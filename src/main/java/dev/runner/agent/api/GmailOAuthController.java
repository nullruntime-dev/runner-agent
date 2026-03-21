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
package dev.runner.agent.api;

import dev.runner.agent.domain.GmailToken;
import dev.runner.agent.service.GmailApiService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/agent/gmail")
@RequiredArgsConstructor
public class GmailOAuthController {

    private final GmailApiService gmailApiService;

    @GetMapping("/auth/url")
    public ResponseEntity<Map<String, Object>> getAuthUrl(HttpServletRequest request) {
        log.info("GET /agent/gmail/auth/url");

        if (!gmailApiService.isConfigured()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Gmail API not configured. Please configure clientId and clientSecret first."
            ));
        }

        String redirectUri = buildRedirectUri(request);
        String authUrl = gmailApiService.generateAuthUrl(redirectUri);

        return ResponseEntity.ok(Map.of(
                "authUrl", authUrl,
                "redirectUri", redirectUri,
                "message", "Visit the authUrl to authorize Gmail access"
        ));
    }

    @GetMapping("/auth/callback")
    public ResponseEntity<Map<String, Object>> handleCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String error,
            HttpServletRequest request
    ) {
        log.info("GET /agent/gmail/auth/callback code={} error={}", code != null ? "[present]" : "[missing]", error);

        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "OAuth authorization denied: " + error
            ));
        }

        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "No authorization code provided"
            ));
        }

        try {
            String redirectUri = buildRedirectUri(request);
            GmailToken token = gmailApiService.exchangeCodeForTokens(code, redirectUri);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "email", token.getEmail(),
                    "message", "Gmail authorization successful! You can now use Gmail API features."
            ));
        } catch (IOException e) {
            log.error("Failed to exchange OAuth code", e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", "Failed to exchange authorization code: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        log.info("GET /agent/gmail/status");

        boolean configured = gmailApiService.isConfigured();
        boolean authorized = gmailApiService.isAuthorized();
        String email = gmailApiService.getAuthorizedEmail();

        return ResponseEntity.ok(Map.of(
                "configured", configured,
                "authorized", authorized,
                "email", email != null ? email : "",
                "ready", configured && authorized
        ));
    }

    @DeleteMapping("/auth")
    public ResponseEntity<Map<String, Object>> revokeAuth() {
        log.info("DELETE /agent/gmail/auth");

        gmailApiService.revokeAuthorization();

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Gmail authorization revoked"
        ));
    }

    private String buildRedirectUri(HttpServletRequest request) {
        String scheme = request.getScheme();
        String serverName = request.getServerName();
        int serverPort = request.getServerPort();

        StringBuilder uri = new StringBuilder();
        uri.append(scheme).append("://").append(serverName);

        if (("http".equals(scheme) && serverPort != 80) ||
                ("https".equals(scheme) && serverPort != 443)) {
            uri.append(":").append(serverPort);
        }

        uri.append("/agent/gmail/auth/callback");
        return uri.toString();
    }
}
