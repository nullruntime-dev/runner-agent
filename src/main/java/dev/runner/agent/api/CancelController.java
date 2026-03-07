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
