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
