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
import dev.runner.agent.executor.ExecutorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class CancelExecutionTool {

    private final ExecutorService executorService;
    private final ExecutionRepository executionRepository;

    @Schema(name = "cancel_execution", description = "Cancel a running execution")
    public Map<String, Object> cancelExecution(
            @Schema(name = "execution_id", description = "The ID of the execution to cancel") String executionId
    ) {
        log.info("ADK tool: cancel_execution id={}", executionId);

        Map<String, Object> result = new HashMap<>();

        Optional<Execution> executionOpt = executionRepository.findById(executionId);
        if (executionOpt.isEmpty()) {
            result.put("success", false);
            result.put("error", "Execution not found: " + executionId);
            return result;
        }

        Execution execution = executionOpt.get();
        if (execution.getStatus() != ExecutionStatus.RUNNING && execution.getStatus() != ExecutionStatus.PENDING) {
            result.put("success", false);
            result.put("error", "Cannot cancel execution in state: " + execution.getStatus());
            return result;
        }

        boolean cancelled = executorService.cancel(executionId);

        result.put("success", cancelled);
        result.put("id", executionId);
        result.put("message", cancelled ? "Execution cancelled successfully" : "Failed to cancel execution");

        return result;
    }
}
