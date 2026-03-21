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
package dev.runner.agent.adk.tools;

import com.google.adk.tools.Annotations.Schema;
import dev.runner.agent.domain.ScheduledTask;
import dev.runner.agent.domain.ScheduledTask.*;
import dev.runner.agent.service.ScheduledTaskService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
public class ScheduleTool {

    private final ScheduledTaskService scheduledTaskService;

    public ScheduleTool(ScheduledTaskService scheduledTaskService) {
        this.scheduledTaskService = scheduledTaskService;
        log.info("ScheduleTool initialized - autopilot mode enabled!");
    }

    @Schema(name = "schedule_daily_task", description = "Schedule a task to run daily at a specific time. Use this for things like 'every morning at 9am, summarize my emails' or 'daily standup reminder at 10am'.")
    public Map<String, Object> scheduleDailyTask(
            @Schema(name = "name", description = "Short name for this schedule (e.g., 'morning-email-summary', 'daily-standup')") String name,
            @Schema(name = "description", description = "What this scheduled task does") String description,
            @Schema(name = "time", description = "Time to run in 24h format (e.g., '09:00' for 9am, '14:30' for 2:30pm)") String time,
            @Schema(name = "task_type", description = "Type of task: 'prompt' (AI will process a prompt), 'skill' (run a skill), or 'command' (run a shell command)") String taskType,
            @Schema(name = "action", description = "The prompt to send, skill name to run, or command to execute") String action,
            @Schema(name = "notify", description = "Where to send results: 'slack', 'email', 'log', or 'none'", optional = true) String notify
    ) {
        log.info("ADK tool: schedule_daily_task name='{}' time='{}' type='{}' action='{}'",
                name, time, taskType, truncate(action, 50));

        Map<String, Object> result = new HashMap<>();

        try {
            ScheduledTaskType type = parseTaskType(taskType);
            NotificationTarget notifyTarget = parseNotify(notify);

            ScheduledTask task = scheduledTaskService.createDailyTask(
                    name, description, type, action, time, notifyTarget
            );

            result.put("success", true);
            result.put("message", String.format("✅ Scheduled '%s' to run daily at %s", name, time));
            result.put("taskId", task.getId());
            result.put("nextRun", task.getNextRunAt() != null ?
                    task.getNextRunAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : "calculating...");
            result.put("instruction", "I've set up your daily schedule. It will run automatically at " + time + " every day.");

        } catch (Exception e) {
            log.error("Failed to create daily schedule: {}", e.getMessage());
            result.put("success", false);
            result.put("error", e.getMessage());
        }

        return result;
    }

    @Schema(name = "schedule_interval_task", description = "Schedule a task to run every X minutes. Use for things like 'check for new messages every 30 minutes' or 'monitor system health every 5 minutes'.")
    public Map<String, Object> scheduleIntervalTask(
            @Schema(name = "name", description = "Short name for this schedule") String name,
            @Schema(name = "description", description = "What this scheduled task does") String description,
            @Schema(name = "interval_minutes", description = "How often to run (in minutes). E.g., 30 for every 30 minutes, 60 for hourly") Integer intervalMinutes,
            @Schema(name = "task_type", description = "Type: 'prompt', 'skill', or 'command'") String taskType,
            @Schema(name = "action", description = "The prompt, skill name, or command") String action,
            @Schema(name = "notify", description = "Where to send results: 'slack', 'email', 'log', or 'none'", optional = true) String notify
    ) {
        log.info("ADK tool: schedule_interval_task name='{}' interval={}min type='{}'",
                name, intervalMinutes, taskType);

        Map<String, Object> result = new HashMap<>();

        try {
            ScheduledTaskType type = parseTaskType(taskType);
            NotificationTarget notifyTarget = parseNotify(notify);

            ScheduledTask task = scheduledTaskService.createIntervalTask(
                    name, description, type, action, intervalMinutes, notifyTarget
            );

            result.put("success", true);
            result.put("message", String.format("✅ Scheduled '%s' to run every %d minutes", name, intervalMinutes));
            result.put("taskId", task.getId());
            result.put("nextRun", task.getNextRunAt() != null ?
                    task.getNextRunAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : "calculating...");
            result.put("instruction", "Your interval schedule is active. It will run every " + intervalMinutes + " minutes.");

        } catch (Exception e) {
            log.error("Failed to create interval schedule: {}", e.getMessage());
            result.put("success", false);
            result.put("error", e.getMessage());
        }

        return result;
    }

    @Schema(name = "schedule_weekly_task", description = "Schedule a task to run once a week on a specific day and time. Use for things like 'every Friday at 5pm, generate weekly report'.")
    public Map<String, Object> scheduleWeeklyTask(
            @Schema(name = "name", description = "Short name for this schedule") String name,
            @Schema(name = "description", description = "What this scheduled task does") String description,
            @Schema(name = "day_of_week", description = "Day to run: 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'") String dayOfWeek,
            @Schema(name = "time", description = "Time to run in 24h format (e.g., '17:00' for 5pm)") String time,
            @Schema(name = "task_type", description = "Type: 'prompt', 'skill', or 'command'") String taskType,
            @Schema(name = "action", description = "The prompt, skill name, or command") String action,
            @Schema(name = "notify", description = "Where to send results: 'slack', 'email', 'log', or 'none'", optional = true) String notify
    ) {
        log.info("ADK tool: schedule_weekly_task name='{}' day='{}' time='{}' type='{}'",
                name, dayOfWeek, time, taskType);

        Map<String, Object> result = new HashMap<>();

        try {
            ScheduledTaskType type = parseTaskType(taskType);
            NotificationTarget notifyTarget = parseNotify(notify);
            int dayNum = parseDayOfWeek(dayOfWeek);

            ScheduledTask task = scheduledTaskService.createWeeklyTask(
                    name, description, type, action, time, dayNum, notifyTarget
            );

            result.put("success", true);
            result.put("message", String.format("✅ Scheduled '%s' to run every %s at %s", name, dayOfWeek, time));
            result.put("taskId", task.getId());
            result.put("nextRun", task.getNextRunAt() != null ?
                    task.getNextRunAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : "calculating...");
            result.put("instruction", "Your weekly schedule is set. It will run every " + dayOfWeek + " at " + time + ".");

        } catch (Exception e) {
            log.error("Failed to create weekly schedule: {}", e.getMessage());
            result.put("success", false);
            result.put("error", e.getMessage());
        }

        return result;
    }

    @Schema(name = "list_schedules", description = "List all scheduled tasks, showing what's running on autopilot.")
    public Map<String, Object> listSchedules(
            @Schema(name = "only_enabled", description = "Only show enabled schedules (default: false)", optional = true) Boolean onlyEnabled
    ) {
        log.info("ADK tool: list_schedules onlyEnabled={}", onlyEnabled);

        Map<String, Object> result = new HashMap<>();

        List<ScheduledTask> tasks = (onlyEnabled != null && onlyEnabled) ?
                scheduledTaskService.getEnabledTasks() :
                scheduledTaskService.getAllTasks();

        if (tasks.isEmpty()) {
            result.put("success", true);
            result.put("message", "No scheduled tasks yet. You can create one with 'schedule X every day at Y'.");
            result.put("schedules", List.of());
            return result;
        }

        List<Map<String, Object>> scheduleList = tasks.stream().map(task -> {
            Map<String, Object> s = new HashMap<>();
            s.put("id", task.getId());
            s.put("name", task.getName());
            s.put("description", task.getDescription());
            s.put("type", task.getType().toString().toLowerCase());
            s.put("schedule", formatSchedule(task));
            s.put("enabled", task.isEnabled());
            s.put("nextRun", task.getNextRunAt() != null ?
                    task.getNextRunAt().format(DateTimeFormatter.ofPattern("MM/dd HH:mm")) : "—");
            s.put("lastRun", task.getLastRunAt() != null ?
                    task.getLastRunAt().format(DateTimeFormatter.ofPattern("MM/dd HH:mm")) : "never");
            s.put("lastStatus", task.getLastRunStatus() != null ? task.getLastRunStatus() : "—");
            s.put("runCount", task.getRunCount());
            return s;
        }).toList();

        result.put("success", true);
        result.put("schedules", scheduleList);
        result.put("count", tasks.size());
        result.put("instruction", "Here are your scheduled tasks running on autopilot:");

        return result;
    }

    @Schema(name = "toggle_schedule", description = "Enable or disable a scheduled task.")
    public Map<String, Object> toggleSchedule(
            @Schema(name = "name", description = "Name of the schedule to toggle") String name,
            @Schema(name = "enabled", description = "true to enable, false to disable") Boolean enabled
    ) {
        log.info("ADK tool: toggle_schedule name='{}' enabled={}", name, enabled);

        Map<String, Object> result = new HashMap<>();

        Optional<ScheduledTask> taskOpt = scheduledTaskService.getTaskByName(name);
        if (taskOpt.isEmpty()) {
            result.put("success", false);
            result.put("error", "Schedule '" + name + "' not found");
            return result;
        }

        scheduledTaskService.toggleTask(taskOpt.get().getId(), enabled);

        result.put("success", true);
        result.put("message", String.format("Schedule '%s' %s", name, enabled ? "enabled ✅" : "disabled ⏸️"));

        return result;
    }

    @Schema(name = "delete_schedule", description = "Delete a scheduled task permanently.")
    public Map<String, Object> deleteSchedule(
            @Schema(name = "name", description = "Name of the schedule to delete") String name
    ) {
        log.info("ADK tool: delete_schedule name='{}'", name);

        Map<String, Object> result = new HashMap<>();

        Optional<ScheduledTask> taskOpt = scheduledTaskService.getTaskByName(name);
        if (taskOpt.isEmpty()) {
            result.put("success", false);
            result.put("error", "Schedule '" + name + "' not found");
            return result;
        }

        scheduledTaskService.deleteTask(taskOpt.get().getId());

        result.put("success", true);
        result.put("message", "Schedule '" + name + "' deleted 🗑️");

        return result;
    }

    @Schema(name = "run_schedule_now", description = "Manually trigger a scheduled task to run immediately.")
    public Map<String, Object> runScheduleNow(
            @Schema(name = "name", description = "Name of the schedule to run") String name
    ) {
        log.info("ADK tool: run_schedule_now name='{}'", name);

        Map<String, Object> result = new HashMap<>();

        Optional<ScheduledTask> taskOpt = scheduledTaskService.getTaskByName(name);
        if (taskOpt.isEmpty()) {
            result.put("success", false);
            result.put("error", "Schedule '" + name + "' not found");
            return result;
        }

        try {
            String taskResult = scheduledTaskService.runTaskNow(taskOpt.get().getId());
            result.put("success", true);
            result.put("message", "Schedule '" + name + "' executed successfully ▶️");
            result.put("result", truncate(taskResult, 1000));
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Execution failed: " + e.getMessage());
        }

        return result;
    }

    // Helper methods

    private ScheduledTaskType parseTaskType(String type) {
        if (type == null) return ScheduledTaskType.PROMPT;
        return switch (type.toLowerCase()) {
            case "skill" -> ScheduledTaskType.SKILL;
            case "command", "cmd", "shell" -> ScheduledTaskType.COMMAND;
            default -> ScheduledTaskType.PROMPT;
        };
    }

    private NotificationTarget parseNotify(String notify) {
        if (notify == null) return NotificationTarget.LOG;
        return switch (notify.toLowerCase()) {
            case "slack" -> NotificationTarget.SLACK;
            case "email" -> NotificationTarget.EMAIL;
            case "none" -> NotificationTarget.NONE;
            default -> NotificationTarget.LOG;
        };
    }

    private int parseDayOfWeek(String day) {
        if (day == null) return 1;
        return switch (day.toLowerCase()) {
            case "monday", "mon" -> 1;
            case "tuesday", "tue", "tues" -> 2;
            case "wednesday", "wed" -> 3;
            case "thursday", "thu", "thurs" -> 4;
            case "friday", "fri" -> 5;
            case "saturday", "sat" -> 6;
            case "sunday", "sun" -> 7;
            default -> 1;
        };
    }

    private String formatSchedule(ScheduledTask task) {
        return switch (task.getScheduleType()) {
            case DAILY -> "Daily at " + task.getTimeOfDay();
            case WEEKLY -> dayName(task.getDayOfWeek()) + " at " + task.getTimeOfDay();
            case INTERVAL -> "Every " + task.getIntervalMinutes() + " min";
            case CRON -> task.getCronExpression();
        };
    }

    private String dayName(Integer day) {
        if (day == null) return "?";
        return switch (day) {
            case 1 -> "Mon";
            case 2 -> "Tue";
            case 3 -> "Wed";
            case 4 -> "Thu";
            case 5 -> "Fri";
            case 6 -> "Sat";
            case 7 -> "Sun";
            default -> "Day " + day;
        };
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max) + "..." : s;
    }
}
