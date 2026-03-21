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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ListExecutionsTool {

    private final ExecutionRepository executionRepository;

    @Schema(name = "list_executions", description = "List the 10 most recent executions")
    public Map<String, Object> listExecutions() {
        log.info("ADK tool: list_executions");

        PageRequest pageRequest = PageRequest.of(0, 10);
        List<Execution> executions = executionRepository.findAllByOrderByCreatedAtDesc(pageRequest);

        List<Map<String, Object>> executionList = new ArrayList<>();
        for (Execution execution : executions) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", execution.getId());
            item.put("name", execution.getName());
            item.put("status", execution.getStatus().name());
            item.put("exitCode", execution.getExitCode());
            item.put("createdAt", execution.getCreatedAt().toString());
            item.put("completedAt", execution.getCompletedAt() != null ? execution.getCompletedAt().toString() : null);
            executionList.add(item);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("executions", executionList);
        result.put("count", executionList.size());

        return result;
    }

    @Schema(name = "list_executions_by_status", description = "List executions filtered by status")
    public Map<String, Object> listExecutionsByStatus(
            @Schema(name = "status", description = "Filter by status: PENDING, RUNNING, SUCCESS, FAILED, or CANCELLED") String status
    ) {
        log.info("ADK tool: list_executions_by_status status={}", status);

        PageRequest pageRequest = PageRequest.of(0, 10);

        try {
            ExecutionStatus executionStatus = ExecutionStatus.valueOf(status.toUpperCase());
            List<Execution> executions = executionRepository.findByStatusOrderByCreatedAtDesc(executionStatus, pageRequest);

            List<Map<String, Object>> executionList = new ArrayList<>();
            for (Execution execution : executions) {
                Map<String, Object> item = new HashMap<>();
                item.put("id", execution.getId());
                item.put("name", execution.getName());
                item.put("status", execution.getStatus().name());
                item.put("exitCode", execution.getExitCode());
                item.put("createdAt", execution.getCreatedAt().toString());
                item.put("completedAt", execution.getCompletedAt() != null ? execution.getCompletedAt().toString() : null);
                executionList.add(item);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("executions", executionList);
            result.put("count", executionList.size());
            result.put("filteredBy", status.toUpperCase());

            return result;
        } catch (IllegalArgumentException e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("error", "Invalid status: " + status + ". Valid values: PENDING, RUNNING, SUCCESS, FAILED, CANCELLED");
            return result;
        }
    }
}
