# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Backend (Java 21 / Spring Boot 3.4.3)
./gradlew bootRun                              # Run backend (requires GOOGLE_AI_API_KEY env var)
./gradlew build                                # Build + run tests
./gradlew test                                 # Run tests only
./gradlew test --tests "ClassName"             # Run single test class
./gradlew test --tests "ClassName.methodName"  # Run single test method
./gradlew bootJar                              # Build executable JAR
./gradlew bootBuildImage                       # Build Docker image (requires Docker)

# Frontend (Next.js 16.1 / React 19)
cd ui && npm install                 # Install dependencies (first time)
cd ui && npm run dev                 # Run frontend at http://localhost:3000
cd ui && npm run build               # Production build
cd ui && npm run lint                # Run ESLint
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Runner Agent                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  POST /execute ──► ExecutorService (@Async) ──► StepRunner              │
│                    └── ConcurrentHashMap<id, Process> for cancellation  │
│                                                                         │
│  /agent/chat ────► AgentService (Google ADK + Gemini)                   │
│                    └── ADK Tools in src/.../adk/tools/*.java            │
│                                                                         │
│  Slack Socket ───► SlackSocketModeService (WebSocket, no public URL)    │
│                                                                         │
│  Skills API ─────► SkillService (slack, gmail, smtp, gmail-api, flirt,  │
│                    web-search) └── Configs in skill_configs table       │
│                                                                         │
│  SSE Streaming ──► SseStreamManager (log streaming to UI)               │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Data Flow:**
- `POST /execute` → `ExecutorService.execute()` (async) → `StepRunner.run()` per step
- Each step uses `ProcessBuilder` with shell, streams stdout/stderr to `SseStreamManager`
- AI chat routes through `AgentService.chat()` which orchestrates ADK tools
- Session context passed to tools via ThreadLocal

## ADK Tools Pattern

Tools live in `src/main/java/dev/runner/agent/adk/tools/`. Each tool:
1. Is a `@Component` class with public methods annotated with `@Schema(name="...", description="...")`
2. Returns `Map<String, Object>` with `success` boolean and either `error` or result data
3. Checks `SkillService.getSkillConfig(name)` before executing (for configurable skills)
4. Registered in `AgentService` constructor via `FunctionTool.create(toolInstance, "methodName")`

Example structure:
```java
@Slf4j
@Component
public class MyTool {
    private final SkillService skillService;

    public MyTool(SkillService skillService) {
        this.skillService = skillService;
    }

    @Schema(name = "tool_name", description = "What this tool does")
    public Map<String, Object> methodName(
            @Schema(name = "param", description = "Param description") String param
    ) {
        Map<String, Object> result = new HashMap<>();
        // ... logic
        result.put("success", true);
        return result;
    }
}
```

## Key Patterns

- **Logging:** Use `@Slf4j` with structured format: `log.info("action completed name={} status={}", name, status)`
- **Async execution:** `ExecutorService.execute()` must have `@Async("agentExecutor")`
- **Process cancellation:** Store active `Process` in `ConcurrentHashMap`, use `destroyForcibly()`
- **Error responses:** Return `{ "error": "message" }` via `GlobalExceptionHandler`
- **Controllers:** Keep thin, use `ResponseEntity<?>` with explicit status codes
- **DTOs:** Use `@Validated` on controllers, `@NotBlank`/`@NotEmpty` on fields

## Database

H2 embedded at `./agent-data.mv.db`. Tables:
- `executions` / `step_results` / `log_lines` — command execution data
- `skill_configs` — skill configurations (JSON blob)
- `crush_profiles` — flirt assistant profiles
- `gmail_tokens` — Gmail OAuth tokens
- `chat_sessions` / `chat_messages` — chat history persistence

Access console: `http://localhost:8090/h2-console` (JDBC URL: `jdbc:h2:file:./agent-data`, user: `sa`, no password)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_AI_API_KEY` | Yes (for AI) | — | Google AI API key for Gemini |
| `AGENT_TOKEN` | No | `1234` | API auth token |
| `AGENT_ADK_MODEL` | No | `gemini-2.0-flash` | Gemini model ID |
| `AGENT_ADK_ENABLED` | No | `true` | Enable/disable AI chat |
| `AGENT_WORKING_DIR` | No | `/tmp` | Working directory for command execution |
| `AGENT_DEFAULT_SHELL` | No | `/bin/sh` | Default shell for commands |
| `AGENT_MAX_CONCURRENT` | No | `5` | Max concurrent executions |
| `SERVER_PORT` | No | `8090` | Backend server port |
| `H2_CONSOLE_ENABLED` | No | `true` | Enable H2 web console (disable in production) |

See `.env.example` for skill-specific variables (Slack, Gmail, SMTP, etc.).

## Project Layout

- `src/main/java/dev/runner/agent/adk/` — AI agent: `AgentService`, `AdkConfig`, tools
- `src/main/java/dev/runner/agent/adk/tools/` — ADK tool implementations:
  - Execution tools: `ExecuteCommandsTool`, `GetExecutionStatusTool`, `ListExecutionsTool`, `ReadLogsTool`, `CancelExecutionTool`
  - Communication: `SlackTool`, `GmailTool`, `GmailApiTool`, `SmtpTool`
  - Search: `WebSearchTool` (Google Custom Search API)
  - Other: `ScheduleTool`, `CustomSkillTool`, `FlirtTool`
- `src/main/java/dev/runner/agent/api/` — REST controllers
- `src/main/java/dev/runner/agent/executor/` — Command execution: `ExecutorService`, `StepRunner`
- `src/main/java/dev/runner/agent/service/` — Business services:
  - `SkillService` — manages skill configurations (JSON in `skill_configs` table)
  - `CustomSkillService` — user-defined custom skills
  - `GmailApiService` — Gmail OAuth token handling
  - `CrushProfileService` — profile persistence for FlirtTool
  - `ChatService` — chat session and message persistence
- `src/main/java/dev/runner/agent/slack/` — Slack Socket Mode integration
- `ui/` — Next.js 16 frontend with React 19, Tailwind 4, TypeScript, Prisma (LibSQL adapter)
