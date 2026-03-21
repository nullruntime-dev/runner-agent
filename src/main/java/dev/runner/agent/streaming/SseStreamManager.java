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
  package dev.runner.agent.streaming;

  import com.fasterxml.jackson.databind.ObjectMapper;
  import dev.runner.agent.domain.LogLine;
  import dev.runner.agent.domain.LogLineRepository;
  import lombok.RequiredArgsConstructor;
  import lombok.extern.slf4j.Slf4j;
  import org.springframework.stereotype.Component;
  import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

  import java.io.IOException;
  import java.util.List;
  import java.util.concurrent.ConcurrentHashMap;
  import java.util.concurrent.CopyOnWriteArrayList;

  @Slf4j
  @Component
  @RequiredArgsConstructor
  public class SseStreamManager {

      private final ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> subscribers = new ConcurrentHashMap<>();
      private final LogLineRepository logLineRepository;
      private final ObjectMapper objectMapper;

      public SseEmitter subscribe(String executionId, long timeoutMs) {
          SseEmitter emitter = new SseEmitter(timeoutMs);

          subscribers.computeIfAbsent(executionId, k -> new CopyOnWriteArrayList<>()).add(emitter);

          emitter.onCompletion(() -> removeEmitter(executionId, emitter));
          emitter.onError(e -> {
              log.debug("SSE error for execution={}: {}", executionId, e.getMessage());
              removeEmitter(executionId, emitter);
          });
          emitter.onTimeout(() -> {
              log.debug("SSE timeout for execution={}", executionId);
              removeEmitter(executionId, emitter);
          });

          return emitter;
      }

      public void replayAndSubscribe(String executionId, SseEmitter emitter, boolean isComplete) {
          List<LogLine> existingLogs = logLineRepository.findByExecutionIdOrderByCreatedAtAsc(executionId);

          try {
              for (LogLine logLine : existingLogs) {
                  emitter.send(SseEmitter.event().name("log").data(objectMapper.writeValueAsString(logLine)));
              }

              if (isComplete) {
                  emitter.complete();
              }
          } catch (IOException e) {
              log.warn("Failed to replay logs for execution={}: {}", executionId, e.getMessage());
              emitter.completeWithError(e);
          }
      }

      public void publish(String executionId, LogLine logLine) {
          CopyOnWriteArrayList<SseEmitter> emitters = subscribers.get(executionId);
          if (emitters == null || emitters.isEmpty()) {
              return;
          }

          String data;
          try {
              data = objectMapper.writeValueAsString(logLine);
          } catch (IOException e) {
              log.error("Failed to serialize log line executionId={}: {}", executionId, e.getMessage());
              return;
          }

          for (SseEmitter emitter : emitters) {
              try {
                  emitter.send(SseEmitter.event().name("log").data(data));
              } catch (IOException e) {
                  log.debug("Failed to send to emitter executionId={}: {}", executionId, e.getMessage());
                  removeEmitter(executionId, emitter);
              }
          }
      }

      public void complete(String executionId) {
          CopyOnWriteArrayList<SseEmitter> emitters = subscribers.remove(executionId);
          if (emitters == null) {
              return;
          }

          for (SseEmitter emitter : emitters) {
              try {
                  emitter.complete();
              } catch (Exception e) {
                  log.debug("Error completing emitter executionId={}: {}", executionId, e.getMessage());
              }
          }
      }

      private void removeEmitter(String executionId, SseEmitter emitter) {
          CopyOnWriteArrayList<SseEmitter> emitters = subscribers.get(executionId);
          if (emitters != null) {
              emitters.remove(emitter);
              if (emitters.isEmpty()) {
                  subscribers.remove(executionId);
              }
          }
      }
  }
