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

import dev.runner.agent.domain.CustomSkill;
import dev.runner.agent.domain.CustomSkillType;
import dev.runner.agent.service.CustomSkillService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/agent/custom-skills")
@RequiredArgsConstructor
@Validated
public class CustomSkillsController {

    private final CustomSkillService customSkillService;

    @GetMapping
    public ResponseEntity<List<CustomSkillDto>> listSkills() {
        log.info("GET /agent/custom-skills");

        List<CustomSkillDto> skills = customSkillService.listSkills().stream()
                .map(this::toDto)
                .toList();

        return ResponseEntity.ok(skills);
    }

    @GetMapping("/{name}")
    public ResponseEntity<?> getSkill(@PathVariable String name) {
        log.info("GET /agent/custom-skills/{}", name);

        return customSkillService.getSkill(name)
                .map(skill -> ResponseEntity.ok(toDto(skill)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createSkill(@RequestBody CreateSkillRequest request) {
        log.info("POST /agent/custom-skills name={} type={}", request.name(), request.type());

        try {
            CustomSkillType type = CustomSkillType.valueOf(request.type().toUpperCase());
            CustomSkill skill = customSkillService.createSkill(
                    request.name(),
                    request.displayName(),
                    request.description(),
                    type,
                    request.definitionJson(),
                    request.icon()
            );

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "skill", toDto(skill)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    @PutMapping("/{name}")
    public ResponseEntity<Map<String, Object>> updateSkill(
            @PathVariable String name,
            @RequestBody UpdateSkillRequest request
    ) {
        log.info("PUT /agent/custom-skills/{}", name);

        try {
            CustomSkill skill = customSkillService.updateSkill(
                    name,
                    request.displayName(),
                    request.description(),
                    request.definitionJson(),
                    request.icon()
            );

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "skill", toDto(skill)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    @DeleteMapping("/{name}")
    public ResponseEntity<Map<String, Object>> deleteSkill(@PathVariable String name) {
        log.info("DELETE /agent/custom-skills/{}", name);

        try {
            customSkillService.deleteSkill(name);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "name", name
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    @PostMapping("/{name}/toggle")
    public ResponseEntity<Map<String, Object>> toggleSkill(
            @PathVariable String name,
            @RequestBody ToggleRequest request
    ) {
        log.info("POST /agent/custom-skills/{}/toggle enabled={}", name, request.enabled());

        try {
            customSkillService.toggleSkill(name, request.enabled());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "name", name,
                    "enabled", request.enabled()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    @PostMapping("/{name}/run")
    public ResponseEntity<Map<String, Object>> runSkill(
            @PathVariable String name,
            @RequestBody(required = false) RunSkillRequest request
    ) {
        log.info("POST /agent/custom-skills/{}/run", name);

        try {
            String input = request != null ? request.input() : null;
            Map<String, Object> params = request != null ? request.params() : null;

            Map<String, Object> result = customSkillService.runSkill(name, input, params);

            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    private CustomSkillDto toDto(CustomSkill skill) {
        return new CustomSkillDto(
                skill.getId(),
                skill.getName(),
                skill.getDisplayName(),
                skill.getDescription(),
                skill.getType().name(),
                skill.getDefinitionJson(),
                skill.getIcon(),
                skill.isEnabled(),
                skill.getExecutionCount(),
                skill.getCreatedAt() != null ? skill.getCreatedAt().toString() : null,
                skill.getUpdatedAt() != null ? skill.getUpdatedAt().toString() : null
        );
    }

    public record CustomSkillDto(
            Long id,
            String name,
            String displayName,
            String description,
            String type,
            String definitionJson,
            String icon,
            boolean enabled,
            Integer executionCount,
            String createdAt,
            String updatedAt
    ) {}

    public record CreateSkillRequest(
            String name,
            String displayName,
            String description,
            String type,
            String definitionJson,
            String icon
    ) {}

    public record UpdateSkillRequest(
            String displayName,
            String description,
            String definitionJson,
            String icon
    ) {}

    public record ToggleRequest(boolean enabled) {}

    public record RunSkillRequest(
            String input,
            Map<String, Object> params
    ) {}
}
