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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import net.schmizz.sshj.SSHClient;
import net.schmizz.sshj.transport.verification.OpenSSHKnownHosts;
import net.schmizz.sshj.userauth.keyprovider.KeyProvider;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Executes shell commands on configured remote hosts over SSH.
 * Hosts are loaded from the {@code host-exec} skill config (JSON list) and
 * reach as far as the host filesystem — useful for managing docker-compose on
 * a host from inside a container, or any "operator" task.
 *
 * Auth: SSH private keys only. No password auth.
 * Verification: uses ~/.ssh/known_hosts when present; falls back to accepting
 * any host key when the file is missing (with a warning).
 */
@Slf4j
@Service
public class HostExecService {

    /** Cached host configs: hostname -> HostConfig. Reloaded via {@link #reload()}. */
    private final ConcurrentHashMap<String, HostConfig> hosts = new ConcurrentHashMap<>();
    private volatile boolean enabled = false;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SkillService skillService;
    private final java.util.concurrent.ScheduledExecutorService scheduler =
            java.util.concurrent.Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "host-exec-reload");
                t.setDaemon(true);
                return t;
            });

    public HostExecService(SkillService skillService) {
        this.skillService = skillService;
    }

    @PostConstruct
    public void init() {
        reload();
        // Hot-reload hosts every 30s so admin edits propagate without restart.
        scheduler.scheduleWithFixedDelay(this::reload, 30, 30, TimeUnit.SECONDS);
    }

    /** Reload host configs and enabled flag from skill_configs table. */
    public synchronized void reload() {
        try {
            Optional<Map<String, String>> cfg = skillService.getSkillConfig("host-exec");
            if (cfg.isEmpty()) {
                enabled = false;
                hosts.clear();
                log.info("host-exec skill not configured; HostExecService disabled");
                return;
            }
            String hostsJson = cfg.get().getOrDefault("hostsJson", "[]");
            String en = cfg.get().getOrDefault("enabled", "true");
            enabled = "true".equalsIgnoreCase(en);
            List<HostConfig> parsed = parseHosts(hostsJson);
            hosts.clear();
            for (HostConfig h : parsed) {
                hosts.put(h.name(), h);
            }
            log.info("HostExecService loaded {} host(s) enabled={}", hosts.size(), enabled);
        } catch (Exception e) {
            log.error("Failed to reload host-exec config: {}", e.getMessage());
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    public List<HostConfig> listHosts() {
        return new ArrayList<>(hosts.values());
    }

    /**
     * Execute {@code command} on the named host.
     *
     * @return {@link ExecResult} with combined stdout, stderr, exit code
     */
    public ExecResult execute(String hostName, String command) throws IOException {
        if (!enabled) {
            throw new IllegalStateException("host-exec skill is not enabled");
        }
        HostConfig host = hosts.get(hostName);
        if (host == null) {
            throw new IllegalArgumentException("Host not configured: " + hostName);
        }
        log.info("host-exec host={} cmd_length={}", hostName, command == null ? 0 : command.length());

        SSHClient client = new SSHClient();
        try {
            int connectTimeoutMs = host.connectTimeoutSeconds() * 1000;
            configureHostKeyVerification(client);
            client.setConnectTimeout(connectTimeoutMs);
            client.setTimeout(host.commandTimeoutSeconds() * 1000);
            // bindAddress=null, connectTimeout=ms — java.net.InetAddress localIp = null
            java.net.InetAddress localIp = null;
            client.connect(host.host(), host.port(), localIp, connectTimeoutMs);
            File keyFile = resolveKeyFile(host.keyPath());
            KeyProvider keys = loadPrivateKey(keyFile);
            client.authPublickey(host.user(), keys);

            int cmdTimeout = host.commandTimeoutSeconds();
            try (net.schmizz.sshj.connection.channel.direct.Session session = client.startSession()) {
                try (net.schmizz.sshj.connection.channel.direct.Session.Command cmd = session.exec(command)) {
                    String stdout = drain(cmd.getInputStream());
                    String stderr = drain(cmd.getErrorStream());
                    cmd.join(cmdTimeout, TimeUnit.SECONDS);
                    Integer exit = cmd.getExitStatus();
                    return new ExecResult(exit == null ? -1 : exit, stdout, stderr);
                }
            }
        } finally {
            try { client.disconnect(); } catch (Exception ignored) {}
        }
    }

    private KeyProvider loadPrivateKey(File keyFile) throws IOException {
        try {
            net.schmizz.sshj.userauth.keyprovider.FileKeyProvider provider;
            String fmt = net.schmizz.sshj.userauth.keyprovider.KeyProviderUtil.detectKeyFileFormat(keyFile).toString();
            if (fmt.contains("PKCS8")) {
                provider = new net.schmizz.sshj.userauth.keyprovider.PKCS8KeyFile();
            } else {
                provider = new net.schmizz.sshj.userauth.keyprovider.OpenSSHKeyFile();
            }
            provider.init(keyFile);
            return provider;
        } catch (Exception e) {
            throw new IOException("Failed to load private key " + keyFile
                    + " — ensure OpenSSH/PKCS8 format and chmod 600: " + e.getMessage(), e);
        }
    }

    private void configureHostKeyVerification(SSHClient client) {
        Path knownHosts = Paths.get(System.getProperty("user.home"), ".ssh", "known_hosts");
        try {
            if (Files.exists(knownHosts)) {
                client.addHostKeyVerifier(new OpenSSHKnownHosts(knownHosts.toFile()));
            } else {
                log.warn("No ~/.ssh/known_hosts found; host-exec will accept any host key. " +
                        "Create the file before relying on this skill in production.");
                client.addHostKeyVerifier(new net.schmizz.sshj.transport.verification.HostKeyVerifier() {
                    @Override
                    public boolean verify(String h, int p, java.security.PublicKey k) { return true; }
                    @Override
                    public java.util.List<String> findExistingAlgorithms(String h, int p) {
                        return java.util.Collections.emptyList();
                    }
                });
            }
        } catch (IOException e) {
            log.warn("Failed to load known_hosts; falling back to trust-all: {}", e.getMessage());
            client.addHostKeyVerifier(new net.schmizz.sshj.transport.verification.HostKeyVerifier() {
                @Override
                public boolean verify(String h, int p, java.security.PublicKey k) { return true; }
                @Override
                public java.util.List<String> findExistingAlgorithms(String h, int p) {
                    return java.util.Collections.emptyList();
                }
            });
        }
    }

    private File resolveKeyFile(String keyPath) throws IOException {
        if (keyPath == null || keyPath.isBlank()) {
            keyPath = "~/.ssh/id_ed25519";
        }
        String resolved = keyPath.startsWith("~/")
                ? System.getProperty("user.home") + keyPath.substring(1)
                : keyPath;
        File f = new File(resolved);
        if (!f.exists()) {
            throw new IOException("Private key not found: " + resolved);
        }
        if (!f.canRead()) {
            throw new IOException("Private key not readable: " + resolved
                    + " (try chmod 600 on Unix)");
        }
        return f;
    }

    private static String drain(java.io.InputStream in) {
        if (in == null) return "";
        byte[] buf = new byte[4096];
        StringBuilder out = new StringBuilder();
        try {
            int n;
            while ((n = in.read(buf)) != -1) {
                out.append(new String(buf, 0, n, java.nio.charset.StandardCharsets.UTF_8));
            }
        } catch (java.io.IOException ignored) {
            // Stream closed early; return what we accumulated.
        }
        return out.toString();
    }

    private List<HostConfig> parseHosts(String json) throws IOException {
        if (json == null || json.isBlank()) return Collections.emptyList();
        return objectMapper.readValue(json, new TypeReference<List<HostConfig>>() {});
    }

    public record HostConfig(
            String name,
            String host,
            int port,
            String user,
            String keyPath,
            int connectTimeoutSeconds,
            int commandTimeoutSeconds
    ) {}

    public record ExecResult(int exitCode, String stdout, String stderr) {}
}
