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

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Properties;
import javax.mail.*;
import javax.mail.internet.*;

@Slf4j
@Component
public class GmailTool {

    private final SkillService skillService;

    public GmailTool(SkillService skillService) {
        this.skillService = skillService;
        log.info("GmailTool initialized");
    }

    private Optional<Map<String, String>> getConfig() {
        return skillService.getSkillConfig("gmail");
    }

    private String getEmail() {
        return getConfig().map(c -> c.get("email")).orElse(null);
    }

    private String getAppPassword() {
        return getConfig().map(c -> c.get("appPassword")).orElse(null);
    }

    private String getDefaultRecipient() {
        return getConfig().map(c -> c.get("defaultRecipient")).orElse(null);
    }

    public boolean isConfigured() {
        String email = getEmail();
        String appPassword = getAppPassword();
        return email != null && !email.isBlank() && appPassword != null && !appPassword.isBlank();
    }

    @Schema(name = "send_email", description = "Send an email via Gmail. Use this to send notifications, reports, or alerts via email. Returns error if Gmail is not configured.")
    public Map<String, Object> sendEmail(
            @Schema(name = "to", description = "Recipient email address") String to,
            @Schema(name = "subject", description = "Email subject line") String subject,
            @Schema(name = "body", description = "Email body content (plain text)") String body
    ) {
        log.info("ADK tool: send_email to={} subject={}", to, subject);

        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Gmail is not configured. Please configure Gmail in the agent settings.");
            return result;
        }

        String recipient = to;
        if (recipient == null || recipient.isBlank()) {
            recipient = getDefaultRecipient();
            if (recipient == null || recipient.isBlank()) {
                result.put("success", false);
                result.put("error", "No recipient specified and no default recipient configured.");
                return result;
            }
        }

        try {
            sendEmailViaSmtp(recipient, subject, body);
            result.put("success", true);
            result.put("message", "Email sent successfully to " + recipient);
            log.info("Email sent successfully to {}", recipient);
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Failed to send email: " + e.getMessage());
            log.error("Failed to send email", e);
        }

        return result;
    }

    @Schema(name = "send_deployment_email", description = "Send a formatted deployment notification email. Returns error if Gmail is not configured.")
    public Map<String, Object> sendDeploymentEmail(
            @Schema(name = "to", description = "Recipient email address") String to,
            @Schema(name = "deployment_name", description = "Name of the deployment") String deploymentName,
            @Schema(name = "status", description = "Deployment status: SUCCESS, FAILED, RUNNING, etc.") String status,
            @Schema(name = "details", description = "Additional details about the deployment") String details
    ) {
        log.info("ADK tool: send_deployment_email to={} deployment={} status={}", to, deploymentName, status);

        String subject = String.format("[%s] Deployment: %s", status, deploymentName);
        String body = String.format("""
                Deployment Notification
                ========================

                Name: %s
                Status: %s

                Details:
                %s

                --
                Sent by Runner Agent
                """,
                deploymentName,
                status,
                details != null ? details : "No additional details"
        );

        return sendEmail(to, subject, body);
    }

    private void sendEmailViaSmtp(String to, String subject, String body) throws MessagingException {
        String email = getEmail();
        String appPassword = getAppPassword();

        Properties props = new Properties();
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.host", "smtp.gmail.com");
        props.put("mail.smtp.port", "587");
        props.put("mail.smtp.ssl.protocols", "TLSv1.2");

        Session session = Session.getInstance(props, new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(email, appPassword);
            }
        });

        Message message = new MimeMessage(session);
        message.setFrom(new InternetAddress(email));
        message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
        message.setSubject(subject);
        message.setText(body);

        Transport.send(message);
    }
}
