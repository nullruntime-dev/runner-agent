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
import dev.runner.agent.domain.ScheduledTask.*;
import dev.runner.agent.domain.ScheduledTaskRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class ScheduledTaskService {

    private final ScheduledTaskRepository repository;
    private final ScheduledTaskExecutor executor;

    public ScheduledTaskService(ScheduledTaskRepository repository, ScheduledTaskExecutor executor) {
        this.repository = repository;
        this.executor = executor;
        log.info("ScheduledTaskService initialized");
    }

    /**
     * Check for due tasks every minute
     */
    @Scheduled(fixedRate = 60000) // Every minute
    @Transactional
    public void checkAndExecuteDueTasks() {
        LocalDateTime now = LocalDateTime.now();
        List<ScheduledTask> dueTasks = repository.findTasksDueForExecution(now);

        if (!dueTasks.isEmpty()) {
            log.info("Found {} scheduled tasks due for execution", dueTasks.size());
        }

        for (ScheduledTask task : dueTasks) {
            try {
                log.info("Executing scheduled task: {} (type={}, action={})",
                        task.getName(), task.getType(), task.getAction());

                // Execute the task
                String result = executor.execute(task);

                // Update task status
                task.setLastRunAt(now);
                task.setLastRunStatus("SUCCESS");
                task.setLastRunResult(truncate(result, 2000));
                task.setRunCount(task.getRunCount() + 1);
                task.calculateNextRun();

                repository.save(task);

                log.info("Scheduled task '{}' completed successfully. Next run: {}",
                        task.getName(), task.getNextRunAt());

            } catch (Exception e) {
                log.error("Failed to execute scheduled task '{}': {}", task.getName(), e.getMessage(), e);

                task.setLastRunAt(now);
                task.setLastRunStatus("FAILED");
                task.setLastRunResult(truncate("Error: " + e.getMessage(), 2000));
                task.setRunCount(task.getRunCount() + 1);
                task.setFailureCount(task.getFailureCount() + 1);
                task.calculateNextRun();

                repository.save(task);
            }
        }
    }

    @Transactional
    public ScheduledTask createTask(
            String name,
            String description,
            ScheduledTaskType type,
            String action,
            ScheduleType scheduleType,
            String cronExpression,
            Integer intervalMinutes,
            String timeOfDay,
            Integer dayOfWeek,
            NotificationTarget notificationTarget,
            String notificationConfig
    ) {
        // Check if task with same name exists
        if (repository.findByNameIgnoreCase(name).isPresent()) {
            throw new IllegalArgumentException("A scheduled task with name '" + name + "' already exists");
        }

        ScheduledTask task = ScheduledTask.builder()
                .name(name)
                .description(description)
                .type(type)
                .action(action)
                .scheduleType(scheduleType)
                .cronExpression(cronExpression)
                .intervalMinutes(intervalMinutes)
                .timeOfDay(timeOfDay)
                .dayOfWeek(dayOfWeek)
                .notificationTarget(notificationTarget != null ? notificationTarget : NotificationTarget.LOG)
                .notificationConfig(notificationConfig)
                .enabled(true)
                .build();

        task = repository.save(task);
        log.info("Created scheduled task: {} (next run: {})", task.getName(), task.getNextRunAt());

        return task;
    }

    /**
     * Helper to create daily tasks easily
     */
    @Transactional
    public ScheduledTask createDailyTask(String name, String description, ScheduledTaskType type,
                                          String action, String timeOfDay, NotificationTarget notify) {
        return createTask(name, description, type, action, ScheduleType.DAILY,
                null, null, timeOfDay, null, notify, null);
    }

    /**
     * Helper to create interval tasks easily
     */
    @Transactional
    public ScheduledTask createIntervalTask(String name, String description, ScheduledTaskType type,
                                             String action, int intervalMinutes, NotificationTarget notify) {
        return createTask(name, description, type, action, ScheduleType.INTERVAL,
                null, intervalMinutes, null, null, notify, null);
    }

    /**
     * Helper to create weekly tasks easily
     */
    @Transactional
    public ScheduledTask createWeeklyTask(String name, String description, ScheduledTaskType type,
                                           String action, String timeOfDay, int dayOfWeek, NotificationTarget notify) {
        return createTask(name, description, type, action, ScheduleType.WEEKLY,
                null, null, timeOfDay, dayOfWeek, notify, null);
    }

    @Transactional
    public ScheduledTask updateTask(Long id, String name, String description, String action,
                                     Boolean enabled, NotificationTarget notificationTarget) {
        ScheduledTask task = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + id));

        if (name != null) task.setName(name);
        if (description != null) task.setDescription(description);
        if (action != null) task.setAction(action);
        if (enabled != null) {
            task.setEnabled(enabled);
            if (enabled && task.getNextRunAt() == null) {
                task.calculateNextRun();
            }
        }
        if (notificationTarget != null) task.setNotificationTarget(notificationTarget);

        return repository.save(task);
    }

    @Transactional
    public void toggleTask(Long id, boolean enabled) {
        ScheduledTask task = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + id));

        task.setEnabled(enabled);
        if (enabled) {
            task.calculateNextRun();
        }

        repository.save(task);
        log.info("Task '{}' {}", task.getName(), enabled ? "enabled" : "disabled");
    }

    @Transactional
    public void deleteTask(Long id) {
        ScheduledTask task = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + id));

        repository.delete(task);
        log.info("Deleted scheduled task: {}", task.getName());
    }

    @Transactional
    public void deleteTaskByName(String name) {
        Optional<ScheduledTask> task = repository.findByNameIgnoreCase(name);
        task.ifPresent(t -> {
            repository.delete(t);
            log.info("Deleted scheduled task: {}", t.getName());
        });
    }

    public List<ScheduledTask> getAllTasks() {
        return repository.findAllOrderByNextRun();
    }

    public List<ScheduledTask> getEnabledTasks() {
        return repository.findEnabledOrderByNextRun();
    }

    public Optional<ScheduledTask> getTask(Long id) {
        return repository.findById(id);
    }

    public Optional<ScheduledTask> getTaskByName(String name) {
        return repository.findByNameIgnoreCase(name);
    }

    /**
     * Run a task immediately (manual trigger)
     */
    @Transactional
    public String runTaskNow(Long id) {
        ScheduledTask task = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + id));

        try {
            log.info("Manually executing task: {}", task.getName());
            String result = executor.execute(task);

            task.setLastRunAt(LocalDateTime.now());
            task.setLastRunStatus("SUCCESS");
            task.setLastRunResult(truncate(result, 2000));
            task.setRunCount(task.getRunCount() + 1);

            repository.save(task);

            return result;
        } catch (Exception e) {
            log.error("Manual task execution failed: {}", e.getMessage(), e);

            task.setLastRunAt(LocalDateTime.now());
            task.setLastRunStatus("FAILED");
            task.setLastRunResult(truncate("Error: " + e.getMessage(), 2000));
            task.setRunCount(task.getRunCount() + 1);
            task.setFailureCount(task.getFailureCount() + 1);

            repository.save(task);

            throw new RuntimeException("Task execution failed: " + e.getMessage(), e);
        }
    }

    /**
     * Get task status summary
     */
    public String getTaskStatus(ScheduledTask task) {
        StringBuilder sb = new StringBuilder();
        sb.append("Task: ").append(task.getName()).append("\n");
        sb.append("Status: ").append(task.isEnabled() ? "Enabled" : "Disabled").append("\n");
        sb.append("Type: ").append(task.getType()).append("\n");
        sb.append("Schedule: ").append(formatSchedule(task)).append("\n");

        if (task.getNextRunAt() != null) {
            sb.append("Next Run: ").append(task.getNextRunAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))).append("\n");
        }
        if (task.getLastRunAt() != null) {
            sb.append("Last Run: ").append(task.getLastRunAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
            sb.append(" (").append(task.getLastRunStatus()).append(")\n");
        }
        sb.append("Total Runs: ").append(task.getRunCount());
        if (task.getFailureCount() > 0) {
            sb.append(" (").append(task.getFailureCount()).append(" failures)");
        }

        return sb.toString();
    }

    private String formatSchedule(ScheduledTask task) {
        return switch (task.getScheduleType()) {
            case DAILY -> "Daily at " + task.getTimeOfDay();
            case WEEKLY -> "Weekly on " + dayName(task.getDayOfWeek()) + " at " + task.getTimeOfDay();
            case INTERVAL -> "Every " + task.getIntervalMinutes() + " minutes";
            case CRON -> "Cron: " + task.getCronExpression();
        };
    }

    private String dayName(Integer day) {
        if (day == null) return "?";
        return switch (day) {
            case 1 -> "Monday";
            case 2 -> "Tuesday";
            case 3 -> "Wednesday";
            case 4 -> "Thursday";
            case 5 -> "Friday";
            case 6 -> "Saturday";
            case 7 -> "Sunday";
            default -> "Day " + day;
        };
    }

    private String truncate(String s, int maxLength) {
        if (s == null) return null;
        return s.length() > maxLength ? s.substring(0, maxLength - 3) + "..." : s;
    }
}
