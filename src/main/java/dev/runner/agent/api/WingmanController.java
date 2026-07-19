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
package dev.runner.agent.api;

import dev.runner.agent.domain.ChatMessage;
import dev.runner.agent.domain.ChatSession;
import dev.runner.agent.domain.CrushProfile;
import dev.runner.agent.service.ChatService;
import dev.runner.agent.service.CrushProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/wingman")
@RequiredArgsConstructor
public class WingmanController {

    private final CrushProfileService crushProfileService;
    private final ChatService chatService;

    @GetMapping("/export")
    public ResponseEntity<Map<String, Object>> exportHistory() {
        log.info("GET /wingman/export");

        List<CrushProfile> profiles = crushProfileService.getAllProfiles("default");
        List<ChatSession> sessions = chatService.listSessions();

        List<Map<String, Object>> exportedProfiles = profiles.stream()
                .map(this::profileToMap)
                .toList();

        List<Map<String, Object>> exportedSessions = sessions.stream()
                .map(this::sessionToMap)
                .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("exportedAt", Instant.now().toString());
        result.put("version", "1.0");
        result.put("profileCount", profiles.size());
        result.put("profiles", exportedProfiles);
        result.put("sessionCount", sessions.size());
        result.put("sessions", exportedSessions);

        return ResponseEntity.ok(result);
    }

    @GetMapping("/export/{name}")
    public ResponseEntity<?> exportProfile(@PathVariable String name) {
        log.info("GET /wingman/export/{}", name);

        return crushProfileService.getProfile("default", name)
                .map(profile -> ResponseEntity.ok(Map.of(
                        "exportedAt", Instant.now().toString(),
                        "version", "1.0",
                        "profile", profileToMap(profile)
                )))
                .orElse(ResponseEntity.notFound().build());
    }

    private Map<String, Object> profileToMap(CrushProfile profile) {
        return Map.ofEntries(
                Map.entry("id", profile.getId()),
                Map.entry("name", profile.getName()),
                Map.entry("displayName", profile.getDisplayName() != null ? profile.getDisplayName() : profile.getName()),
                Map.entry("nickname", profile.getNickname() != null ? profile.getNickname() : ""),
                Map.entry("platform", profile.getPlatform() != null ? profile.getPlatform() : ""),
                Map.entry("relationshipStage", profile.getRelationshipStage() != null ? profile.getRelationshipStage() : ""),
                Map.entry("interests", profile.getInterests() != null ? profile.getInterests() : ""),
                Map.entry("personality", profile.getPersonality() != null ? profile.getPersonality() : ""),
                Map.entry("communicationStyle", profile.getCommunicationStyle() != null ? profile.getCommunicationStyle() : ""),
                Map.entry("knownFacts", profile.getKnownFacts() != null ? profile.getKnownFacts() : ""),
                Map.entry("recentMessages", profile.getRecentMessages() != null ? profile.getRecentMessages() : ""),
                Map.entry("messageCount", profile.getMessageCount() != null ? profile.getMessageCount() : 0),
                Map.entry("createdAt", profile.getCreatedAt().toString()),
                Map.entry("updatedAt", profile.getUpdatedAt().toString())
        );
    }

    private Map<String, Object> sessionToMap(ChatSession session) {
        List<ChatMessage> messages = chatService.getSessionHistory(session.getId());

        List<Map<String, Object>> exportedMessages = messages.stream()
                .map(this::messageToMap)
                .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("id", session.getId());
        result.put("title", session.getTitle() != null ? session.getTitle() : "");
        result.put("createdAt", session.getCreatedAt().toString());
        result.put("updatedAt", session.getUpdatedAt().toString());
        result.put("messageCount", messages.size());
        result.put("messages", exportedMessages);

        return result;
    }

    private Map<String, Object> messageToMap(ChatMessage message) {
        return Map.of(
                "id", message.getId(),
                "role", message.getRole().name().toLowerCase(),
                "content", message.getContent(),
                "createdAt", message.getCreatedAt().toString()
        );
    }
}
