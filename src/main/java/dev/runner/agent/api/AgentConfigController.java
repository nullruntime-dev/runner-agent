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

import dev.runner.agent.domain.AgentConfig;
import dev.runner.agent.domain.AgentConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/agents")
@RequiredArgsConstructor
public class AgentConfigController {

    private final AgentConfigRepository repo;

    @GetMapping
    public ResponseEntity<List<AgentConfig>> list() {
        return ResponseEntity.ok(repo.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AgentConfig> get(@PathVariable String id) {
        return repo.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        String url = body.get("url");
        String token = body.get("token");
        if (name == null || name.isBlank() || url == null || url.isBlank() || token == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields: name, url, token"));
        }
        AgentConfig agent = AgentConfig.builder()
                .id(UUID.randomUUID().toString())
                .name(name)
                .url(url)
                .token(token)
                .build();
        repo.save(agent);
        log.info("POST /api/agents id={} name={}", agent.getId(), agent.getName());
        return ResponseEntity.ok(agent);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, String> body) {
        return repo.findById(id).map(agent -> {
            if (body.containsKey("name")) agent.setName(body.get("name"));
            if (body.containsKey("url")) agent.setUrl(body.get("url"));
            if (body.containsKey("token")) agent.setToken(body.get("token"));
            repo.save(agent);
            return ResponseEntity.ok(agent);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        if (!repo.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        repo.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
