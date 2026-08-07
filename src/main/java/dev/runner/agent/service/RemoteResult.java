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

/**
 * Result of a remote command. {@link #error} is non-null when the command
 * never ran (executor offline, timeout, interrupted) or the remote failed;
 * in that case {@link #exitCode} is -1 and stdout/stderr are empty. When the
 * command ran, error is null and exitCode is the real process exit code.
 */
public record RemoteResult(String workId, int exitCode, String stdout, String stderr, String error) {

    /** Sentinel exit code for "the command never ran / failed to deliver". */
    public static final int NO_RUN = -1;

    public static RemoteResult success(String workId, int exitCode, String stdout, String stderr) {
        return new RemoteResult(workId, exitCode,
                stdout == null ? "" : stdout,
                stderr == null ? "" : stderr,
                null);
    }

    public static RemoteResult failure(String workId, String error) {
        return new RemoteResult(workId, NO_RUN, "", "", error);
    }

    public boolean failed() {
        return error != null;
    }
}