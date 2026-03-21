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

import dev.runner.agent.domain.CrushProfile;
import dev.runner.agent.domain.CrushProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CrushProfileService {

    private final CrushProfileRepository crushProfileRepository;

    private static final int MAX_RECENT_MESSAGES = 20;

    @Transactional
    public CrushProfile getOrCreateProfile(String sessionId, String name) {
        String normalizedName = normalizeName(name);
        return crushProfileRepository.findBySessionIdAndName(sessionId, normalizedName)
                .orElseGet(() -> {
                    log.info("Creating new crush profile: session={} name={} displayName={}",
                            sessionId, normalizedName, name.trim());
                    CrushProfile profile = CrushProfile.builder()
                            .sessionId(sessionId)
                            .name(normalizedName)
                            .displayName(name.trim())
                            .messageCount(0)
                            .build();
                    return crushProfileRepository.save(profile);
                });
    }

    /**
     * Normalize name for consistent lookup - lowercase, trimmed, single spaces
     */
    private String normalizeName(String name) {
        return name.toLowerCase().trim().replaceAll("\\s+", " ");
    }

    @Transactional
    public CrushProfile addMessage(String sessionId, String name, String theirMessage) {
        CrushProfile profile = getOrCreateProfile(sessionId, name);

        // Ensure display name is set (might be missing for old profiles)
        if (profile.getDisplayName() == null || profile.getDisplayName().isBlank()) {
            profile.setDisplayName(name.trim());
        }

        // Append to recent messages (keep last N)
        String recentMessages = profile.getRecentMessages();
        if (recentMessages == null) {
            recentMessages = "";
        }

        // Add timestamp to message for context
        String timestamp = java.time.LocalDateTime.now().format(
                java.time.format.DateTimeFormatter.ofPattern("MM/dd HH:mm"));
        String newEntry = "- [" + timestamp + "] \"" + theirMessage.replace("\"", "'") + "\"\n";
        recentMessages = recentMessages + newEntry;

        // Keep only last N messages
        String[] lines = recentMessages.split("\n");
        if (lines.length > MAX_RECENT_MESSAGES) {
            StringBuilder sb = new StringBuilder();
            for (int i = lines.length - MAX_RECENT_MESSAGES; i < lines.length; i++) {
                sb.append(lines[i]).append("\n");
            }
            recentMessages = sb.toString();
        }

        profile.setRecentMessages(recentMessages);
        profile.setMessageCount(profile.getMessageCount() + 1);

        log.info("Added message to profile: session={} name={} displayName={} totalMessages={}",
                sessionId, profile.getName(), profile.getDisplayName(), profile.getMessageCount());

        return crushProfileRepository.save(profile);
    }

    @Transactional
    public CrushProfile updateProfileTraits(String sessionId, String name,
                                             String interests, String personality,
                                             String communicationStyle, String knownFacts) {
        CrushProfile profile = getOrCreateProfile(sessionId, name);

        // Append new info to existing
        if (interests != null && !interests.isBlank()) {
            profile.setInterests(appendInfo(profile.getInterests(), interests));
        }
        if (personality != null && !personality.isBlank()) {
            profile.setPersonality(appendInfo(profile.getPersonality(), personality));
        }
        if (communicationStyle != null && !communicationStyle.isBlank()) {
            profile.setCommunicationStyle(appendInfo(profile.getCommunicationStyle(), communicationStyle));
        }
        if (knownFacts != null && !knownFacts.isBlank()) {
            profile.setKnownFacts(appendInfo(profile.getKnownFacts(), knownFacts));
        }

        log.info("Updated profile traits: session={} name={}", sessionId, name);

        return crushProfileRepository.save(profile);
    }

    @Transactional
    public CrushProfile setProfileMeta(String sessionId, String name,
                                        String nickname, String platform, String relationshipStage) {
        CrushProfile profile = getOrCreateProfile(sessionId, name);

        if (nickname != null && !nickname.isBlank()) {
            profile.setNickname(nickname);
        }
        if (platform != null && !platform.isBlank()) {
            profile.setPlatform(platform);
        }
        if (relationshipStage != null && !relationshipStage.isBlank()) {
            profile.setRelationshipStage(relationshipStage);
        }

        return crushProfileRepository.save(profile);
    }

    public Optional<CrushProfile> getProfile(String sessionId, String name) {
        String normalizedName = normalizeName(name);

        // Try exact match first
        Optional<CrushProfile> exact = crushProfileRepository.findBySessionIdAndName(sessionId, normalizedName);
        if (exact.isPresent()) {
            return exact;
        }

        // Try case-insensitive match
        Optional<CrushProfile> caseInsensitive = crushProfileRepository.findBySessionIdAndNameIgnoreCase(sessionId, normalizedName);
        if (caseInsensitive.isPresent()) {
            return caseInsensitive;
        }

        // Try display name match
        Optional<CrushProfile> displayNameMatch = crushProfileRepository.findBySessionIdAndDisplayNameIgnoreCase(sessionId, name.trim());
        if (displayNameMatch.isPresent()) {
            return displayNameMatch;
        }

        // Try partial match (first name only, or contains)
        String firstName = normalizedName.split(" ")[0];
        List<CrushProfile> partialMatches = crushProfileRepository.findBySessionIdAndNameContainingIgnoreCase(sessionId, firstName);
        if (!partialMatches.isEmpty()) {
            log.info("Found {} partial match(es) for '{}' using first name '{}'", partialMatches.size(), name, firstName);
            return Optional.of(partialMatches.get(0));
        }

        return Optional.empty();
    }

    /**
     * Get or create a profile - useful when we want to ensure a profile exists
     */
    public CrushProfile getOrCreateProfileForLookup(String sessionId, String name) {
        return getProfile(sessionId, name)
                .orElseGet(() -> getOrCreateProfile(sessionId, name));
    }

    public List<CrushProfile> getAllProfiles(String sessionId) {
        return crushProfileRepository.findBySessionIdOrderByUpdatedAtDesc(sessionId);
    }

    public Optional<CrushProfile> getActiveProfile(String sessionId) {
        return crushProfileRepository.findFirstBySessionIdOrderByUpdatedAtDesc(sessionId);
    }

    @Transactional
    public void deleteProfile(String sessionId, String name) {
        crushProfileRepository.deleteBySessionIdAndName(sessionId, name.toLowerCase().trim());
        log.info("Deleted profile: session={} name={}", sessionId, name);
    }

    public String buildProfileContext(CrushProfile profile) {
        StringBuilder context = new StringBuilder();
        String displayName = profile.getDisplayName() != null ? profile.getDisplayName() : profile.getName();
        context.append("=== CRUSH PROFILE: ").append(displayName.toUpperCase()).append(" ===\n\n");

        context.append("Name: ").append(displayName).append("\n");
        if (profile.getNickname() != null && !profile.getNickname().isBlank()) {
            context.append("Nickname: ").append(profile.getNickname()).append("\n");
        }
        if (profile.getPlatform() != null && !profile.getPlatform().isBlank()) {
            context.append("Platform: ").append(profile.getPlatform()).append("\n");
        }
        if (profile.getRelationshipStage() != null && !profile.getRelationshipStage().isBlank()) {
            context.append("Stage: ").append(profile.getRelationshipStage()).append("\n");
        }
        context.append("Messages analyzed: ").append(profile.getMessageCount()).append("\n");
        context.append("First contact: ").append(profile.getCreatedAt()).append("\n");
        context.append("Last interaction: ").append(profile.getUpdatedAt()).append("\n\n");

        if (profile.getInterests() != null && !profile.getInterests().isBlank()) {
            context.append("INTERESTS:\n").append(profile.getInterests()).append("\n\n");
        }
        if (profile.getPersonality() != null && !profile.getPersonality().isBlank()) {
            context.append("PERSONALITY:\n").append(profile.getPersonality()).append("\n\n");
        }
        if (profile.getCommunicationStyle() != null && !profile.getCommunicationStyle().isBlank()) {
            context.append("COMMUNICATION STYLE:\n").append(profile.getCommunicationStyle()).append("\n\n");
        }
        if (profile.getKnownFacts() != null && !profile.getKnownFacts().isBlank()) {
            context.append("KNOWN FACTS:\n").append(profile.getKnownFacts()).append("\n\n");
        }
        if (profile.getRecentMessages() != null && !profile.getRecentMessages().isBlank()) {
            context.append("RECENT MESSAGES FROM THEM:\n").append(profile.getRecentMessages()).append("\n");
        }

        return context.toString();
    }

    private String appendInfo(String existing, String newInfo) {
        if (existing == null || existing.isBlank()) {
            return newInfo.trim();
        }
        // Avoid duplicates (simple check)
        if (existing.toLowerCase().contains(newInfo.toLowerCase().trim())) {
            return existing;
        }
        return existing + ", " + newInfo.trim();
    }
}
