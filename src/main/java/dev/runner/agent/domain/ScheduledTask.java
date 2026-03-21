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
package dev.runner.agent.domain;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Entity
@Table(name = "scheduled_tasks")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduledTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 500)
    private String description;

    /**
     * What type of scheduled task:
     * - PROMPT: Send a prompt to the AI agent
     * - SKILL: Execute a specific skill
     * - COMMAND: Run a shell command
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ScheduledTaskType type;

    /**
     * The prompt to send to AI, skill name to execute, or command to run
     */
    @Column(nullable = false, length = 2000)
    private String action;

    /**
     * Optional parameters as JSON
     */
    @Column(length = 2000)
    private String parametersJson;

    /**
     * Schedule type: CRON, INTERVAL, DAILY, WEEKLY
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ScheduleType scheduleType;

    /**
     * Cron expression (if scheduleType is CRON)
     * e.g., "0 9 * * *" for daily at 9am
     */
    @Column
    private String cronExpression;

    /**
     * Interval in minutes (if scheduleType is INTERVAL)
     */
    @Column
    private Integer intervalMinutes;

    /**
     * Time of day for DAILY/WEEKLY schedules (e.g., "09:00")
     */
    @Column
    private String timeOfDay;

    /**
     * Day of week for WEEKLY schedules (1=Monday, 7=Sunday)
     */
    @Column
    private Integer dayOfWeek;

    /**
     * Where to send results: SLACK, EMAIL, LOG, NONE
     */
    @Enumerated(EnumType.STRING)
    @Column
    private NotificationTarget notificationTarget;

    /**
     * Additional notification config (channel name, email address, etc.)
     */
    @Column
    private String notificationConfig;

    @Column(nullable = false)
    private boolean enabled;

    @Column
    private LocalDateTime lastRunAt;

    @Column
    private LocalDateTime nextRunAt;

    @Column
    private String lastRunStatus;

    @Column(length = 2000)
    private String lastRunResult;

    @Column
    private Integer runCount;

    @Column
    private Integer failureCount;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (runCount == null) runCount = 0;
        if (failureCount == null) failureCount = 0;
        if (enabled) {
            calculateNextRun();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void calculateNextRun() {
        LocalDateTime now = LocalDateTime.now();

        switch (scheduleType) {
            case INTERVAL:
                if (intervalMinutes != null && intervalMinutes > 0) {
                    nextRunAt = (lastRunAt != null ? lastRunAt : now).plusMinutes(intervalMinutes);
                    if (nextRunAt.isBefore(now)) {
                        nextRunAt = now.plusMinutes(intervalMinutes);
                    }
                }
                break;

            case DAILY:
                if (timeOfDay != null) {
                    String[] parts = timeOfDay.split(":");
                    int hour = Integer.parseInt(parts[0]);
                    int minute = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
                    nextRunAt = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0);
                    if (nextRunAt.isBefore(now) || nextRunAt.isEqual(now)) {
                        nextRunAt = nextRunAt.plusDays(1);
                    }
                }
                break;

            case WEEKLY:
                if (timeOfDay != null && dayOfWeek != null) {
                    String[] parts = timeOfDay.split(":");
                    int hour = Integer.parseInt(parts[0]);
                    int minute = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;

                    nextRunAt = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0);
                    int currentDay = now.getDayOfWeek().getValue();
                    int daysUntil = dayOfWeek - currentDay;
                    if (daysUntil < 0 || (daysUntil == 0 && nextRunAt.isBefore(now))) {
                        daysUntil += 7;
                    }
                    nextRunAt = nextRunAt.plusDays(daysUntil);
                }
                break;

            case CRON:
                // For cron, we'll calculate in the service using a cron parser
                break;
        }
    }

    public enum ScheduledTaskType {
        PROMPT,   // Send prompt to AI
        SKILL,    // Execute a skill
        COMMAND   // Run shell command
    }

    public enum ScheduleType {
        CRON,
        INTERVAL,
        DAILY,
        WEEKLY
    }

    public enum NotificationTarget {
        SLACK,
        EMAIL,
        LOG,
        NONE
    }
}
