/*
 * Copyright 2024-2026 Hamim Alam
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package dev.runner.agent.telegram;

import dev.runner.agent.adk.AgentService;
import dev.runner.agent.config.AgentConfig;
import dev.runner.agent.service.AIConfigService;
import dev.runner.agent.service.ChatService;
import dev.runner.agent.service.SkillService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import org.telegram.telegrambots.client.okhttp.OkHttpTelegramClient;
import org.telegram.telegrambots.longpolling.BotSession;
import org.telegram.telegrambots.longpolling.TelegramBotsLongPollingApplication;
import org.telegram.telegrambots.longpolling.interfaces.LongPollingUpdateConsumer;
import org.telegram.telegrambots.longpolling.util.LongPollingSingleThreadUpdateConsumer;
import org.telegram.telegrambots.meta.api.methods.GetFile;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.methods.send.SendPhoto;
import org.telegram.telegrambots.meta.api.objects.InputFile;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.api.objects.User;
import org.telegram.telegrambots.meta.api.objects.message.Message;
import org.telegram.telegrambots.meta.api.objects.photo.PhotoSize;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import org.telegram.telegrambots.meta.generics.TelegramClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Telegram bot integration using long polling via the official
 * org.telegram:telegrambots library.
 *
 * DB-driven lifecycle: the bot registers and starts polling iff a non-empty
 * botToken is present in the {@code skill_configs} row for "telegram". The
 * token + allowlist are hot-reloaded every 5s so dashboard changes take effect
 * without a restart. We deliberately do NOT implement SpringLongPollingBot so
 * the Spring Boot starter's auto-scan finds zero bots and never calls the
 * Telegram API with an empty token (which would 404 and crash the context);
 * instead we register manually via {@link TelegramBotsLongPollingApplication}
 * once the DB says a token is configured.
 *
 * Auth: allowlist only. Bot token alone does not grant access.
 */
@Slf4j
@Component
public class TelegramBotService implements LongPollingSingleThreadUpdateConsumer {

    private static final long MAX_CHUNK_SIZE = 4000L;

    private final SkillService skillService;
    @Lazy
    private final AgentService agentService;
    private final ChatService chatService;
    private final AgentConfig agentConfig;
    private final TelegramBotsLongPollingApplication botsApplication;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();
    private TelegramClient telegramClient;
    private volatile Set<Long> allowedUserIds;

    // Currently registered bot session (null when no token is configured or
    // registration failed). Guarded by synchronizing on `this` for register/
    // unregister transitions.
    private volatile BotSession session;
    // The token the current session was registered with (null when none).
    // We only re-register when this differs from the DB token, so a transient
    // registration failure doesn't spam the log every 5s; re-saving the token
    // (even the same value) in the dashboard forces a retry.
    private volatile String registeredToken;

    // Per-chat timestamp of the last "Unauthorized" reply. Subsequent rejects
    // within UNAUTH_COOLDOWN_MS are logged only (no reply) to avoid feedback loops.
    private final java.util.concurrent.ConcurrentHashMap<Long, Long> lastUnauthReplyMs = new java.util.concurrent.ConcurrentHashMap<>();
    private static final long UNAUTH_COOLDOWN_MS = 5_000L;

    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "telegram-config-poll");
                t.setDaemon(true);
                return t;
            });

    // Shared scheduler for typing-action refreshes (one per active long-running call).
    private final ScheduledExecutorService typingScheduler =
            Executors.newScheduledThreadPool(2, r -> {
                Thread t = new Thread(r, "telegram-typing");
                t.setDaemon(true);
                return t;
            });

    public TelegramBotService(SkillService skillService,
                              @Lazy AgentService agentService,
                              ChatService chatService,
                              AgentConfig agentConfig,
                              TelegramBotsLongPollingApplication botsApplication) {
        this.skillService = skillService;
        this.agentService = agentService;
        this.chatService = chatService;
        this.agentConfig = agentConfig;
        this.botsApplication = botsApplication;
        log.info("TelegramBotService constructed");
    }

    /**
     * Read the bot token from the persisted skill config. Empty when the
     * telegram skill is not yet configured via the dashboard.
     */
    private String currentBotToken() {
        return skillService.getSkillConfig("telegram")
                .map(c -> Optional.ofNullable(c.get("botToken")).orElse(""))
                .orElse("");
    }

    /**
     * On startup, sync the bot session against the DB and start the 5s
     * hot-reload loop. The DB is the source of truth: a non-empty token
     * registers + starts polling; an empty token keeps the bot idle. Token
     * or allowlist changes in the dashboard take effect within 5s, no restart
     * needed.
     */
    @PostConstruct
    void init() {
        syncSessionAndAllowlist();
        scheduler.scheduleWithFixedDelay(this::syncSessionAndAllowlist, 5, 5, TimeUnit.SECONDS);
    }

    /**
     * DB-driven session lifecycle + allowlist reload. Runs on startup and
     * every 5s. Compares the DB token against the one currently registered;
     * starts/stops/restarts the BotSession to match. Idempotent: if nothing
     * changed, only the allowlist is refreshed.
     */
    private void syncSessionAndAllowlist() {
        String dbToken = currentBotToken();
        try {
            if (!java.util.Objects.equals(dbToken, registeredToken)) {
                // Token changed (set -> unset, unset -> set, or set -> different set).
                if (session != null) {
                    log.info("Telegram token changed ({} -> {}), stopping current bot session",
                            mask(registeredToken), mask(dbToken));
                    try {
                        botsApplication.unregisterBot(registeredToken);
                    } catch (Exception e) {
                        log.warn("Failed to unregister old Telegram bot session: {}", e.getMessage());
                    }
                    session = null;
                    telegramClient = null;
                }
                if (dbToken != null && !dbToken.isBlank()) {
                    try {
                        session = botsApplication.registerBot(dbToken, this);
                        registeredToken = dbToken;
                        synchronized (this) {
                            telegramClient = new OkHttpTelegramClient(dbToken);
                        }
                        log.info("Telegram bot registered, running={}", session.isRunning());
                    } catch (Exception e) {
                        // Mark this token as attempted so we don't retry the identical
                        // token every 5s. Re-saving the token in the dashboard forces a retry.
                        registeredToken = dbToken;
                        session = null;
                        telegramClient = null;
                        log.error("Failed to register Telegram bot (re-save the token in the dashboard to retry): {}", e.getMessage());
                    }
                } else {
                    registeredToken = null;
                    log.info("Telegram bot token not configured in DB; bot is idle");
                }
            }
        } catch (Exception e) {
            log.error("Error syncing Telegram session", e);
        }
        // Always refresh the allowlist so dashboard user-id changes apply live.
        reloadAllowlist();
    }

    @PreDestroy
    void shutdown() {
        scheduler.shutdownNow();
        typingScheduler.shutdownNow();
        BotSession s = session;
        if (s != null) {
            try { s.close(); } catch (Exception e) { log.warn("Error closing Telegram bot session", e); }
        }
    }

    private static String mask(String token) {
        if (token == null || token.isBlank()) return "<empty>";
        // Show only the bot id prefix (everything before the first ':').
        int colon = token.indexOf(':');
        return colon > 0 ? token.substring(0, colon) + ":***" : "***";
    }

    private void reloadAllowlist() {
        try {
            Optional<Map<String, String>> cfg = skillService.getSkillConfig("telegram");
            if (cfg.isEmpty()) {
                allowedUserIds = null;
                return;
            }
            String csv = cfg.get().get("allowedUserIds");
            if (csv == null || csv.isBlank()) {
                allowedUserIds = null;
                return;
            }
            allowedUserIds = parseAllowedUserIds(csv);
        } catch (Exception e) {
            log.error("Failed to reload Telegram allowlist", e);
        }
    }

    private static Set<Long> parseAllowedUserIds(String csv) {
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(s -> {
                    try {
                        return Long.parseLong(s);
                    } catch (NumberFormatException e) {
                        log.warn("Skipping invalid telegram user id: {}", s);
                        return null;
                    }
                })
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(HashSet::new));
    }

    @Override
    public void consume(Update update) {
        long chatId = 0L;
        try {
            if (update == null || !update.hasMessage()) return;
            Message message = update.getMessage();
            if (message == null) return;
            if (!message.hasText() && !message.hasPhoto()) return;

            User from = message.getFrom();
            if (from == null) return;
            // Drop messages from any bot (including our own echoes).
            if (from.getIsBot()) return;

            long userId = from.getId();
            chatId = message.getChatId();

            if (!isAllowed(userId)) {
                // First rejection in the cooldown window: reply. Subsequent ones
                // within UNAUTH_COOLDOWN_MS are logged only to avoid feedback loops.
                long now = System.currentTimeMillis();
                long last = lastUnauthReplyMs.getOrDefault(chatId, 0L);
                if (now - last > UNAUTH_COOLDOWN_MS) {
                    lastUnauthReplyMs.put(chatId, now);
                    log.warn("telegram unauthorized user_id={} chat_id={} - sending reply", userId, chatId);
                    try {
                        sendMessage(chatId, "⛔ Unauthorized. Your user id (" + userId + ") is not in the allowlist.");
                    } catch (Exception sendEx) {
                        log.error("Failed to send unauthorized reply: {}", sendEx.getMessage());
                    }
                } else {
                    log.debug("telegram unauthorized user_id={} chat_id={} (cooldown, no reply)", userId, chatId);
                }
                return;
            }

            String sessionId = "telegram-" + chatId;
            String response;
            if (message.hasPhoto()) {
                log.info("telegram photo user_id={} chat_id={}", userId, chatId);
                try (TypingIndicator typing = new TypingIndicator(chatId)) {
                    response = handlePhoto(sessionId, message);
                }
            } else {
                String text = message.getText().trim();
                if (text.isEmpty()) return;
                log.info("telegram message user_id={} chat_id={} length={}", userId, chatId, text.length());

                String commandResponse = dispatchCommand(text, sessionId);
                // Slash commands are instant; only show typing while waiting on the agent.
                if (commandResponse == null) {
                    try (TypingIndicator typing = new TypingIndicator(chatId)) {
                        response = runAgent(sessionId, text);
                    }
                } else {
                    response = commandResponse;
                }
            }
            if (response != null && !response.isBlank()) {
                sendMessage(chatId, response);
            }
        } catch (Exception e) {
            log.error("Error handling Telegram update", e);
            // Try to inform the user on chat-level errors (network blips, agent crashes, etc.)
            if (chatId != 0L) {
                try {
                    sendMessage(chatId, "⚠️ Error processing your message: " + truncate(e.getMessage(), 400));
                } catch (Exception sendEx) {
                    log.error("Failed to send error reply: {}", sendEx.getMessage());
                }
            }
        }
    }

    /**
     * Download the largest photo size from the Telegram message into working dir,
     * then dispatch to the agent with the on-disk path.
     */
    private String handlePhoto(String sessionId, Message message) {
        List<PhotoSize> photos = message.getPhoto();
        if (photos == null || photos.isEmpty()) return "Photo metadata unavailable.";
        PhotoSize largest = photos.stream()
                .filter(p -> p.getFileSize() != null)
                .max(Comparator.comparingInt(PhotoSize::getFileSize))
                .orElse(photos.get(photos.size() - 1));
        String fileId = largest.getFileId();
        String fileUniqueId = largest.getFileUniqueId();

        TelegramClient client = ensureClient();
        if (client == null) return "Bot is not connected.";

        org.telegram.telegrambots.meta.api.objects.File file;
        try {
            file = client.execute(GetFile.builder().fileId(fileId).build());
        } catch (TelegramApiException e) {
            log.error("GetFile failed: {}", e.getMessage());
            return "Failed to fetch photo: " + truncate(e.getMessage(), 200);
        }
        String filePath = file.getFilePath();
        if (filePath == null || filePath.isBlank()) {
            return "Photo file path unavailable.";
        }

        String token = currentBotToken();
        if (token.isBlank()) return "Bot token missing.";
        String downloadUrl = org.telegram.telegrambots.meta.api.objects.File.getFileUrl(token, filePath);

        Path savedPath;
        try {
            savedPath = downloadPhoto(downloadUrl, fileUniqueId);
        } catch (IOException e) {
            log.error("Failed to download photo: {}", e.getMessage());
            return "Failed to download photo: " + truncate(e.getMessage(), 200);
        }

        String caption = message.hasCaption() ? message.getCaption() : "";
        String mime = sniffMime(savedPath);
        if (mime == null) {
            return "Image saved to " + savedPath + " but the format wasn't recognized as an image. Please send it as JPEG/PNG/GIF.";
        }
        String prompt;
        if (caption.isBlank()) {
            prompt = "The user sent you an image (no caption). Look at it carefully and describe what you see in detail, including any visible text, objects, or notable features.";
        } else {
            prompt = "The user sent this image with this caption: \"" + caption + "\"\n\nLook at the image and respond to the caption's request.";
        }
        try {
            AgentService.ChatResult result = runAgentWithTimeout(sessionId, prompt, true, savedPath, mime);
            return result.response();
        } catch (Exception e) {
            log.error("chatWithImage failed: {}", e.getMessage());
            return "Failed to process image: " + truncate(e.getMessage(), 200);
        }
    }

    private String sniffMime(Path path) {
        try (java.io.InputStream in = Files.newInputStream(path)) {
            byte[] head = in.readNBytes(16);
            if (head.length >= 3
                    && (head[0] & 0xFF) == 0xFF
                    && (head[1] & 0xFF) == 0xD8
                    && (head[2] & 0xFF) == 0xFF) {
                return "image/jpeg";
            }
            if (head.length >= 8
                    && (head[0] & 0xFF) == 0x89
                    && head[1] == 'P' && head[2] == 'N' && head[3] == 'G'
                    && head[4] == 0x0D && head[5] == 0x0A && head[6] == 0x1A && head[7] == 0x0A) {
                return "image/png";
            }
            if (head.length >= 6
                    && head[0] == 'G' && head[1] == 'I' && head[2] == 'F' && head[3] == '8'
                    && (head[4] == '7' || head[4] == '9') && head[5] == 'a') {
                return "image/gif";
            }
            if (head.length >= 12
                    && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                    && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') {
                return "image/webp";
            }
            if (head.length >= 2 && head[0] == 'B' && head[1] == 'M') {
                return "image/bmp";
            }
            return null;
        } catch (IOException e) {
            return null;
        }
    }

    private static String mimeToExtension(String mime) {
        return switch (mime) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            case "image/bmp" -> ".bmp";
            default -> null;
        };
    }

    private Path downloadPhoto(String url, String fileUniqueId) throws IOException {
        Path dir = Paths.get(agentConfig.getWorkingDir(), "telegram");
        Files.createDirectories(dir);
        // Download to a stable temp name first; we rename once we've sniffed the magic bytes.
        Path temp = dir.resolve(fileUniqueId + ".bin");
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .GET().build();
        try {
            HttpResponse<java.nio.file.Path> resp = httpClient.send(req,
                    HttpResponse.BodyHandlers.ofFile(temp));
            if (resp.statusCode() / 100 != 2) {
                throw new IOException("HTTP " + resp.statusCode() + " downloading photo");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupted downloading photo", e);
        }
        String mime = sniffMime(temp);
        if (mime == null) return temp;
        String ext = mimeToExtension(mime);
        if (ext == null) return temp;
        Path renamed = dir.resolve(fileUniqueId + ext);
        try {
            return Files.move(temp, renamed, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (java.nio.file.AtomicMoveNotSupportedException e) {
            return Files.move(temp, renamed, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private boolean isAllowed(long userId) {
        Set<Long> allowed = allowedUserIds;
        return allowed != null && allowed.contains(userId);
    }

    private String dispatchCommand(String text, String sessionId) {
        if (!text.startsWith("/")) return null;
        String[] parts = text.split("\\s+", 2);
        String cmd = parts[0].toLowerCase();
        switch (cmd) {
            case "/help":
                return """
                        *Telegram Bot Commands*

                        /help - show this message
                        /status - show current AI provider/model
                        /skills - list available skills
                        /new - reset the chat session
                        /history - show last 20 messages
                        <anything else> - chat with the agent""";
            case "/status": {
                AIConfigService.AIProviderConfig cfg = agentService.getCurrentConfig();
                return String.format("AI provider: %s\nModel: %s",
                        cfg.getProvider(),
                        cfg.isOllama() ? cfg.getOllamaModel() : cfg.getGeminiModel());
            }
            case "/skills": {
                StringBuilder sb = new StringBuilder("Available skills:\n");
                skillService.getVisibleSkills().forEach(s -> sb.append("- ")
                        .append(s.getDisplayName()).append("\n"));
                return sb.toString();
            }
            case "/new":
                agentService.clearSession(sessionId);
                return "Session reset.";
            case "/history": {
                StringBuilder sb = new StringBuilder("Last messages:\n");
                chatService.getSessionHistory(sessionId, 20).forEach(m ->
                        sb.append(m.getRole()).append(": ")
                                .append(truncate(m.getContent(), 200))
                                .append("\n"));
                return sb.toString();
            }
            default:
                return null;
        }
    }

    private String runAgent(String sessionId, String text) {
        try {
            AgentService.ChatResult result = runAgentWithTimeout(sessionId, text, false, null, null);
            return result.response();
        } catch (Exception e) {
            log.error("Telegram agent error: {}", e.getMessage(), e);
            return "Error: " + truncate(e.getMessage(), 500);
        }
    }

    /**
     * Run the agent with a wall-clock timeout. AGENT_TIMEOUT_MS caps the LLM/tool loop
     * so runaway recursions (e.g. agent stuck calling OCR/color tools on an image it
     * could just describe) don't pin a chat forever.
     */
    private static final long AGENT_TIMEOUT_MS = 60_000L;

    private AgentService.ChatResult runAgentWithTimeout(String sessionId, String text,
                                                        boolean withImage, Path imagePath, String mime) {
        java.util.concurrent.CompletableFuture<AgentService.ChatResult> fut =
                java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                    try {
                        return withImage
                                ? agentService.chatWithImage(sessionId, text, imagePath, mime, null)
                                : agentService.chat(sessionId, text, null);
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    }
                });
        try {
            return fut.get(AGENT_TIMEOUT_MS, java.util.concurrent.TimeUnit.MILLISECONDS);
        } catch (java.util.concurrent.TimeoutException e) {
            fut.cancel(true);
            // Clear the session so the next message starts fresh and isn't tainted by the timed-out run.
            try {
                agentService.clearSession(sessionId);
            } catch (Exception clear) {
                log.warn("Failed to clear session after timeout: {}", clear.getMessage());
            }
            throw new RuntimeException("Agent timed out after " + (AGENT_TIMEOUT_MS / 1000) + "s");
        } catch (Exception e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            throw new RuntimeException(cause);
        }
    }

    /**
     * Send a message to a chat, chunked at MAX_CHUNK_SIZE chars.
     * Renders Markdown to Telegram MarkdownV2; on parse error retries as plain text.
     */
    public void sendMessage(long chatId, String text) {
        if (text == null || text.isEmpty()) return;
        TelegramClient client = ensureClient();
        if (client == null) return;
        for (int i = 0; i < text.length(); i += MAX_CHUNK_SIZE) {
            int end = (int) Math.min((long) i + MAX_CHUNK_SIZE, (long) text.length());
            String chunk = text.substring(i, end);
            sendChunk(client, chatId, chunk);
        }
    }

    /**
     * Send a photo to a chat. Caption is optional and capped at 1024 chars.
     * Plain text caption (no parse_mode) to avoid escaping issues.
     */
    public void sendPhoto(long chatId, byte[] data, String caption) {
        if (data == null || data.length == 0) return;
        TelegramClient client = ensureClient();
        if (client == null) return;
        String safeCaption = caption == null ? null : truncate(caption, 1024);
        try (ByteArrayInputStream in = new ByteArrayInputStream(data)) {
            client.execute(SendPhoto.builder()
                    .chatId(String.valueOf(chatId))
                    .photo(new InputFile(in, "image.jpg"))
                    .caption(safeCaption)
                    .build());
        } catch (TelegramApiException e) {
            log.error("Telegram sendPhoto failed: {}", e.getMessage(), e);
        } catch (IOException e) {
            log.error("Failed to close photo stream: {}", e.getMessage());
        }
    }

    /** Fetch bytes from a URL using the bot's shared HttpClient. */
    public byte[] fetchUrl(String url) throws IOException {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .GET().build();
        try {
            HttpResponse<byte[]> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() / 100 != 2) {
                throw new IOException("HTTP " + resp.statusCode() + " fetching " + url);
            }
            return resp.body();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupted fetching " + url, e);
        }
    }

    private void sendChunk(TelegramClient client, long chatId, String chunk) {
        String md2 = toTelegramMarkdownV2(chunk);
        try {
            client.execute(SendMessage.builder()
                    .chatId(String.valueOf(chatId))
                    .text(md2)
                    .parseMode("MarkdownV2")
                    .build());
        } catch (TelegramApiException e) {
            // Parse error (likely a chunk boundary split a tag) — fall back to plain text.
            log.debug("MarkdownV2 send failed, falling back to plain text: {}", e.getMessage());
            try {
                client.execute(SendMessage.builder()
                        .chatId(String.valueOf(chatId))
                        .text(chunk)
                        .build());
            } catch (TelegramApiException ex) {
                log.error("Telegram sendMessage failed: {}", ex.getMessage(), ex);
            }
        }
    }

    /**
     * Markdown -> Telegram MarkdownV2 converter.
     * Supported input syntax (matches Telegram's subset):
     *   **bold**  -> *bold*
     *   *italic*  -> _italic_
     *   ~~strike~~ -> ~strike~
     *   ||spoiler|| -> ||spoiler||
     *   `inline code` (no escape)
     *   ```code block``` (no escape)
     *   [text](url) -> [text](url)
     *   # H1 / ## H2 / ### H3
     *   - item bullet
     * Outside of formatting regions, MarkdownV2 reserved chars are escaped with \.
     */
    static String toTelegramMarkdownV2(String md) {
        if (md == null || md.isEmpty()) return "";
        // MarkdownV2 reserved chars that must be escaped outside formatting entities.
        String reserved = "_*[]()~`>#+-=|{}.!";
        StringBuilder out = new StringBuilder(md.length() + 64);
        int i = 0;
        int n = md.length();
        while (i < n) {
            // Code block ```...```
            if (i + 2 < n && md.charAt(i) == '`' && md.charAt(i + 1) == '`' && md.charAt(i + 2) == '`') {
                int end = md.indexOf("```", i + 3);
                if (end < 0) {
                    out.append(escapeMd2(md.substring(i), reserved));
                    break;
                }
                out.append("```");
                String code = md.substring(i + 3, end);
                int nl = code.indexOf('\n');
                if (nl >= 0 && nl <= 20) {
                    String first = code.substring(0, nl).trim();
                    if (first.matches("[a-zA-Z0-9+#\\-.]+")) {
                        out.append(first).append('\n');
                        code = code.substring(nl + 1);
                    }
                }
                out.append(code);
                out.append("```");
                i = end + 3;
                continue;
            }
            // Inline code `...`
            if (md.charAt(i) == '`') {
                int end = md.indexOf('`', i + 1);
                if (end < 0) end = n;
                out.append('`').append(md, i + 1, end).append('`');
                i = (end < n) ? end + 1 : n;
                continue;
            }
            // Bold **...** -> *...*
            if (i + 1 < n && md.charAt(i) == '*' && md.charAt(i + 1) == '*') {
                int end = md.indexOf("**", i + 2);
                if (end < 0) {
                    out.append(escapeMd2(md.substring(i), reserved));
                    break;
                }
                out.append('*').append(escapeMd2(md.substring(i + 2, end), reserved)).append('*');
                i = end + 2;
                continue;
            }
            // Italic *...* -> _..._
            if (md.charAt(i) == '*') {
                int end = md.indexOf('*', i + 1);
                if (end < 0) end = n;
                out.append('_').append(escapeMd2(md.substring(i + 1, end), reserved)).append('_');
                i = (end < n) ? end + 1 : n;
                continue;
            }
            // Strikethrough ~~...~~ -> ~...~
            if (i + 1 < n && md.charAt(i) == '~' && md.charAt(i + 1) == '~') {
                int end = md.indexOf("~~", i + 2);
                if (end < 0) {
                    out.append(escapeMd2(md.substring(i), reserved));
                    break;
                }
                out.append('~').append(escapeMd2(md.substring(i + 2, end), reserved)).append('~');
                i = end + 2;
                continue;
            }
            // Spoiler ||...|| -> ||...|| (reserved '|' chars must be escaped inside)
            if (i + 1 < n && md.charAt(i) == '|' && md.charAt(i + 1) == '|') {
                int end = md.indexOf("||", i + 2);
                if (end < 0) {
                    out.append(escapeMd2(md.substring(i), reserved));
                    break;
                }
                out.append("||").append(escapeMd2(md.substring(i + 2, end), reserved)).append("||");
                i = end + 2;
                continue;
            }
            // Link [text](url) -> [text](url) (escape inside text, escape inside url)
            if (md.charAt(i) == '[') {
                int closeText = md.indexOf(']', i + 1);
                int openUrl = closeText >= 0 ? closeText + 1 : -1;
                if (closeText >= 0 && openUrl < n && md.charAt(openUrl) == '(') {
                    int closeUrl = md.indexOf(')', openUrl + 1);
                    if (closeUrl >= 0) {
                        String text = md.substring(i + 1, closeText);
                        String url = md.substring(openUrl + 1, closeUrl);
                        out.append('[').append(escapeMd2(text, reserved)).append("](")
                                .append(escapeMd2(url, reserved)).append(')');
                        i = closeUrl + 1;
                        continue;
                    }
                }
                out.append(escapeMd2("[", reserved));
                i++;
                continue;
            }
            // Headings: # H1, ## H2, ### H3 (only at line start)
            if (md.charAt(i) == '#' && (i == 0 || md.charAt(i - 1) == '\n')) {
                int j = i;
                int level = 0;
                while (j < n && md.charAt(j) == '#' && level < 3) {
                    j++; level++;
                }
                if (level > 0 && j < n && md.charAt(j) == ' ') {
                    out.append("*");
                    int eol = md.indexOf('\n', j + 1);
                    if (eol < 0) eol = n;
                    out.append(escapeMd2(md.substring(j + 1, eol), reserved));
                    out.append("*");
                    i = eol;
                    continue;
                }
            }
            // Bullet list: "- " or "* " or "+ " at line start
            if ((md.charAt(i) == '-' || md.charAt(i) == '*' || md.charAt(i) == '+')
                    && (i == 0 || md.charAt(i - 1) == '\n')
                    && i + 1 < n && md.charAt(i + 1) == ' ') {
                int eol = md.indexOf('\n', i + 1);
                if (eol < 0) eol = n;
                out.append(escapeMd2(md.substring(i, eol), reserved));
                i = eol;
                continue;
            }
            // Default: copy char, escaping reserved
            out.append(escapeMd2(String.valueOf(md.charAt(i)), reserved));
            i++;
        }
        return out.toString();
    }

    private static String escapeMd2(String s, String reserved) {
        if (s == null || s.isEmpty()) return "";
        StringBuilder b = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (reserved.indexOf(c) >= 0) {
                b.append('\\');
            }
            b.append(c);
        }
        return b.toString();
    }

    private synchronized TelegramClient ensureClient() {
        if (telegramClient == null) {
            String token = currentBotToken();
            if (token == null || token.isBlank()) return null;
            telegramClient = new OkHttpTelegramClient(token);
        }
        return telegramClient;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }

    public boolean isConnected() {
        return telegramClient != null;
    }

    /**
     * Show "typing..." chat action repeatedly while a long-running call is in flight.
     * Telegram typing actions expire after 5s, so we re-send every 4s.
     */
    private final class TypingIndicator implements AutoCloseable {
        private static final long TYPING_REFRESH_MS = 4_000L;
        private final java.util.concurrent.ScheduledFuture<?> task;
        private volatile boolean stopped = false;

        TypingIndicator(long chatId) {
            sendTyping(chatId);
            this.task = typingScheduler.scheduleAtFixedRate(
                    () -> { if (!stopped) sendTyping(chatId); },
                    TYPING_REFRESH_MS, TYPING_REFRESH_MS, java.util.concurrent.TimeUnit.MILLISECONDS);
        }

        void stop() {
            stopped = true;
            if (task != null) task.cancel(false);
        }

        @Override
        public void close() { stop(); }
    }

    private void sendTyping(long chatId) {
        try {
            TelegramClient client = ensureClient();
            if (client == null) return;
            client.execute(org.telegram.telegrambots.meta.api.methods.send.SendChatAction.builder()
                    .chatId(String.valueOf(chatId))
                    .action("typing")
                    .build());
        } catch (Exception e) {
            log.debug("sendTyping failed: {}", e.getMessage());
        }
    }
}
