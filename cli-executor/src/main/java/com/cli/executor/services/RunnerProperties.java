package com.cli.executor.services;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Outbound-mode config for talking to runner-agent's remote-executor protocol.
 *
 * <p>When both {@code executor-id} and {@code executor-token} are set, the
 * {@link RunnerAgentClient} starts a daemon thread that registers with
 * runner-agent and long-polls {@code /daemon/{id}/work}. When either is blank,
 * outbound mode is disabled and the inbound {@code POST /executor/run}
 * endpoint continues to work exactly as before.
 *
 * <p>{@code executorId} is a String so an unset {@code EXECUTOR_ID} env var
 * (resolving to "") binds cleanly instead of failing Long coercion; it is
 * parsed to a Long in {@link RunnerAgentClient}.
 */
@Component
@ConfigurationProperties(prefix = "runner")
@Getter
@Setter
public class RunnerProperties {
    private String url;
    private String executorId;
    private String executorToken;
}