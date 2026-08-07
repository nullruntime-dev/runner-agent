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
import dev.runner.agent.domain.RemoteExecutor;
import dev.runner.agent.service.RemoteExecutorService;
import dev.runner.agent.service.RemoteResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * ADK tool that lets the agent run a shell command on a named remote executor
 * (a daemon-registered machine). Discovery via list_executors; execution via
 * execute_on_executor. Mirrors HostExecTool's output shape and truncation.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RemoteExecTool {

    private static final int MAX_OUTPUT_CHARS = 8000;

    private final RemoteExecutorService remoteExecutorService;

    @Schema(name = "execute_on_executor",
            description = "Execute a shell command on a named remote executor (a daemon-registered machine). The executor must be online (use list_executors to check). Returns stdout, stderr, and exit code. CAREFUL: this runs with the daemon's privileges on the remote machine.")
    public Map<String, Object> executeOnExecutor(
            @Schema(name = "executor_name", description = "Name of the remote executor (use list_executors to discover).") String executorName,
            @Schema(name = "command", description = "Shell command to run on the remote executor.") String command,
            @Schema(name = "timeout_sec", description = "Max seconds to wait for the result. Default 60.", optional = true) Integer timeoutSec
    ) {
        log.info("ADK tool: execute_on_executor executor={} cmd_len={} timeout={}",
                executorName, command == null ? 0 : command.length(), timeoutSec);

        Map<String, Object> result = new HashMap<>();
        if (executorName == null || executorName.isBlank()) {
            result.put("success", false);
            result.put("error", "executor_name is required");
            return result;
        }
        if (command == null || command.isBlank()) {
            result.put("success", false);
            result.put("error", "command is required");
            return result;
        }

        Optional<RemoteExecutor> opt = remoteExecutorService.findByName(executorName);
        if (opt.isEmpty()) {
            result.put("success", false);
            result.put("error", "executor not found: " + executorName + ". Use list_executors to see configured executors.");
            return result;
        }
        RemoteExecutor e = opt.get();
        int timeout = timeoutSec == null ? 0 : timeoutSec;

        try {
            RemoteResult rr = remoteExecutorService.execute(e.getId(), command, timeout);
            if (rr.failed()) {
                result.put("success", false);
                result.put("error", rr.error());
                result.put("executor", executorName);
                return result;
            }
            String stdout = rr.stdout() == null ? "" : rr.stdout();
            String stderr = rr.stderr() == null ? "" : rr.stderr();
            if (stdout.length() > MAX_OUTPUT_CHARS) {
                stdout = stdout.substring(0, MAX_OUTPUT_CHARS) + "\n... [truncated]";
            }
            if (stderr.length() > MAX_OUTPUT_CHARS) {
                stderr = stderr.substring(0, MAX_OUTPUT_CHARS) + "\n... [truncated]";
            }
            result.put("success", rr.exitCode() == 0);
            result.put("exit_code", rr.exitCode());
            result.put("stdout", stdout);
            result.put("stderr", stderr);
            result.put("executor", executorName);
            return result;
        } catch (Exception ex) {
            result.put("success", false);
            result.put("error", "remote exec failed: " + ex.getMessage());
            result.put("executor", executorName);
            log.error("remote exec failed executor={}", executorName, ex);
            return result;
        }
    }

    @Schema(name = "list_executors",
            description = "List all configured remote executors and their online/offline status. Use this to discover executor names for execute_on_executor.")
    public Map<String, Object> listExecutors() {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> executors = remoteExecutorService.list().stream()
                .map(e -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", e.getId());
                    m.put("name", e.getName());
                    m.put("status", e.getStatus().name());
                    m.put("lastSeenAt", e.getLastSeenAt() == null ? "" : e.getLastSeenAt().toString());
                    return m;
                })
                .toList();
        result.put("success", true);
        result.put("executors", executors);
        result.put("count", executors.size());
        return result;
    }
}