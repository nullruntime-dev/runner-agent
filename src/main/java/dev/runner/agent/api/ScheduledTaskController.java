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

import dev.runner.agent.domain.ScheduledTask;
import dev.runner.agent.domain.ScheduledTask.*;
import dev.runner.agent.service.ScheduledTaskService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/agent/schedules")
public class ScheduledTaskController {

    private final ScheduledTaskService scheduledTaskService;

    public ScheduledTaskController(ScheduledTaskService scheduledTaskService) {
        this.scheduledTaskService = scheduledTaskService;
    }

    @GetMapping
    public ResponseEntity<List<ScheduledTask>> getAllTasks() {
        return ResponseEntity.ok(scheduledTaskService.getAllTasks());
    }

    @GetMapping("/enabled")
    public ResponseEntity<List<ScheduledTask>> getEnabledTasks() {
        return ResponseEntity.ok(scheduledTaskService.getEnabledTasks());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getTask(@PathVariable Long id) {
        return scheduledTaskService.getTask(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createTask(@RequestBody CreateTaskRequest request) {
        try {
            ScheduledTask task = scheduledTaskService.createTask(
                    request.name(),
                    request.description(),
                    request.type(),
                    request.action(),
                    request.scheduleType(),
                    request.cronExpression(),
                    request.intervalMinutes(),
                    request.timeOfDay(),
                    request.dayOfWeek(),
                    request.notificationTarget(),
                    request.notificationConfig()
            );

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "task", task,
                    "message", "Scheduled task created successfully"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Failed to create scheduled task: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", "Failed to create scheduled task: " + e.getMessage()
            ));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTask(@PathVariable Long id, @RequestBody UpdateTaskRequest request) {
        try {
            ScheduledTask task = scheduledTaskService.updateTask(
                    id,
                    request.name(),
                    request.description(),
                    request.action(),
                    request.enabled(),
                    request.notificationTarget()
            );

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "task", task
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    @PostMapping("/{id}/toggle")
    public ResponseEntity<?> toggleTask(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        try {
            boolean enabled = body.getOrDefault("enabled", true);
            scheduledTaskService.toggleTask(id, enabled);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Task " + (enabled ? "enabled" : "disabled")
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    @PostMapping("/{id}/run")
    public ResponseEntity<?> runTaskNow(@PathVariable Long id) {
        try {
            String result = scheduledTaskService.runTaskNow(id);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "result", result
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTask(@PathVariable Long id) {
        try {
            scheduledTaskService.deleteTask(id);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Task deleted"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    // Request DTOs
    public record CreateTaskRequest(
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
    ) {}

    public record UpdateTaskRequest(
            String name,
            String description,
            String action,
            Boolean enabled,
            NotificationTarget notificationTarget
    ) {}
}
