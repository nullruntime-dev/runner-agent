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
import com.google.adk.runner.InMemoryRunner;
import com.google.adk.sessions.Session;
import com.google.adk.tools.FunctionTool;
import com.google.genai.types.Content;
import com.google.genai.types.Part;
import dev.runner.agent.adk.tools.*;
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
import java.util.concurrent.atomic.AtomicReference;

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

            For flirting/dating help (Flirt Assistant):
            - Use generate_flirty_response when they share a message they received (ALWAYS ask for the person's name to track their profile)
            - Use generate_opener when they need help starting a conversation with someone new
            - Use analyze_conversation when they want to understand someone's interest level
            - Use update_crush_profile to store new info learned about someone (interests, personality, facts)
            - Use get_crush_profile to retrieve what you know about someone before giving advice
            - Use list_crushes to see all people being tracked
            - Use forget_crush to delete a profile

            IMPORTANT for Flirt Assistant:
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
            - [Flirt Assistant Mode] = Focus on dating/flirting help. Be charming, witty, and give multiple response options.
            - [Slack Mode] = Focus on sending Slack messages/notifications.
            - [Gmail Mode] = Focus on sending emails via Gmail SMTP.
            - [Gmail API Mode] = Focus on reading, searching, and managing Gmail emails via API.
            - [SMTP Mode] = Focus on sending emails via SMTP.

            When in Flirt Assistant Mode:
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
            """;

    private final InMemoryRunner runner;
    private final RunConfig runConfig;
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private final ChatService chatService;

    public AgentService(
            AdkConfig adkConfig,
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
            // WebSearchTool webSearchTool,  // Disabled until Google API key issues are resolved
            ChatService chatService
    ) {
        log.info("Initializing ADK AgentService with model={}", adkConfig.getModel());

        List<FunctionTool> tools = new ArrayList<>();
        tools.add(FunctionTool.create(executeCommandsTool, "executeCommands"));
        tools.add(FunctionTool.create(getExecutionStatusTool, "getStatus"));
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

        // Flirt Assistant tools
        tools.add(FunctionTool.create(flirtTool, "generateResponse"));
        tools.add(FunctionTool.create(flirtTool, "generateOpener"));
        tools.add(FunctionTool.create(flirtTool, "analyzeConversation"));
        tools.add(FunctionTool.create(flirtTool, "updateProfile"));
        tools.add(FunctionTool.create(flirtTool, "getProfile"));
        tools.add(FunctionTool.create(flirtTool, "listProfiles"));
        tools.add(FunctionTool.create(flirtTool, "forgetProfile"));
        log.info("Flirt Assistant tools registered with profile support (configuration checked at runtime)");

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

        // Web Search tools - disabled until Google API key issues are resolved
        // tools.add(FunctionTool.create(webSearchTool, "search"));
        // tools.add(FunctionTool.create(webSearchTool, "searchNews"));
        // tools.add(FunctionTool.create(webSearchTool, "searchSite"));
        // log.info("Web Search tools registered (configuration checked at runtime)");

        LlmAgent agent = LlmAgent.builder()
                .name("runner-assistant")
                .description("A deployment assistant that executes commands and monitors executions")
                .model(adkConfig.getModel())
                .instruction(SYSTEM_PROMPT)
                .tools((Object[]) tools.toArray(new FunctionTool[0]))
                .build();

        this.runner = new InMemoryRunner(agent);
        this.runConfig = RunConfig.builder().build();
        this.chatService = chatService;

        log.info("ADK AgentService initialized successfully with {} tools", tools.size());
    }

    public ChatResult chat(String sessionId, String message) {
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = UUID.randomUUID().toString();
        }

        log.info("Processing chat sessionId={} message={}", sessionId, message);

        // Persist chat session and user message
        chatService.getOrCreateSession(sessionId);
        chatService.saveUserMessage(sessionId, message);

        // Set session context for FlirtTool profile tracking
        FlirtTool.setCurrentSession(sessionId);

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
}
