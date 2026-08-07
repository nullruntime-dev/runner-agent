package com.cli.executor.services;

/**
 * Outcome of running a single command for the outbound daemon. Unlike
 * {@code runSync}, this never throws — a non-zero exit or a timeout is
 * reported via the fields so the daemon can post a result back to
 * runner-agent regardless of how the command ended.
 *
 * <p>Sentinels: {@code exitCode = -1} means the command never completed
 * (timeout or failed to launch); {@code stderr} then carries the reason.
 */
public record ExecOutcome(int exitCode, String stdout, String stderr) {
}