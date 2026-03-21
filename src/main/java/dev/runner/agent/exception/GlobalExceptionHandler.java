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

  import lombok.extern.slf4j.Slf4j;
  import org.springframework.http.HttpStatus;
  import org.springframework.http.ResponseEntity;
  import org.springframework.validation.FieldError;
  import org.springframework.web.bind.MethodArgumentNotValidException;
  import org.springframework.web.bind.annotation.ExceptionHandler;
  import org.springframework.web.bind.annotation.RestControllerAdvice;

  import java.util.Map;
  import java.util.stream.Collectors;

  @Slf4j
  @RestControllerAdvice
  public class GlobalExceptionHandler {

      @ExceptionHandler(ExecutionNotFoundException.class)
      public ResponseEntity<Map<String, String>> handleExecutionNotFound(ExecutionNotFoundException ex) {
          log.warn("Execution not found: {}", ex.getMessage());
          return ResponseEntity.status(HttpStatus.NOT_FOUND)
                  .body(Map.of("error", ex.getMessage()));
      }

      @ExceptionHandler(AgentException.class)
      public ResponseEntity<Map<String, String>> handleAgentException(AgentException ex) {
          log.error("Agent error: {}", ex.getMessage(), ex);
          return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                  .body(Map.of("error", ex.getMessage()));
      }

      @ExceptionHandler(MethodArgumentNotValidException.class)
      public ResponseEntity<Map<String, Object>> handleValidationErrors(MethodArgumentNotValidException ex) {
          Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                  .collect(Collectors.toMap(
                          FieldError::getField,
                          fieldError -> fieldError.getDefaultMessage() != null
                                  ? fieldError.getDefaultMessage()
                                  : "Invalid value",
                          (existing, replacement) -> existing
                  ));
          log.warn("Validation errors: {}", errors);
          return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                  .body(Map.of("error", "Validation failed", "details", errors));
      }

      @ExceptionHandler(IllegalStateException.class)
      public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException ex) {
          log.warn("Illegal state: {}", ex.getMessage());
          return ResponseEntity.status(HttpStatus.CONFLICT)
                  .body(Map.of("error", ex.getMessage()));
      }

      @ExceptionHandler(GmailApiException.class)
      public ResponseEntity<Map<String, String>> handleGmailApiException(GmailApiException ex) {
          log.warn("Gmail API error: {} type={}", ex.getMessage(), ex.getErrorType());
          HttpStatus status = switch (ex.getErrorType()) {
              case NOT_CONFIGURED, REAUTH_REQUIRED -> HttpStatus.UNAUTHORIZED;
              case RATE_LIMITED -> HttpStatus.TOO_MANY_REQUESTS;
              case NOT_FOUND -> HttpStatus.NOT_FOUND;
              case PERMISSION_DENIED -> HttpStatus.FORBIDDEN;
              case API_ERROR -> HttpStatus.BAD_GATEWAY;
          };
          return ResponseEntity.status(status)
                  .body(Map.of("error", ex.getMessage(), "errorType", ex.getErrorType().name()));
      }

      @ExceptionHandler(Exception.class)
      public ResponseEntity<Map<String, String>> handleGenericException(Exception ex) {
          log.error("Unexpected error: {}", ex.getMessage(), ex);
          return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                  .body(Map.of("error", "Internal server error"));
      }
  }
