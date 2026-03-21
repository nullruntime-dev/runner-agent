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
import dev.runner.agent.domain.*;
import dev.runner.agent.dto.ExecuteRequest;
import dev.runner.agent.dto.StepDto;
import dev.runner.agent.executor.ExecutorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomSkillService {

    private final CustomSkillRepository customSkillRepository;
    private final ExecutorService executorService;
    private final ExecutionRepository executionRepository;
    private final SkillService skillService;
    private final ObjectMapper objectMapper;

    private static final Pattern KEBAB_CASE = Pattern.compile("^[a-z][a-z0-9]*(-[a-z0-9]+)*$");

    @Transactional
    public CustomSkill createSkill(String name, String displayName, String description,
                                   CustomSkillType type, String definitionJson, String icon) {
        log.info("Creating custom skill name={} type={}", name, type);

        if (!KEBAB_CASE.matcher(name).matches()) {
            throw new IllegalArgumentException("Skill name must be kebab-case (e.g., 'deploy-prod')");
        }

        if (customSkillRepository.existsByName(name)) {
            throw new IllegalArgumentException("Skill already exists: " + name);
        }

        validateDefinitionJson(type, definitionJson);

        CustomSkill skill = CustomSkill.builder()
                .name(name)
                .displayName(displayName != null ? displayName : formatDisplayName(name))
                .description(description)
                .type(type)
                .definitionJson(definitionJson)
                .icon(icon != null ? icon : "custom")
                .enabled(true)
                .executionCount(0)
                .build();

        return customSkillRepository.save(skill);
    }

    @Transactional(readOnly = true)
    public List<CustomSkill> listSkills() {
        return customSkillRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<CustomSkill> listEnabledSkills() {
        return customSkillRepository.findByEnabledTrue();
    }

    @Transactional(readOnly = true)
    public Optional<CustomSkill> getSkill(String name) {
        return customSkillRepository.findByName(name);
    }

    @Transactional
    public CustomSkill updateSkill(String name, String displayName, String description,
                                   String definitionJson, String icon) {
        log.info("Updating custom skill name={}", name);

        CustomSkill skill = customSkillRepository.findByName(name)
                .orElseThrow(() -> new IllegalArgumentException("Skill not found: " + name));

        if (displayName != null) {
            skill.setDisplayName(displayName);
        }
        if (description != null) {
            skill.setDescription(description);
        }
        if (definitionJson != null) {
            validateDefinitionJson(skill.getType(), definitionJson);
            skill.setDefinitionJson(definitionJson);
        }
        if (icon != null) {
            skill.setIcon(icon);
        }

        return customSkillRepository.save(skill);
    }

    @Transactional
    public void deleteSkill(String name) {
        log.info("Deleting custom skill name={}", name);

        CustomSkill skill = customSkillRepository.findByName(name)
                .orElseThrow(() -> new IllegalArgumentException("Skill not found: " + name));

        customSkillRepository.delete(skill);
    }

    @Transactional
    public void toggleSkill(String name, boolean enabled) {
        log.info("Toggling custom skill name={} enabled={}", name, enabled);

        CustomSkill skill = customSkillRepository.findByName(name)
                .orElseThrow(() -> new IllegalArgumentException("Skill not found: " + name));

        skill.setEnabled(enabled);
        customSkillRepository.save(skill);
    }

    @Transactional
    public Map<String, Object> runSkill(String name, String input, Map<String, Object> params) {
        log.info("Running custom skill name={}", name);

        CustomSkill skill = customSkillRepository.findByName(name)
                .orElseThrow(() -> new IllegalArgumentException("Skill not found: " + name));

        if (!skill.isEnabled()) {
            throw new IllegalStateException("Skill is disabled: " + name);
        }

        skill.incrementExecutionCount();
        customSkillRepository.save(skill);

        return switch (skill.getType()) {
            case COMMAND -> runCommandSkill(skill, input, params);
            case PROMPT -> runPromptSkill(skill, input);
            case WORKFLOW -> runWorkflowSkill(skill, input, params);
        };
    }

    private Map<String, Object> runCommandSkill(CustomSkill skill, String input, Map<String, Object> params) {
        Map<String, Object> result = new HashMap<>();

        try {
            Map<String, Object> definition = parseDefinition(skill.getDefinitionJson());
            @SuppressWarnings("unchecked")
            List<String> commands = (List<String>) definition.get("commands");
            String workingDir = (String) definition.get("workingDir");
            String shell = (String) definition.get("shell");
            Integer timeout = definition.get("timeout") != null ?
                    ((Number) definition.get("timeout")).intValue() : 300;

            if (commands == null || commands.isEmpty()) {
                result.put("success", false);
                result.put("error", "No commands defined in skill");
                return result;
            }

            // Substitute input into commands if placeholder exists
            List<String> processedCommands = new ArrayList<>();
            for (String cmd : commands) {
                String processed = cmd.replace("${input}", input != null ? input : "");
                if (params != null) {
                    for (Map.Entry<String, Object> entry : params.entrySet()) {
                        processed = processed.replace("${" + entry.getKey() + "}",
                                entry.getValue() != null ? entry.getValue().toString() : "");
                    }
                }
                processedCommands.add(processed);
            }

            List<StepDto> steps = new ArrayList<>();
            for (int i = 0; i < processedCommands.size(); i++) {
                StepDto step = new StepDto();
                step.setName("Step " + (i + 1));
                step.setRun(processedCommands.get(i));
                step.setTimeout(timeout);
                step.setContinueOnError(false);
                steps.add(step);
            }

            ExecuteRequest request = new ExecuteRequest();
            request.setName("Skill: " + skill.getDisplayName());
            request.setSteps(steps);
            request.setEnv(new HashMap<>());
            request.setTimeout(timeout);
            if (workingDir != null) {
                request.setWorkingDir(workingDir);
            }
            if (shell != null) {
                request.setShell(shell);
            }

            Execution execution = executorService.createExecution(request);
            executorService.execute(execution.getId(), request);

            result.put("success", true);
            result.put("executionId", execution.getId());
            result.put("skillName", skill.getName());
            result.put("message", "Command skill started. Use get_execution_status to check progress.");

        } catch (Exception e) {
            log.error("Failed to run command skill name={}: {}", skill.getName(), e.getMessage(), e);
            result.put("success", false);
            result.put("error", "Failed to run command skill: " + e.getMessage());
        }

        return result;
    }

    private Map<String, Object> runPromptSkill(CustomSkill skill, String input) {
        Map<String, Object> result = new HashMap<>();

        try {
            Map<String, Object> definition = parseDefinition(skill.getDefinitionJson());
            String systemPrompt = (String) definition.get("systemPrompt");
            String personality = (String) definition.get("personality");
            String outputFormat = (String) definition.get("outputFormat");

            StringBuilder enhancedPrompt = new StringBuilder();
            enhancedPrompt.append("[").append(skill.getDisplayName()).append(" Mode]\n\n");

            if (systemPrompt != null) {
                enhancedPrompt.append("INSTRUCTIONS: ").append(systemPrompt).append("\n\n");
            }
            if (personality != null) {
                enhancedPrompt.append("PERSONALITY: ").append(personality).append("\n\n");
            }
            if (outputFormat != null) {
                enhancedPrompt.append("OUTPUT FORMAT: ").append(outputFormat).append("\n\n");
            }
            if (input != null && !input.isBlank()) {
                enhancedPrompt.append("USER INPUT:\n").append(input);
            }

            result.put("success", true);
            result.put("skillName", skill.getName());
            result.put("enhancedPrompt", enhancedPrompt.toString());
            result.put("message", "Prompt skill applied. Process the enhanced prompt.");

        } catch (Exception e) {
            log.error("Failed to run prompt skill name={}: {}", skill.getName(), e.getMessage(), e);
            result.put("success", false);
            result.put("error", "Failed to run prompt skill: " + e.getMessage());
        }

        return result;
    }

    private Map<String, Object> runWorkflowSkill(CustomSkill skill, String input, Map<String, Object> params) {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> stepResults = new ArrayList<>();

        try {
            Map<String, Object> definition = parseDefinition(skill.getDefinitionJson());
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> steps = (List<Map<String, Object>>) definition.get("steps");

            if (steps == null || steps.isEmpty()) {
                result.put("success", false);
                result.put("error", "No steps defined in workflow");
                return result;
            }

            Map<String, Integer> labelIndex = new HashMap<>();
            for (int i = 0; i < steps.size(); i++) {
                String stepName = (String) steps.get(i).get("name");
                if (stepName != null) {
                    labelIndex.put(stepName.toLowerCase(), i);
                }
            }

            int currentStep = 0;
            while (currentStep < steps.size()) {
                Map<String, Object> step = steps.get(currentStep);
                String stepName = (String) step.get("name");
                String stepType = (String) step.get("type");
                Map<String, Object> stepResult = new HashMap<>();
                stepResult.put("step", stepName);
                stepResult.put("index", currentStep);

                boolean stepSuccess = false;
                String nextAction = null;

                try {
                    switch (stepType != null ? stepType : "command") {
                        case "command" -> {
                            String command = (String) step.get("command");
                            if (command != null) {
                                // Substitute placeholders
                                command = command.replace("${input}", input != null ? input : "");
                                stepResult.put("command", command);
                                // For workflow, we execute commands synchronously inline
                                // Create a single-step execution and wait for it
                                stepSuccess = executeWorkflowCommand(command, stepResult);
                            }
                        }
                        case "skill" -> {
                            String skillName = (String) step.get("skill");
                            @SuppressWarnings("unchecked")
                            Map<String, Object> skillParams = (Map<String, Object>) step.get("params");
                            if (skillName != null) {
                                // Substitute placeholders in params
                                if (skillParams != null) {
                                    Map<String, Object> processedParams = new HashMap<>();
                                    for (Map.Entry<String, Object> entry : skillParams.entrySet()) {
                                        Object value = entry.getValue();
                                        if (value instanceof String) {
                                            value = ((String) value).replace("${input}", input != null ? input : "");
                                        }
                                        processedParams.put(entry.getKey(), value);
                                    }
                                    skillParams = processedParams;
                                }
                                stepResult.put("skill", skillName);
                                stepSuccess = executeWorkflowSkill(skillName, skillParams, stepResult);
                            }
                        }
                        default -> {
                            stepResult.put("error", "Unknown step type: " + stepType);
                            stepSuccess = false;
                        }
                    }
                } catch (Exception e) {
                    stepResult.put("error", e.getMessage());
                    stepSuccess = false;
                }

                stepResult.put("success", stepSuccess);
                stepResults.add(stepResult);

                // Handle onSuccess/onFailure
                if (stepSuccess) {
                    nextAction = (String) step.get("onSuccess");
                } else {
                    nextAction = (String) step.get("onFailure");
                }

                if (nextAction != null) {
                    if (nextAction.equals("abort")) {
                        break;
                    } else if (nextAction.startsWith("goto:")) {
                        String label = nextAction.substring(5).toLowerCase();
                        Integer targetIndex = labelIndex.get(label);
                        if (targetIndex != null) {
                            currentStep = targetIndex;
                            continue;
                        }
                    }
                }

                currentStep++;
            }

            boolean allSuccess = stepResults.stream()
                    .allMatch(sr -> Boolean.TRUE.equals(sr.get("success")));

            result.put("success", allSuccess);
            result.put("skillName", skill.getName());
            result.put("stepResults", stepResults);
            result.put("message", allSuccess ? "Workflow completed successfully" : "Workflow completed with errors");

        } catch (Exception e) {
            log.error("Failed to run workflow skill name={}: {}", skill.getName(), e.getMessage(), e);
            result.put("success", false);
            result.put("error", "Failed to run workflow skill: " + e.getMessage());
            result.put("stepResults", stepResults);
        }

        return result;
    }

    private boolean executeWorkflowCommand(String command, Map<String, Object> stepResult) {
        try {
            List<StepDto> steps = new ArrayList<>();
            StepDto step = new StepDto();
            step.setName("Workflow Step");
            step.setRun(command);
            step.setTimeout(60);
            step.setContinueOnError(false);
            steps.add(step);

            ExecuteRequest request = new ExecuteRequest();
            request.setName("Workflow Command");
            request.setSteps(steps);
            request.setEnv(new HashMap<>());
            request.setTimeout(60);

            Execution execution = executorService.createExecution(request);
            executorService.execute(execution.getId(), request);

            // Wait for completion (with timeout)
            int maxWait = 60;
            int waited = 0;
            while (waited < maxWait) {
                Execution current = executionRepository.findById(execution.getId()).orElse(null);
                if (current != null && current.getStatus() != ExecutionStatus.PENDING
                        && current.getStatus() != ExecutionStatus.RUNNING) {
                    stepResult.put("executionId", execution.getId());
                    stepResult.put("status", current.getStatus().name());
                    return current.getStatus() == ExecutionStatus.SUCCESS;
                }
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
                waited++;
            }

            stepResult.put("executionId", execution.getId());
            stepResult.put("status", "TIMEOUT");
            return false;

        } catch (Exception e) {
            stepResult.put("error", e.getMessage());
            return false;
        }
    }

    private boolean executeWorkflowSkill(String skillName, Map<String, Object> params, Map<String, Object> stepResult) {
        // Check if it's a built-in skill or custom skill
        Optional<CustomSkill> customSkill = customSkillRepository.findByName(skillName);
        if (customSkill.isPresent()) {
            try {
                Map<String, Object> skillResult = runSkill(skillName, null, params);
                stepResult.put("skillResult", skillResult);
                return Boolean.TRUE.equals(skillResult.get("success"));
            } catch (Exception e) {
                stepResult.put("error", e.getMessage());
                return false;
            }
        }

        // Check built-in skills (slack, gmail, etc.)
        Optional<Map<String, String>> config = skillService.getSkillConfig(skillName);
        if (config.isPresent()) {
            stepResult.put("info", "Built-in skill " + skillName + " would be invoked here");
            // Built-in skill execution would happen through the respective tools
            // For now, we just mark it as needing external invocation
            stepResult.put("requiresExternalInvocation", true);
            stepResult.put("skillParams", params);
            return true;
        }

        stepResult.put("error", "Skill not found: " + skillName);
        return false;
    }

    private Map<String, Object> parseDefinition(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid definition JSON: " + e.getMessage());
        }
    }

    private void validateDefinitionJson(CustomSkillType type, String json) {
        if (json == null || json.isBlank()) {
            throw new IllegalArgumentException("Definition JSON is required");
        }

        Map<String, Object> definition = parseDefinition(json);

        switch (type) {
            case COMMAND -> {
                if (!definition.containsKey("commands")) {
                    throw new IllegalArgumentException("COMMAND skill requires 'commands' array");
                }
            }
            case PROMPT -> {
                if (!definition.containsKey("systemPrompt")) {
                    throw new IllegalArgumentException("PROMPT skill requires 'systemPrompt'");
                }
            }
            case WORKFLOW -> {
                if (!definition.containsKey("steps")) {
                    throw new IllegalArgumentException("WORKFLOW skill requires 'steps' array");
                }
            }
        }
    }

    private String formatDisplayName(String kebabName) {
        String[] parts = kebabName.split("-");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (!sb.isEmpty()) {
                sb.append(" ");
            }
            sb.append(Character.toUpperCase(part.charAt(0)));
            sb.append(part.substring(1));
        }
        return sb.toString();
    }
}
