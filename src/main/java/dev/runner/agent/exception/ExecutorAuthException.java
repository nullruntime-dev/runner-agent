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
package dev.runner.agent.exception;

/**
 * Thrown when a /daemon/* request fails executor-token verification
 * (missing/invalid Bearer, or token does not match the executor id).
 * Mapped to HTTP 401 by GlobalExceptionHandler.
 */
public class ExecutorAuthException extends RuntimeException {

    public ExecutorAuthException(String message) {
        super(message);
    }
}