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

        // First, try to find globally (across all sessions)
        Optional<CrushProfile> existing = findProfileGlobally(name);
        if (existing.isPresent()) {
            log.info("Found existing global profile for: {}", name);
            return existing.get();
        }

        // Create new profile
        log.info("Creating new crush profile: session={} name={} displayName={}",
                sessionId, normalizedName, name.trim());
        CrushProfile profile = CrushProfile.builder()
                .sessionId(sessionId)
                .name(normalizedName)
                .displayName(name.trim())
                .messageCount(0)
                .build();
        return crushProfileRepository.save(profile);
    }

    /**
     * Find a profile globally by name (not session-scoped).
     * Prefers profiles that have actual data (messages, interests, etc.)
     */
    private Optional<CrushProfile> findProfileGlobally(String name) {
        String normalizedName = normalizeName(name);

        // First try exact name match (get all with that name)
        List<CrushProfile> matches = new java.util.ArrayList<>(
            crushProfileRepository.findByNameIgnoreCaseOrderByUpdatedAtDesc(normalizedName)
        );

        // If no exact matches, try partial/contains match
        if (matches.isEmpty()) {
            matches = new java.util.ArrayList<>(
                crushProfileRepository.findByNameContainingIgnoreCaseOrderByUpdatedAtDesc(normalizedName)
            );
        }

        // Also check display name matches and add if not already present
        Optional<CrushProfile> displayMatch = crushProfileRepository.findFirstByDisplayNameIgnoreCaseOrderByUpdatedAtDesc(name.trim());
        if (displayMatch.isPresent()) {
            CrushProfile dm = displayMatch.get();
            if (matches.stream().noneMatch(p -> p.getId().equals(dm.getId()))) {
                matches.add(0, dm);
            }
        }

        if (matches.isEmpty()) {
            return Optional.empty();
        }

        // Find the profile with the most data (prefer profiles that have content)
        CrushProfile best = matches.get(0);
        int bestScore = scoreProfile(best);

        for (CrushProfile p : matches) {
            int score = scoreProfile(p);
            if (score > bestScore) {
                best = p;
                bestScore = score;
            }
        }

        log.info("Found best profile for '{}': id={} messageCount={} score={}",
                name, best.getId(), best.getMessageCount(), bestScore);

        return Optional.of(best);
    }

    /**
     * Score a profile based on how much data it has
     */
    private int scoreProfile(CrushProfile p) {
        int score = 0;
        if (p.getMessageCount() != null && p.getMessageCount() > 0) score += p.getMessageCount() * 10;
        if (p.getRecentMessages() != null && !p.getRecentMessages().isBlank()) score += 50;
        if (p.getInterests() != null && !p.getInterests().isBlank()) score += 20;
        if (p.getPersonality() != null && !p.getPersonality().isBlank()) score += 20;
        if (p.getCommunicationStyle() != null && !p.getCommunicationStyle().isBlank()) score += 10;
        if (p.getKnownFacts() != null && !p.getKnownFacts().isBlank()) score += 10;
        return score;
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
        // Use global lookup - profiles are shared across sessions
        return findProfileGlobally(name);
    }

    /**
     * Get or create a profile - useful when we want to ensure a profile exists
     */
    public CrushProfile getOrCreateProfileForLookup(String sessionId, String name) {
        return getProfile(sessionId, name)
                .orElseGet(() -> getOrCreateProfile(sessionId, name));
    }

    public List<CrushProfile> getAllProfiles(String sessionId) {
        // Return all profiles globally (not session-scoped)
        return crushProfileRepository.findAllByOrderByUpdatedAtDesc();
    }

    public Optional<CrushProfile> getActiveProfile(String sessionId) {
        // Get most recently updated profile globally
        List<CrushProfile> all = crushProfileRepository.findAllByOrderByUpdatedAtDesc();
        return all.isEmpty() ? Optional.empty() : Optional.of(all.get(0));
    }

    @Transactional
    public void deleteProfile(String sessionId, String name) {
        String normalizedName = normalizeName(name);
        crushProfileRepository.deleteByName(normalizedName);
        log.info("Deleted profile globally: name={}", name);
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
