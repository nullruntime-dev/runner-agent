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
import dev.runner.agent.streaming.SseStreamManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Slf4j
@RestController
@RequiredArgsConstructor
public class LogsController {

    private final SseStreamManager sseStreamManager;
    private final ExecutionRepository executionRepository;

    @GetMapping(value = "/execution/{id}/logs", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamLogs(@PathVariable String id) {
        Execution execution = executionRepository.findById(id)
                .orElseThrow(() -> new ExecutionNotFoundException(id));

        long timeoutMs = 330_000;

        boolean isComplete = execution.getStatus() == ExecutionStatus.SUCCESS
                || execution.getStatus() == ExecutionStatus.FAILED
                || execution.getStatus() == ExecutionStatus.CANCELLED;

        SseEmitter emitter = sseStreamManager.subscribe(id, timeoutMs);

        sseStreamManager.replayAndSubscribe(id, emitter, isComplete);

        log.info("SSE subscription started executionId={} isComplete={}", id, isComplete);

        return emitter;
    }
}
