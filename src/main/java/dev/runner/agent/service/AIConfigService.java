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
import dev.runner.agent.adk.AdkConfig;
import dev.runner.agent.domain.SkillConfig;
import dev.runner.agent.domain.SkillConfigRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
@RequiredArgsConstructor
public class AIConfigService {

    private static final String CONFIG_NAME = "ai-provider";

    private final SkillConfigRepository skillConfigRepository;
    private final ObjectMapper objectMapper;
    private final AdkConfig adkConfig;

    // Track config version for change detection
    private final AtomicLong configVersion = new AtomicLong(0);

    @Data
    public static class AIProviderConfig {
        private String provider = "gemini";  // "gemini" or "ollama"
        private String geminiModel = "gemini-2.0-flash";
        private String ollamaBaseUrl = "http://127.0.0.1:11434";
        private String ollamaModel = "llama3.1:8b";

        public boolean isOllama() {
            return "ollama".equalsIgnoreCase(provider);
        }

        public boolean isGemini() {
            return "gemini".equalsIgnoreCase(provider);
        }
    }

    /**
     * Get current AI config. Falls back to AdkConfig (env/yml) if not in DB.
     */
    public AIProviderConfig getConfig() {
        Optional<SkillConfig> stored = skillConfigRepository.findBySkillName(CONFIG_NAME);

        if (stored.isPresent() && stored.get().getConfigJson() != null) {
            try {
                Map<String, String> configMap = objectMapper.readValue(
                        stored.get().getConfigJson(),
                        new TypeReference<Map<String, String>>() {}
                );

                AIProviderConfig config = new AIProviderConfig();
                config.setProvider(configMap.getOrDefault("provider", adkConfig.getProvider()));
                config.setGeminiModel(configMap.getOrDefault("geminiModel", adkConfig.getModel()));
                config.setOllamaBaseUrl(configMap.getOrDefault("ollamaBaseUrl", adkConfig.getOllamaBaseUrl()));
                config.setOllamaModel(configMap.getOrDefault("ollamaModel", adkConfig.getOllamaModel()));
                return config;
            } catch (JsonProcessingException e) {
                log.error("Failed to parse AI config from DB, using defaults", e);
            }
        }

        // Fall back to AdkConfig (from env/yml)
        AIProviderConfig config = new AIProviderConfig();
        config.setProvider(adkConfig.getProvider());
        config.setGeminiModel(adkConfig.getModel());
        config.setOllamaBaseUrl(adkConfig.getOllamaBaseUrl());
        config.setOllamaModel(adkConfig.getOllamaModel());
        return config;
    }

    /**
     * Save AI config to DB and increment version.
     */
    @Transactional
    public AIProviderConfig saveConfig(AIProviderConfig config) {
        log.info("Saving AI config provider={} model={}",
                config.getProvider(),
                config.isOllama() ? config.getOllamaModel() : config.getGeminiModel());

        Map<String, String> configMap = Map.of(
                "provider", config.getProvider(),
                "geminiModel", config.getGeminiModel(),
                "ollamaBaseUrl", config.getOllamaBaseUrl(),
                "ollamaModel", config.getOllamaModel()
        );

        String configJson;
        try {
            configJson = objectMapper.writeValueAsString(configMap);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize AI config", e);
        }

        SkillConfig skillConfig = skillConfigRepository.findBySkillName(CONFIG_NAME)
                .orElseGet(() -> SkillConfig.builder().skillName(CONFIG_NAME).build());

        skillConfig.setConfigJson(configJson);
        skillConfig.setEnabled(true);
        skillConfigRepository.save(skillConfig);

        // Increment version to signal change
        configVersion.incrementAndGet();
        log.info("AI config saved, version={}", configVersion.get());

        return config;
    }

    /**
     * Get current config version for change detection.
     */
    public long getConfigVersion() {
        return configVersion.get();
    }
}
