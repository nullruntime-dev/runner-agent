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

import dev.runner.agent.domain.Execution;
import dev.runner.agent.dto.ExecuteRequest;
import dev.runner.agent.dto.ExecuteResponse;
import dev.runner.agent.executor.ExecutorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@Validated
@RequiredArgsConstructor
public class ExecuteController {

    private final ExecutorService executorService;

    @PostMapping("/execute")
    public ResponseEntity<ExecuteResponse> execute(@Valid @RequestBody ExecuteRequest request) {
        log.info("Received execute request name={} steps={}", request.getName(), request.getSteps().size());

        Execution execution = executorService.createExecution(request);
        executorService.execute(execution.getId(), request);

        ExecuteResponse response = ExecuteResponse.builder()
                .id(execution.getId())
                .status(execution.getStatus())
                .build();

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }
}
