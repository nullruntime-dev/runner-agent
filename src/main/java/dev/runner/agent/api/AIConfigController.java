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

import dev.runner.agent.service.AIConfigService;
import dev.runner.agent.service.AIConfigService.AIProviderConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/agent/ai-config")
@RequiredArgsConstructor
public class AIConfigController {

    private final AIConfigService aiConfigService;

    @GetMapping
    public ResponseEntity<AIProviderConfig> getConfig() {
        log.info("GET /agent/ai-config");
        return ResponseEntity.ok(aiConfigService.getConfig());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> updateConfig(@RequestBody AIProviderConfig config) {
        log.info("POST /agent/ai-config provider={}", config.getProvider());

        try {
            AIProviderConfig saved = aiConfigService.saveConfig(config);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "config", saved,
                    "message", "AI configuration updated. Changes take effect on next chat request."
            ));
        } catch (Exception e) {
            log.error("Failed to save AI config", e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }
}
