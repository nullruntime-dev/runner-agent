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
import dev.runner.agent.service.RemoteExecutorService;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * UI-facing endpoints for managing remote executors. Gated by ApiKeyFilter
 * (AGENT_TOKEN, auto-injected by the UI's proxyToAgent). The per-executor
 * token is returned ONLY on create — copy it immediately, it is not retrievable
 * later (delete + recreate if lost).
 */
@Slf4j
@RestController
@RequestMapping("/executors")
@RequiredArgsConstructor
@Validated
public class ExecutorsController {

    private final RemoteExecutorService remoteExecutorService;

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<Map<String, Object>>> list() {
        log.info("GET /executors");
        List<Map<String, Object>> body = remoteExecutorService.list().stream()
                .map(ExecutorsController::view)
                .toList();
        return ResponseEntity.ok(body);
    }

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> create(@RequestBody CreateRequest request) {
        log.info("POST /executors name={}", request.name());
        try {
            RemoteExecutor e = remoteExecutorService.create(request.name());
            // Token shown once here only.
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "id", e.getId(),
                    "name", e.getName(),
                    "token", e.getToken(),
                    "status", e.getStatus().name()
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", ex.getMessage()
            ));
        }
    }

    @DeleteMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> delete(@PathVariable Long id) {
        log.info("DELETE /executors/{}", id);
        remoteExecutorService.delete(id);
        return ResponseEntity.ok(Map.of("success", true, "id", id));
    }

    /** Public view of an executor — never exposes the token. */
    private static Map<String, Object> view(RemoteExecutor e) {
        return Map.of(
                "id", e.getId(),
                "name", e.getName(),
                "status", e.getStatus().name(),
                "lastSeenAt", e.getLastSeenAt() == null ? "" : e.getLastSeenAt().toString(),
                "createdAt", e.getCreatedAt() == null ? Instant.EPOCH.toString() : e.getCreatedAt().toString()
        );
    }

    public record CreateRequest(@NotBlank String name) {}
}