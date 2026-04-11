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

import dev.runner.agent.domain.SkillConfig;
import dev.runner.agent.dto.SkillDefinition;
import dev.runner.agent.service.SkillService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/agent/skills")
@RequiredArgsConstructor
@Validated
public class SkillsController {

    private final SkillService skillService;

    @GetMapping
    public ResponseEntity<List<SkillDefinition>> listSkills() {
        log.info("GET /agent/skills");
        return ResponseEntity.ok(skillService.getAvailableSkills());
    }

    @GetMapping("/{skillName}")
    public ResponseEntity<SkillDefinition> getSkill(@PathVariable String skillName) {
        log.info("GET /agent/skills/{}", skillName);
        return skillService.getSkill(skillName)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{skillName}/configure")
    public ResponseEntity<Map<String, Object>> configureSkill(
            @PathVariable String skillName,
            @RequestBody ConfigureRequest request
    ) {
        log.info("POST /agent/skills/{}/configure", skillName);

        try {
            SkillConfig config = skillService.configureSkill(
                    skillName,
                    request.config(),
                    request.enabled() != null ? request.enabled() : true
            );

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "skillName", skillName,
                    "enabled", config.isEnabled()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    @PostMapping("/{skillName}/toggle")
    public ResponseEntity<Map<String, Object>> toggleSkill(
            @PathVariable String skillName,
            @RequestBody ToggleRequest request
    ) {
        log.info("POST /agent/skills/{}/toggle enabled={}", skillName, request.enabled());

        try {
            skillService.toggleSkill(skillName, request.enabled());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "skillName", skillName,
                    "enabled", request.enabled()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    @DeleteMapping("/{skillName}")
    public ResponseEntity<Map<String, Object>> deleteSkillConfig(@PathVariable String skillName) {
        log.info("DELETE /agent/skills/{}", skillName);

        skillService.deleteSkillConfig(skillName);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "skillName", skillName
        ));
    }

    @PostMapping("/{skillName}/visibility")
    public ResponseEntity<Map<String, Object>> toggleVisibility(
            @PathVariable String skillName,
            @RequestBody VisibilityRequest request
    ) {
        log.info("POST /agent/skills/{}/visibility hidden={}", skillName, request.hidden());

        try {
            skillService.toggleVisibility(skillName, request.hidden());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "skillName", skillName,
                    "hidden", request.hidden()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    public record ConfigureRequest(Map<String, String> config, Boolean enabled) {}
    public record ToggleRequest(boolean enabled) {}
    public record VisibilityRequest(boolean hidden) {}
}
