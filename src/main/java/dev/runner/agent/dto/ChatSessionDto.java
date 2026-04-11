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
package dev.runner.agent.dto;

import dev.runner.agent.domain.ChatMessage;
import dev.runner.agent.domain.ChatSession;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatSessionDto {

    private String id;
    private String title;
    private Instant createdAt;
    private Instant updatedAt;
    private List<ChatMessageDto> messages;
    private long messageCount;

    public static ChatSessionDto from(ChatSession session) {
        return ChatSessionDto.builder()
                .id(session.getId())
                .title(session.getTitle())
                .createdAt(session.getCreatedAt())
                .updatedAt(session.getUpdatedAt())
                .build();
    }

    public static ChatSessionDto fromWithMessages(ChatSession session) {
        return ChatSessionDto.builder()
                .id(session.getId())
                .title(session.getTitle())
                .createdAt(session.getCreatedAt())
                .updatedAt(session.getUpdatedAt())
                .messages(session.getMessages().stream()
                        .map(ChatMessageDto::from)
                        .toList())
                .messageCount(session.getMessages().size())
                .build();
    }

    public static ChatSessionDto fromWithMessageCount(ChatSession session, long messageCount) {
        return ChatSessionDto.builder()
                .id(session.getId())
                .title(session.getTitle())
                .createdAt(session.getCreatedAt())
                .updatedAt(session.getUpdatedAt())
                .messageCount(messageCount)
                .build();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatMessageDto {
        private Long id;
        private String role;
        private String content;
        private Instant createdAt;

        public static ChatMessageDto from(ChatMessage message) {
            return ChatMessageDto.builder()
                    .id(message.getId())
                    .role(message.getRole().name().toLowerCase())
                    .content(message.getContent())
                    .createdAt(message.getCreatedAt())
                    .build();
        }
    }
}
