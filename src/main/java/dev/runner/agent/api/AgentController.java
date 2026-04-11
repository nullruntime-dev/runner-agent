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

import com.google.adk.events.Event;
import dev.runner.agent.adk.AgentService;
import dev.runner.agent.domain.ChatSession;
import dev.runner.agent.dto.ChatRequest;
import dev.runner.agent.dto.ChatResponse;
import dev.runner.agent.dto.ChatSessionDto;
import dev.runner.agent.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@RestController
@RequestMapping("/agent")
@RequiredArgsConstructor
@Validated
@ConditionalOnBean(AgentService.class)
public class AgentController {

    private final AgentService agentService;
    private final ChatService chatService;
    private final ExecutorService executorService = Executors.newCachedThreadPool();

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody @Validated ChatRequest request) {
        log.info("POST /agent/chat sessionId={}", request.getSessionId());

        AgentService.ChatResult result = agentService.chat(request.getSessionId(), request.getMessage());

        ChatResponse response = new ChatResponse(result.sessionId(), result.response());
        return ResponseEntity.ok(response);
    }

    @GetMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(
            @RequestParam(required = false) String sessionId,
            @RequestParam String message
    ) {
        log.info("GET /agent/chat/stream sessionId={}", sessionId);

        String actualSessionId = agentService.getSessionId(sessionId);
        SseEmitter emitter = new SseEmitter(300000L); // 5 minute timeout

        executorService.submit(() -> {
            try {
                agentService.chatStream(actualSessionId, message)
                        .blockingForEach(event -> {
                            try {
                                sendEvent(emitter, event, actualSessionId);
                            } catch (IOException e) {
                                log.warn("Failed to send SSE event: {}", e.getMessage());
                            }
                        });

                emitter.complete();
            } catch (Exception e) {
                log.error("Error in chat stream: {}", e.getMessage(), e);
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    @DeleteMapping("/session/{sessionId}")
    public ResponseEntity<Void> clearSession(@PathVariable String sessionId) {
        log.info("DELETE /agent/session/{}", sessionId);
        agentService.clearSession(sessionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<ChatSessionDto>> listSessions(
            @RequestParam(defaultValue = "50") int limit
    ) {
        log.info("GET /agent/sessions limit={}", limit);
        List<ChatSession> sessions = chatService.listSessions(limit);
        List<ChatSessionDto> dtos = sessions.stream()
                .map(session -> ChatSessionDto.fromWithMessageCount(session, chatService.getMessageCount(session.getId())))
                .toList();
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<ChatSessionDto> getSession(@PathVariable String sessionId) {
        log.info("GET /agent/sessions/{}", sessionId);
        return chatService.getSessionWithMessages(sessionId)
                .map(session -> ResponseEntity.ok(ChatSessionDto.fromWithMessages(session)))
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Map<String, Object>> archiveSession(@PathVariable String sessionId) {
        log.info("DELETE /agent/sessions/{}", sessionId);
        chatService.archiveSession(sessionId);
        return ResponseEntity.ok(Map.of("success", true, "sessionId", sessionId));
    }

    private void sendEvent(SseEmitter emitter, Event event, String sessionId) throws IOException {
        String content = event.stringifyContent();

        // Log event details for debugging
        log.debug("SSE event sessionId={} finalResponse={} contentLength={}",
                sessionId,
                event.finalResponse(),
                content != null ? content.length() : 0);

        // Send events that have content
        // We send all content, not just finalResponse, to enable proper streaming
        if (content != null && !content.isBlank()) {
            // Transform content - extract function names or filter internal data
            String transformedContent = transformContent(content);
            if (transformedContent == null) {
                log.debug("Filtering internal ADK event");
                return;
            }

            SseEmitter.SseEventBuilder builder = SseEmitter.event()
                    .name("message")
                    .data(transformedContent);

            emitter.send(builder);
        }
    }

    /**
     * Transforms content - extracts function names from raw ADK data and formats them cleanly
     * Returns null if content should be completely filtered out
     */
    private String transformContent(String content) {
        if (content == null || content.isBlank()) {
            return null;
        }

        // Extract function name from FunctionCall patterns and return clean format
        if (content.contains("FunctionCall{") && content.contains("name=Optional[")) {
            String functionName = extractFunctionName(content);
            if (functionName != null) {
                return "[[FUNCTION_CALL:" + functionName + "]]";
            }
            return null;
        }

        // Extract function name from FunctionResponse patterns
        if (content.contains("FunctionResponse{") && content.contains("name=Optional[")) {
            String functionName = extractFunctionName(content);
            if (functionName != null) {
                return "[[FUNCTION_RESPONSE:" + functionName + "]]";
            }
            return null;
        }

        // Filter other internal ADK patterns completely
        if (content.contains("ToolCall{") ||
            content.contains("ToolResponse{") ||
            content.contains("ToolResult{")) {
            return null;
        }

        // Filter JSON-formatted tool calls
        if (content.startsWith("{") && (content.contains("\"function_call\"") || content.contains("\"tool_calls\""))) {
            return null;
        }

        // Filter lines that start with "Function Call:" or "Function Response:"
        if (content.startsWith("Function Call:") || content.startsWith("Function Response:")) {
            return null;
        }

        // Filter content with ADK internal IDs
        if (content.contains("id=Optional[adk-")) {
            return null;
        }

        return content;
    }

    /**
     * Extracts function name from ADK toString() output
     * Example: "FunctionCall{id=Optional[...], name=Optional[send_slack_message], args=...}"
     */
    private String extractFunctionName(String content) {
        try {
            int nameStart = content.indexOf("name=Optional[");
            if (nameStart == -1) return null;

            nameStart += "name=Optional[".length();
            int nameEnd = content.indexOf("]", nameStart);
            if (nameEnd == -1) return null;

            return content.substring(nameStart, nameEnd);
        } catch (Exception e) {
            log.debug("Failed to extract function name from: {}", content);
            return null;
        }
    }
}
