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
import dev.runner.agent.domain.CrushProfile;
import dev.runner.agent.service.CrushProfileService;
import dev.runner.agent.service.SkillService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
public class FlirtTool {

    private final SkillService skillService;
    private final CrushProfileService crushProfileService;

    // Thread-local to track current session (set by AgentService before tool calls)
    private static final ThreadLocal<String> currentSessionId = new ThreadLocal<>();

    public FlirtTool(SkillService skillService, CrushProfileService crushProfileService) {
        this.skillService = skillService;
        this.crushProfileService = crushProfileService;
        log.info("FlirtTool initialized with CrushProfileService");
    }

    public static void setCurrentSession(String sessionId) {
        currentSessionId.set(sessionId);
    }

    public static void clearCurrentSession() {
        currentSessionId.remove();
    }

    private String getSessionId() {
        String session = currentSessionId.get();
        return session != null ? session : "default";
    }

    private Optional<Map<String, String>> getConfig() {
        return skillService.getSkillConfig("flirt");
    }

    public boolean isConfigured() {
        return getConfig().isPresent();
    }

    @Schema(name = "generate_flirty_response", description = "Generate a smooth, flirty response to reply to someone you're interested in. Automatically learns about them from their messages.")
    public Map<String, Object> generateResponse(
            @Schema(name = "their_name", description = "Name of the person (to track their profile)") String theirName,
            @Schema(name = "their_message", description = "The message the other person sent that you need to respond to") String theirMessage,
            @Schema(name = "context", description = "Optional context about the conversation or relationship", optional = true) String context
    ) {
        log.info("ADK tool: generate_flirty_response name='{}' message='{}' context='{}'", theirName, theirMessage, context);

        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Wingman is not configured. Please configure it in the agent settings.");
            return result;
        }

        String sessionId = getSessionId();
        String name = (theirName != null && !theirName.isBlank()) ? theirName : "crush";

        // Store their message and get/create profile
        CrushProfile profile = crushProfileService.addMessage(sessionId, name, theirMessage);

        Map<String, String> config = getConfig().get();
        String userName = config.getOrDefault("userName", "");
        String style = config.getOrDefault("style", "playful");
        String personality = config.getOrDefault("personality", "");

        // Build prompt with profile context
        StringBuilder prompt = new StringBuilder();
        prompt.append("You are a flirting coach helping ").append(userName.isBlank() ? "someone" : userName);
        prompt.append(" craft the perfect response.\n\n");

        // Include crush profile for personalization
        prompt.append(crushProfileService.buildProfileContext(profile));
        prompt.append("\n");

        prompt.append("Your flirting style: ").append(style).append("\n");
        if (!personality.isBlank()) {
            prompt.append("Your personality: ").append(personality).append("\n");
        }
        prompt.append("\n");

        if (context != null && !context.isBlank()) {
            prompt.append("Additional context: ").append(context).append("\n\n");
        }

        prompt.append("Their latest message: \"").append(theirMessage).append("\"\n\n");
        prompt.append("Generate 3 response options ranging from subtle to bold. ");
        prompt.append("Use what you know about them to personalize the responses. ");
        prompt.append("Reference their interests or past messages when relevant. ");
        prompt.append("Keep responses natural, witty, and match their energy.");

        result.put("success", true);
        result.put("prompt", prompt.toString());
        result.put("theirName", name);
        result.put("theirMessage", theirMessage);
        result.put("style", style);
        result.put("profileMessageCount", profile.getMessageCount());
        result.put("instruction", "Based on what I know about " + name + ", here are some response options:");

        return result;
    }

    @Schema(name = "generate_opener", description = "Generate a creative opening message for someone new.")
    public Map<String, Object> generateOpener(
            @Schema(name = "their_name", description = "Name of the person (optional)", optional = true) String theirName,
            @Schema(name = "about_them", description = "What you know about them (from their profile, appearance, shared interest, etc.)") String aboutThem,
            @Schema(name = "platform", description = "Where you're messaging them (tinder, bumble, instagram, in person, etc.)", optional = true) String platform
    ) {
        log.info("ADK tool: generate_opener name='{}' about='{}' platform='{}'", theirName, aboutThem, platform);

        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Wingman is not configured. Please configure it in the agent settings.");
            return result;
        }

        String sessionId = getSessionId();
        String name = (theirName != null && !theirName.isBlank()) ? theirName : "new_match";

        // Create/update profile with known info
        if (aboutThem != null && !aboutThem.isBlank()) {
            crushProfileService.updateProfileTraits(sessionId, name, aboutThem, null, null, aboutThem);
        }
        if (platform != null && !platform.isBlank()) {
            crushProfileService.setProfileMeta(sessionId, name, null, platform, "just_matched");
        }

        Optional<CrushProfile> profileOpt = crushProfileService.getProfile(sessionId, name);

        Map<String, String> config = getConfig().get();
        String style = config.getOrDefault("style", "playful");

        StringBuilder prompt = new StringBuilder();
        prompt.append("Generate 3 creative opening messages for ").append(platform != null ? platform : "a dating app").append(".\n\n");
        prompt.append("Style: ").append(style).append("\n");

        if (profileOpt.isPresent()) {
            prompt.append("\n").append(crushProfileService.buildProfileContext(profileOpt.get())).append("\n");
        } else if (aboutThem != null && !aboutThem.isBlank()) {
            prompt.append("About them: ").append(aboutThem).append("\n");
        }

        prompt.append("\nRules:\n");
        prompt.append("- Be original, not generic\n");
        prompt.append("- Reference something specific about them\n");
        prompt.append("- Avoid overused pickup lines\n");
        prompt.append("- Be confident but not arrogant\n");
        prompt.append("- Make them want to respond\n");

        result.put("success", true);
        result.put("prompt", prompt.toString());
        result.put("theirName", name);
        result.put("platform", platform);
        result.put("style", style);
        result.put("instruction", "Here are some opener options:");

        return result;
    }

    @Schema(name = "analyze_conversation", description = "Analyze a conversation to understand their interest level and suggest next moves.")
    public Map<String, Object> analyzeConversation(
            @Schema(name = "their_name", description = "Name of the person") String theirName,
            @Schema(name = "conversation", description = "The conversation so far (copy paste the recent messages)") String conversation
    ) {
        log.info("ADK tool: analyze_conversation name='{}' length={}", theirName, conversation != null ? conversation.length() : 0);

        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Wingman is not configured. Please configure it in the agent settings.");
            return result;
        }

        String sessionId = getSessionId();
        String name = (theirName != null && !theirName.isBlank()) ? theirName : "crush";

        // Get existing profile if any
        Optional<CrushProfile> profileOpt = crushProfileService.getProfile(sessionId, name);

        StringBuilder prompt = new StringBuilder();
        prompt.append("Analyze this conversation and provide:\n");
        prompt.append("1. Interest level (1-10) with explanation\n");
        prompt.append("2. Green flags (positive signs)\n");
        prompt.append("3. Red/yellow flags (if any)\n");
        prompt.append("4. Their communication style\n");
        prompt.append("5. Their likely interests/personality based on the convo\n");
        prompt.append("6. Suggested next move\n");
        prompt.append("7. Topics to bring up\n");
        prompt.append("8. Things to avoid\n\n");

        if (profileOpt.isPresent()) {
            prompt.append("EXISTING PROFILE:\n");
            prompt.append(crushProfileService.buildProfileContext(profileOpt.get()));
            prompt.append("\n");
        }

        prompt.append("CONVERSATION TO ANALYZE:\n").append(conversation);

        prompt.append("\n\nAfter analysis, I should update their profile with new insights about their personality, interests, and communication style.");

        result.put("success", true);
        result.put("prompt", prompt.toString());
        result.put("theirName", name);
        result.put("instruction", "Here's my analysis of your conversation with " + name + ":");

        return result;
    }

    @Schema(name = "update_crush_profile", description = "Update information about someone you're talking to. Use this to store interests, personality traits, or facts you've learned about them.")
    public Map<String, Object> updateProfile(
            @Schema(name = "their_name", description = "Name of the person") String theirName,
            @Schema(name = "interests", description = "Their interests/hobbies (optional)", optional = true) String interests,
            @Schema(name = "personality", description = "Their personality traits (optional)", optional = true) String personality,
            @Schema(name = "communication_style", description = "How they communicate - emoji user, long texter, etc. (optional)", optional = true) String communicationStyle,
            @Schema(name = "facts", description = "Specific facts about them - job, location, pets, etc. (optional)", optional = true) String facts,
            @Schema(name = "platform", description = "Where you met/chat with them (optional)", optional = true) String platform,
            @Schema(name = "relationship_stage", description = "Current stage: just_matched, talking, dating, etc. (optional)", optional = true) String relationshipStage
    ) {
        log.info("ADK tool: update_crush_profile name='{}'", theirName);

        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Wingman is not configured.");
            return result;
        }

        String sessionId = getSessionId();
        String name = (theirName != null && !theirName.isBlank()) ? theirName : "crush";

        // Update traits
        crushProfileService.updateProfileTraits(sessionId, name, interests, personality, communicationStyle, facts);

        // Update meta
        crushProfileService.setProfileMeta(sessionId, name, null, platform, relationshipStage);

        CrushProfile profile = crushProfileService.getOrCreateProfile(sessionId, name);

        result.put("success", true);
        result.put("message", "Updated profile for " + name);
        result.put("profile", Map.of(
                "name", profile.getName(),
                "interests", profile.getInterests() != null ? profile.getInterests() : "",
                "personality", profile.getPersonality() != null ? profile.getPersonality() : "",
                "communicationStyle", profile.getCommunicationStyle() != null ? profile.getCommunicationStyle() : "",
                "messageCount", profile.getMessageCount()
        ));

        return result;
    }

    @Schema(name = "get_crush_profile", description = "Get the stored profile for someone you're talking to. Creates a new profile if one doesn't exist.")
    public Map<String, Object> getProfile(
            @Schema(name = "their_name", description = "Name of the person (leave empty to get most recent)", optional = true) String theirName,
            @Schema(name = "create_if_missing", description = "Create a new profile if one doesn't exist (default: true)", optional = true) Boolean createIfMissing
    ) {
        log.info("ADK tool: get_crush_profile name='{}' createIfMissing={}", theirName, createIfMissing);

        Map<String, Object> result = new HashMap<>();

        String sessionId = getSessionId();
        boolean shouldCreate = createIfMissing == null || createIfMissing;

        CrushProfile profile;
        if (theirName != null && !theirName.isBlank()) {
            Optional<CrushProfile> profileOpt = crushProfileService.getProfile(sessionId, theirName);
            if (profileOpt.isEmpty()) {
                if (shouldCreate) {
                    // Auto-create profile for new person
                    log.info("Creating new profile for: {}", theirName);
                    profile = crushProfileService.getOrCreateProfile(sessionId, theirName);
                    result.put("isNew", true);
                    result.put("message", "Created a new profile for " + theirName + ". Share their messages so I can learn about them!");
                } else {
                    result.put("success", false);
                    result.put("message", "No profile found for " + theirName + ". Share their messages with me to start tracking!");
                    return result;
                }
            } else {
                profile = profileOpt.get();
                result.put("isNew", false);
            }
        } else {
            Optional<CrushProfile> activeProfile = crushProfileService.getActiveProfile(sessionId);
            if (activeProfile.isEmpty()) {
                result.put("success", false);
                result.put("message", "No profiles yet. Tell me someone's name and share their messages!");
                return result;
            }
            profile = activeProfile.get();
            result.put("isNew", false);
        }

        String displayName = profile.getDisplayName() != null ? profile.getDisplayName() : profile.getName();
        result.put("success", true);
        result.put("profileContext", crushProfileService.buildProfileContext(profile));

        // Build profile map (Map.of() only supports up to 10 entries)
        Map<String, Object> profileData = new HashMap<>();
        profileData.put("name", profile.getName());
        profileData.put("displayName", displayName);
        profileData.put("nickname", profile.getNickname() != null ? profile.getNickname() : "");
        profileData.put("platform", profile.getPlatform() != null ? profile.getPlatform() : "");
        profileData.put("relationshipStage", profile.getRelationshipStage() != null ? profile.getRelationshipStage() : "");
        profileData.put("interests", profile.getInterests() != null ? profile.getInterests() : "");
        profileData.put("personality", profile.getPersonality() != null ? profile.getPersonality() : "");
        profileData.put("communicationStyle", profile.getCommunicationStyle() != null ? profile.getCommunicationStyle() : "");
        profileData.put("knownFacts", profile.getKnownFacts() != null ? profile.getKnownFacts() : "");
        profileData.put("recentMessages", profile.getRecentMessages() != null ? profile.getRecentMessages() : "");
        profileData.put("messageCount", profile.getMessageCount());
        profileData.put("createdAt", profile.getCreatedAt().toString());
        profileData.put("lastUpdated", profile.getUpdatedAt().toString());
        result.put("profile", profileData);

        return result;
    }

    @Schema(name = "list_crushes", description = "List all people you've been talking to.")
    public Map<String, Object> listProfiles() {
        log.info("ADK tool: list_crushes");

        Map<String, Object> result = new HashMap<>();
        String sessionId = getSessionId();

        List<CrushProfile> profiles = crushProfileService.getAllProfiles(sessionId);

        if (profiles.isEmpty()) {
            result.put("success", true);
            result.put("message", "No profiles yet. Start by sharing someone's messages with me!");
            result.put("profiles", List.of());
            return result;
        }

        List<Map<String, Object>> profileList = profiles.stream().map(p -> Map.<String, Object>of(
                "name", p.getDisplayName() != null ? p.getDisplayName() : p.getName(),
                "platform", p.getPlatform() != null ? p.getPlatform() : "unknown",
                "stage", p.getRelationshipStage() != null ? p.getRelationshipStage() : "unknown",
                "messageCount", p.getMessageCount(),
                "lastUpdated", p.getUpdatedAt().toString(),
                "hasMessages", p.getRecentMessages() != null && !p.getRecentMessages().isBlank()
        )).toList();

        result.put("success", true);
        result.put("profiles", profileList);
        result.put("count", profiles.size());

        return result;
    }

    @Schema(name = "forget_crush", description = "Delete a crush profile when you no longer need it.")
    public Map<String, Object> forgetProfile(
            @Schema(name = "their_name", description = "Name of the person to forget") String theirName
    ) {
        log.info("ADK tool: forget_crush name='{}'", theirName);

        Map<String, Object> result = new HashMap<>();

        if (theirName == null || theirName.isBlank()) {
            result.put("success", false);
            result.put("error", "Please specify whose profile to delete.");
            return result;
        }

        String sessionId = getSessionId();
        crushProfileService.deleteProfile(sessionId, theirName);

        result.put("success", true);
        result.put("message", "Forgot all about " + theirName + ". Moving on!");

        return result;
    }
}
