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

import dev.runner.agent.domain.RemoteExecutor;
import dev.runner.agent.exception.ExecutorAuthException;
import dev.runner.agent.service.RemoteExecutorService;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.async.DeferredResult;

import java.util.Map;

/**
 * Daemon-facing endpoints. Exempt from ApiKeyFilter (see filter skip list) —
 * every call authenticates with the per-executor token as a Bearer header,
 * verified via {@link RemoteExecutorService}.
 */
@Slf4j
@RestController
@RequestMapping("/daemon")
@RequiredArgsConstructor
@Validated
public class DaemonController {

    private static final long POLL_INTERVAL_MS = 30_000L;

    private final RemoteExecutorService remoteExecutorService;

    @PostMapping(value = "/{id}/register", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> register(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        String token = bearer(auth);
        log.info("POST /daemon/{}/register", id);
        RemoteExecutor e = remoteExecutorService.register(id, token);
        return ResponseEntity.ok(Map.of(
                "id", e.getId(),
                "name", e.getName(),
                "status", e.getStatus().name(),
                "pollIntervalMs", POLL_INTERVAL_MS
        ));
    }

    @GetMapping(value = "/{id}/work", produces = MediaType.APPLICATION_JSON_VALUE)
    public DeferredResult<Map<String, Object>> work(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        String token = bearer(auth);
        log.info("GET /daemon/{}/work", id);
        return remoteExecutorService.pollWork(id, token);
    }

    @PostMapping(value = "/{id}/results", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> results(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestBody ResultRequest request) {
        String token = bearer(auth);
        log.info("POST /daemon/{}/results workId={} exitCode={}", id, request.workId(), request.exitCode());
        remoteExecutorService.submitResult(id, token, request.workId(), request.exitCode(), request.stdout(), request.stderr());
        return ResponseEntity.ok(Map.of("success", true));
    }

    private static String bearer(String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) {
            throw new ExecutorAuthException("missing Bearer token");
        }
        String t = auth.substring(7).trim();
        if (t.isEmpty()) {
            throw new ExecutorAuthException("empty Bearer token");
        }
        return t;
    }

    public record ResultRequest(@NotBlank String workId, int exitCode, String stdout, String stderr) {}
}