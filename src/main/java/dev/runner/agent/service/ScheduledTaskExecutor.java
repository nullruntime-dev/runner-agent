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
package dev.runner.agent.service;

import dev.runner.agent.adk.AgentService;
import dev.runner.agent.domain.CustomSkill;
import dev.runner.agent.domain.ScheduledTask;
import dev.runner.agent.domain.ScheduledTask.NotificationTarget;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class ScheduledTaskExecutor {

    private final AgentService agentService;
    private final CustomSkillService customSkillService;
    private final SkillService skillService;

    public ScheduledTaskExecutor(
            @Lazy AgentService agentService,
            CustomSkillService customSkillService,
            SkillService skillService
    ) {
        this.agentService = agentService;
        this.customSkillService = customSkillService;
        this.skillService = skillService;
        log.info("ScheduledTaskExecutor initialized");
    }

    /**
     * Execute a scheduled task and return the result
     */
    public String execute(ScheduledTask task) throws Exception {
        log.info("Executing scheduled task: {} (type={})", task.getName(), task.getType());

        String result = switch (task.getType()) {
            case PROMPT -> executePrompt(task);
            case SKILL -> executeSkill(task);
            case COMMAND -> executeCommand(task);
        };

        // Send notification if configured
        sendNotification(task, result);

        return result;
    }

    /**
     * Execute a prompt via the AI agent
     */
    private String executePrompt(ScheduledTask task) {
        String prompt = task.getAction();
        String sessionId = "scheduled-" + task.getId() + "-" + System.currentTimeMillis();

        log.info("Sending prompt to AI agent: {}", truncate(prompt, 100));

        try {
            // Use the agent service to process the prompt
            String response = agentService.chat(sessionId, prompt).response();
            log.info("AI response for scheduled task '{}': {}", task.getName(), truncate(response, 200));
            return response;
        } catch (Exception e) {
            log.error("Failed to execute AI prompt for task '{}': {}", task.getName(), e.getMessage());
            throw new RuntimeException("AI prompt execution failed: " + e.getMessage(), e);
        }
    }

    /**
     * Execute a skill (built-in or custom)
     */
    private String executeSkill(ScheduledTask task) {
        String skillName = task.getAction();

        log.info("Executing skill: {}", skillName);

        // First check if it's a custom skill
        Optional<CustomSkill> customSkill = customSkillService.getSkill(skillName);
        if (customSkill.isPresent()) {
            return executeCustomSkill(customSkill.get(), task);
        }

        // Otherwise, send to AI to invoke the built-in skill
        String prompt = "Execute the " + skillName + " skill";
        if (task.getParametersJson() != null && !task.getParametersJson().isBlank()) {
            prompt += " with parameters: " + task.getParametersJson();
        }

        String sessionId = "scheduled-skill-" + task.getId() + "-" + System.currentTimeMillis();

        try {
            String response = agentService.chat(sessionId, prompt).response();
            return response;
        } catch (Exception e) {
            log.error("Failed to execute skill '{}': {}", skillName, e.getMessage());
            throw new RuntimeException("Skill execution failed: " + e.getMessage(), e);
        }
    }

    /**
     * Execute a custom skill
     */
    private String executeCustomSkill(CustomSkill skill, ScheduledTask task) {
        log.info("Executing custom skill: {} (type={})", skill.getName(), skill.getType());

        return switch (skill.getType()) {
            case COMMAND -> {
                try {
                    // Parse the command from definitionJson
                    String command = skill.getDefinitionJson();
                    // Remove JSON wrapper if present
                    if (command.startsWith("{")) {
                        // Simple extraction - in production use proper JSON parsing
                        int cmdStart = command.indexOf("\"command\":\"");
                        if (cmdStart >= 0) {
                            int start = cmdStart + 11;
                            int end = command.indexOf("\"", start);
                            command = command.substring(start, end);
                        }
                    }
                    yield executeShellCommand(command);
                } catch (Exception e) {
                    throw new RuntimeException("Custom command execution failed: " + e.getMessage(), e);
                }
            }
            case PROMPT -> {
                String sessionId = "custom-skill-" + task.getId() + "-" + System.currentTimeMillis();
                try {
                    yield agentService.chat(sessionId, skill.getDefinitionJson()).response();
                } catch (Exception e) {
                    throw new RuntimeException("Custom prompt execution failed: " + e.getMessage(), e);
                }
            }
            case WORKFLOW -> {
                // Workflow execution - each step
                yield "Workflow execution not yet implemented";
            }
        };
    }

    /**
     * Execute a shell command
     */
    private String executeCommand(ScheduledTask task) throws Exception {
        String command = task.getAction();
        log.info("Executing command: {}", command);

        return executeShellCommand(command);
    }

    private String executeShellCommand(String command) throws Exception {
        ProcessBuilder pb = new ProcessBuilder("/bin/sh", "-c", command);
        pb.redirectErrorStream(true);

        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }

        boolean finished = process.waitFor(5, TimeUnit.MINUTES);
        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("Command timed out after 5 minutes");
        }

        int exitCode = process.exitValue();
        if (exitCode != 0) {
            throw new RuntimeException("Command failed with exit code " + exitCode + ": " + output);
        }

        return output.toString().trim();
    }

    /**
     * Send notification about task completion
     */
    private void sendNotification(ScheduledTask task, String result) {
        NotificationTarget target = task.getNotificationTarget();
        if (target == null || target == NotificationTarget.NONE || target == NotificationTarget.LOG) {
            // LOG is handled by the normal logging
            return;
        }

        String message = formatNotificationMessage(task, result);

        try {
            switch (target) {
                case SLACK -> sendSlackNotification(task, message);
                case EMAIL -> sendEmailNotification(task, message);
                default -> log.debug("No notification sent for target: {}", target);
            }
        } catch (Exception e) {
            log.error("Failed to send notification for task '{}': {}", task.getName(), e.getMessage());
        }
    }

    private String formatNotificationMessage(ScheduledTask task, String result) {
        StringBuilder sb = new StringBuilder();
        sb.append("⏰ *Scheduled Task Completed*\n\n");
        sb.append("*Task:* ").append(task.getName()).append("\n");
        sb.append("*Time:* ").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))).append("\n");
        sb.append("*Status:* ✅ Success\n\n");

        if (result != null && !result.isBlank()) {
            sb.append("*Result:*\n");
            sb.append(truncate(result, 1500));
        }

        return sb.toString();
    }

    private void sendSlackNotification(ScheduledTask task, String message) {
        String channel = task.getNotificationConfig();
        if (channel == null || channel.isBlank()) {
            channel = "#general"; // Default channel
        }

        // Check if Slack is configured
        if (skillService.getSkillConfig("slack").isEmpty()) {
            log.warn("Slack notification requested but Slack is not configured");
            return;
        }

        // TODO: Implement Slack notification via SlackTool or make sendMessage public
        log.info("Slack notification for task '{}' (channel: {}): {}", task.getName(), channel, truncate(message, 200));
    }

    private void sendEmailNotification(ScheduledTask task, String message) {
        // Email notification - would need EmailService implementation
        log.info("Email notification not yet implemented for task: {}", task.getName());
    }

    private String truncate(String s, int maxLength) {
        if (s == null) return "";
        return s.length() > maxLength ? s.substring(0, maxLength) + "..." : s;
    }
}
