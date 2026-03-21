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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.adk.tools.Annotations.Schema;
import dev.runner.agent.domain.CustomSkill;
import dev.runner.agent.domain.CustomSkillType;
import dev.runner.agent.service.CustomSkillService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class CustomSkillTool {

    private final CustomSkillService customSkillService;
    private final ObjectMapper objectMapper;

    @Schema(name = "create_custom_skill", description = "Create a new custom skill. Types: COMMAND (run shell commands), PROMPT (AI instructions/personas), WORKFLOW (multi-step with conditions)")
    public Map<String, Object> createCustomSkill(
            @Schema(name = "name", description = "Unique kebab-case name for the skill (e.g., 'deploy-prod', 'code-review')") String name,
            @Schema(name = "display_name", description = "Human-readable display name (e.g., 'Deploy Production')") String displayName,
            @Schema(name = "description", description = "What this skill does") String description,
            @Schema(name = "type", description = "Skill type: COMMAND, PROMPT, or WORKFLOW") String type,
            @Schema(name = "definition_json", description = "Type-specific JSON definition. COMMAND: {\"commands\":[...],\"workingDir\":\"...\",\"timeout\":300}. PROMPT: {\"systemPrompt\":\"...\",\"personality\":\"...\"}. WORKFLOW: {\"steps\":[{\"name\":\"...\",\"type\":\"command\",\"command\":\"...\",\"onFailure\":\"goto:label\"}]}") String definitionJson
    ) {
        log.info("ADK tool: create_custom_skill name={} type={}", name, type);

        Map<String, Object> result = new HashMap<>();

        try {
            CustomSkillType skillType = CustomSkillType.valueOf(type.toUpperCase());
            CustomSkill skill = customSkillService.createSkill(name, displayName, description, skillType, definitionJson, null);

            result.put("success", true);
            result.put("id", skill.getId());
            result.put("name", skill.getName());
            result.put("displayName", skill.getDisplayName());
            result.put("type", skill.getType().name());
            result.put("enabled", skill.isEnabled());
            result.put("message", "Custom skill '" + skill.getDisplayName() + "' created successfully");

        } catch (IllegalArgumentException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        } catch (Exception e) {
            log.error("Failed to create custom skill: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("error", "Failed to create skill: " + e.getMessage());
        }

        return result;
    }

    @Schema(name = "list_custom_skills", description = "List all custom skills with their details")
    public Map<String, Object> listCustomSkills() {
        log.info("ADK tool: list_custom_skills");

        Map<String, Object> result = new HashMap<>();

        try {
            List<CustomSkill> skills = customSkillService.listSkills();

            List<Map<String, Object>> skillList = skills.stream().map(skill -> {
                Map<String, Object> map = new HashMap<>();
                map.put("name", skill.getName());
                map.put("displayName", skill.getDisplayName());
                map.put("description", skill.getDescription());
                map.put("type", skill.getType().name());
                map.put("enabled", skill.isEnabled());
                map.put("executionCount", skill.getExecutionCount());
                return map;
            }).toList();

            result.put("success", true);
            result.put("skills", skillList);
            result.put("count", skills.size());

        } catch (Exception e) {
            log.error("Failed to list custom skills: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("error", "Failed to list skills: " + e.getMessage());
        }

        return result;
    }

    @Schema(name = "get_custom_skill", description = "Get details of a specific custom skill by name")
    public Map<String, Object> getCustomSkill(
            @Schema(name = "name", description = "Name of the skill to retrieve") String name
    ) {
        log.info("ADK tool: get_custom_skill name={}", name);

        Map<String, Object> result = new HashMap<>();

        try {
            Optional<CustomSkill> skillOpt = customSkillService.getSkill(name);

            if (skillOpt.isEmpty()) {
                result.put("success", false);
                result.put("error", "Skill not found: " + name);
                return result;
            }

            CustomSkill skill = skillOpt.get();
            result.put("success", true);
            result.put("name", skill.getName());
            result.put("displayName", skill.getDisplayName());
            result.put("description", skill.getDescription());
            result.put("type", skill.getType().name());
            result.put("definitionJson", skill.getDefinitionJson());
            result.put("icon", skill.getIcon());
            result.put("enabled", skill.isEnabled());
            result.put("executionCount", skill.getExecutionCount());
            result.put("createdAt", skill.getCreatedAt().toString());
            if (skill.getUpdatedAt() != null) {
                result.put("updatedAt", skill.getUpdatedAt().toString());
            }

        } catch (Exception e) {
            log.error("Failed to get custom skill: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("error", "Failed to get skill: " + e.getMessage());
        }

        return result;
    }

    @Schema(name = "update_custom_skill", description = "Update an existing custom skill")
    public Map<String, Object> updateCustomSkill(
            @Schema(name = "name", description = "Name of the skill to update") String name,
            @Schema(name = "display_name", description = "New display name (optional)") String displayName,
            @Schema(name = "description", description = "New description (optional)") String description,
            @Schema(name = "definition_json", description = "New definition JSON (optional)") String definitionJson,
            @Schema(name = "icon", description = "New icon name (optional)") String icon
    ) {
        log.info("ADK tool: update_custom_skill name={}", name);

        Map<String, Object> result = new HashMap<>();

        try {
            CustomSkill skill = customSkillService.updateSkill(name, displayName, description, definitionJson, icon);

            result.put("success", true);
            result.put("name", skill.getName());
            result.put("displayName", skill.getDisplayName());
            result.put("type", skill.getType().name());
            result.put("message", "Skill '" + skill.getDisplayName() + "' updated successfully");

        } catch (IllegalArgumentException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        } catch (Exception e) {
            log.error("Failed to update custom skill: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("error", "Failed to update skill: " + e.getMessage());
        }

        return result;
    }

    @Schema(name = "delete_custom_skill", description = "Delete a custom skill by name")
    public Map<String, Object> deleteCustomSkill(
            @Schema(name = "name", description = "Name of the skill to delete") String name
    ) {
        log.info("ADK tool: delete_custom_skill name={}", name);

        Map<String, Object> result = new HashMap<>();

        try {
            customSkillService.deleteSkill(name);

            result.put("success", true);
            result.put("message", "Skill '" + name + "' deleted successfully");

        } catch (IllegalArgumentException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        } catch (Exception e) {
            log.error("Failed to delete custom skill: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("error", "Failed to delete skill: " + e.getMessage());
        }

        return result;
    }

    @Schema(name = "run_custom_skill", description = "Execute a custom skill")
    public Map<String, Object> runCustomSkill(
            @Schema(name = "name", description = "Name of the skill to run") String name,
            @Schema(name = "input", description = "Input text/content for the skill (optional)") String input,
            @Schema(name = "params_json", description = "Additional parameters as JSON object (optional)") String paramsJson
    ) {
        log.info("ADK tool: run_custom_skill name={}", name);

        Map<String, Object> result = new HashMap<>();

        try {
            Map<String, Object> params = null;
            if (paramsJson != null && !paramsJson.isBlank()) {
                try {
                    params = objectMapper.readValue(paramsJson, new com.fasterxml.jackson.core.type.TypeReference<>() {});
                } catch (JsonProcessingException e) {
                    result.put("success", false);
                    result.put("error", "Invalid params JSON: " + e.getMessage());
                    return result;
                }
            }

            result = customSkillService.runSkill(name, input, params);

        } catch (IllegalArgumentException | IllegalStateException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        } catch (Exception e) {
            log.error("Failed to run custom skill: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("error", "Failed to run skill: " + e.getMessage());
        }

        return result;
    }

    @Schema(name = "toggle_custom_skill", description = "Enable or disable a custom skill")
    public Map<String, Object> toggleCustomSkill(
            @Schema(name = "name", description = "Name of the skill to toggle") String name,
            @Schema(name = "enabled", description = "Whether to enable (true) or disable (false) the skill") boolean enabled
    ) {
        log.info("ADK tool: toggle_custom_skill name={} enabled={}", name, enabled);

        Map<String, Object> result = new HashMap<>();

        try {
            customSkillService.toggleSkill(name, enabled);

            result.put("success", true);
            result.put("name", name);
            result.put("enabled", enabled);
            result.put("message", "Skill '" + name + "' " + (enabled ? "enabled" : "disabled"));

        } catch (IllegalArgumentException e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        } catch (Exception e) {
            log.error("Failed to toggle custom skill: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("error", "Failed to toggle skill: " + e.getMessage());
        }

        return result;
    }
}
