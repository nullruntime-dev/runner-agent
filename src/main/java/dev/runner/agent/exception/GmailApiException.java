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

import lombok.Getter;

@Getter
public class GmailApiException extends RuntimeException {

    private final ErrorType errorType;

    public enum ErrorType {
        NOT_CONFIGURED,
        REAUTH_REQUIRED,
        RATE_LIMITED,
        NOT_FOUND,
        PERMISSION_DENIED,
        API_ERROR
    }

    public GmailApiException(ErrorType errorType, String message) {
        super(message);
        this.errorType = errorType;
    }

    public GmailApiException(ErrorType errorType, String message, Throwable cause) {
        super(message, cause);
        this.errorType = errorType;
    }

    public static GmailApiException notConfigured() {
        return new GmailApiException(ErrorType.NOT_CONFIGURED,
                "Gmail API is not configured. Please complete OAuth setup at /agent/gmail/auth/url");
    }

    public static GmailApiException reauthRequired() {
        return new GmailApiException(ErrorType.REAUTH_REQUIRED,
                "Gmail authorization expired. Please re-authorize at /agent/gmail/auth/url");
    }

    public static GmailApiException rateLimited() {
        return new GmailApiException(ErrorType.RATE_LIMITED,
                "Gmail API rate limit exceeded. Please try again later.");
    }

    public static GmailApiException notFound(String resource) {
        return new GmailApiException(ErrorType.NOT_FOUND,
                "Gmail resource not found: " + resource);
    }

    public static GmailApiException permissionDenied() {
        return new GmailApiException(ErrorType.PERMISSION_DENIED,
                "Permission denied. The requested scope may not be authorized.");
    }

    public static GmailApiException apiError(String message, Throwable cause) {
        return new GmailApiException(ErrorType.API_ERROR, "Gmail API error: " + message, cause);
    }
}
