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

import dev.runner.agent.domain.RemoteExecutor;
import dev.runner.agent.domain.RemoteExecutorRepository;
import dev.runner.agent.domain.RemoteExecutorStatus;
import dev.runner.agent.exception.ExecutorAuthException;
import dev.runner.agent.exception.ExecutorNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.async.DeferredResult;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Coordinates remote executors: daemons deployed on remote servers that call
 * runner-agent over outbound HTTP to register and long-poll for work.
 *
 * <p>In-memory state (per runner-agent JVM — single-instance requirement, see
 * docs/remote-executor-protocol.md):
 * <ul>
 *   <li>{@code backlogs} — per-executor queue of undelivered commands.</li>
 *   <li>{@code pollers} — at most one waiting long-poll per executor.</li>
 *   <li>{@code inflight} — workId → CompletableFuture, completed by /results.</li>
 *   <li>{@code locks} — per-executor lock serializing poll+enqueue (delivery race fix).</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RemoteExecutorService {

    private final RemoteExecutorRepository remoteExecutorRepository;

    private final Map<Long, LinkedBlockingQueue<RemoteCommand>> backlogs = new ConcurrentHashMap<>();
    private final Map<Long, DeferredResult<Map<String, Object>>> pollers = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<RemoteResult>> inflight = new ConcurrentHashMap<>();
    private final Map<Long, ReentrantLock> locks = new ConcurrentHashMap<>();

    /** Long-poll wait before returning an empty {@code {"commands":[]}}. */
    private static final long POLL_TIMEOUT_MS = 30_000L;
    /** Mark OFFLINE if no poll/register in this window. */
    private static final Duration STALE_AFTER = Duration.ofSeconds(90);
    /** Default per-command timeout if the caller doesn't specify one. */
    private static final int DEFAULT_TIMEOUT_SEC = 60;

    // ----- UI-facing -----

    public List<RemoteExecutor> list() {
        return remoteExecutorRepository.findAll();
    }

    /** Create a new executor. The token is returned once; persist it on the daemon. */
    public RemoteExecutor create(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        String trimmed = name.trim();
        if (remoteExecutorRepository.existsByName(trimmed)) {
            throw new IllegalArgumentException("executor name already exists: " + trimmed);
        }
        RemoteExecutor saved = remoteExecutorRepository.save(
                RemoteExecutor.builder()
                        .name(trimmed)
                        .token(newToken())
                        .status(RemoteExecutorStatus.OFFLINE)
                        .build());
        log.info("Created executor id={} name={}", saved.getId(), saved.getName());
        return saved;
    }

    public void delete(Long id) {
        RemoteExecutor e = remoteExecutorRepository.findById(id)
                .orElseThrow(() -> new ExecutorNotFoundException("executor not found: " + id));
        remoteExecutorRepository.deleteById(id);
        // Clean up in-memory state; fail anything still waiting.
        ReentrantLock lock = locks.remove(id);
        if (lock != null) {
            lock.lock();
            try {
                pollers.remove(id);
                LinkedBlockingQueue<RemoteCommand> q = backlogs.remove(id);
                if (q != null) {
                    RemoteCommand c;
                    while ((c = q.poll()) != null) {
                        CompletableFuture<RemoteResult> f = inflight.remove(c.workId());
                        if (f != null) f.complete(RemoteResult.failure(c.workId(), "executor deleted"));
                    }
                }
            } finally {
                lock.unlock();
            }
        }
        log.info("Deleted executor id={} name={}", id, e.getName());
    }

    public Optional<RemoteExecutor> findByName(String name) {
        if (name == null || name.isBlank()) return Optional.empty();
        return remoteExecutorRepository.findByName(name.trim());
    }

    // ----- Daemon-facing -----

    /** Daemon calls this once on startup. Validates the token and marks the executor ONLINE. */
    public RemoteExecutor register(Long id, String token) {
        RemoteExecutor e = authenticate(id, token);
        e.setStatus(RemoteExecutorStatus.ONLINE);
        e.setLastSeenAt(Instant.now());
        RemoteExecutor saved = remoteExecutorRepository.save(e);
        log.info("Executor registered id={} name={} status=ONLINE", id, saved.getName());
        return saved;
    }

    /** Daemon long-polls here. Returns immediately if a command is queued, else holds up to 30s. */
    public DeferredResult<Map<String, Object>> pollWork(Long id, String token) {
        authenticate(id, token);
        touchLastSeen(id);

        DeferredResult<Map<String, Object>> deferred = new DeferredResult<>(POLL_TIMEOUT_MS);
        deferred.onTimeout(() -> {
            pollers.remove(id, deferred);
            if (!deferred.isSetOrExpired()) {
                deferred.setResult(Map.of("commands", List.of()));
            }
        });

        ReentrantLock lock = lockFor(id);
        lock.lock();
        try {
            // Kick any stale poller (protocol says one stream per executor).
            DeferredResult<Map<String, Object>> stale = pollers.get(id);
            if (stale != null && stale != deferred && !stale.isSetOrExpired()) {
                pollers.remove(id, stale);
                stale.setResult(Map.of("commands", List.of()));
            }

            LinkedBlockingQueue<RemoteCommand> q = backlogs.get(id);
            RemoteCommand head = (q == null) ? null : q.poll();
            if (head != null) {
                deferred.setResult(Map.of("commands", List.of(head)));
                return deferred;
            }

            pollers.put(id, deferred);
            // Re-drain under lock to close the enqueue race.
            RemoteCommand raced = (backlogs.get(id) == null) ? null : backlogs.get(id).poll();
            if (raced != null) {
                if (pollers.remove(id, deferred)) {
                    deferred.setResult(Map.of("commands", List.of(raced)));
                } else {
                    // Timeout already took the poller; re-queue so the next poll gets it.
                    backlogs.computeIfAbsent(id, k -> new LinkedBlockingQueue<>()).offer(raced);
                }
            }
        } finally {
            lock.unlock();
        }
        return deferred;
    }

    /** Daemon posts the result of a command it ran. Completes the waiting future. */
    public void submitResult(Long id, String token, String workId, int exitCode, String stdout, String stderr) {
        authenticate(id, token);
        CompletableFuture<RemoteResult> fut = inflight.remove(workId);
        if (fut == null) {
            log.warn("Result for unknown/late workId={} executor={}", workId, id);
            return;
        }
        fut.complete(RemoteResult.success(workId, exitCode, stdout, stderr));
        log.info("Result received executor={} workId={} exitCode={}", id, workId, exitCode);
    }

    // ----- ADK-facing -----

    /**
     * Execute a shell command on a named executor. Blocks the calling (ADK
     * inference) thread until the daemon posts a result or the timeout elapses.
     */
    public RemoteResult execute(Long executorId, String command, int timeoutSec) {
        RemoteExecutor e = remoteExecutorRepository.findById(executorId)
                .orElseThrow(() -> new ExecutorNotFoundException("executor not found: " + executorId));
        if (e.getStatus() != RemoteExecutorStatus.ONLINE) {
            return RemoteResult.failure(null, "executor offline");
        }
        if (command == null || command.isBlank()) {
            return RemoteResult.failure(null, "command is required");
        }
        int effectiveTimeout = timeoutSec > 0 ? timeoutSec : DEFAULT_TIMEOUT_SEC;

        String workId = UUID.randomUUID().toString();
        CompletableFuture<RemoteResult> fut = new CompletableFuture<>();
        inflight.put(workId, fut);
        RemoteCommand cmd = new RemoteCommand(workId, command, effectiveTimeout);

        ReentrantLock lock = lockFor(executorId);
        lock.lock();
        try {
            DeferredResult<Map<String, Object>> poller = pollers.remove(executorId);
            if (poller != null && poller.setResult(Map.of("commands", List.of(cmd)))) {
                // Delivered to the waiting daemon poll.
            } else {
                // No poller waiting (or it had already timed out) — queue for the next poll.
                backlogs.computeIfAbsent(executorId, k -> new LinkedBlockingQueue<>()).offer(cmd);
            }
        } finally {
            lock.unlock();
        }

        try {
            return fut.get(effectiveTimeout, TimeUnit.SECONDS);
        } catch (TimeoutException te) {
            inflight.remove(workId);
            return RemoteResult.failure(workId, "timeout after " + effectiveTimeout + "s");
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            inflight.remove(workId);
            return RemoteResult.failure(workId, "interrupted");
        } catch (ExecutionException ee) {
            return RemoteResult.failure(workId, "remote failed: " + ee.getCause().getMessage());
        }
    }

    // ----- Maintenance -----

    /** Mark executors OFFLINE if they haven't polled/registered in STALE_AFTER. */
    @Scheduled(fixedDelay = 30_000L)
    public void markStaleOffline() {
        Instant cutoff = Instant.now().minus(STALE_AFTER);
        List<RemoteExecutor> stale = remoteExecutorRepository.findByStatus(RemoteExecutorStatus.ONLINE).stream()
                .filter(e -> e.getLastSeenAt() == null || e.getLastSeenAt().isBefore(cutoff))
                .toList();
        for (RemoteExecutor e : stale) {
            e.setStatus(RemoteExecutorStatus.OFFLINE);
            remoteExecutorRepository.save(e);
            log.info("Executor marked offline (stale) id={} name={} lastSeenAt={}",
                    e.getId(), e.getName(), e.getLastSeenAt());
        }
    }

    // ----- Helpers -----

    private RemoteExecutor authenticate(Long id, String token) {
        if (token == null || token.isBlank()) {
            throw new ExecutorAuthException("missing executor token");
        }
        RemoteExecutor e = remoteExecutorRepository.findById(id)
                .orElseThrow(() -> new ExecutorNotFoundException("executor not found: " + id));
        if (!token.equals(e.getToken())) {
            throw new ExecutorAuthException("invalid executor token for id " + id);
        }
        return e;
    }

    private void touchLastSeen(Long id) {
        remoteExecutorRepository.findById(id).ifPresent(e -> {
            e.setLastSeenAt(Instant.now());
            if (e.getStatus() != RemoteExecutorStatus.ONLINE) {
                e.setStatus(RemoteExecutorStatus.ONLINE);
            }
            remoteExecutorRepository.save(e);
        });
    }

    private ReentrantLock lockFor(Long id) {
        return locks.computeIfAbsent(id, k -> new ReentrantLock());
    }

    private static String newToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}