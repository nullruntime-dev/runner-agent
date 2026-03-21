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
import dev.runner.agent.domain.ExecutionRepository;
import dev.runner.agent.domain.ExecutionStatus;
import dev.runner.agent.exception.ExecutionNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequiredArgsConstructor
public class ExecutionController {

    private final ExecutionRepository executionRepository;

    @GetMapping("/execution/{id}")
    public ResponseEntity<Execution> getExecution(@PathVariable String id) {
        Execution execution = executionRepository.findById(id)
                .orElseThrow(() -> new ExecutionNotFoundException(id));
        return ResponseEntity.ok(execution);
    }

    @GetMapping("/executions")
    public ResponseEntity<List<Execution>> listExecutions(
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) ExecutionStatus status) {

        List<Execution> executions;
        PageRequest pageRequest = PageRequest.of(0, limit);

        if (status != null) {
            executions = executionRepository.findByStatusOrderByCreatedAtDesc(status, pageRequest);
        } else {
            executions = executionRepository.findAllByOrderByCreatedAtDesc(pageRequest);
        }

        return ResponseEntity.ok(executions);
    }
}
