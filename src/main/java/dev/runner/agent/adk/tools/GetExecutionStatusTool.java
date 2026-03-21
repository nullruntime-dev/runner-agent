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
import dev.runner.agent.domain.Execution;
import dev.runner.agent.domain.ExecutionRepository;
import dev.runner.agent.domain.ExecutionStatus;
import dev.runner.agent.domain.StepResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class GetExecutionStatusTool {

    private final ExecutionRepository executionRepository;

    private static final Set<ExecutionStatus> TERMINAL_STATUSES = Set.of(
            ExecutionStatus.SUCCESS,
            ExecutionStatus.FAILED,
            ExecutionStatus.CANCELLED
    );

    private static final int POLL_INTERVAL_MS = 1000;
    private static final int MAX_WAIT_MS = 300000; // 5 minutes max wait

    @Transactional(readOnly = true)
    @Schema(name = "get_execution_status", description = "Get the status and results of an execution by its ID. Use waitForCompletion=true to wait until the execution finishes.")
    public Map<String, Object> getStatus(
            @Schema(name = "execution_id", description = "The ID of the execution to check") String executionId,
            @Schema(name = "wait_for_completion", description = "If true, wait until execution completes (SUCCESS, FAILED, or CANCELLED). Default is true for a smoother experience.", optional = true) Boolean waitForCompletion
    ) {
        // Default to waiting for completion
        boolean shouldWait = waitForCompletion == null || waitForCompletion;

        log.info("ADK tool: get_execution_status id={} wait={}", executionId, shouldWait);

        if (shouldWait) {
            return waitAndGetStatus(executionId);
        } else {
            return getStatusOnce(executionId);
        }
    }

    private Map<String, Object> waitAndGetStatus(String executionId) {
        long startTime = System.currentTimeMillis();

        while (System.currentTimeMillis() - startTime < MAX_WAIT_MS) {
            Map<String, Object> status = getStatusOnce(executionId);

            if (status.containsKey("error")) {
                return status;
            }

            String statusStr = (String) status.get("status");
            if (statusStr != null) {
                try {
                    ExecutionStatus execStatus = ExecutionStatus.valueOf(statusStr);
                    if (TERMINAL_STATUSES.contains(execStatus)) {
                        log.info("Execution {} completed with status {}", executionId, execStatus);
                        return status;
                    }
                } catch (IllegalArgumentException e) {
                    // Unknown status, return as-is
                    return status;
                }
            }

            // Still running, wait and poll again
            try {
                Thread.sleep(POLL_INTERVAL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                status.put("warning", "Polling interrupted");
                return status;
            }
        }

        // Timeout - return current status with warning
        Map<String, Object> status = getStatusOnce(executionId);
        status.put("warning", "Timed out waiting for completion after 5 minutes. Execution is still running.");
        return status;
    }

    private Map<String, Object> getStatusOnce(String executionId) {
        return executionRepository.findByIdWithSteps(executionId)
                .map(this::toStatusMap)
                .orElseGet(() -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("success", false);
                    result.put("error", "Execution not found: " + executionId);
                    return result;
                });
    }

    private Map<String, Object> toStatusMap(Execution execution) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("id", execution.getId());
        result.put("name", execution.getName());
        result.put("status", execution.getStatus().name());
        result.put("exitCode", execution.getExitCode());
        result.put("error", execution.getError());
        result.put("startedAt", execution.getStartedAt() != null ? execution.getStartedAt().toString() : null);
        result.put("completedAt", execution.getCompletedAt() != null ? execution.getCompletedAt().toString() : null);

        List<Map<String, Object>> steps = new ArrayList<>();
        for (StepResult step : execution.getSteps()) {
            Map<String, Object> stepMap = new HashMap<>();
            stepMap.put("index", step.getStepIndex());
            stepMap.put("name", step.getName());
            stepMap.put("status", step.getStatus() != null ? step.getStatus().name() : null);
            stepMap.put("exitCode", step.getExitCode());
            stepMap.put("error", step.getError());
            // Include step output for completed steps
            if (step.getOutput() != null && !step.getOutput().isBlank()) {
                // Truncate very long outputs
                String output = step.getOutput();
                if (output.length() > 2000) {
                    output = output.substring(0, 2000) + "\n... (truncated)";
                }
                stepMap.put("output", output);
            }
            steps.add(stepMap);
        }
        result.put("steps", steps);

        return result;
    }
}
