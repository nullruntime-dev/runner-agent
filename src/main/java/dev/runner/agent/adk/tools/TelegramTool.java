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
package dev.runner.agent.adk.tools;

import com.google.adk.tools.Annotations.Schema;
import dev.runner.agent.telegram.TelegramBotService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * ADK tool that lets the agent send messages via Telegram.
 * Read-only access to the bot config; delegates actual send to {@link TelegramBotService}.
 * Uses ObjectProvider so the app still boots when telegram.enabled=false (the
 * TelegramBotService bean is absent in that case).
 */
@Slf4j
@Component
public class TelegramTool {

    private final ObjectProvider<TelegramBotService> telegramBotServiceProvider;
    private final dev.runner.agent.service.SkillService skillService;

    public TelegramTool(ObjectProvider<TelegramBotService> telegramBotServiceProvider,
                        dev.runner.agent.service.SkillService skillService) {
        this.telegramBotServiceProvider = telegramBotServiceProvider;
        this.skillService = skillService;
        log.info("TelegramTool initialized (telegram.enabled={})",
                telegramBotServiceProvider.getIfAvailable() != null ? "true" : "false");
    }

    private TelegramBotService bot() {
        return telegramBotServiceProvider.getIfAvailable();
    }

    private boolean isConfigured() {
        // Trust the actual bot session state, not the DB row. The Spring
        // telegrambots starter registers the BotSession at startup and does
        // NOT unregister it when the skill_configs row is later disabled or
        // deleted - so a running bot with a disabled row would otherwise make
        // this check return false and every send_telegram_message call fail
        // with "Telegram is not configured" even though the bot is live.
        TelegramBotService b = bot();
        return b != null && b.isConnected();
    }

    /**
     * Resolve the chat_id to use: explicit arg first, else configured defaultChatId.
     * Returns null if neither is available.
     */
    private String resolveChatId(String chatIdArg) {
        if (chatIdArg != null && !chatIdArg.isBlank()) {
            return chatIdArg;
        }
        Optional<java.util.Map<String, String>> cfg = skillService.getSkillConfig("telegram");
        if (cfg.isPresent()) {
            String def = cfg.get().get("defaultChatId");
            if (def != null && !def.isBlank()) {
                return def;
            }
        }
        return null;
    }

    @Schema(name = "send_telegram_message",
            description = "Send a message to a Telegram chat by chat id. Use this to notify on Telegram about deployments, execution results, or any important updates. Returns error if Telegram is not configured.")
    public Map<String, Object> sendMessage(
            @Schema(name = "chat_id", description = "Telegram chat id (numeric) of the recipient. Optional — if omitted, falls back to the configured defaultChatId. The user must already be in the agent's allowlist.", optional = true) String chatId,
            @Schema(name = "message", description = "The message text to send. Plain text only.") String message
    ) {
        log.info("ADK tool: send_telegram_message chat_id={} length={}", chatId, message == null ? 0 : message.length());

        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Telegram is not configured. Please configure Telegram in the agent settings.");
            return result;
        }

        if (message == null || message.isBlank()) {
            result.put("success", false);
            result.put("error", "message is required");
            return result;
        }

        String resolvedChatId = resolveChatId(chatId);
        if (resolvedChatId == null) {
            result.put("success", false);
            result.put("error", "chat_id is required and no defaultChatId is configured");
            return result;
        }

        long parsedChatId;
        try {
            parsedChatId = Long.parseLong(resolvedChatId.trim());
        } catch (NumberFormatException e) {
            result.put("success", false);
            result.put("error", "chat_id must be numeric");
            return result;
        }

        try {
            TelegramBotService b = bot();
            if (b == null || !b.isConnected()) {
                result.put("success", false);
                result.put("error", "Telegram bot is not running");
                return result;
            }
            b.sendMessage(parsedChatId, message);
            result.put("success", true);
            result.put("message", "Message sent to Telegram");
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Failed to send Telegram message: " + e.getMessage());
            log.error("Failed to send Telegram message", e);
        }
        return result;
    }

    @Schema(name = "send_telegram_photo",
            description = "Send a photo to a Telegram chat by chat id. The image is downloaded from the given URL and uploaded to Telegram. Use this to share screenshots, generated images, or any visual artifact with the user. Telegram bot upload limit is 50MB.")
    public Map<String, Object> sendPhoto(
            @Schema(name = "chat_id", description = "Telegram chat id (numeric) of the recipient. Optional — if omitted, falls back to the configured defaultChatId.", optional = true) String chatId,
            @Schema(name = "url", description = "HTTP(S) URL of the image to download and send. Telegram will not fetch URLs directly — this tool downloads the bytes and uploads them.") String url,
            @Schema(name = "caption", description = "Optional caption (plain text, max 1024 chars).", optional = true) String caption
    ) {
        log.info("ADK tool: send_telegram_photo chat_id={} url={}", chatId, url);

        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Telegram is not configured.");
            return result;
        }
        if (url == null || url.isBlank()) {
            result.put("success", false);
            result.put("error", "url is required");
            return result;
        }

        String resolvedChatId = resolveChatId(chatId);
        if (resolvedChatId == null) {
            result.put("success", false);
            result.put("error", "chat_id is required and no defaultChatId is configured");
            return result;
        }

        long parsedChatId;
        try {
            parsedChatId = Long.parseLong(resolvedChatId.trim());
        } catch (NumberFormatException e) {
            result.put("success", false);
            result.put("error", "chat_id must be numeric");
            return result;
        }

        try {
            TelegramBotService b = bot();
            if (b == null || !b.isConnected()) {
                result.put("success", false);
                result.put("error", "Telegram bot is not running");
                return result;
            }
            byte[] data = b.fetchUrl(url);
            if (data == null || data.length == 0) {
                result.put("success", false);
                result.put("error", "Downloaded image is empty");
                return result;
            }
            b.sendPhoto(parsedChatId, data, caption);
            result.put("success", true);
            result.put("message", "Photo sent to Telegram");
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Failed to send Telegram photo: " + e.getMessage());
            log.error("Failed to send Telegram photo", e);
        }
        return result;
    }

    @Schema(name = "list_allowed_telegram_chats",
            description = "List the Telegram chat IDs (numeric user IDs) that are allowed to interact with this bot. ALWAYS call this when you need to send a Telegram message but don't know the chat_id — it returns the configured allowlist from the skill config. Returns error if Telegram is not configured.")
    public Map<String, Object> listAllowedChats() {
        Map<String, Object> result = new HashMap<>();
        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Telegram is not configured");
            return result;
        }
        Optional<java.util.Map<String, String>> cfg = skillService.getSkillConfig("telegram");
        if (cfg.isEmpty()) {
            result.put("success", false);
            result.put("error", "Telegram is not configured");
            return result;
        }
        String csv = cfg.get().getOrDefault("allowedUserIds", "");
        java.util.List<String> ids = new java.util.ArrayList<>();
        for (String s : csv.split(",")) {
            String t = s.trim();
            if (!t.isEmpty()) ids.add(t);
        }
        result.put("success", true);
        result.put("chat_ids", ids);
        result.put("count", ids.size());
        result.put("hint", "Use one of these chat_ids with send_telegram_message. Do not ask the user for their chat_id — these are the only IDs the bot can reach.");
        return result;
    }
}
