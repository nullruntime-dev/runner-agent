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

import com.google.api.client.auth.oauth2.TokenResponseException;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeTokenRequest;
import com.google.api.client.googleapis.auth.oauth2.GoogleCredential;
import com.google.api.client.googleapis.auth.oauth2.GoogleTokenResponse;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.HttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.GmailScopes;
import com.google.api.services.gmail.model.*;
import dev.runner.agent.domain.GmailToken;
import dev.runner.agent.domain.GmailTokenRepository;
import dev.runner.agent.dto.EmailDetails;
import dev.runner.agent.dto.EmailSummary;
import dev.runner.agent.exception.GmailApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.mail.MessagingException;
import javax.mail.Session;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class GmailApiService {

    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final List<String> SCOPES = List.of(
            GmailScopes.GMAIL_READONLY,
            GmailScopes.GMAIL_SEND,
            GmailScopes.GMAIL_MODIFY
    );
    private static final String APPLICATION_NAME = "Runner Agent";

    private final GmailTokenRepository tokenRepository;
    private final SkillService skillService;
    private HttpTransport httpTransport;

    public GmailApiService(GmailTokenRepository tokenRepository, SkillService skillService) {
        this.tokenRepository = tokenRepository;
        this.skillService = skillService;
        try {
            this.httpTransport = GoogleNetHttpTransport.newTrustedTransport();
        } catch (GeneralSecurityException | IOException e) {
            log.error("Failed to initialize HTTP transport", e);
        }
    }

    private Optional<Map<String, String>> getConfig() {
        return skillService.getSkillConfig("gmail-api");
    }

    private String getClientId() {
        return getConfig().map(c -> c.get("clientId")).orElse(null);
    }

    private String getClientSecret() {
        return getConfig().map(c -> c.get("clientSecret")).orElse(null);
    }

    public boolean isConfigured() {
        String clientId = getClientId();
        String clientSecret = getClientSecret();
        return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
    }

    public boolean isAuthorized() {
        if (!isConfigured()) return false;
        return tokenRepository.findFirstByOrderByUpdatedAtDesc().isPresent();
    }

    public String getAuthorizedEmail() {
        return tokenRepository.findFirstByOrderByUpdatedAtDesc()
                .map(GmailToken::getEmail)
                .orElse(null);
    }

    public String generateAuthUrl(String redirectUri) {
        if (!isConfigured()) {
            throw GmailApiException.notConfigured();
        }

        GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
                httpTransport, JSON_FACTORY, getClientId(), getClientSecret(), SCOPES)
                .setAccessType("offline")
                .setApprovalPrompt("force")
                .build();

        return flow.newAuthorizationUrl()
                .setRedirectUri(redirectUri)
                .build();
    }

    @Transactional
    public GmailToken exchangeCodeForTokens(String code, String redirectUri) throws IOException {
        if (!isConfigured()) {
            throw GmailApiException.notConfigured();
        }

        GoogleTokenResponse tokenResponse = new GoogleAuthorizationCodeTokenRequest(
                httpTransport, JSON_FACTORY, getClientId(), getClientSecret(), code, redirectUri)
                .execute();

        String accessToken = tokenResponse.getAccessToken();
        String refreshToken = tokenResponse.getRefreshToken();
        Long expiresInSeconds = tokenResponse.getExpiresInSeconds();

        // Get the user's email address
        Gmail gmail = buildGmailService(accessToken);
        Profile profile = gmail.users().getProfile("me").execute();
        String email = profile.getEmailAddress();

        log.info("OAuth completed for email={}", email);

        // Save or update the token
        GmailToken token = tokenRepository.findByEmail(email)
                .orElseGet(() -> GmailToken.builder().email(email).build());

        token.setAccessToken(accessToken);
        if (refreshToken != null) {
            token.setRefreshToken(refreshToken);
        }
        token.setExpiresAt(Instant.now().plusSeconds(expiresInSeconds != null ? expiresInSeconds : 3600));
        token.setScope(String.join(" ", SCOPES));

        return tokenRepository.save(token);
    }

    private Gmail getGmailService() {
        GmailToken token = tokenRepository.findFirstByOrderByUpdatedAtDesc()
                .orElseThrow(GmailApiException::notConfigured);

        if (token.isExpired()) {
            token = refreshAccessToken(token);
        }

        return buildGmailService(token.getAccessToken());
    }

    private Gmail buildGmailService(String accessToken) {
        GoogleCredential credential = new GoogleCredential().setAccessToken(accessToken);
        return new Gmail.Builder(httpTransport, JSON_FACTORY, credential)
                .setApplicationName(APPLICATION_NAME)
                .build();
    }

    @Transactional
    public GmailToken refreshAccessToken(GmailToken token) {
        if (!isConfigured()) {
            throw GmailApiException.notConfigured();
        }

        try {
            GoogleCredential credential = new GoogleCredential.Builder()
                    .setTransport(httpTransport)
                    .setJsonFactory(JSON_FACTORY)
                    .setClientSecrets(getClientId(), getClientSecret())
                    .build()
                    .setRefreshToken(token.getRefreshToken());

            if (credential.refreshToken()) {
                token.setAccessToken(credential.getAccessToken());
                token.setExpiresAt(Instant.now().plusSeconds(
                        credential.getExpiresInSeconds() != null ? credential.getExpiresInSeconds() : 3600));
                return tokenRepository.save(token);
            } else {
                throw GmailApiException.reauthRequired();
            }
        } catch (TokenResponseException e) {
            log.error("Token refresh failed: {}", e.getMessage());
            throw GmailApiException.reauthRequired();
        } catch (IOException e) {
            throw GmailApiException.apiError("Failed to refresh token", e);
        }
    }

    public List<EmailSummary> listEmails(String label, int maxResults, String pageToken) {
        try {
            Gmail gmail = getGmailService();
            Gmail.Users.Messages.List request = gmail.users().messages().list("me")
                    .setMaxResults((long) maxResults);

            if (label != null && !label.isBlank()) {
                request.setLabelIds(List.of(label.toUpperCase()));
            }
            if (pageToken != null && !pageToken.isBlank()) {
                request.setPageToken(pageToken);
            }

            ListMessagesResponse response = request.execute();
            List<Message> messages = response.getMessages();

            if (messages == null || messages.isEmpty()) {
                return List.of();
            }

            return messages.stream()
                    .map(msg -> getEmailSummary(gmail, msg.getId()))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
        } catch (IOException e) {
            handleGmailException(e);
            throw GmailApiException.apiError("Failed to list emails", e);
        }
    }

    public List<EmailSummary> searchEmails(String query, int maxResults) {
        try {
            Gmail gmail = getGmailService();
            ListMessagesResponse response = gmail.users().messages().list("me")
                    .setQ(query)
                    .setMaxResults((long) maxResults)
                    .execute();

            List<Message> messages = response.getMessages();

            if (messages == null || messages.isEmpty()) {
                return List.of();
            }

            return messages.stream()
                    .map(msg -> getEmailSummary(gmail, msg.getId()))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
        } catch (IOException e) {
            handleGmailException(e);
            throw GmailApiException.apiError("Failed to search emails", e);
        }
    }

    private EmailSummary getEmailSummary(Gmail gmail, String messageId) {
        try {
            Message message = gmail.users().messages().get("me", messageId)
                    .setFormat("metadata")
                    .setMetadataHeaders(List.of("Subject", "From", "Date"))
                    .execute();

            return buildEmailSummary(message);
        } catch (IOException e) {
            log.warn("Failed to get email summary for id={}: {}", messageId, e.getMessage());
            return null;
        }
    }

    private EmailSummary buildEmailSummary(Message message) {
        Map<String, String> headers = extractHeaders(message.getPayload());

        return EmailSummary.builder()
                .id(message.getId())
                .threadId(message.getThreadId())
                .subject(headers.getOrDefault("Subject", "(no subject)"))
                .from(headers.getOrDefault("From", ""))
                .snippet(message.getSnippet())
                .date(parseGmailDate(headers.get("Date"), message.getInternalDate()))
                .labels(message.getLabelIds())
                .unread(message.getLabelIds() != null && message.getLabelIds().contains("UNREAD"))
                .hasAttachments(hasAttachments(message.getPayload()))
                .build();
    }

    public EmailDetails getEmail(String messageId) {
        try {
            Gmail gmail = getGmailService();
            Message message = gmail.users().messages().get("me", messageId)
                    .setFormat("full")
                    .execute();

            return buildEmailDetails(message);
        } catch (IOException e) {
            handleGmailException(e);
            throw GmailApiException.apiError("Failed to get email", e);
        }
    }

    public List<EmailDetails> getThread(String threadId) {
        try {
            Gmail gmail = getGmailService();
            com.google.api.services.gmail.model.Thread thread = gmail.users().threads().get("me", threadId)
                    .setFormat("full")
                    .execute();

            return thread.getMessages().stream()
                    .map(this::buildEmailDetails)
                    .collect(Collectors.toList());
        } catch (IOException e) {
            handleGmailException(e);
            throw GmailApiException.apiError("Failed to get thread", e);
        }
    }

    private EmailDetails buildEmailDetails(Message message) {
        Map<String, String> headers = extractHeaders(message.getPayload());
        String body = extractBody(message.getPayload(), "text/plain");
        String bodyHtml = extractBody(message.getPayload(), "text/html");

        return EmailDetails.builder()
                .id(message.getId())
                .threadId(message.getThreadId())
                .subject(headers.getOrDefault("Subject", "(no subject)"))
                .from(headers.getOrDefault("From", ""))
                .to(parseAddressList(headers.get("To")))
                .cc(parseAddressList(headers.get("Cc")))
                .body(body != null ? body : bodyHtml)
                .bodyHtml(bodyHtml)
                .date(parseGmailDate(headers.get("Date"), message.getInternalDate()))
                .labels(message.getLabelIds())
                .unread(message.getLabelIds() != null && message.getLabelIds().contains("UNREAD"))
                .attachments(extractAttachmentInfo(message.getPayload()))
                .build();
    }

    public void replyToEmail(String messageId, String body) {
        try {
            Gmail gmail = getGmailService();

            // Get the original message
            Message original = gmail.users().messages().get("me", messageId)
                    .setFormat("metadata")
                    .setMetadataHeaders(List.of("Subject", "From", "To", "Message-ID", "References", "In-Reply-To"))
                    .execute();

            Map<String, String> headers = extractHeaders(original.getPayload());

            // Build reply
            String subject = headers.getOrDefault("Subject", "");
            if (!subject.toLowerCase().startsWith("re:")) {
                subject = "Re: " + subject;
            }

            String to = headers.get("From"); // Reply to sender
            String messageIdHeader = headers.get("Message-ID");
            String references = headers.get("References");

            // Build references header
            String newReferences = references != null ? references + " " + messageIdHeader : messageIdHeader;

            MimeMessage mimeMessage = createReplyMessage(to, subject, body, messageIdHeader, newReferences);
            Message replyMessage = createMessageWithEmail(mimeMessage);
            replyMessage.setThreadId(original.getThreadId());

            gmail.users().messages().send("me", replyMessage).execute();
            log.info("Reply sent to threadId={}", original.getThreadId());
        } catch (IOException | MessagingException e) {
            handleGmailException(e);
            throw GmailApiException.apiError("Failed to send reply", e);
        }
    }

    public void sendEmail(String to, String subject, String body, String cc) {
        try {
            Gmail gmail = getGmailService();

            MimeMessage mimeMessage = createNewMessage(to, subject, body, cc);
            Message message = createMessageWithEmail(mimeMessage);

            gmail.users().messages().send("me", message).execute();
            log.info("Email sent to={} subject={}", to, subject);
        } catch (IOException | MessagingException e) {
            handleGmailException(e);
            throw GmailApiException.apiError("Failed to send email", e);
        }
    }

    private MimeMessage createNewMessage(String to, String subject, String body, String cc) throws MessagingException {
        Properties props = new Properties();
        Session session = Session.getDefaultInstance(props, null);
        MimeMessage email = new MimeMessage(session);

        email.setFrom(new InternetAddress(getAuthorizedEmail()));
        email.addRecipient(javax.mail.Message.RecipientType.TO, new InternetAddress(to));
        if (cc != null && !cc.isBlank()) {
            for (String ccAddr : cc.split(",")) {
                email.addRecipient(javax.mail.Message.RecipientType.CC, new InternetAddress(ccAddr.trim()));
            }
        }
        email.setSubject(subject);
        email.setText(body);

        return email;
    }

    private MimeMessage createReplyMessage(String to, String subject, String body,
                                           String inReplyTo, String references) throws MessagingException {
        Properties props = new Properties();
        Session session = Session.getDefaultInstance(props, null);
        MimeMessage email = new MimeMessage(session);

        email.setFrom(new InternetAddress(getAuthorizedEmail()));
        email.addRecipient(javax.mail.Message.RecipientType.TO, new InternetAddress(to));
        email.setSubject(subject);
        email.setText(body);

        if (inReplyTo != null) {
            email.setHeader("In-Reply-To", inReplyTo);
        }
        if (references != null) {
            email.setHeader("References", references);
        }

        return email;
    }

    private Message createMessageWithEmail(MimeMessage email) throws MessagingException, IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        email.writeTo(buffer);
        byte[] bytes = buffer.toByteArray();
        String encodedEmail = Base64.getUrlEncoder().encodeToString(bytes);

        Message message = new Message();
        message.setRaw(encodedEmail);
        return message;
    }

    public void markAsRead(String messageId) {
        modifyLabels(messageId, List.of(), List.of("UNREAD"));
    }

    public void markAsUnread(String messageId) {
        modifyLabels(messageId, List.of("UNREAD"), List.of());
    }

    private void modifyLabels(String messageId, List<String> addLabels, List<String> removeLabels) {
        try {
            Gmail gmail = getGmailService();
            ModifyMessageRequest request = new ModifyMessageRequest()
                    .setAddLabelIds(addLabels)
                    .setRemoveLabelIds(removeLabels);

            gmail.users().messages().modify("me", messageId, request).execute();
            log.info("Modified labels for messageId={} add={} remove={}", messageId, addLabels, removeLabels);
        } catch (IOException e) {
            handleGmailException(e);
            throw GmailApiException.apiError("Failed to modify labels", e);
        }
    }

    private Map<String, String> extractHeaders(MessagePart payload) {
        if (payload == null || payload.getHeaders() == null) {
            return Map.of();
        }
        return payload.getHeaders().stream()
                .filter(h -> h.getValue() != null)
                .collect(Collectors.toMap(
                        MessagePartHeader::getName,
                        MessagePartHeader::getValue,
                        (v1, v2) -> v1
                ));
    }

    private String extractBody(MessagePart payload, String mimeType) {
        if (payload == null) return null;

        // Check if this part is the body
        if (mimeType.equals(payload.getMimeType()) && payload.getBody() != null) {
            String data = payload.getBody().getData();
            if (data != null) {
                return new String(Base64.getUrlDecoder().decode(data));
            }
        }

        // Check nested parts
        if (payload.getParts() != null) {
            for (MessagePart part : payload.getParts()) {
                String body = extractBody(part, mimeType);
                if (body != null) return body;
            }
        }

        return null;
    }

    private boolean hasAttachments(MessagePart payload) {
        if (payload == null) return false;
        if (payload.getFilename() != null && !payload.getFilename().isEmpty()) {
            return true;
        }
        if (payload.getParts() != null) {
            return payload.getParts().stream().anyMatch(this::hasAttachments);
        }
        return false;
    }

    private List<EmailDetails.AttachmentInfo> extractAttachmentInfo(MessagePart payload) {
        List<EmailDetails.AttachmentInfo> attachments = new ArrayList<>();
        extractAttachmentInfoRecursive(payload, attachments);
        return attachments;
    }

    private void extractAttachmentInfoRecursive(MessagePart part, List<EmailDetails.AttachmentInfo> attachments) {
        if (part == null) return;

        if (part.getFilename() != null && !part.getFilename().isEmpty() && part.getBody() != null) {
            attachments.add(EmailDetails.AttachmentInfo.builder()
                    .filename(part.getFilename())
                    .mimeType(part.getMimeType())
                    .size(part.getBody().getSize() != null ? part.getBody().getSize() : 0)
                    .attachmentId(part.getBody().getAttachmentId())
                    .build());
        }

        if (part.getParts() != null) {
            part.getParts().forEach(p -> extractAttachmentInfoRecursive(p, attachments));
        }
    }

    private List<String> parseAddressList(String addresses) {
        if (addresses == null || addresses.isBlank()) {
            return List.of();
        }
        return Arrays.stream(addresses.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }

    private Instant parseGmailDate(String dateHeader, Long internalDate) {
        if (internalDate != null) {
            return Instant.ofEpochMilli(internalDate);
        }
        return Instant.now();
    }

    private void handleGmailException(Exception e) {
        if (e instanceof com.google.api.client.googleapis.json.GoogleJsonResponseException gje) {
            int code = gje.getStatusCode();
            if (code == 401) {
                throw GmailApiException.reauthRequired();
            } else if (code == 403) {
                throw GmailApiException.permissionDenied();
            } else if (code == 404) {
                throw GmailApiException.notFound("Email or thread");
            } else if (code == 429) {
                throw GmailApiException.rateLimited();
            }
        }
    }

    @Transactional
    public void revokeAuthorization() {
        tokenRepository.deleteAll();
        log.info("Gmail authorization revoked");
    }
}
