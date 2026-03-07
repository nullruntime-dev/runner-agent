package dev.runner.agent.executor;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.runner.agent.config.AgentConfig;
import dev.runner.agent.domain.*;
import dev.runner.agent.dto.ExecuteRequest;
import dev.runner.agent.dto.StepDto;
import dev.runner.agent.streaming.SseStreamManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutorService {

    private final AgentConfig agentConfig;
    private final StepRunner stepRunner;
    private final SseStreamManager sseStreamManager;
    private final ExecutionRepository executionRepository;
    private final StepResultRepository stepResultRepository;
    private final ObjectMapper objectMapper;

    private final ConcurrentHashMap<String, StepRunner.ProcessHolder> activeProcesses = new ConcurrentHashMap<>();

    @Transactional
    public Execution createExecution(ExecuteRequest request) {
        String id = request.getId() != null ? request.getId() : UUID.randomUUID().toString();

        String requestJson;
        try {
            requestJson = objectMapper.writeValueAsString(request);
        } catch (Exception e) {
            requestJson = "{}";
        }

        Execution execution = Execution.builder()
                .id(id)
                .name(request.getName())
                .status(ExecutionStatus.PENDING)
                .requestJson(requestJson)
                .shell(request.getShell() != null ? request.getShell() : agentConfig.getDefaultShell())
                .workingDir(request.getWorkingDir() != null ? request.getWorkingDir() : agentConfig.getWorkingDir())
                .createdAt(Instant.now())
                .build();

        return executionRepository.save(execution);
    }

    @Async("agentExecutor")
    public void execute(String executionId, ExecuteRequest request) {
        log.info("Starting execution id={} name={}", executionId, request.getName());

        Execution execution = executionRepository.findById(executionId).orElse(null);
        if (execution == null) {
            log.error("Execution not found id={}", executionId);
            return;
        }

        execution.setStatus(ExecutionStatus.RUNNING);
        execution.setStartedAt(Instant.now());
        executionRepository.save(execution);

        String shell = execution.getShell();
        String workingDir = execution.getWorkingDir();

        Map<String, String> env = new HashMap<>(System.getenv());
        if (request.getEnv() != null) {
            env.putAll(request.getEnv());
        }

        StepRunner.ProcessHolder processHolder = new StepRunner.ProcessHolder();
        activeProcesses.put(executionId, processHolder);

        boolean allSuccess = true;
        Integer lastExitCode = null;

        try {
            int stepIndex = 0;
            for (StepDto step : request.getSteps()) {
                if (Thread.currentThread().isInterrupted()) {
                    execution.setStatus(ExecutionStatus.CANCELLED);
                    break;
                }

                StepResult result = stepRunner.run(executionId, step, stepIndex, env, shell, workingDir, processHolder);
                result.setExecution(execution);
                stepResultRepository.save(result);

                lastExitCode = result.getExitCode();

                if (result.getStatus() != ExecutionStatus.SUCCESS) {
                    allSuccess = false;
                    if (!step.isContinueOnError()) {
                        log.info("Step failed, stopping execution id={} step={}", executionId, step.getName());
                        break;
                    }
                }

                stepIndex++;
            }

            if (execution.getStatus() != ExecutionStatus.CANCELLED) {
                execution.setStatus(allSuccess ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED);
            }
            execution.setExitCode(lastExitCode);

        } catch (Exception e) {
            log.error("Execution failed id={}: {}", executionId, e.getMessage(), e);
            execution.setStatus(ExecutionStatus.FAILED);
            execution.setError(e.getMessage());
        } finally {
            activeProcesses.remove(executionId);
            execution.setCompletedAt(Instant.now());
            executionRepository.save(execution);
            sseStreamManager.complete(executionId);
            log.info("Execution completed id={} status={}", executionId, execution.getStatus());
        }
    }

    public boolean cancel(String executionId) {
        StepRunner.ProcessHolder holder = activeProcesses.get(executionId);
        if (holder == null) {
            return false;
        }

        Process process = holder.getProcess();
        if (process != null && process.isAlive()) {
            process.destroyForcibly();
            log.info("Process destroyed for execution id={}", executionId);
        }

        Execution execution = executionRepository.findById(executionId).orElse(null);
        if (execution != null && execution.getStatus() == ExecutionStatus.RUNNING) {
            execution.setStatus(ExecutionStatus.CANCELLED);
            execution.setCompletedAt(Instant.now());
            executionRepository.save(execution);
        }

        return true;
    }

    public boolean isActive(String executionId) {
        return activeProcesses.containsKey(executionId);
    }
}
