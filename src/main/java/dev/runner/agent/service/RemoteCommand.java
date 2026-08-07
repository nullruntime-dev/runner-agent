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
 * A command to run on a remote executor. Delivered to the daemon via the
 * long-poll /daemon/{id}/work endpoint; identified by workId so the result
 * can be correlated back to the waiting CompletableFuture.
 */
public record RemoteCommand(String workId, String command, int timeoutSec) {
}