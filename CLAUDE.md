# Deploy Agent — CLAUDE.md

## Project Overview

A lightweight **generic remote command executor** agent written in Java (Spring Boot).
It accepts HTTP requests containing a list of shell commands (steps), executes them
sequentially on the host machine, and streams output back to the caller via SSE.

Designed to be used as a **deployment target** for GitHub Actions self-hosted runners.
The GitHub runner builds and pushes artifacts, then POSTs execution steps to this agent.
The agent runs whatever commands it receives — no project-specific knowledge required.

---

## Architecture

```
GitHub Actions (self-hosted runner, same LAN)
    │
    │  POST /execute  (steps as JSON)
    ▼
Deploy Agent (this project)
    │
    ├── Runs steps via ProcessBuilder sequentially
    ├── Streams stdout/stderr via SSE (SseEmitter)
    ├── Persists execution history in H2 (file mode)
    └── Reports exit code back to caller
```

---

## Tech Stack

- **Language:** Java 21
- **Framework:** Spring Boot 3.3
- **Database:** H2 embedded (file mode — persists between restarts)
- **ORM:** Spring Data JPA + Hibernate
- **Process Execution:** `ProcessBuilder` (stdlib)
- **Log Streaming:** SSE via Spring's `SseEmitter`
- **Build Tool:** Gradle (Kotlin DSL)
- **Auth:** Static API key via `Authorization: Bearer <token>` header

---

## Project Structure

```
agent/
├── src/main/java/io/agent/
│   ├── AgentApplication.java
│   ├── config/
│   │   ├── AgentConfig.java              # @ConfigurationProperties
│   │   ├── AsyncConfig.java              # ThreadPoolTaskExecutor bean
│   │   └── SecurityConfig.java           # Filter registration
│   ├── api/
│   │   ├── ExecuteController.java        # POST /execute
│   │   ├── ExecutionController.java      # GET /execution/{id}, GET /executions
│   │   ├── LogsController.java           # GET /execution/{id}/logs (SSE)
│   │   ├── CancelController.java         # POST /execution/{id}/cancel
│   │   └── HealthController.java         # GET /health
│   ├── executor/
│   │   ├── ExecutorService.java          # Orchestrates step execution (@Async)
│   │   └── StepRunner.java               # Runs a single step via ProcessBuilder
│   ├── streaming/
│   │   └── SseStreamManager.java         # Manages active SseEmitter connections
│   ├── domain/
│   │   ├── Execution.java                # @Entity
│   │   ├── StepResult.java               # @Entity
│   │   ├── LogLine.java                  # @Entity
│   │   ├── ExecutionStatus.java          # Enum
│   │   ├── ExecutionRepository.java      # JpaRepository
│   │   ├── StepResultRepository.java     # JpaRepository
│   │   └── LogLineRepository.java        # JpaRepository
│   ├── dto/
│   │   ├── ExecuteRequest.java
│   │   ├── ExecuteResponse.java
│   │   └── StepDto.java
│   ├── filter/
│   │   └── ApiKeyFilter.java             # Auth — OncePerRequestFilter
│   └── exception/
│       ├── GlobalExceptionHandler.java   # @RestControllerAdvice
│       ├── ExecutionNotFoundException.java
│       └── AgentException.java
├── src/main/resources/
│   └── application.yml
├── src/test/java/io/agent/
│   ├── executor/
│   │   └── ExecutorServiceTest.java
│   └── api/
│       └── ExecuteControllerTest.java
├── build.gradle.kts
├── settings.gradle.kts
└── Dockerfile
```

---

## build.gradle.kts

```kotlin
plugins {
    java
    id("org.springframework.boot") version "3.3.0"
    id("io.spring.dependency-management") version "1.1.5"
}

group = "io.agent"
version = "0.1.0-SNAPSHOT"

java {
    sourceCompatibility = JavaVersion.VERSION_21
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // Embedded database — runs inside the JVM, no separate install needed
    runtimeOnly("com.h2database:h2")

    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
```

---

## application.yml

```yaml
server:
  port: 8090

agent:
  token: ${AGENT_TOKEN}             # required — app refuses to start if not set
  working-dir: /tmp
  default-shell: /bin/sh
  max-concurrent: 5                 # max simultaneous executions

spring:
  datasource:
    url: jdbc:h2:file:./agent-data  # file-based — survives restarts
    driver-class-name: org.h2.Driver
    username: sa
    password: ""
  jpa:
    hibernate:
      ddl-auto: update              # auto-creates/updates tables from @Entity on startup
    show-sql: false
  h2:
    console:
      enabled: true                 # browse data at http://localhost:8090/h2-console
      path: /h2-console
```

---

## Domain Models

### Execution.java
```java
@Entity
@Table(name = "executions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Execution {

    @Id
    private String id;                              // UUID

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExecutionStatus status;

    @Column(columnDefinition = "TEXT")
    private String requestJson;                     // full original request stored as JSON

    private String shell;
    private String workingDir;
    private Integer exitCode;

    @Column(columnDefinition = "TEXT")
    private String error;

    private Instant startedAt;
    private Instant completedAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "execution", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @OrderBy("stepIndex ASC")
    private List<StepResult> steps = new ArrayList<>();
}
```

### StepResult.java
```java
@Entity
@Table(name = "step_results")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class StepResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "execution_id", nullable = false)
    private Execution execution;

    @Column(nullable = false)
    private int stepIndex;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String run;

    @Enumerated(EnumType.STRING)
    private ExecutionStatus status;

    private Integer exitCode;

    @Column(columnDefinition = "TEXT")
    private String output;                          // combined stdout + stderr

    @Column(columnDefinition = "TEXT")
    private String error;

    private boolean continueOnError;
    private Instant startedAt;
    private Instant completedAt;
}
```

### LogLine.java
```java
@Entity
@Table(name = "log_lines")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LogLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "execution_id", nullable = false)
    private String executionId;

    @Column(nullable = false)
    private String stepName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String line;

    @Column(nullable = false)
    private String stream;                          // "stdout" or "stderr"

    @Column(nullable = false)
    private Instant createdAt;
}
```

### ExecutionStatus.java
```java
public enum ExecutionStatus {
    PENDING,
    RUNNING,
    SUCCESS,
    FAILED,
    CANCELLED
}
```

---

## DTOs

### ExecuteRequest.java
```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExecuteRequest {

    private String id;                              // optional — UUID generated if absent

    @NotBlank(message = "name is required")
    private String name;

    @NotEmpty(message = "steps cannot be empty")
    private List<StepDto> steps;

    private Map<String, String> env = new HashMap<>();

    private String workingDir;                      // falls back to agent.working-dir

    private String shell;                           // falls back to agent.default-shell

    private int timeout = 300;                      // total timeout seconds
}
```

### StepDto.java
```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StepDto {

    @NotBlank(message = "step name is required")
    private String name;

    @NotBlank(message = "run command is required")
    private String run;

    private int timeout = 60;                       // per-step timeout seconds

    private boolean continueOnError = false;
}
```

---

## API Endpoints

### POST /execute
Submit a new execution. Starts async immediately. Returns execution ID.

**Request:** `ExecuteRequest`
**Response:** `202 Accepted`
```json
{ "id": "uuid", "status": "PENDING" }
```

---

### GET /execution/{id}
Get full status and step results.

**Response:** `200 OK` — `Execution` with all `StepResult` entries.
**Response:** `404 Not Found` — unknown ID.

---

### GET /execution/{id}/logs
Stream live log lines via **Server-Sent Events**.

- Content-Type: `text/event-stream`
- Each event: JSON `LogLine` object
- Closes automatically when execution reaches terminal state
- If execution already complete: replays stored log lines then closes

---

### GET /executions
List recent executions (summary, no step output).

**Query params:** `?limit=20&status=FAILED`

---

### POST /execution/{id}/cancel
Kill the running execution process.

**Response:** `200 OK`
**Response:** `409 Conflict` — already in terminal state.

---

### GET /health
No auth required.

**Response:**
```json
{ "status": "ok", "version": "0.1.0" }
```

---

## Key Implementation Details

### ExecutorService.java
```
- Annotate class with @Service
- Annotate execute method with @Async("agentExecutor")
- Inject AgentConfig, StepRunner, SseStreamManager, ExecutionRepository, StepResultRepository
- On entry: update Execution status to RUNNING, set startedAt
- Loop through steps: call stepRunner.run(step, env, shell, workingDir)
- After each step: save StepResult to DB
- If step fails and continueOnError=false: break loop, set execution FAILED
- After loop: set execution SUCCESS or FAILED, set completedAt
- Call sseStreamManager.complete(executionId) when done
- Keep ConcurrentHashMap<String, Process> activeProcesses for cancellation
```

### StepRunner.java
```
- Use ProcessBuilder to build the command: List.of(shell, "-c", step.getRun())
- Call processBuilder.environment().putAll(mergedEnv)
- Call processBuilder.directory(new File(workingDir))
- Call processBuilder.redirectErrorStream(true) — merge stderr into stdout
- Start process, read output line by line with BufferedReader
- For each line: push to SseStreamManager.publish(), append to output StringBuilder
- Use process.waitFor(timeout, TimeUnit.SECONDS) — destroy if returns false
- Return StepResult with exitCode, output, status
```

### SseStreamManager.java
```
- ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> subscribers
- subscribe(executionId, timeoutMs): create SseEmitter, add to map,
  register onCompletion/onError/onTimeout callbacks to remove from map
- publish(executionId, LogLine): send event to all subscribers for that id
- complete(executionId): call emitter.complete() on all, remove from map
- On new subscriber for already-complete execution:
  replay LogLine records from DB for that executionId, then complete immediately
```

### ApiKeyFilter.java
```
- Extend OncePerRequestFilter
- Skip if path is /health or /h2-console/**
- Read Authorization header
- Check starts with "Bearer " and token matches agentConfig.getToken()
- If invalid: response.setStatus(401), write { "error": "Unauthorized" }, return
```

### AsyncConfig.java
```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "agentExecutor")
    public Executor agentExecutor(AgentConfig config) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(config.getMaxConcurrent());
        executor.setMaxPoolSize(config.getMaxConcurrent());
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("agent-exec-");
        executor.initialize();
        return executor;
    }
}
```

### AgentConfig.java
```java
@Configuration
@ConfigurationProperties(prefix = "agent")
@Data
public class AgentConfig {
    private String token;
    private String workingDir = "/tmp";
    private String defaultShell = "/bin/sh";
    private int maxConcurrent = 5;

    @PostConstruct
    public void validate() {
        if (token == null || token.isBlank()) {
            throw new IllegalStateException(
                "AGENT_TOKEN environment variable must be set before starting the agent");
        }
    }
}
```

---

## Dockerfile

```dockerfile
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY build/libs/agent-0.1.0-SNAPSHOT.jar app.jar
EXPOSE 8090
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Build and run:
```bash
./gradlew bootJar
docker build -t deploy-agent .
docker run \
  -e AGENT_TOKEN=your-secret-token \
  -p 8090:8090 \
  -v $(pwd)/data:/app \
  deploy-agent
```

---

## systemd Service (bare metal)

```ini
[Unit]
Description=Deploy Agent
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/agent
Environment=AGENT_TOKEN=your-secret-token
ExecStart=java -jar /opt/agent/agent.jar
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## GitHub Actions Usage

Inline steps:
```yaml
- name: Deploy to production
  run: |
    curl -s -f -X POST http://${{ vars.AGENT_HOST }}:8090/execute \
      -H "Authorization: Bearer ${{ secrets.AGENT_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "Deploy ${{ github.repository }} @ ${{ github.sha }}",
        "steps": [
          { "name": "Pull",   "run": "docker pull ${{ vars.REGISTRY }}/myapp:${{ github.sha }}" },
          { "name": "Stop",   "run": "docker stop myapp || true" },
          { "name": "Start",  "run": "docker run -d --name myapp --restart unless-stopped -p 8080:8080 ${{ vars.REGISTRY }}/myapp:${{ github.sha }}" },
          { "name": "Health", "run": "sleep 5 && curl -f http://localhost:8080/actuator/health" }
        ],
        "timeout": 120
      }'
```

Or reference a file in the repo (recommended — keeps pipeline clean):
```yaml
- name: Deploy to production
  run: |
    curl -s -f -X POST http://${{ vars.AGENT_HOST }}:8090/execute \
      -H "Authorization: Bearer ${{ secrets.AGENT_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d @.github/deploy/prod.json
```

Store per-environment step files in the repo:
```
.github/
  deploy/
    prod.json
    staging.json
    gpu-server.json
```

---

## Coding Guidelines

- Use `@Slf4j` for all logging — structured messages: `log.info("step completed name={} exitCode={}", name, code)`
- All controllers return `ResponseEntity<?>` with explicit HTTP status codes
- All error responses return `{ "error": "message" }` — handled centrally in `GlobalExceptionHandler`
- Use `@Validated` on controller classes, `@NotBlank` / `@NotEmpty` on DTOs
- `ExecutorService.execute()` must be `@Async("agentExecutor")` — never block the HTTP thread
- Store active `Process` in `ConcurrentHashMap` inside `ExecutorService` for cancellation support
- Use `@Transactional` on all service methods that write to the database
- `SseEmitter` timeout = execution timeout + 30 seconds buffer
- Never swallow exceptions silently — always log with context before rethrowing or handling
- Keep controllers thin: validate input, call service, return response — no business logic in controllers

---

## Out of Scope (do not add)

- No frontend / dashboard UI
- No OAuth or JWT — API key only
- No job scheduling / cron
- No agent-to-agent communication
- No secret management — caller passes secrets as env vars in the request
- No plugin system
- No multi-tenancy
- No WebSocket — SSE is sufficient for one-way log streaming
