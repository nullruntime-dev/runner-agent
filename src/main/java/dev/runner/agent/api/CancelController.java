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
import dev.runner.agent.executor.ExecutorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
public class CancelController {

    private final ExecutorService executorService;
    private final ExecutionRepository executionRepository;

    @PostMapping("/execution/{id}/cancel")
    public ResponseEntity<Map<String, String>> cancel(@PathVariable String id) {
        Execution execution = executionRepository.findById(id)
                .orElseThrow(() -> new ExecutionNotFoundException(id));

        ExecutionStatus status = execution.getStatus();
        if (status == ExecutionStatus.SUCCESS
                || status == ExecutionStatus.FAILED
                || status == ExecutionStatus.CANCELLED) {
            log.warn("Cannot cancel execution in terminal state id={} status={}", id, status);
            throw new IllegalStateException("Execution is already in terminal state: " + status);
        }

        boolean cancelled = executorService.cancel(id);
        if (cancelled) {
            log.info("Execution cancelled id={}", id);
            return ResponseEntity.ok(Map.of("status", "cancelled"));
        } else {
            log.warn("Execution not active id={}", id);
            return ResponseEntity.ok(Map.of("status", "not_active"));
        }
    }
}
