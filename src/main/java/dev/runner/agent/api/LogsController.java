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
