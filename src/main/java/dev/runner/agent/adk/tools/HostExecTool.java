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
import dev.runner.agent.service.HostExecService;
import dev.runner.agent.service.HostExecService.ExecResult;
import dev.runner.agent.service.HostExecService.HostConfig;
import dev.runner.agent.service.SkillService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ADK tool: lets the agent run shell commands on configured remote hosts over SSH.
 * Hosts are declared in the host-exec skill config — this tool refuses anything
 * not in that allowlist.
 *
 * Auth: SSH key auth. Verify by setting up known_hosts first.
 */
@Slf4j
@Component
public class HostExecTool {

    private static final int MAX_OUTPUT_CHARS = 8000;

    private final HostExecService hostExecService;
    private final SkillService skillService;

    public HostExecTool(HostExecService hostExecService, SkillService skillService) {
        this.hostExecService = hostExecService;
        this.skillService = skillService;
        log.info("HostExecTool initialized");
    }

    private boolean isConfigured() {
        return skillService.getSkillConfig("host-exec").isPresent();
    }

    @Schema(name = "execute_on_host",
            description = "Execute a shell command on a configured remote host over SSH. The host must be in the agent's allowlist (configured by the admin). Returns stdout, stderr, and exit code. Use this to manage docker-compose, run operator scripts, or query system state on a remote machine — exactly as if you were logged into it. CAREFUL: this runs with the SSH key's privileges. Avoid destructive commands without confirmation.")
    public Map<String, Object> execute(
            @Schema(name = "host_name", description = "Name of a configured host (use list_hosts to see what's available).") String hostName,
            @Schema(name = "command", description = "Shell command to run. Single-line is preferred; multi-line scripts should be passed via a heredoc or invoked from a file already on the host.") String command
    ) {
        log.info("ADK tool: execute_on_host host={} cmd_len={}", hostName, command == null ? 0 : command.length());

        Map<String, Object> result = new HashMap<>();
        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "host-exec skill not configured. Ask the user to configure it from the Skills UI.");
            return result;
        }
        if (!hostExecService.isEnabled()) {
            result.put("success", false);
            result.put("error", "host-exec skill is disabled in the config.");
            return result;
        }
        if (hostName == null || hostName.isBlank()) {
            result.put("success", false);
            result.put("error", "host_name is required");
            return result;
        }
        if (command == null || command.isBlank()) {
            result.put("success", false);
            result.put("error", "command is required");
            return result;
        }

        // Defense-in-depth: refuse unknown hosts even if HostExecService has stale state.
        List<HostConfig> known = hostExecService.listHosts();
        boolean found = known.stream().anyMatch(h -> h.name().equals(hostName));
        if (!found) {
            result.put("success", false);
            result.put("error", "Host not in allowlist: " + hostName + ". Use list_hosts to see configured hosts.");
            return result;
        }

        try {
            ExecResult er = hostExecService.execute(hostName, command);
            String stdout = er.stdout() == null ? "" : er.stdout();
            String stderr = er.stderr() == null ? "" : er.stderr();
            boolean truncated = stdout.length() > MAX_OUTPUT_CHARS;
            if (truncated) stdout = stdout.substring(0, MAX_OUTPUT_CHARS) + "\n... [truncated]";
            result.put("success", er.exitCode() == 0);
            result.put("exit_code", er.exitCode());
            result.put("stdout", stdout);
            result.put("stderr", stderr.length() > MAX_OUTPUT_CHARS
                    ? stderr.substring(0, MAX_OUTPUT_CHARS) + "\n... [truncated]"
                    : stderr);
            result.put("host", hostName);
            return result;
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "host-exec failed: " + e.getMessage());
            log.error("host-exec failed host={} cmd_len={}", hostName, command.length(), e);
            return result;
        }
    }

    @Schema(name = "list_hosts",
            description = "List the SSH hosts the agent has been configured to manage. Use this to discover host names for execute_on_host.")
    public Map<String, Object> listHosts() {
        Map<String, Object> result = new HashMap<>();
        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "host-exec skill not configured.");
            return result;
        }
        result.put("success", true);
        result.put("enabled", hostExecService.isEnabled());
        List<Map<String, Object>> hosts = hostExecService.listHosts().stream()
                .map(h -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("name", h.name());
                    m.put("host", h.host());
                    m.put("user", h.user());
                    m.put("port", h.port());
                    return m;
                })
                .toList();
        result.put("hosts", hosts);
        return result;
    }
}
