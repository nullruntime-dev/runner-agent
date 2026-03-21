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
  package dev.runner.agent.filter;

  import dev.runner.agent.config.AgentConfig;
  import jakarta.servlet.FilterChain;
  import jakarta.servlet.ServletException;
  import jakarta.servlet.http.HttpServletRequest;
  import jakarta.servlet.http.HttpServletResponse;
  import lombok.RequiredArgsConstructor;
  import org.springframework.http.MediaType;
  import org.springframework.stereotype.Component;
  import org.springframework.web.filter.OncePerRequestFilter;

  import java.io.IOException;

  @Component
  @RequiredArgsConstructor
  public class ApiKeyFilter extends OncePerRequestFilter {

      private final AgentConfig agentConfig;

      @Override
      protected void doFilterInternal(HttpServletRequest request,
                                      HttpServletResponse response,
                                      FilterChain filterChain) throws ServletException, IOException {
          String path = request.getRequestURI();

          // Skip auth for health, H2 console, and OAuth callbacks
          if (path.equals("/health") || path.startsWith("/h2-console") || path.equals("/agent/gmail/auth/callback")) {
              filterChain.doFilter(request, response);
              return;
          }

          String authHeader = request.getHeader("Authorization");

          if (authHeader == null || !authHeader.startsWith("Bearer ")) {
              sendUnauthorized(response);
              return;
          }

          String token = authHeader.substring(7);
          if (!token.equals(agentConfig.getToken())) {
              sendUnauthorized(response);
              return;
          }

          filterChain.doFilter(request, response);
      }

      private void sendUnauthorized(HttpServletResponse response) throws IOException {
          response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
          response.setContentType(MediaType.APPLICATION_JSON_VALUE);
          response.getWriter().write("{\"error\": \"Unauthorized\"}");
      }
  }
