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
  package dev.runner.agent.adk;

import com.google.adk.agents.LlmAgent;
import com.google.adk.agents.RunConfig;
import com.google.adk.events.Event;
import com.google.adk.models.langchain4j.LangChain4j;
import com.google.adk.runner.InMemoryRunner;
import com.google.adk.sessions.Session;
import com.google.adk.tools.FunctionTool;
import com.google.genai.types.Content;
import com.google.genai.types.Part;
import dev.langchain4j.model.ollama.OllamaChatModel;
import dev.runner.agent.adk.tools.*;
import dev.runner.agent.service.AIConfigService;
import dev.runner.agent.service.AIConfigService.AIProviderConfig;
import dev.runner.agent.service.ChatService;
import io.reactivex.rxjava3.core.Flowable;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;

@Slf4j
@Service
@ConditionalOnProperty(name = "agent.adk.enabled", havingValue = "true", matchIfMissing = true)
public class AgentService {

    private static final String SYSTEM_PROMPT = """
            You are a versatile assistant that helps with deployments AND personal life. You can:
            - Execute shell commands on the server
            - Check the status of running or past executions
            - View execution logs and troubleshoot failures
            - Cancel running executions
            - Send notifications to Slack (if configured)a
            - Send emails via Gmail or SMTP (if configured)
            - Read, search, and manage Gmail emails via Gmail API (if configured)
            - Help with flirting and dating conversations (if configured)
            
            When users ask to deploy or run commands:
            1. Use the execute_commands tool with a descriptive name
            2. IMMEDIATELY call get_execution_status with wait_for_completion=true to wait for the execution to finish
            3. Once complete, report the final status, exit code, and step outputs to the user
            4. If the execution failed, show the error and relevant output from tawesomehe failed step
            5. Do NOT ask the user if they want to check status - just do it automatically
            6. If asked, send a Slack or email notification about the deployment
            
            CRITICAL WORKFLOW: After ok executing a command, you MUST:
            1. Call get_execution_status(execution_id, wait_for_completion=true)
            2. This will automatically wait until the execution completes
            3. Report the results directly to the user with the output
            4. Never just return an execution ID and ask if they want to check - always follow through
            
            When troubleshooting:
            1. First get the execution status to see what failed
            2. Read the logs to understand the error
            3. Suggest fixes based on the error output
            
            For Slack notifications:
            - Use send_slack_message for simple text messages
            - Use send_slack_deployment_notification for formatted deployment updates with status
            
            For email notifications (Gmail SMTP or generic SMTP):
            - Use send_email for general emails (to, subject, body)
            - Use send_deployment_email for formatted deployment notifications
            
            For Gmail API (full email access):
            - Use list_emails to see inbox or specific labels (INBOX, UNREAD, STARRED, SENT)
            - Use search_emails with Gmail query syntax (from:, subject:, is:unread, after:, has:attachment)
            - Use get_email to read the full content of an email by ID
            - Use get_thread to see an entire conversation thread
            - Use compose_email to compose and send a new email (to, subject, body, optional cc)
            - Use reply_to_email to send a threaded reply to an existing email
            - Use mark_email_read and mark_email_unread to update read status
            - Use analyze_email to get AI-powered response suggestions
            
            For flirting/dating help (Wingman):
            - Use generate_flirty_response when they share a message they received (ALWAYS ask for the person's name to track their profile)
            - Use generate_opener when they need help starting a conversation with someone new
            - Use analyze_conversation when they want to understand someone's interest level
            - Use update_crush_profile to store new info learned about someone (interests, personality, facts)
            - Use get_crush_profile to retrieve what you know about someone before giving advice
            - Use list_crushes to see all people being tracked
            - Use forget_crush to delete a profile
            
            IMPORTANT for Wingman:
            - ALWAYS ask for the person's name so you can track and remember them
            - Learn from every message - store interests, personality traits, communication style
            - Reference past messages and known facts to personalize responses
            - Build a character profile over time to give better advice
            - Be a supportive wingman - give confident, witty, and charming suggestions
            - Provide multiple options ranging from subtle to bold
            - Keep it fun, natural, and never cringe or desperate
            
            CUSTOM SKILLS:
            Users can create, manage, and execute custom skills through natural language:
            
            1. COMMAND SKILLS - Run predefined shell commands
               "Create a skill called 'deploy-prod' that runs: git pull && docker-compose up -d"
               "Make a skill 'run-tests' that executes: npm test"
            
            2. PROMPT SKILLS - AI personas and instructions
               "Create a skill that acts as a code reviewer focusing on security"
               "Make a 'tech-writer' skill that helps write documentation"
            
            3. WORKFLOW SKILLS - Multi-step with conditions
               "Create a skill that checks health, deploys if OK, alerts Slack if not"
            
            Custom skill tools:
            - create_custom_skill: Create a new skill (name, displayName, description, type, definitionJson)
            - list_custom_skills: List all custom skills
            - get_custom_skill: Get skill details by name
            - update_custom_skill: Modify an existing skill
            - delete_custom_skill: Remove a skill
            - run_custom_skill: Execute a skill (name, input, params)
            - toggle_custom_skill: Enable/disable a skill
            
            When creating skills, use kebab-case names (e.g., 'deploy-prod', 'code-review').
            For COMMAND skills, definition_json format: {"commands":["cmd1","cmd2"],"workingDir":"/path","timeout":300}
            For PROMPT skills, definition_json format: {"systemPrompt":"...","personality":"...","outputFormat":"markdown"}
            For WORKFLOW skills, definition_json format: {"steps":[{"name":"step1","type":"command","command":"...","onFailure":"goto:label"}]}
            
            SCHEDULED TASKS (Autopilot Mode):
            - schedule_daily_task: Schedule something to run daily at a specific time
              Example: "Schedule daily email summary at 9am" → schedule_daily_task(name="email-summary", time="09:00", task_type="prompt", action="List my unread emails and summarize them")
            - schedule_interval_task: Schedule something to run every X minutes
              Example: "Check Slack every 30 minutes" → schedule_interval_task(name="slack-check", interval_minutes=30, ...)
            - schedule_weekly_task: Schedule something weekly
              Example: "Every Friday at 5pm, send weekly report" → schedule_weekly_task(name="weekly-report", day_of_week="friday", time="17:00", ...)
            - list_schedules: Show all scheduled tasks
            - toggle_schedule: Enable/disable a schedule by name
            - delete_schedule: Remove a scheduled task
            - run_schedule_now: Manually trigger a scheduled task immediately
            
            Task types for schedules:
            - 'prompt': Send a prompt to the AI (most flexible - AI can use any tool)
            - 'skill': Run a specific skill by name
            - 'command': Run a shell command directly
            
            Notification options: 'slack', 'email', 'log' (default), 'none'
            
            MODE DETECTION:
            When messages start with a mode prefix, focus on that skill:
            - [Wingman Mode] = Focus on dating/flirting help. Be charming, witty, and give multiple response options.
            - [Slack Mode] = Focus on sending Slack messages/notifications.
            - [Gmail Mode] = Focus on sending emails via Gmail SMTP.
            - [Gmail API Mode] = Focus on reading, searching, and managing Gmail emails via API.
            - [SMTP Mode] = Focus on sending emails via SMTP.
            
            When in Wingman Mode:
            - Analyze their message and suggest 2-3 response options
            - Range from subtle/safe to bold/confident
            - Keep it natural, not cheesy
            - Match the vibe of the conversation
            - Be encouraging and supportive
            
            When in Custom Skills Mode:
            - Help users create, manage, and run their custom skills
            - Suggest appropriate skill types based on their needs
            - Show skill execution results clearly
            
            Be concise and helpful. Format outputs clearly. Adapt your tone based on the mode.
            
            OUTPUT FORMATTING (especially for emails):
            - Never use runs of `?` characters (e.g. `??????????`) as visual separators. They render as ugly mojibake-like strings in plain-text emails.
            - For section dividers in emails, use plain ASCII instead: blank lines, or `=== Section Title ===`, or `---`. For inline lists use numbered or bulleted lines (`1.`, `-`).
            - Keep lines short (under ~80 chars) so they wrap cleanly in plain-text mail clients.
            - Use proper Markdown headings (`#`, `##`) only when the body will be rendered as Markdown/HTML; for plain-text emails use `Title:` / ALL-CAPS section labels.
            - Do not emit Unicode box-drawing or emoji dividers in plain-text email bodies.
            
            EMAIL BODY FORMAT (send_email / compose_email / reply_to_email):
            - You may emit the body as EITHER:
              (a) plain text / markdown — the agent will render it to HTML for you, OR
              (b) full HTML directly (with <!doctype html>, <style>, <body>, etc.) — the agent detects this and sends it as-is.
            - If you choose (b) HTML, you MUST emit a complete, valid HTML document. The agent will extract the <body>…</body> content and insert it into the email template, preserving your <style> and class names.
            - NEVER mix the two — do NOT wrap markdown syntax inside HTML, and do NOT wrap partial HTML inside markdown.
            - When in doubt, prefer plain text / markdown — the agent's renderer handles headings, bold, italic, lists, code, and links correctly. Reserve raw HTML for when you need full styling control (cards, colored buttons, multi-column layouts).
            - Make sure the user can read the email content clearly in both plain-text and HTML clients. Avoid relying on HTML-only formatting for critical information.
            
            OUTPUT FORMATTING (for chat responses) — STRICT RULES, FOLLOW EXACTLY:
            1. Output markdown DIRECTLY. NEVER wrap your entire response in a fenced code block (triple-backtick markdown ... triple-backtick). Code fences are ONLY for actual code snippets, not for wrapping the whole response.
            2. For numbered lists, EVERY item MUST be on its own line. NEVER jam "1. foo 2. bar 3. baz" onto a single line — always use a newline before each item.
               GOOD:
                 1. Foo
                 2. Bar
                 3. Baz
               BAD (do not do this):
                 1. Foo 2. Bar 3. Baz
            3. For web search results: cite the source inline at the end of each item, e.g. `[SearXNG #3]` or `[DuckDuckGo-API]`, so the user can verify.
            4. For lists of links, render each item as ONE line: `N. **Title** — url [Source #rank]`. Do NOT split title and url onto separate lines with a `-` bullet.
            5. Do NOT add a "Recommended Learning Path" / "Summary" / "Related resources" section unless the user EXPLICITLY asked for one.
            6. If the user asked one question, answer it directly and stop. Do not pad with extras.
            
            BAD (do not do this) — wrapping in a code fence:
            [triple-backtick]markdown
            # Top resources
            1. W3Schools — https://w3schools.com/java
            [triple-backtick]
            
            GOOD (do this) — raw markdown, no fence:
            # Top resources
            1. **Java Tutorial — W3Schools** — https://www.w3schools.com/java/ [SearXNG #1]
            2. **How to Start Learning Java — GeeksforGeeks** — https://www.geeksforgeeks.org/java/ [SearXNG #2]
            
            TOOL BUDGET - You have a LIMITED number of LLM calls (12 max). Be efficient:
            - For web search tasks: Do at most 2-3 searches, then compile and send results. Do NOT keep searching for more.
            - For research + email tasks: Search 2 times max, then immediately send the email with what you found.
            - Never repeat the same search with slightly different terms. One good search is enough.
            - Prioritize completing the task (e.g. sending the email) over exhaustive research.

            WEB SEARCH TOOLS:
            - web_search(query, num_results): snippet-level search across SearXNG + DuckDuckGo. Use for most searches.
            - web_search_news(query, time_range): recent news only.
            - web_search_site(query, site): restrict to a specific domain.
            - search_and_fetch(query, urls, num_results, max_pages): runs web_search AND fetches the full content of the given URLs in parallel. Returns search results + cleaned page content + page links. Use this when snippets aren't enough and you need to read specific pages in full (e.g. a job listing, an article, a doc page). The agent fetches, cleans HTML to text, and extracts links for you — you don't need to run execute_commands with curl.
            Prefer search_and_fetch over (web_search then execute_commands with curl then readLogs) — it's one tool call instead of three.
            """;

    private volatile InMemoryRunner runner;
    private final RunConfig runConfig;
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private final ChatService chatService;
    private final AIConfigService aiConfigService;
    private final List<FunctionTool> tools;
    private final AtomicLong lastConfigVersion = new AtomicLong(-1);
    private final ReentrantLock runnerLock = new ReentrantLock();

    public AgentService(
            AdkConfig adkConfig,
            AIConfigService aiConfigService,
            ExecuteCommandsTool executeCommandsTool,
            GetExecutionStatusTool getExecutionStatusTool,
            ListExecutionsTool listExecutionsTool,
            CancelExecutionTool cancelExecutionTool,
            ReadLogsTool readLogsTool,
            SlackTool slackTool,
            GmailTool gmailTool,
            GmailApiTool gmailApiTool,
            SmtpTool smtpTool,
            FlirtTool flirtTool,
            CustomSkillTool customSkillTool,
            ScheduleTool scheduleTool,
            WebSearchTool webSearchTool,
            ChatService chatService
    ) {
        log.info("Initializing ADK AgentService");

        this.aiConfigService = aiConfigService;
        this.chatService = chatService;
        this.runConfig = RunConfig.builder().setMaxLlmCalls(Integer.MAX_VALUE - 1).build();
        this.tools = new ArrayList<>();
        tools.add(FunctionTool.create(executeCommandsTool, "executeCommands"));
        tools.add(FunctionTool.create(getExecutionStatusTool, "get_execution_status"));
        tools.add(FunctionTool.create(listExecutionsTool, "listExecutions"));
        tools.add(FunctionTool.create(listExecutionsTool, "listExecutionsByStatus"));
        tools.add(FunctionTool.create(cancelExecutionTool, "cancelExecution"));
        tools.add(FunctionTool.create(readLogsTool, "readLogs"));
        tools.add(FunctionTool.create(readLogsTool, "readLogsWithLimit"));

        // Slack tools are always registered but check configuration at runtime
        tools.add(FunctionTool.create(slackTool, "sendMessage"));
        tools.add(FunctionTool.create(slackTool, "sendDeploymentNotification"));
        log.info("Slack integration tools registered (configuration checked at runtime)");

        // Gmail SMTP tools
        tools.add(FunctionTool.create(gmailTool, "sendEmail"));
        tools.add(FunctionTool.create(gmailTool, "sendDeploymentEmail"));
        log.info("Gmail SMTP tools registered (configuration checked at runtime)");

        // Gmail API tools (full email access)
        tools.add(FunctionTool.create(gmailApiTool, "listEmails"));
        tools.add(FunctionTool.create(gmailApiTool, "searchEmails"));
        tools.add(FunctionTool.create(gmailApiTool, "getEmail"));
        tools.add(FunctionTool.create(gmailApiTool, "getThread"));
        tools.add(FunctionTool.create(gmailApiTool, "replyToEmail"));
        tools.add(FunctionTool.create(gmailApiTool, "composeEmail"));
        tools.add(FunctionTool.create(gmailApiTool, "markAsRead"));
        tools.add(FunctionTool.create(gmailApiTool, "markAsUnread"));
        tools.add(FunctionTool.create(gmailApiTool, "analyzeEmail"));
        log.info("Gmail API tools registered (OAuth required at runtime)");

        // SMTP tools
        tools.add(FunctionTool.create(smtpTool, "sendEmail"));
        tools.add(FunctionTool.create(smtpTool, "sendDeploymentEmail"));
        log.info("SMTP integration tools registered (configuration checked at runtime)");

        // Wingman tools
        tools.add(FunctionTool.create(flirtTool, "generateResponse"));
        tools.add(FunctionTool.create(flirtTool, "generateOpener"));
        tools.add(FunctionTool.create(flirtTool, "analyzeConversation"));
        tools.add(FunctionTool.create(flirtTool, "updateProfile"));
        tools.add(FunctionTool.create(flirtTool, "getProfile"));
        tools.add(FunctionTool.create(flirtTool, "listProfiles"));
        tools.add(FunctionTool.create(flirtTool, "forgetProfile"));
        log.info("Wingman tools registered with profile support (configuration checked at runtime)");

        // Custom Skills tools
        tools.add(FunctionTool.create(customSkillTool, "createCustomSkill"));
        tools.add(FunctionTool.create(customSkillTool, "listCustomSkills"));
        tools.add(FunctionTool.create(customSkillTool, "getCustomSkill"));
        tools.add(FunctionTool.create(customSkillTool, "updateCustomSkill"));
        tools.add(FunctionTool.create(customSkillTool, "deleteCustomSkill"));
        tools.add(FunctionTool.create(customSkillTool, "runCustomSkill"));
        tools.add(FunctionTool.create(customSkillTool, "toggleCustomSkill"));
        log.info("Custom Skills tools registered");

        // Scheduled Tasks tools (autopilot mode)
        tools.add(FunctionTool.create(scheduleTool, "scheduleDailyTask"));
        tools.add(FunctionTool.create(scheduleTool, "scheduleIntervalTask"));
        tools.add(FunctionTool.create(scheduleTool, "scheduleWeeklyTask"));
        tools.add(FunctionTool.create(scheduleTool, "listSchedules"));
        tools.add(FunctionTool.create(scheduleTool, "toggleSchedule"));
        tools.add(FunctionTool.create(scheduleTool, "deleteSchedule"));
        tools.add(FunctionTool.create(scheduleTool, "runScheduleNow"));
        log.info("Scheduled Tasks tools registered - autopilot mode enabled!");

        // Web Search tools
        tools.add(FunctionTool.create(webSearchTool, "search"));
        tools.add(FunctionTool.create(webSearchTool, "searchNews"));
        tools.add(FunctionTool.create(webSearchTool, "searchSite"));
        tools.add(FunctionTool.create(webSearchTool, "searchAndFetch"));
        log.info("Web Search tools registered");

        // Initialize runner with current config
        rebuildRunner();

        log.info("ADK AgentService initialized successfully with {} tools", tools.size());
    }

    /**
     * Rebuild the runner with current AI config.
     */
    private void rebuildRunner() {
        AIProviderConfig config = aiConfigService.getConfig();

        log.info("Building agent with provider={} model={}",
                config.getProvider(),
                config.isOllama() ? config.getOllamaModel() : config.getGeminiModel());

        LlmAgent.Builder agentBuilder = LlmAgent.builder()
                .name("runner-assistant")
                .description("A deployment assistant that executes commands and monitors executions")
                .instruction(SYSTEM_PROMPT)
                .tools((Object[]) tools.toArray(new FunctionTool[0]));

        if (config.isOllama()) {
            OllamaChatModel ollamaModel = OllamaChatModel.builder()
                    .modelName(config.getOllamaModel())
                    .baseUrl(config.getOllamaBaseUrl())
                    .timeout(java.time.Duration.ofMinutes(5))
                    .build();
            agentBuilder.model(new LangChain4j(ollamaModel));
            log.info("Using Ollama model={} at {}", config.getOllamaModel(), config.getOllamaBaseUrl());
        } else {
            agentBuilder.model(config.getGeminiModel());
            log.info("Using Gemini model={}", config.getGeminiModel());
        }

        LlmAgent agent = agentBuilder.build();
        this.runner = new InMemoryRunner(agent);

        // Clear sessions when switching models
        sessions.clear();

        lastConfigVersion.set(aiConfigService.getConfigVersion());
        log.info("Agent runner rebuilt with config version={}", lastConfigVersion.get());
    }

    /**
     * Check if config changed and rebuild runner if needed.
     */
    private void checkAndReloadConfig() {
        long currentVersion = aiConfigService.getConfigVersion();
        if (currentVersion != lastConfigVersion.get()) {
            runnerLock.lock();
            try {
                // Double-check after acquiring lock
                if (currentVersion != lastConfigVersion.get()) {
                    log.info("AI config changed (version {} -> {}), rebuilding runner",
                            lastConfigVersion.get(), currentVersion);
                    rebuildRunner();
                }
            } finally {
                runnerLock.unlock();
            }
        }
    }

    public ChatResult chat(String sessionId, String message) {
        // Check if AI config changed and reload if needed
        checkAndReloadConfig();

        if (sessionId == null || sessionId.isBlank()) {
            sessionId = UUID.randomUUID().toString();
        }

        log.info("Processing chat sessionId={} message={}", sessionId, message);

        // Persist chat session and user message
        chatService.getOrCreateSession(sessionId);
        chatService.saveUserMessage(sessionId, message);

        // Set session context for FlirtTool profile tracking
        FlirtTool.setCurrentSession(sessionId);
        WebSearchTool.clearSessionSearchCount(sessionId);

        try {
            Session session = getOrCreateSession(sessionId);
            Content userMsg = Content.fromParts(Part.fromText(message));

            Flowable<Event> events = runner.runAsync(session.userId(), session.id(), userMsg, runConfig);

            StringBuilder responseBuilder = new StringBuilder();
            String finalSessionId = sessionId;

            events.blockingForEach(event -> {
                log.debug("Event sessionId={} type={}", finalSessionId, event.getClass().getSimpleName());

                if (event.finalResponse()) {
                    String content = event.stringifyContent();
                    String transformed = transformAdkContent(content);
                    if (transformed != null) {
                        responseBuilder.append(transformed);
                    }
                }
            });

            String response = responseBuilder.toString();
            if (response.isBlank()) {
                response = "I processed your request but have no additional response.";
            }

            // Persist assistant response
            chatService.saveAssistantMessage(sessionId, response);

            log.info("Chat completed sessionId={} responseLength={}", sessionId, response.length());

            return new ChatResult(sessionId, response);
        } finally {
            FlirtTool.clearCurrentSession();
        }
    }

    public Flowable<Event> chatStream(String sessionId, String message) {
        // Check if AI config changed and reload if needed
        checkAndReloadConfig();

        if (sessionId == null || sessionId.isBlank()) {
            sessionId = UUID.randomUUID().toString();
        }

        log.info("Processing streaming chat sessionId={} message={}", sessionId, message);

        // Persist chat session and user message
        chatService.getOrCreateSession(sessionId);
        chatService.saveUserMessage(sessionId, message);

        // Set session context for FlirtTool profile tracking
        FlirtTool.setCurrentSession(sessionId);

        Session session = getOrCreateSession(sessionId);
        Content userMsg = Content.fromParts(Part.fromText(message));

        // Accumulate response for persistence
        AtomicReference<StringBuilder> responseBuilder = new AtomicReference<>(new StringBuilder());
        String finalSessionId = sessionId;

        return runner.runAsync(session.userId(), session.id(), userMsg, runConfig)
                .doOnNext(event -> {
                    if (event.finalResponse()) {
                        String content = event.stringifyContent();
                        String transformed = transformAdkContent(content);
                        if (transformed != null) {
                            responseBuilder.get().append(transformed);
                        }
                    }
                })
                .doFinally(() -> {
                    FlirtTool.clearCurrentSession();
                    // Persist accumulated assistant response
                    String response = responseBuilder.get().toString();
                    if (!response.isBlank()) {
                        chatService.saveAssistantMessage(finalSessionId, response);
                        log.debug("Persisted streaming response sessionId={} length={}", finalSessionId, response.length());
                    }
                });
    }

    public String getSessionId(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return UUID.randomUUID().toString();
        }
        return sessionId;
    }

    private Session getOrCreateSession(String sessionId) {
        return sessions.computeIfAbsent(sessionId, id -> {
            Session newSession = runner.sessionService()
                    .createSession(runner.appName(), id)
                    .blockingGet();
            log.info("Created new session id={}", id);
            return newSession;
        });
    }

    public void clearSession(String sessionId) {
        sessions.remove(sessionId);
        // Archive the persisted chat session
        chatService.archiveSession(sessionId);
        log.info("Cleared session id={}", sessionId);
    }

    /**
     * Transforms content - extracts function names from raw ADK data and formats them cleanly
     * Returns null if content should be completely filtered out
     */
    private String transformAdkContent(String content) {
        if (content == null || content.isBlank()) {
            return null;
        }

        // Extract function name from FunctionCall patterns and return clean format
        if (content.contains("FunctionCall{") && content.contains("name=Optional[")) {
            String functionName = extractFunctionName(content);
            if (functionName != null) {
                return "[[FUNCTION_CALL:" + functionName + "]]";
            }
            return null;
        }

        // Extract function name from FunctionResponse patterns
        if (content.contains("FunctionResponse{") && content.contains("name=Optional[")) {
            String functionName = extractFunctionName(content);
            if (functionName != null) {
                return "[[FUNCTION_RESPONSE:" + functionName + "]]";
            }
            return null;
        }

        // Filter other internal ADK patterns completely
        if (content.contains("ToolCall{") ||
            content.contains("ToolResponse{") ||
            content.contains("ToolResult{")) {
            return null;
        }

        // Filter JSON-formatted tool calls
        if (content.startsWith("{") && (content.contains("\"function_call\"") || content.contains("\"tool_calls\""))) {
            return null;
        }

        // Filter lines that start with "Function Call:" or "Function Response:"
        if (content.startsWith("Function Call:") || content.startsWith("Function Response:")) {
            return null;
        }

        // Filter content with ADK internal IDs
        if (content.contains("id=Optional[adk-")) {
            return null;
        }

        return content;
    }

    /**
     * Extracts function name from ADK toString() output
     */
    private String extractFunctionName(String content) {
        try {
            int nameStart = content.indexOf("name=Optional[");
            if (nameStart == -1) return null;

            nameStart += "name=Optional[".length();
            int nameEnd = content.indexOf("]", nameStart);
            if (nameEnd == -1) return null;

            return content.substring(nameStart, nameEnd);
        } catch (Exception e) {
            log.debug("Failed to extract function name: {}", e.getMessage());
            return null;
        }
    }

    /**
     * @deprecated Use transformAdkContent instead
     */
    private boolean isInternalAdkContent(String content) {
        return transformAdkContent(content) == null;
    }

    public record ChatResult(String sessionId, String response) {}

    /**
     * Get current AI config for display purposes.
     */
    public AIProviderConfig getCurrentConfig() {
        return aiConfigService.getConfig();
    }
}
