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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.runner.agent.domain.SkillConfig;
import dev.runner.agent.domain.SkillConfigRepository;
import dev.runner.agent.dto.SkillDefinition;
import dev.runner.agent.dto.SkillDefinition.ConfigField;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SkillService {

    private final SkillConfigRepository skillConfigRepository;
    private final ObjectMapper objectMapper;

    private static final List<SkillDefinition> AVAILABLE_SKILLS = List.of(
            SkillDefinition.builder()
                    .name("slack")
                    .displayName("Slack")
                    .description("Send messages to Slack and receive commands via Socket Mode (no public URL needed)")
                    .icon("slack")
                    .configFields(List.of(
                            ConfigField.builder().name("appToken").label("App-Level Token").type("password").description("App-Level Token for Socket Mode (starts with xapp-)").required(true).placeholder("xapp-...").build(),
                            ConfigField.builder().name("botToken").label("Bot Token").type("password").description("Bot User OAuth Token (starts with xoxb-)").required(true).placeholder("xoxb-...").build(),
                            ConfigField.builder().name("webhookUrl").label("Webhook URL (Optional)").type("password").description("Incoming Webhook URL for simple notifications").required(false).placeholder("https://hooks.slack.com/services/...").build(),
                            ConfigField.builder().name("defaultChannel").label("Default Channel").type("text").description("Channel where the bot will post messages (required for Socket Mode)").required(true).placeholder("#runner-agent-dev").build(),
                            ConfigField.builder().name("slashCommand").label("Slash Command").type("text").description("The slash command name you configured in Slack (without the /)").required(false).placeholder("runner-agent").build()
                    ))
                    .build(),
            SkillDefinition.builder()
                    .name("gmail")
                    .displayName("Gmail")
                    .description("Send emails via Gmail SMTP")
                    .icon("email")
                    .configFields(List.of(
                            ConfigField.builder().name("email").label("Gmail Address").type("text").description("Your Gmail email address").required(true).placeholder("you@gmail.com").build(),
                            ConfigField.builder().name("appPassword").label("App Password").type("password").description("Gmail App Password (generate at myaccount.google.com/apppasswords)").required(true).placeholder("xxxx xxxx xxxx xxxx").build(),
                            ConfigField.builder().name("defaultRecipient").label("Default Recipient").type("text").description("Default email recipient (optional)").required(false).placeholder("recipient@example.com").build()
                    ))
                    .build(),
            SkillDefinition.builder()
                    .name("gmail-api")
                    .displayName("Gmail API")
                    .description("Full Gmail access via OAuth2 - read, search, reply to emails, and more")
                    .icon("email")
                    .configFields(List.of(
                            ConfigField.builder().name("clientId").label("OAuth Client ID").type("text").description("Google OAuth 2.0 Client ID from Google Cloud Console").required(true).placeholder("123456789.apps.googleusercontent.com").build(),
                            ConfigField.builder().name("clientSecret").label("OAuth Client Secret").type("password").description("Google OAuth 2.0 Client Secret").required(true).placeholder("GOCSPX-...").build()
                    ))
                    .build(),
            SkillDefinition.builder()
                    .name("smtp")
                    .displayName("SMTP Email")
                    .description("Send emails via any SMTP server (SendGrid, Mailgun, SES, etc.)")
                    .icon("smtp")
                    .configFields(List.of(
                            ConfigField.builder().name("host").label("SMTP Host").type("text").description("SMTP server hostname").required(true).placeholder("smtp.example.com").build(),
                            ConfigField.builder().name("port").label("SMTP Port").type("text").description("SMTP port (587 for TLS, 465 for SSL, 25 for plain)").required(true).placeholder("587").build(),
                            ConfigField.builder().name("username").label("Username").type("text").description("SMTP username or API key").required(true).placeholder("apikey or username").build(),
                            ConfigField.builder().name("password").label("Password").type("password").description("SMTP password or API secret").required(true).placeholder("password").build(),
                            ConfigField.builder().name("fromEmail").label("From Email").type("text").description("Sender email address").required(true).placeholder("noreply@yourdomain.com").build(),
                            ConfigField.builder().name("fromName").label("From Name").type("text").description("Sender display name (optional)").required(false).placeholder("Runner Agent").build(),
                            ConfigField.builder().name("encryption").label("Encryption").type("text").description("TLS, SSL, or NONE").required(false).placeholder("TLS").build(),
                            ConfigField.builder().name("defaultRecipient").label("Default Recipient").type("text").description("Default email recipient (optional)").required(false).placeholder("recipient@example.com").build()
                    ))
                    .build(),
            SkillDefinition.builder()
                    .name("flirt")
                    .displayName("Wingman")
                    .description("AI-powered wingman to help you craft smooth responses and openers for dating conversations")
                    .icon("heart")
                    .configFields(List.of(
                            ConfigField.builder().name("userName").label("Your Name").type("text").description("Your name (for personalized responses)").required(false).placeholder("Alex").build(),
                            ConfigField.builder().name("style").label("Flirting Style").type("text").description("Your preferred style: playful, witty, romantic, bold, subtle, mysterious").required(false).placeholder("playful").build(),
                            ConfigField.builder().name("interestedIn").label("Interested In").type("text").description("Who you're interested in (for context)").required(false).placeholder("women, men, everyone").build(),
                            ConfigField.builder().name("personality").label("Your Personality").type("text").description("Describe your personality/vibe").required(false).placeholder("funny, nerdy, adventurous").build()
                    ))
                    .build(),
            SkillDefinition.builder()
                    .name("web-search")
                    .displayName("Web Search")
                    .description("Search the web using Google Custom Search API to find information, documentation, news, and more")
                    .icon("search")
                    .configFields(List.of(
                            ConfigField.builder().name("apiKey").label("Google API Key").type("password").description("Google Cloud API Key with Custom Search API enabled").required(true).placeholder("AIza...").build(),
                            ConfigField.builder().name("searchEngineId").label("Search Engine ID").type("text").description("Custom Search Engine ID (cx parameter) from Programmable Search Engine").required(true).placeholder("a1b2c3d4e5f6g7h8i").build()
                    ))
                    .build()
    );

    public List<SkillDefinition> getAvailableSkills() {
        List<SkillDefinition> skills = new ArrayList<>();

        for (SkillDefinition definition : AVAILABLE_SKILLS) {
            SkillDefinition skill = SkillDefinition.builder()
                    .name(definition.getName())
                    .displayName(definition.getDisplayName())
                    .description(definition.getDescription())
                    .icon(definition.getIcon())
                    .configFields(definition.getConfigFields())
                    .build();

            Optional<SkillConfig> config = skillConfigRepository.findBySkillName(definition.getName());
            if (config.isPresent()) {
                skill.setConfigured(true);
                skill.setEnabled(config.get().isEnabled());
                skill.setHidden(config.get().isHidden());
            } else {
                skill.setConfigured(false);
                skill.setEnabled(false);
                skill.setHidden(false);
            }

            skills.add(skill);
        }

        return skills;
    }

    public List<SkillDefinition> getVisibleSkills() {
        return getAvailableSkills().stream()
                .filter(s -> !s.isHidden())
                .toList();
    }

    public Optional<SkillDefinition> getSkill(String name) {
        return AVAILABLE_SKILLS.stream()
                .filter(s -> s.getName().equals(name))
                .findFirst()
                .map(definition -> {
                    SkillDefinition skill = SkillDefinition.builder()
                            .name(definition.getName())
                            .displayName(definition.getDisplayName())
                            .description(definition.getDescription())
                            .icon(definition.getIcon())
                            .configFields(definition.getConfigFields())
                            .build();

                    Optional<SkillConfig> config = skillConfigRepository.findBySkillName(name);
                    if (config.isPresent()) {
                        skill.setConfigured(true);
                        skill.setEnabled(config.get().isEnabled());
                        skill.setHidden(config.get().isHidden());
                    }

                    return skill;
                });
    }

    @Transactional
    public SkillConfig configureSkill(String skillName, Map<String, String> config, boolean enabled) {
        log.info("Configuring skill: {} enabled={}", skillName, enabled);

        boolean validSkill = AVAILABLE_SKILLS.stream().anyMatch(s -> s.getName().equals(skillName));
        if (!validSkill) {
            throw new IllegalArgumentException("Unknown skill: " + skillName);
        }

        String configJson;
        try {
            configJson = objectMapper.writeValueAsString(config);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize config", e);
        }

        SkillConfig skillConfig = skillConfigRepository.findBySkillName(skillName)
                .orElseGet(() -> SkillConfig.builder().skillName(skillName).build());

        skillConfig.setConfigJson(configJson);
        skillConfig.setEnabled(enabled);

        return skillConfigRepository.save(skillConfig);
    }

    @Transactional
    public void toggleSkill(String skillName, boolean enabled) {
        log.info("Toggling skill: {} enabled={}", skillName, enabled);

        SkillConfig config = skillConfigRepository.findBySkillName(skillName)
                .orElseThrow(() -> new IllegalArgumentException("Skill not configured: " + skillName));

        config.setEnabled(enabled);
        skillConfigRepository.save(config);
    }

    @Transactional
    public void toggleVisibility(String skillName, boolean hidden) {
        log.info("Toggling skill visibility: {} hidden={}", skillName, hidden);

        boolean validSkill = AVAILABLE_SKILLS.stream().anyMatch(s -> s.getName().equals(skillName));
        if (!validSkill) {
            throw new IllegalArgumentException("Unknown skill: " + skillName);
        }

        SkillConfig config = skillConfigRepository.findBySkillName(skillName)
                .orElseGet(() -> {
                    SkillConfig newConfig = SkillConfig.builder()
                            .skillName(skillName)
                            .enabled(false)
                            .build();
                    return skillConfigRepository.save(newConfig);
                });

        config.setHidden(hidden);
        skillConfigRepository.save(config);
    }

    @Transactional
    public void deleteSkillConfig(String skillName) {
        log.info("Deleting skill config: {}", skillName);

        skillConfigRepository.findBySkillName(skillName).ifPresent(skillConfigRepository::delete);
    }

    public Optional<Map<String, String>> getSkillConfig(String skillName) {
        return skillConfigRepository.findBySkillName(skillName)
                .filter(SkillConfig::isEnabled)
                .map(config -> {
                    try {
                        return objectMapper.readValue(config.getConfigJson(), new TypeReference<Map<String, String>>() {});
                    } catch (JsonProcessingException e) {
                        log.error("Failed to parse skill config for {}", skillName, e);
                        return null;
                    }
                });
    }

    public List<SkillConfig> getEnabledSkills() {
        return skillConfigRepository.findByEnabledTrue();
    }
}
