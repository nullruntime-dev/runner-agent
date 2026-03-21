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
import dev.runner.agent.dto.EmailDetails;
import dev.runner.agent.dto.EmailSummary;
import dev.runner.agent.exception.GmailApiException;
import dev.runner.agent.service.GmailApiService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
public class GmailApiTool {

    private final GmailApiService gmailApiService;

    public GmailApiTool(GmailApiService gmailApiService) {
        this.gmailApiService = gmailApiService;
        log.info("GmailApiTool initialized");
    }

    @Schema(name = "list_emails", description = "List emails from Gmail inbox or a specific label. Returns email summaries with id, subject, from, snippet, and unread status. Use label='INBOX' for inbox, 'UNREAD' for unread only, 'STARRED' for starred, etc.")
    public Map<String, Object> listEmails(
            @Schema(name = "label", description = "Gmail label to list from (INBOX, UNREAD, STARRED, SENT, DRAFT, SPAM, TRASH, or custom label). Default: INBOX", optional = true) String label,
            @Schema(name = "max_results", description = "Maximum number of emails to return (1-50, default: 20)", optional = true) Integer maxResults,
            @Schema(name = "page_token", description = "Token for pagination (from previous response)", optional = true) String pageToken
    ) {
        log.info("ADK tool: list_emails label={} maxResults={}", label, maxResults);

        Map<String, Object> result = new HashMap<>();

        if (!gmailApiService.isAuthorized()) {
            result.put("success", false);
            result.put("error", "Gmail API is not authorized. Please complete OAuth setup at /agent/gmail/auth/url");
            return result;
        }

        try {
            String effectiveLabel = (label == null || label.isBlank()) ? "INBOX" : label;
            int effectiveMax = (maxResults == null || maxResults < 1) ? 20 : Math.min(maxResults, 50);

            List<EmailSummary> emails = gmailApiService.listEmails(effectiveLabel, effectiveMax, pageToken);

            result.put("success", true);
            result.put("count", emails.size());
            result.put("emails", emails.stream()
                    .map(this::emailSummaryToMap)
                    .collect(Collectors.toList()));
            result.put("label", effectiveLabel);

            log.info("Listed {} emails from label={}", emails.size(), effectiveLabel);
        } catch (GmailApiException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("errorType", e.getErrorType().name());
            log.warn("Failed to list emails: {}", e.getMessage());
        }

        return result;
    }

    @Schema(name = "search_emails", description = "Search emails using Gmail query syntax. Examples: 'from:john@example.com', 'subject:invoice', 'is:unread', 'after:2024/01/01', 'has:attachment', 'in:sent larger:5M'")
    public Map<String, Object> searchEmails(
            @Schema(name = "query", description = "Gmail search query (same syntax as Gmail search bar)") String query,
            @Schema(name = "max_results", description = "Maximum number of results (1-50, default: 20)", optional = true) Integer maxResults
    ) {
        log.info("ADK tool: search_emails query={} maxResults={}", query, maxResults);

        Map<String, Object> result = new HashMap<>();

        if (!gmailApiService.isAuthorized()) {
            result.put("success", false);
            result.put("error", "Gmail API is not authorized. Please complete OAuth setup at /agent/gmail/auth/url");
            return result;
        }

        if (query == null || query.isBlank()) {
            result.put("success", false);
            result.put("error", "Search query is required");
            return result;
        }

        try {
            int effectiveMax = (maxResults == null || maxResults < 1) ? 20 : Math.min(maxResults, 50);

            List<EmailSummary> emails = gmailApiService.searchEmails(query, effectiveMax);

            result.put("success", true);
            result.put("query", query);
            result.put("count", emails.size());
            result.put("emails", emails.stream()
                    .map(this::emailSummaryToMap)
                    .collect(Collectors.toList()));

            log.info("Search found {} emails for query={}", emails.size(), query);
        } catch (GmailApiException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("errorType", e.getErrorType().name());
            log.warn("Failed to search emails: {}", e.getMessage());
        }

        return result;
    }

    @Schema(name = "get_email", description = "Get the full content of an email by its ID. Returns subject, from, to, cc, body text, date, labels, and attachment info.")
    public Map<String, Object> getEmail(
            @Schema(name = "message_id", description = "The email message ID (from list_emails or search_emails)") String messageId
    ) {
        log.info("ADK tool: get_email messageId={}", messageId);

        Map<String, Object> result = new HashMap<>();

        if (!gmailApiService.isAuthorized()) {
            result.put("success", false);
            result.put("error", "Gmail API is not authorized. Please complete OAuth setup at /agent/gmail/auth/url");
            return result;
        }

        if (messageId == null || messageId.isBlank()) {
            result.put("success", false);
            result.put("error", "Message ID is required");
            return result;
        }

        try {
            EmailDetails email = gmailApiService.getEmail(messageId);

            result.put("success", true);
            result.put("email", emailDetailsToMap(email));

            log.info("Retrieved email messageId={} subject={}", messageId, email.getSubject());
        } catch (GmailApiException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("errorType", e.getErrorType().name());
            log.warn("Failed to get email: {}", e.getMessage());
        }

        return result;
    }

    @Schema(name = "get_thread", description = "Get all emails in a conversation thread. Returns a list of full email details for the entire thread in chronological order.")
    public Map<String, Object> getThread(
            @Schema(name = "thread_id", description = "The thread ID (from email's threadId field)") String threadId
    ) {
        log.info("ADK tool: get_thread threadId={}", threadId);

        Map<String, Object> result = new HashMap<>();

        if (!gmailApiService.isAuthorized()) {
            result.put("success", false);
            result.put("error", "Gmail API is not authorized. Please complete OAuth setup at /agent/gmail/auth/url");
            return result;
        }

        if (threadId == null || threadId.isBlank()) {
            result.put("success", false);
            result.put("error", "Thread ID is required");
            return result;
        }

        try {
            List<EmailDetails> emails = gmailApiService.getThread(threadId);

            result.put("success", true);
            result.put("threadId", threadId);
            result.put("messageCount", emails.size());
            result.put("emails", emails.stream()
                    .map(this::emailDetailsToMap)
                    .collect(Collectors.toList()));

            log.info("Retrieved thread threadId={} with {} messages", threadId, emails.size());
        } catch (GmailApiException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("errorType", e.getErrorType().name());
            log.warn("Failed to get thread: {}", e.getMessage());
        }

        return result;
    }

    @Schema(name = "reply_to_email", description = "Reply to an email. The reply will be properly threaded with the original conversation. Uses the authorized Gmail account as sender.")
    public Map<String, Object> replyToEmail(
            @Schema(name = "message_id", description = "The message ID to reply to") String messageId,
            @Schema(name = "body", description = "The reply message body (plain text)") String body
    ) {
        log.info("ADK tool: reply_to_email messageId={}", messageId);

        Map<String, Object> result = new HashMap<>();

        if (!gmailApiService.isAuthorized()) {
            result.put("success", false);
            result.put("error", "Gmail API is not authorized. Please complete OAuth setup at /agent/gmail/auth/url");
            return result;
        }

        if (messageId == null || messageId.isBlank()) {
            result.put("success", false);
            result.put("error", "Message ID is required");
            return result;
        }

        if (body == null || body.isBlank()) {
            result.put("success", false);
            result.put("error", "Reply body is required");
            return result;
        }

        try {
            gmailApiService.replyToEmail(messageId, body);

            result.put("success", true);
            result.put("message", "Reply sent successfully");
            result.put("repliedTo", messageId);

            log.info("Reply sent to messageId={}", messageId);
        } catch (GmailApiException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("errorType", e.getErrorType().name());
            log.warn("Failed to reply to email: {}", e.getMessage());
        }

        return result;
    }

    @Schema(name = "compose_email", description = "Compose and send a new email via Gmail API. Uses the authorized Gmail account as sender.")
    public Map<String, Object> composeEmail(
            @Schema(name = "to", description = "Recipient email address") String to,
            @Schema(name = "subject", description = "Email subject line") String subject,
            @Schema(name = "body", description = "Email body content (plain text)") String body,
            @Schema(name = "cc", description = "CC recipients (comma-separated email addresses)", optional = true) String cc
    ) {
        log.info("ADK tool: send_email to={} subject={}", to, subject);

        Map<String, Object> result = new HashMap<>();

        if (!gmailApiService.isAuthorized()) {
            result.put("success", false);
            result.put("error", "Gmail API is not authorized. Please complete OAuth setup at /agent/gmail/auth/url");
            return result;
        }

        if (to == null || to.isBlank()) {
            result.put("success", false);
            result.put("error", "Recipient email address (to) is required");
            return result;
        }

        if (subject == null || subject.isBlank()) {
            result.put("success", false);
            result.put("error", "Email subject is required");
            return result;
        }

        if (body == null || body.isBlank()) {
            result.put("success", false);
            result.put("error", "Email body is required");
            return result;
        }

        try {
            gmailApiService.sendEmail(to, subject, body, cc);

            result.put("success", true);
            result.put("message", "Email sent successfully");
            result.put("to", to);
            result.put("subject", subject);

            log.info("Email sent to={}", to);
        } catch (GmailApiException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("errorType", e.getErrorType().name());
            log.warn("Failed to send email: {}", e.getMessage());
        }

        return result;
    }

    @Schema(name = "mark_email_read", description = "Mark an email as read by removing the UNREAD label.")
    public Map<String, Object> markAsRead(
            @Schema(name = "message_id", description = "The message ID to mark as read") String messageId
    ) {
        log.info("ADK tool: mark_email_read messageId={}", messageId);

        Map<String, Object> result = new HashMap<>();

        if (!gmailApiService.isAuthorized()) {
            result.put("success", false);
            result.put("error", "Gmail API is not authorized. Please complete OAuth setup at /agent/gmail/auth/url");
            return result;
        }

        if (messageId == null || messageId.isBlank()) {
            result.put("success", false);
            result.put("error", "Message ID is required");
            return result;
        }

        try {
            gmailApiService.markAsRead(messageId);

            result.put("success", true);
            result.put("message", "Email marked as read");
            result.put("messageId", messageId);

            log.info("Marked email as read messageId={}", messageId);
        } catch (GmailApiException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("errorType", e.getErrorType().name());
            log.warn("Failed to mark email as read: {}", e.getMessage());
        }

        return result;
    }

    @Schema(name = "mark_email_unread", description = "Mark an email as unread by adding the UNREAD label.")
    public Map<String, Object> markAsUnread(
            @Schema(name = "message_id", description = "The message ID to mark as unread") String messageId
    ) {
        log.info("ADK tool: mark_email_unread messageId={}", messageId);

        Map<String, Object> result = new HashMap<>();

        if (!gmailApiService.isAuthorized()) {
            result.put("success", false);
            result.put("error", "Gmail API is not authorized. Please complete OAuth setup at /agent/gmail/auth/url");
            return result;
        }

        if (messageId == null || messageId.isBlank()) {
            result.put("success", false);
            result.put("error", "Message ID is required");
            return result;
        }

        try {
            gmailApiService.markAsUnread(messageId);

            result.put("success", true);
            result.put("message", "Email marked as unread");
            result.put("messageId", messageId);

            log.info("Marked email as unread messageId={}", messageId);
        } catch (GmailApiException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("errorType", e.getErrorType().name());
            log.warn("Failed to mark email as unread: {}", e.getMessage());
        }

        return result;
    }

    @Schema(name = "analyze_email", description = "Analyze an email and provide response suggestions. Gets the email content and returns it with context for AI analysis. The AI should then provide response suggestions based on the email content and any additional context provided.")
    public Map<String, Object> analyzeEmail(
            @Schema(name = "message_id", description = "The message ID to analyze") String messageId,
            @Schema(name = "context", description = "Additional context for analysis (e.g., 'This is from a client', 'I want to decline politely')", optional = true) String context
    ) {
        log.info("ADK tool: analyze_email messageId={} context={}", messageId, context);

        Map<String, Object> result = new HashMap<>();

        if (!gmailApiService.isAuthorized()) {
            result.put("success", false);
            result.put("error", "Gmail API is not authorized. Please complete OAuth setup at /agent/gmail/auth/url");
            return result;
        }

        if (messageId == null || messageId.isBlank()) {
            result.put("success", false);
            result.put("error", "Message ID is required");
            return result;
        }

        try {
            EmailDetails email = gmailApiService.getEmail(messageId);

            result.put("success", true);
            result.put("email", emailDetailsToMap(email));
            result.put("context", context != null ? context : "");
            result.put("analysisHint", buildAnalysisHint(email, context));

            log.info("Prepared email for analysis messageId={}", messageId);
        } catch (GmailApiException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("errorType", e.getErrorType().name());
            log.warn("Failed to analyze email: {}", e.getMessage());
        }

        return result;
    }

    private String buildAnalysisHint(EmailDetails email, String context) {
        StringBuilder hint = new StringBuilder();
        hint.append("Please analyze this email and suggest appropriate responses. ");
        hint.append("Consider the sender (").append(email.getFrom()).append("), ");
        hint.append("subject (").append(email.getSubject()).append("), ");
        hint.append("and tone of the message. ");

        if (context != null && !context.isBlank()) {
            hint.append("Additional context: ").append(context).append(". ");
        }

        hint.append("Provide 2-3 response options ranging from brief to detailed.");
        return hint.toString();
    }

    private Map<String, Object> emailSummaryToMap(EmailSummary email) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", email.getId());
        map.put("threadId", email.getThreadId());
        map.put("subject", email.getSubject());
        map.put("from", email.getFrom());
        map.put("snippet", email.getSnippet());
        map.put("date", email.getDate() != null ? email.getDate().toString() : null);
        map.put("labels", email.getLabels());
        map.put("unread", email.isUnread());
        map.put("hasAttachments", email.isHasAttachments());
        return map;
    }

    private Map<String, Object> emailDetailsToMap(EmailDetails email) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", email.getId());
        map.put("threadId", email.getThreadId());
        map.put("subject", email.getSubject());
        map.put("from", email.getFrom());
        map.put("to", email.getTo());
        map.put("cc", email.getCc());
        map.put("body", email.getBody());
        map.put("date", email.getDate() != null ? email.getDate().toString() : null);
        map.put("labels", email.getLabels());
        map.put("unread", email.isUnread());
        map.put("attachments", email.getAttachments() != null
                ? email.getAttachments().stream()
                .map(a -> Map.of(
                        "filename", a.getFilename(),
                        "mimeType", a.getMimeType(),
                        "size", a.getSize()
                ))
                .collect(Collectors.toList())
                : List.of());
        return map;
    }
}
