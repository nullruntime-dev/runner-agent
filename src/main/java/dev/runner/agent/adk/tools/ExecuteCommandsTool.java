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
import dev.runner.agent.dto.ExecuteRequest;
import dev.runner.agent.dto.StepDto;
import dev.runner.agent.executor.ExecutorService;
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
public class ExecuteCommandsTool {

    private final ExecutorService executorService;

    @Schema(name = "execute_commands", description = "Execute shell commands on the server. Use this to run deployments, scripts, or any shell commands.")
    public Map<String, Object> executeCommands(
            @Schema(name = "name", description = "A descriptive name for this execution (e.g., 'Deploy myapp', 'Run tests')") String name,
            @Schema(name = "commands", description = "List of shell commands to run sequentially") List<String> commands
    ) {
        log.info("ADK tool: execute_commands name={} commands={}", name, commands.size());

        List<StepDto> steps = new ArrayList<>();
        for (int i = 0; i < commands.size(); i++) {
            StepDto step = new StepDto();
            step.setName("Step " + (i + 1));
            step.setRun(commands.get(i));
            step.setTimeout(60);
            step.setContinueOnError(false);
            steps.add(step);
        }

        ExecuteRequest request = new ExecuteRequest();
        request.setName(name);
        request.setSteps(steps);
        request.setEnv(new HashMap<>());
        request.setTimeout(300);

        Execution execution = executorService.createExecution(request);
        executorService.execute(execution.getId(), request);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("id", execution.getId());
        result.put("name", execution.getName());
        result.put("status", execution.getStatus().name());
        result.put("message", "Execution started. Use get_execution_status to check progress.");

        return result;
    }
}
