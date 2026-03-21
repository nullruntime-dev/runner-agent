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
import dev.runner.agent.domain.LogLine;
import dev.runner.agent.domain.LogLineRepository;
import dev.runner.agent.domain.StepResult;
import dev.runner.agent.domain.StepResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReadLogsTool {

    private final LogLineRepository logLineRepository;
    private final StepResultRepository stepResultRepository;

    @Schema(name = "read_logs", description = "Read the last 100 log lines from an execution. Returns stored log lines and step outputs.")
    public Map<String, Object> readLogs(
            @Schema(name = "execution_id", description = "The ID of the execution to read logs from") String executionId
    ) {
        return readLogsWithLimit(executionId, 100);
    }

    @Schema(name = "read_logs_with_limit", description = "Read logs from an execution with a custom limit. Returns stored log lines and step outputs.")
    public Map<String, Object> readLogsWithLimit(
            @Schema(name = "execution_id", description = "The ID of the execution to read logs from") String executionId,
            @Schema(name = "max_lines", description = "Maximum number of log lines to return (1-500)") Integer maxLines
    ) {
        log.info("ADK tool: read_logs id={} maxLines={}", executionId, maxLines);

        int limit = Math.min(maxLines != null ? maxLines : 100, 500);

        Map<String, Object> result = new HashMap<>();

        // Get log lines
        List<LogLine> logLines = logLineRepository.findByExecutionIdOrderByCreatedAtAsc(executionId);
        List<Map<String, Object>> logs = new ArrayList<>();

        int count = 0;
        for (LogLine logLine : logLines) {
            if (count >= limit) break;

            Map<String, Object> entry = new HashMap<>();
            entry.put("stepName", logLine.getStepName());
            entry.put("stream", logLine.getStream());
            entry.put("line", logLine.getLine());
            entry.put("timestamp", logLine.getCreatedAt().toString());
            logs.add(entry);
            count++;
        }

        // Also get step outputs (in case log lines weren't stored)
        List<StepResult> stepResults = stepResultRepository.findByExecutionIdOrderByStepIndexAsc(executionId);
        List<Map<String, Object>> stepOutputs = new ArrayList<>();

        for (StepResult step : stepResults) {
            Map<String, Object> stepInfo = new HashMap<>();
            stepInfo.put("stepIndex", step.getStepIndex());
            stepInfo.put("name", step.getName());
            stepInfo.put("status", step.getStatus() != null ? step.getStatus().name() : null);
            stepInfo.put("exitCode", step.getExitCode());
            stepInfo.put("output", step.getOutput());
            stepInfo.put("error", step.getError());
            stepOutputs.add(stepInfo);
        }

        result.put("success", true);
        result.put("logLines", logs);
        result.put("logLineCount", logs.size());
        result.put("stepOutputs", stepOutputs);
        result.put("stepCount", stepOutputs.size());

        if (logs.isEmpty() && stepOutputs.isEmpty()) {
            result.put("message", "No logs found for execution: " + executionId);
        }

        return result;
    }
}
