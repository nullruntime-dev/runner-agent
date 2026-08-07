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
import lombok.*;

import java.time.Instant;

/**
 * A named remote executor: a daemon deployed on a remote server that calls
 * runner-agent over outbound HTTP to register and long-poll for work.
 * The token is shown once on create; the daemon must keep it and send it
 * as a Bearer header on every /daemon/{id}/* call.
 */
@Entity
@Table(name = "remote_executors")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RemoteExecutor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    /** Per-executor secret; verified in DaemonController. Plaintext (matches Agent.token posture). */
    @Column(nullable = false, unique = true)
    private String token;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private RemoteExecutorStatus status = RemoteExecutorStatus.OFFLINE;

    /** Refreshed on every /register and /work call. */
    private Instant lastSeenAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}