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
public class SmtpTool {

    private final SkillService skillService;

    public SmtpTool(SkillService skillService) {
        this.skillService = skillService;
        log.info("SmtpTool initialized");
    }

    private Optional<Map<String, String>> getConfig() {
        return skillService.getSkillConfig("smtp");
    }

    public boolean isConfigured() {
        return getConfig().map(c ->
                c.get("host") != null && !c.get("host").isBlank() &&
                c.get("username") != null && !c.get("username").isBlank() &&
                c.get("password") != null && !c.get("password").isBlank() &&
                c.get("fromEmail") != null && !c.get("fromEmail").isBlank()
        ).orElse(false);
    }

    @Schema(name = "smtp_send_email", description = "Send an email via SMTP. Use this to send notifications, reports, or alerts via email. Returns error if SMTP is not configured.")
    public Map<String, Object> sendEmail(
            @Schema(name = "to", description = "Recipient email address") String to,
            @Schema(name = "subject", description = "Email subject line") String subject,
            @Schema(name = "body", description = "Email body content (plain text)") String body
    ) {
        log.info("ADK tool: smtp_send_email to={} subject={}", to, subject);

        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "SMTP is not configured. Please configure SMTP in the agent settings.");
            return result;
        }

        Map<String, String> config = getConfig().get();
        String recipient = to;
        if (recipient == null || recipient.isBlank()) {
            recipient = config.get("defaultRecipient");
            if (recipient == null || recipient.isBlank()) {
                result.put("success", false);
                result.put("error", "No recipient specified and no default recipient configured.");
                return result;
            }
        }

        try {
            sendEmailViaSmtp(config, recipient, subject, body);
            result.put("success", true);
            result.put("message", "Email sent successfully to " + recipient);
            log.info("SMTP email sent successfully to {}", recipient);
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Failed to send email: " + e.getMessage());
            log.error("Failed to send SMTP email", e);
        }

        return result;
    }

    @Schema(name = "smtp_send_deployment_email", description = "Send a formatted deployment notification email via SMTP. Returns error if SMTP is not configured.")
    public Map<String, Object> sendDeploymentEmail(
            @Schema(name = "to", description = "Recipient email address") String to,
            @Schema(name = "deployment_name", description = "Name of the deployment") String deploymentName,
            @Schema(name = "status", description = "Deployment status: SUCCESS, FAILED, RUNNING, etc.") String status,
            @Schema(name = "details", description = "Additional details about the deployment") String details
    ) {
        log.info("ADK tool: smtp_send_deployment_email to={} deployment={} status={}", to, deploymentName, status);

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

    private void sendEmailViaSmtp(Map<String, String> config, String to, String subject, String body) throws MessagingException, java.io.UnsupportedEncodingException {
        String host = config.get("host");
        String portStr = config.get("port");
        String username = config.get("username");
        String password = config.get("password");
        String fromEmail = config.get("fromEmail");
        String fromName = config.get("fromName");
        String encryption = config.get("encryption");

        int port = 587;
        try {
            port = Integer.parseInt(portStr);
        } catch (NumberFormatException e) {
            log.warn("Invalid port '{}', using default 587", portStr);
        }

        Properties props = new Properties();
        props.put("mail.smtp.host", host);
        props.put("mail.smtp.port", String.valueOf(port));
        props.put("mail.smtp.auth", "true");

        // Configure encryption
        if (encryption == null || encryption.isBlank() || encryption.equalsIgnoreCase("TLS")) {
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.ssl.protocols", "TLSv1.2");
        } else if (encryption.equalsIgnoreCase("SSL")) {
            props.put("mail.smtp.ssl.enable", "true");
            props.put("mail.smtp.socketFactory.port", String.valueOf(port));
            props.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
        }
        // NONE = no encryption settings

        Session session = Session.getInstance(props, new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(username, password);
            }
        });

        Message message = new MimeMessage(session);

        // Set From with optional display name
        if (fromName != null && !fromName.isBlank()) {
            message.setFrom(new InternetAddress(fromEmail, fromName, "UTF-8"));
        } else {
            message.setFrom(new InternetAddress(fromEmail));
        }

        message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
        message.setSubject(subject);
        message.setText(body);

        Transport.send(message);
    }
}
