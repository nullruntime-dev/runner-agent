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

import dev.runner.agent.domain.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
//AIzaSyBBmIACfxVcaOHtwtZKPQa-8Fr52Y_KPHE
//<script async src="https://cse.google.com/cse.js?cx=076fb230554124231">
//</script>
//<div class="gcse-search"></div>
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatSessionRepository sessionRepository;
    private final ChatMessageRepository messageRepository;

    @Transactional
    public ChatSession getOrCreateSession(String sessionId) {
        return sessionRepository.findByIdAndArchivedAtIsNull(sessionId)
                .orElseGet(() -> {
                    log.info("Creating new chat session id={}", sessionId);
                    ChatSession session = ChatSession.builder()
                            .id(sessionId)
                            .build();
                    return sessionRepository.save(session);
                });
    }

    @Transactional
    public ChatMessage saveUserMessage(String sessionId, String content) {
        ChatSession session = getOrCreateSession(sessionId);

        // Set title from first user message if not set
        if (session.getTitle() == null || session.getTitle().isBlank()) {
            String title = generateTitle(content);
            session.setTitle(title);
            sessionRepository.save(session);
        }

        ChatMessage message = ChatMessage.builder()
                .session(session)
                .role(ChatMessage.ChatRole.USER)
                .content(content)
                .build();

        log.debug("Saving user message sessionId={} contentLength={}", sessionId, content.length());
        return messageRepository.save(message);
    }

    @Transactional
    public ChatMessage saveAssistantMessage(String sessionId, String content) {
        ChatSession session = getOrCreateSession(sessionId);

        ChatMessage message = ChatMessage.builder()
                .session(session)
                .role(ChatMessage.ChatRole.ASSISTANT)
                .content(content)
                .build();

        log.debug("Saving assistant message sessionId={} contentLength={}", sessionId, content.length());
        return messageRepository.save(message);
    }

    @Transactional(readOnly = true)
    public List<ChatMessage> getSessionHistory(String sessionId) {
        return messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
    }

    @Transactional(readOnly = true)
    public List<ChatMessage> getSessionHistory(String sessionId, int limit) {
        return messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId, PageRequest.of(0, limit));
    }

    @Transactional(readOnly = true)
    public Optional<ChatSession> getSession(String sessionId) {
        return sessionRepository.findByIdAndArchivedAtIsNull(sessionId);
    }

    @Transactional(readOnly = true)
    public Optional<ChatSession> getSessionWithMessages(String sessionId) {
        return sessionRepository.findByIdWithMessages(sessionId);
    }

    @Transactional(readOnly = true)
    public List<ChatSession> listSessions() {
        return sessionRepository.findAllByArchivedAtIsNullOrderByUpdatedAtDesc();
    }

    @Transactional(readOnly = true)
    public List<ChatSession> listSessions(int limit) {
        return sessionRepository.findAllByArchivedAtIsNullOrderByUpdatedAtDesc(PageRequest.of(0, limit));
    }

    @Transactional
    public void archiveSession(String sessionId) {
        log.info("Archiving chat session id={}", sessionId);
        sessionRepository.findById(sessionId).ifPresent(session -> {
            session.setArchivedAt(Instant.now());
            sessionRepository.save(session);
        });
    }

    @Transactional(readOnly = true)
    public long getMessageCount(String sessionId) {
        return messageRepository.countBySessionId(sessionId);
    }

    private String generateTitle(String firstMessage) {
        // Generate a title from the first message (truncate if too long)
        String title = firstMessage.trim();
        if (title.length() > 100) {
            title = title.substring(0, 97) + "...";
        }
        return title;
    }
}
