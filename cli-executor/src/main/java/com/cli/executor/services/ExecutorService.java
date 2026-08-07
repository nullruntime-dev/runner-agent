package com.cli.executor.services;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ExecutorService {

    private final Token token;

    /**
     * Matches unreplaced placeholder strings commonly sent by API clients
     * or Swagger UI, e.g. "<INPUT>", "<COMMAND>", "<ARG1>", "<string>".
     */
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("^<.+>$");

    public String runSync(List<String> commands, String requestToken) {

        // ─── Token validation ───────────────────────────────────────
        String serviceToken = token.getToken();
        if (serviceToken == null || serviceToken.isBlank()) {
            throw new IllegalStateException(
                    "Service token not configured (token.token property missing)");
        }
        if (requestToken == null || requestToken.isBlank()
                || !serviceToken.equals(requestToken)) {
            throw new IllegalArgumentException("Invalid token");
        }

        // ─── Input validation ───────────────────────────────────────
        if (commands == null || commands.isEmpty()) {
            throw new IllegalArgumentException(
                    "Commands list cannot be null or empty");
        }

        String cmd = commands.get(0);
        if (cmd == null || cmd.isBlank()) {
            throw new IllegalArgumentException(
                    "Command (first element) cannot be null or blank");
        }

        // Reject unreplaced placeholder values (e.g. "<INPUT>") before
        // they reach the shell and produce a cryptic syntax error.
        if (PLACEHOLDER_PATTERN.matcher(cmd.trim()).matches()) {
            throw new IllegalArgumentException(
                    "Command appears to be an unreplaced placeholder: '"
                            + cmd + "'. Provide an actual shell command to execute.");
        }

        // Remaining elements are positional args exposed as "$@" ($1, $2, ...).
        List<String> args = commands.size() > 1
                ? commands.subList(1, commands.size())
                : List.of();

        // Validate each argument — reject nulls and placeholders.
        for (int i = 0; i < args.size(); i++) {
            String arg = args.get(i);
            if (arg == null) {
                throw new IllegalArgumentException(
                        "Argument at position " + (i + 1) + " is null");
            }
            if (PLACEHOLDER_PATTERN.matcher(arg.trim()).matches()) {
                throw new IllegalArgumentException(
                        "Argument at position " + (i + 1)
                                + " appears to be an unreplaced placeholder: '"
                                + arg + "'. Provide an actual value.");
            }
        }

        // ─── Process execution ──────────────────────────────────────
        StringBuilder output = new StringBuilder();
        try {
            List<String> pbCmd = new ArrayList<>(2 + args.size());
            pbCmd.add("/bin/sh");
            pbCmd.add("-c");
            // When args are present, append " \"$@\"" so the positional
            // parameters are available inside the shell command string.
            pbCmd.add(args.isEmpty() ? cmd : cmd + " \"$@\"");
            pbCmd.add("sh");    // $0
            pbCmd.addAll(args); // $1, $2, ...

            ProcessBuilder processBuilder = new ProcessBuilder(pbCmd);
            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(
                            process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }

            int exitCode = process.waitFor();
            if (exitCode != 0) {
                throw new RuntimeException(
                        "Process execution failed with exit code " + exitCode
                                + "\n--- command output ---\n" + output);
            }
            return output.toString().trim();

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * Run a single command for the outbound runner-agent daemon. Unlike
     * {@link #runSync}, this:
     * <ul>
     *   <li>does NOT check the service token — the command came from
     *       runner-agent, already authed via the per-executor token;</li>
     *   <li>captures stdout and stderr separately (not merged);</li>
     *   <li>enforces a timeout via {@code destroyForcibly} so a hung command
     *       can't block the poll loop;</li>
     *   <li>never throws — exit code / timeout / launch failure are all
     *       reported via {@link ExecOutcome} so the daemon can post a result
     *       back for every command it receives.</li>
     * </ul>
     *
     * @param command   single shell command string (no positional args; the
     *                  runner-agent protocol sends one string, not a list)
     * @param timeoutSec per-command timeout; {@code <= 0} means 60s
     */
    public ExecOutcome runRemote(String command, int timeoutSec) {
        if (command == null || command.isBlank()) {
            return new ExecOutcome(2, "", "empty command");
        }
        int timeout = timeoutSec > 0 ? timeoutSec : 60;

        try {
            ProcessBuilder pb = new ProcessBuilder("/bin/sh", "-c", command);
            // Streams NOT merged — drain each on its own thread to avoid the
            // classic deadlock where a full pipe buffer blocks the process.
            Process process = pb.start();

            StringBuilder out = new StringBuilder();
            StringBuilder err = new StringBuilder();
            Thread tOut = drainAsync(process.getInputStream(), out);
            Thread tErr = drainAsync(process.getErrorStream(), err);

            boolean finished = process.waitFor(timeout, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                tOut.interrupt();
                tErr.interrupt();
                return new ExecOutcome(-1, out.toString(), "timeout after " + timeout + "s");
            }
            tOut.join(1_000);
            tErr.join(1_000);
            return new ExecOutcome(process.exitValue(), out.toString(), err.toString());
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            return new ExecOutcome(-1, "", "interrupted");
        } catch (Exception e) {
            return new ExecOutcome(-1, "", "failed to run: " + e.getMessage());
        }
    }

    private Thread drainAsync(InputStream is, StringBuilder sb) {
        Thread t = new Thread(() -> {
            try (BufferedReader r = new BufferedReader(
                    new InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) {
                    sb.append(line).append("\n");
                }
            } catch (IOException ignored) {
                // stream closed by process exit or destroyForcibly — expected
            }
        }, "cmd-drain");
        t.setDaemon(true);
        t.start();
        return t;
    }
}