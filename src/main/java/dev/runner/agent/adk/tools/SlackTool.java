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
import dev.runner.agent.service.SkillService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
public class SlackTool {

    private final SkillService skillService;
    private final HttpClient httpClient;

    public SlackTool(SkillService skillService) {
        this.skillService = skillService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        log.info("SlackTool initialized");
    }

    private Optional<Map<String, String>> getConfig() {
        return skillService.getSkillConfig("slack");
    }

    private String getWebhookUrl() {
        return getConfig().map(c -> c.get("webhookUrl")).orElse(null);
    }

    private String getBotToken() {
        return getConfig().map(c -> c.get("botToken")).orElse(null);
    }

    private String getDefaultChannel() {
        return getConfig().map(c -> c.get("defaultChannel")).orElse(null);
    }

    public boolean isConfigured() {
        // Configured if we have either webhookUrl OR botToken
        String webhookUrl = getWebhookUrl();
        String botToken = getBotToken();
        return (webhookUrl != null && !webhookUrl.isBlank()) ||
               (botToken != null && !botToken.isBlank());
    }

    private boolean useWebhook() {
        String webhookUrl = getWebhookUrl();
        return webhookUrl != null && !webhookUrl.isBlank();
    }

    @Schema(name = "send_slack_message", description = "Send a message to Slack. Use this to notify about deployments, execution results, or any important updates. Returns error if Slack is not configured.")
    public Map<String, Object> sendMessage(
            @Schema(name = "message", description = "The message text to send to Slack. Supports Slack markdown formatting.") String message
    ) {
        log.info("ADK tool: send_slack_message length={}", message.length());

        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Slack is not configured. Please configure Slack in the agent settings.");
            return result;
        }

        try {
            HttpResponse<String> response;
            if (useWebhook()) {
                String payload = buildPayload(message, getDefaultChannel());
                response = sendViaWebhook(payload);
            } else {
                String channel = getDefaultChannel();
                if (channel == null || channel.isBlank()) {
                    result.put("success", false);
                    result.put("error", "Default channel is required when using Bot Token. Please configure a default channel.");
                    return result;
                }
                response = sendViaBotToken(channel, message);
            }

            if (response.statusCode() == 200) {
                result.put("success", true);
                result.put("message", "Message sent to Slack successfully");
                log.info("Slack message sent successfully");
            } else {
                result.put("success", false);
                result.put("error", "Slack API returned status " + response.statusCode() + ": " + response.body());
                log.warn("Slack API error: {} - {}", response.statusCode(), response.body());
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Failed to send Slack message: " + e.getMessage());
            log.error("Failed to send Slack message", e);
        }

        return result;
    }

    @Schema(name = "send_slack_deployment_notification", description = "Send a formatted deployment notification to Slack with execution details. Returns error if Slack is not configured.")
    public Map<String, Object> sendDeploymentNotification(
            @Schema(name = "execution_name", description = "Name of the execution/deployment") String executionName,
            @Schema(name = "status", description = "Status of the execution: SUCCESS, FAILED, RUNNING, etc.") String status,
            @Schema(name = "details", description = "Additional details about the execution") String details
    ) {
        log.info("ADK tool: send_slack_deployment_notification name={} status={}", executionName, status);

        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Slack is not configured. Please configure Slack in the agent settings.");
            return result;
        }

        String emoji = getStatusEmoji(status);
        String color = getStatusColor(status);

        String message = String.format("""
                %s *Deployment Update*

                *Name:* %s
                *Status:* %s
                %s""",
                emoji,
                executionName,
                status,
                details != null && !details.isBlank() ? "\n*Details:* " + details : ""
        );

        try {
            HttpResponse<String> response;
            if (useWebhook()) {
                String payload = buildRichPayload(message, color);
                response = sendViaWebhook(payload);
            } else {
                String channel = getDefaultChannel();
                if (channel == null || channel.isBlank()) {
                    result.put("success", false);
                    result.put("error", "Default channel is required when using Bot Token. Please configure a default channel.");
                    return result;
                }
                response = sendViaBotToken(channel, message);
            }

            if (response.statusCode() == 200) {
                result.put("success", true);
                result.put("message", "Deployment notification sent to Slack");
                log.info("Slack deployment notification sent successfully");
            } else {
                result.put("success", false);
                result.put("error", "Slack API returned status " + response.statusCode());
                log.warn("Slack API error: {} - {}", response.statusCode(), response.body());
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Failed to send notification: " + e.getMessage());
            log.error("Failed to send Slack notification", e);
        }

        return result;
    }

    private String buildPayload(String text, String channel) {
        String defaultChan = getDefaultChannel();
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"text\":").append(escapeJson(text));
        if (channel != null && !channel.isBlank()) {
            json.append(",\"channel\":").append(escapeJson(channel));
        } else if (defaultChan != null && !defaultChan.isBlank()) {
            json.append(",\"channel\":").append(escapeJson(defaultChan));
        }
        json.append("}");
        return json.toString();
    }

    private String buildRichPayload(String text, String color) {
        String defaultChan = getDefaultChannel();
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"attachments\":[{");
        json.append("\"color\":").append(escapeJson(color)).append(",");
        json.append("\"text\":").append(escapeJson(text)).append(",");
        json.append("\"mrkdwn_in\":[\"text\"]");
        json.append("}]");
        if (defaultChan != null && !defaultChan.isBlank()) {
            json.append(",\"channel\":").append(escapeJson(defaultChan));
        }
        json.append("}");
        return json.toString();
    }

    private HttpResponse<String> sendViaWebhook(String payload) throws Exception {
        String webhookUrl = getWebhookUrl();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(webhookUrl))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .timeout(Duration.ofSeconds(30))
                .build();

        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> sendViaBotToken(String channel, String message) throws Exception {
        String botToken = getBotToken();
        String payload = String.format(
                "{\"channel\":%s,\"text\":%s,\"mrkdwn\":true}",
                escapeJson(channel),
                escapeJson(message)
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://slack.com/api/chat.postMessage"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + botToken)
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .timeout(Duration.ofSeconds(30))
                .build();

        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private String escapeJson(String value) {
        if (value == null) return "null";
        return "\"" + value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t")
                + "\"";
    }

    private String getStatusEmoji(String status) {
        if (status == null) return ":information_source:";
        return switch (status.toUpperCase()) {
            case "SUCCESS" -> ":white_check_mark:";
            case "FAILED" -> ":x:";
            case "RUNNING" -> ":hourglass_flowing_sand:";
            case "PENDING" -> ":clock1:";
            case "CANCELLED" -> ":no_entry_sign:";
            default -> ":information_source:";
        };
    }

    private String getStatusColor(String status) {
        if (status == null) return "#808080";
        return switch (status.toUpperCase()) {
            case "SUCCESS" -> "#36a64f";
            case "FAILED" -> "#dc3545";
            case "RUNNING" -> "#ffc107";
            case "PENDING" -> "#6c757d";
            case "CANCELLED" -> "#fd7e14";
            default -> "#808080";
        };
    }
}
