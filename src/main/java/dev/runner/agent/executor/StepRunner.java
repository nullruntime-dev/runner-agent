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
  package dev.runner.agent.executor;

  import dev.runner.agent.domain.ExecutionStatus;
  import dev.runner.agent.domain.LogLine;
  import dev.runner.agent.domain.LogLineRepository;
  import dev.runner.agent.domain.StepResult;
  import dev.runner.agent.dto.StepDto;
  import dev.runner.agent.streaming.SseStreamManager;
  import lombok.RequiredArgsConstructor;
  import lombok.extern.slf4j.Slf4j;
  import org.springframework.stereotype.Component;

  import java.io.BufferedReader;
  import java.io.File;
  import java.io.InputStreamReader;
  import java.time.Instant;
  import java.util.List;
  import java.util.Map;
  import java.util.concurrent.TimeUnit;

  @Slf4j
  @Component
  @RequiredArgsConstructor
  public class StepRunner {

      private final SseStreamManager sseStreamManager;
      private final LogLineRepository logLineRepository;

      public StepResult run(String executionId, StepDto step, int stepIndex,
                            Map<String, String> env, String shell, String workingDir,
                            ProcessHolder processHolder) {
          StepResult result = StepResult.builder()
                  .stepIndex(stepIndex)
                  .name(step.getName())
                  .run(step.getRun())
                  .continueOnError(step.isContinueOnError())
                  .status(ExecutionStatus.RUNNING)
                  .startedAt(Instant.now())
                  .build();

          StringBuilder output = new StringBuilder();

          try {
              ProcessBuilder processBuilder = new ProcessBuilder(List.of(shell, "-c", step.getRun()));
              processBuilder.environment().putAll(env);
              processBuilder.directory(new File(workingDir));
              processBuilder.redirectErrorStream(true);

              log.info("Starting step name={} executionId={}", step.getName(), executionId);

              Process process = processBuilder.start();
              processHolder.setProcess(process);

              try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                  String line;
                  while ((line = reader.readLine()) != null) {
                      output.append(line).append("\n");

                      LogLine logLine = LogLine.builder()
                              .executionId(executionId)
                              .stepName(step.getName())
                              .line(line)
                              .stream("stdout")
                              .createdAt(Instant.now())
                              .build();

                      logLineRepository.save(logLine);
                      sseStreamManager.publish(executionId, logLine);
                  }
              }

              boolean finished = process.waitFor(step.getTimeout(), TimeUnit.SECONDS);

              if (!finished) {
                  process.destroyForcibly();
                  result.setStatus(ExecutionStatus.FAILED);
                  result.setError("Step timed out after " + step.getTimeout() + " seconds");
                  result.setExitCode(-1);
                  log.warn("Step timed out name={} executionId={}", step.getName(), executionId);
              } else {
                  int exitCode = process.exitValue();
                  result.setExitCode(exitCode);
                  result.setStatus(exitCode == 0 ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED);
                  log.info("Step completed name={} exitCode={} executionId={}", step.getName(), exitCode, executionId);
              }

          } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
              result.setStatus(ExecutionStatus.CANCELLED);
              result.setError("Step was interrupted");
              log.info("Step interrupted name={} executionId={}", step.getName(), executionId);
          } catch (Exception e) {
              result.setStatus(ExecutionStatus.FAILED);
              result.setError(e.getMessage());
              log.error("Step failed name={} executionId={}: {}", step.getName(), executionId, e.getMessage(), e);
          }

          result.setOutput(output.toString());
          result.setCompletedAt(Instant.now());
          return result;
      }

      public static class ProcessHolder {
          private volatile Process process;

          public void setProcess(Process process) {
              this.process = process;
          }

          public Process getProcess() {
              return process;
          }
      }
  }
