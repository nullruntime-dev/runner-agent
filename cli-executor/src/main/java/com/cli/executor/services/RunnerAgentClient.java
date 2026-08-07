package com.cli.executor.services;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import java.time.Duration;
import java.util.List;

/**
 * Outbound daemon: registers with runner-agent and long-polls
 * {@code /daemon/{id}/work} for shell commands, running each via
 * {@link ExecutorService#runRemote} and posting the result back to
 * {@code /daemon/{id}/results}.
 *
 * <p>Opt-in via {@link RunnerProperties}: if {@code runner.executor-id} or
 * {@code runner.executor-token} is blank, the daemon thread is NOT started
 * and the inbound {@code POST /executor/run} endpoint continues to work
 * exactly as before. When both are set, a single daemon thread runs the
 * register → poll loop, with exponential backoff (2s → 60s) on any error.
 *
 * <p>Auth: every call carries {@code Authorization: Bearer <executor-token>}.
 * The read timeout is 35s so the server's 30s long-poll completes normally.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RunnerAgentClient {

    private final RunnerProperties runnerProperties;
    private final ExecutorService executorService;

    private volatile boolean running = true;
    private Thread pollThread;
    private RestClient restClient;
    private long executorId;

    @PostConstruct
    public void start() {
        if (!configured()) {
            log.info("Runner-agent daemon mode disabled (runner.executor-id / runner.executor-token not set). "
                    + "Inbound POST /executor/run still works.");
            return;
        }
        try {
            executorId = Long.parseLong(runnerProperties.getExecutorId().trim());
        } catch (NumberFormatException e) {
            log.error("runner.executor-id is not a number: '{}'. Daemon disabled.", runnerProperties.getExecutorId());
            return;
        }

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(10).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(35).toMillis());

        restClient = RestClient.builder()
                .baseUrl(runnerProperties.getUrl())
                .defaultHeader("Authorization", "Bearer " + runnerProperties.getExecutorToken())
                .requestFactory(factory)
                .build();

        pollThread = new Thread(this::loop, "runner-agent-poll");
        pollThread.setDaemon(true);
        pollThread.start();
        log.info("Runner-agent daemon client started: url={} executorId={}",
                runnerProperties.getUrl(), executorId);
    }

    @PreDestroy
    public void stop() {
        running = false;
        if (pollThread != null) {
            pollThread.interrupt();
        }
    }

    private boolean configured() {
        return runnerProperties.getExecutorId() != null && !runnerProperties.getExecutorId().isBlank()
                && runnerProperties.getExecutorToken() != null && !runnerProperties.getExecutorToken().isBlank();
    }

    private void loop() {
        long backoffMs = 2_000;
        while (running && !Thread.currentThread().isInterrupted()) {
            try {
                register();
                backoffMs = 2_000; // reset after a successful register
                pollLoop();
            } catch (Exception e) {
                if (!running) return; // shutdown race — don't log/backoff
                log.warn("Runner-agent loop error (backoff {}ms): {}", backoffMs, e.getMessage());
                sleep(backoffMs);
                backoffMs = Math.min(backoffMs * 2, 60_000);
            }
        }
    }

    private void register() {
        restClient.post()
                .uri("/daemon/{id}/register", executorId)
                .retrieve()
                .toBodilessEntity();
        log.info("Registered with runner-agent as executor id={}", executorId);
    }

    private void pollLoop() {
        while (running) {
            WorkResponse resp = restClient.get()
                    .uri("/daemon/{id}/work", executorId)
                    .retrieve()
                    .body(WorkResponse.class);
            if (resp == null || resp.commands() == null || resp.commands().isEmpty()) {
                continue; // empty (server held ~30s) → poll again immediately
            }
            for (Command cmd : resp.commands()) {
                runAndPost(cmd);
            }
        }
    }

    private void runAndPost(Command cmd) {
        ExecOutcome o;
        try {
            o = executorService.runRemote(cmd.command(), cmd.timeoutSec());
        } catch (Exception e) {
            log.error("Failed to run workId={}: {}", cmd.workId(), e.getMessage());
            o = new ExecOutcome(-1, "", "daemon run error: " + e.getMessage());
        }
        try {
            restClient.post()
                    .uri("/daemon/{id}/results", executorId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new ResultRequest(cmd.workId(), o.exitCode(), o.stdout(), o.stderr()))
                    .retrieve()
                    .toBodilessEntity();
            log.info("Posted result workId={} exitCode={}", cmd.workId(), o.exitCode());
        } catch (Exception e) {
            log.error("Failed to post result for workId={}: {}", cmd.workId(), e.getMessage());
        }
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    // ----- wire DTOs (match docs/remote-executor-protocol.md field names) -----

    public record WorkResponse(List<Command> commands) {}
    public record Command(String workId, String command, int timeoutSec) {}
    public record ResultRequest(String workId, int exitCode, String stdout, String stderr) {}
}