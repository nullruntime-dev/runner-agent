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
package dev.runner.agent.service;

import dev.runner.agent.domain.ScheduledTask;
import dev.runner.agent.domain.ScheduledTaskRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Component
public class ScheduledTaskAsyncExecutor {

    private final ScheduledTaskRepository repository;
    private final ScheduledTaskExecutor executor;

    public ScheduledTaskAsyncExecutor(ScheduledTaskRepository repository, ScheduledTaskExecutor executor) {
        this.repository = repository;
        this.executor = executor;
    }

    @Async("agentExecutor")
    public void executeTaskAsync(Long id) {
        ScheduledTask task;
        try {
            task = repository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Task not found: " + id));
        } catch (Exception e) {
            log.error("Failed to load task {}: {}", id, e.getMessage());
            return;
        }

        markRunning(id);

        try {
            String result = executor.execute(task);
            markCompleted(id, true, result);
            log.info("Manual task '{}' completed. Result: {}", task.getName(), truncate(result, 200));
        } catch (Exception e) {
            log.error("Manual task execution failed: {}", e.getMessage(), e);
            markCompleted(id, false, "Error: " + e.getMessage());
        }
    }

    @Transactional
    public void markRunning(Long id) {
        repository.findById(id).ifPresent(t -> {
            t.setLastRunStatus("RUNNING");
            repository.save(t);
        });
    }

    @Transactional
    public void markCompleted(Long id, boolean success, String result) {
        repository.findById(id).ifPresent(t -> {
            t.setLastRunAt(LocalDateTime.now());
            t.setLastRunStatus(success ? "SUCCESS" : "FAILED");
            t.setLastRunResult(truncate(result, 2000));
            t.setRunCount(t.getRunCount() + 1);
            if (!success) {
                t.setFailureCount(t.getFailureCount() + 1);
            }
            repository.save(t);
        });
    }

    private String truncate(String s, int maxLength) {
        if (s == null) return null;
        return s.length() > maxLength ? s.substring(0, maxLength - 3) + "..." : s;
    }
}