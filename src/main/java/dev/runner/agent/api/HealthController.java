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

import dev.runner.agent.adk.AdkConfig;
import dev.runner.agent.service.AIConfigService;
import dev.runner.agent.service.AIConfigService.AIProviderConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class HealthController {

    private final AdkConfig adkConfig;
    private final AIConfigService aiConfigService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "ok");
        response.put("version", "0.1.0");

        // AI provider info (from dynamic config)
        AIProviderConfig config = aiConfigService.getConfig();
        Map<String, Object> ai = new HashMap<>();
        ai.put("enabled", adkConfig.isEnabled());
        ai.put("provider", config.getProvider());
        if (config.isOllama()) {
            ai.put("model", config.getOllamaModel());
            ai.put("baseUrl", config.getOllamaBaseUrl());
        } else {
            ai.put("model", config.getGeminiModel());
        }
        response.put("ai", ai);

        return ResponseEntity.ok(response);
    }
}
