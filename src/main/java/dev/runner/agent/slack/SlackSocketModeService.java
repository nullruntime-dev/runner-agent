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
  package dev.runner.agent.slack;

  import com.slack.api.bolt.App;
  import com.slack.api.bolt.AppConfig;
  import com.slack.api.bolt.socket_mode.SocketModeApp;
  import com.slack.api.model.event.AppMentionEvent;
  import com.slack.api.model.event.MessageEvent;
  import com.slack.api.socket_mode.SocketModeClient;
  import dev.runner.agent.adk.AgentService;
  import dev.runner.agent.service.SkillService;
  import jakarta.annotation.PostConstruct;
  import jakarta.annotation.PreDestroy;
  import lombok.RequiredArgsConstructor;
  import lombok.extern.slf4j.Slf4j;
  import org.springframework.stereotype.Service;

  import java.util.Map;
  import java.util.Optional;
  import java.util.concurrent.Executors;
  import java.util.concurrent.ScheduledExecutorService;
  import java.util.concurrent.TimeUnit;

  @Slf4j
  @Service
  @RequiredArgsConstructor
  public class SlackSocketModeService {

      private final SkillService skillService;
      private final AgentService agentService;

      private SocketModeApp socketModeApp;
      private App boltApp;
      private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
      private volatile boolean running = false;

      @PostConstruct
      public void init() {
          // Check config periodically and start/stop socket mode as needed
          scheduler.scheduleWithFixedDelay(this::checkAndManageConnection, 5, 30, TimeUnit.SECONDS);
          log.info("Slack Socket Mode service initialized - will connect when configured");
      }

      @PreDestroy
      public void shutdown() {
          scheduler.shutdown();
          stopSocketMode();
      }

      private void checkAndManageConnection() {
          try {
              Optional<Map<String, String>> configOpt = skillService.getSkillConfig("slack");

              if (configOpt.isEmpty()) {
                  if (running) {
                      log.info("Slack config removed, stopping Socket Mode");
                      stopSocketMode();
                  }
                  return;
              }

              Map<String, String> config = configOpt.get();
              String appToken = config.get("appToken");
              String botToken = config.get("botToken");

              if (appToken == null || appToken.isBlank() || botToken == null || botToken.isBlank()) {
                  if (running) {
                      log.info("Slack tokens removed, stopping Socket Mode");
                      stopSocketMode();
                  }
                  return;
              }

              // Get configured slash command (default to "runner-agent" if not set)
              String slashCommand = config.get("slashCommand");
              if (slashCommand == null || slashCommand.isBlank()) {
                  slashCommand = "runner-agent";
              }
              // Ensure it starts with /
              if (!slashCommand.startsWith("/")) {
                  slashCommand = "/" + slashCommand;
              }

              if (!running) {
                  startSocketMode(appToken, botToken, slashCommand);
              }
          } catch (Exception e) {
              log.error("Error checking Slack configuration", e);
          }
      }

      private synchronized void startSocketMode(String appToken, String botToken, String slashCommand) {
          if (running) return;

          try {
              log.info("Starting Slack Socket Mode with command: {}", slashCommand);

              AppConfig appConfig = AppConfig.builder().singleTeamBotToken(botToken).build();

              boltApp = new App(appConfig);

              // Register slash command handler with configured command name
              final String commandName = slashCommand;
              boltApp.command(slashCommand, (req, ctx) -> {
                  String text = req.getPayload().getText();
                  String userId = req.getPayload().getUserId();
                  String userName = req.getPayload().getUserName();
                  String channelId = req.getPayload().getChannelId();

                  log.info("Received {} command: '{}' from user={} channel={}", commandName, text, userName, channelId);

                  // Process async and respond via response_url
                  processCommandAsync(text, channelId, userId, userName, ctx.getResponseUrl());

                  // Acknowledge immediately with a processing message
                  return ctx.ack(":hourglass_flowing_sand: Processing your request...");
              });

              // Register app mention handler
              boltApp.event(AppMentionEvent.class, (req, ctx) -> {
                  AppMentionEvent event = req.getEvent();
                  String text = event.getText().replaceAll("<@[A-Z0-9]+>", "").trim();
                  String channel = event.getChannel();
                  String user = event.getUser();

                  log.info("Received @mention: '{}' in channel={}", text, channel);

                  processAndReply(text, channel, user);

                  return ctx.ack();
              });

              // Register direct message handler
              boltApp.event(MessageEvent.class, (req, ctx) -> {
                  MessageEvent event = req.getEvent();

                  // Only handle DMs (channel starts with D) and ignore bot messages
                  if (event.getChannelType() != null && event.getChannelType().equals("im") && event.getBotId() == null) {
                      String text = event.getText();
                      String channel = event.getChannel();
                      String user = event.getUser();

                      log.info("Received DM: '{}' from user={}", text, user);

                      processAndReply(text, channel, user);
                  }

                  return ctx.ack();
              });

              log.info("Creating Socket Mode app with appToken={}..., botToken={}...", appToken.substring(0, Math.min(15, appToken.length())), botToken.substring(0, Math.min(15, botToken.length())));

              log.info("Step 1: Creating SocketModeApp with JavaWebSocket backend...");
              socketModeApp = new SocketModeApp(appToken, SocketModeClient.Backend.JavaWebSocket, boltApp);
              log.info("Step 2: SocketModeApp created, calling startAsync...");

              socketModeApp.startAsync();
              log.info("Step 3: startAsync called");

              // Give it a moment to connect
              Thread.sleep(3000);
              log.info("Step 4: Wait complete");

              running = true;
              log.info("Slack Socket Mode started successfully! Listening for command: {}", slashCommand);

          } catch (Exception e) {
              log.error("Failed to start Slack Socket Mode at some step: {}", e.getMessage());
              log.error("Exception class: {}", e.getClass().getName());
              e.printStackTrace();
              running = false;
          } catch (Throwable t) {
              log.error("Throwable caught: {}", t.getMessage());
              t.printStackTrace();
              running = false;
          }
      }

      private synchronized void stopSocketMode() {
          if (!running) return;

          try {
              log.info("Stopping Slack Socket Mode...");

              if (socketModeApp != null) {
                  socketModeApp.stop();
                  socketModeApp = null;
              }
              if (boltApp != null) {
                  boltApp.stop();
                  boltApp = null;
              }

              running = false;
              log.info("Slack Socket Mode stopped");

          } catch (Exception e) {
              log.error("Error stopping Slack Socket Mode", e);
          }
      }

      private void processCommandAsync(String text, String channelId, String userId, String userName, String responseUrl) {
          log.info("Processing command async: text='{}', channel={}, user={}, responseUrl={}", text, channelId, userName, responseUrl != null ? "present" : "NULL");

          Thread.startVirtualThread(() -> {
              try {
                  String sessionId = "slack-" + channelId;
                  log.info("Calling agent.chat for sessionId={}", sessionId);

                  AgentService.ChatResult result = agentService.chat(sessionId, text);
                  log.info("Agent returned response: length={}", result.response().length());

                  // Send response via response_url
                  sendResponseUrl(responseUrl, result.response(), userName);

              } catch (Exception e) {
                  log.error("Error processing Slack command: {}", e.getMessage(), e);
                  try {
                      sendResponseUrl(responseUrl, ":x: Error: " + e.getMessage(), userName);
                  } catch (Exception ex) {
                      log.error("Failed to send error response: {}", ex.getMessage(), ex);
                  }
              }
          });
      }

      private void processAndReply(String text, String channel, String user) {
          Thread.startVirtualThread(() -> {
              try {
                  String sessionId = "slack-" + channel;
                  AgentService.ChatResult result = agentService.chat(sessionId, text);

                  // Send response via chat.postMessage
                  sendMessage(channel, result.response());

              } catch (Exception e) {
                  log.error("Error processing Slack message", e);
                  sendMessage(channel, ":x: Error: " + e.getMessage());
              }
          });
      }

      private void sendResponseUrl(String responseUrl, String message, String userName) {
          try {
              log.info("Sending response to Slack: responseUrl={}, messageLength={}, user={}", responseUrl != null ? responseUrl.substring(0, Math.min(50, responseUrl.length())) + "..." : "null", message != null ? message.length() : 0, userName);

              if (responseUrl == null || responseUrl.isBlank()) {
                  log.error("Response URL is null or blank!");
                  return;
              }

              var httpClient = java.net.http.HttpClient.newHttpClient();

              // Simpler payload without blocks for reliability
              String payload = String.format("""
                      {
                          "response_type": "in_channel",
                          "text": %s
                      }
                      """, toJson(message));

              log.debug("Slack payload: {}", payload);

              var request = java.net.http.HttpRequest.newBuilder().uri(java.net.URI.create(responseUrl)).header("Content-Type", "application/json").POST(java.net.http.HttpRequest.BodyPublishers.ofString(payload)).build();

              var response = httpClient.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
              log.info("Slack response_url response: status={}, body={}", response.statusCode(), response.body());

          } catch (Exception e) {
              log.error("Failed to send response to Slack: {}", e.getMessage(), e);
          }
      }

      private void sendMessage(String channel, String message) {
          try {
              Optional<Map<String, String>> configOpt = skillService.getSkillConfig("slack");
              if (configOpt.isEmpty()) return;

              String botToken = configOpt.get().get("botToken");
              if (botToken == null || botToken.isBlank()) return;

              var httpClient = java.net.http.HttpClient.newHttpClient();
              String payload = String.format("""
                      {
                          "channel": %s,
                          "text": %s,
                          "mrkdwn": true
                      }
                      """, toJson(channel), toJson(message));

              var request = java.net.http.HttpRequest.newBuilder().uri(java.net.URI.create("https://slack.com/api/chat.postMessage")).header("Content-Type", "application/json").header("Authorization", "Bearer " + botToken).POST(java.net.http.HttpRequest.BodyPublishers.ofString(payload)).build();

              var response = httpClient.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
              log.debug("Slack chat.postMessage response: {}", response.body());

          } catch (Exception e) {
              log.error("Failed to send message to Slack", e);
          }
      }

      private String toJson(String value) {
          if (value == null) return "null";
          return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "\"";
      }

      public boolean isConnected() {
          return running;
      }
  }
