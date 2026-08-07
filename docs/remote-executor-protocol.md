# Remote Executor Protocol (v1)

A **remote executor** is a daemon deployed on a remote server that calls
runner-agent over **outbound HTTP** to register and long-poll for work.
This is the opposite of the older standalone `cli-executor` microservice
(inbound HTTP, agent calls the executor); the two are separate features and
can coexist. This document defines the runner-agent side of the v1 protocol —
the daemon itself is built separately.

## Overview

```
┌─────────────────┐   register / work / results (outbound HTTP, Bearer)   ┌──────────────┐
│   daemon        │ ─────────────────────────────────────────────────────▶ │  runner-agent│
│ (remote server) │ ◀───────────────────────────────────────────────────── │   (this app) │
└─────────────────┘            commands / acks                             └──────────────┘
```

The daemon holds **no inbound port**. runner-agent does not dial the daemon;
the daemon always initiates. This keeps the remote server behind its firewall
as long as it can reach runner-agent's HTTP endpoint.

## Setup flow

1. In the runner-agent UI, open **Settings → Remote Executors → Add Executor**,
   give it a name (e.g. `prod-web-1`), and click **Add Executor**.
2. A token is shown **once** in a modal. Copy the three values:
   ```
   RUNNER_URL=<your runner-agent base url, e.g. https://runner.example.com>
   EXECUTOR_ID=<the numeric id from the modal>
   EXECUTOR_TOKEN=<the token from the modal, shown only once>
   ```
3. Put them in the daemon's config (env vars, config file, however the daemon is built).
4. Start the daemon. It calls `POST /daemon/{id}/register`, then loops on
   `GET /daemon/{id}/work`, running each returned command and posting the result
   to `POST /daemon/{id}/results`.

If you lose the token, there is no recovery — delete the executor and create a
new one (the id changes, so the daemon config must be updated). A
`rotate-token` endpoint may arrive in v2.

## Authentication

Every `/daemon/*` call must carry the executor token as a Bearer header:

```
Authorization: Bearer <EXECUTOR_TOKEN>
```

`/daemon/*` is **exempt** from runner-agent's normal `AGENT_TOKEN` (`ApiKeyFilter`).
The per-executor token is the only credential for the daemon surface, verified
inside `DaemonController` against the `remote_execators` row. A request with a
missing/invalid token or a token that does not match the id gets HTTP 401; an
unknown id gets 404.

## Endpoints

### `POST /daemon/{id}/register`

Called once on daemon startup (and again on reconnect). Marks the executor
`ONLINE` and refreshes `lastSeenAt`.

- Auth: Bearer executor token.
- Request body: none.
- Response `200`:
  ```json
  { "id": 1, "name": "prod-web-1", "status": "ONLINE", "pollIntervalMs": 30000 }
  ```
- Errors: `401` bad token, `404` unknown id.

### `GET /daemon/{id}/work`

Long-poll for work. Holds the connection up to **30s**; returns immediately if
a command is queued. Each call also refreshes `lastSeenAt` (this is the
heartbeat — there is no separate keepalive).

- Auth: Bearer executor token.
- Response `200` (immediate or after up to 30s):
  ```json
  { "commands": [ { "workId": "uuid", "command": "uname -a", "timeoutSec": 60 } ] }
  ```
  When idle for 30s, returns `{ "commands": [] }`.
- The daemon should run **each** command in the list and post a result for
  each `workId`.
- Only **one long-poll per executor at a time** (single-stream). A second
  concurrent poll causes the first to return `{"commands":[]}` immediately.
- Errors: `401`, `404`.

### `POST /daemon/{id}/results`

Post the outcome of a command the daemon ran.

- Auth: Bearer executor token.
- Request body:
  ```json
  { "workId": "uuid", "exitCode": 0, "stdout": "...", "stderr": "..." }
  ```
- Response `200`: `{ "success": true }`.
- A result for an unknown/late `workId` (e.g. the agent already timed out)
  is accepted and silently dropped — it is not an error.
- Errors: `401`, `404`.

## Daemon poll loop (pseudo-code)

```
POST /daemon/{id}/register   (Bearer token)
loop:
  resp = GET /daemon/{id}/work (Bearer token, 30s timeout)
  for cmd in resp.commands:
    run cmd.command with a timeout of cmd.timeoutSec
    POST /daemon/{id}/results { workId: cmd.workId, exitCode, stdout, stderr }
  # if commands was empty, the GET already blocked ~30s; loop immediately
```

On any HTTP error (401/404/network), back off (e.g. 5–30s exponential) and
retry. A 401 usually means the token was rotated/revoked — stop and surface
the error; do not spin.

## Status & offline detection

A `@Scheduled` task on runner-agent marks an executor `OFFLINE` if no
`/register` or `/work` call has been received in the last **90s**. Because
every `/work` call refreshes `lastSeenAt`, a daemon polling every 30s stays
`ONLINE` indefinitely; a crashed/blocked daemon is detected within ~90s.

The agent's `list_executors` tool reports each executor's `ONLINE`/`OFFLINE`
status, and `execute_on_executor` refuses to run on an `OFFLINE` executor.

## The agent tool

The agent gets two ADK tools:

- `list_executors()` — returns `{success, executors:[{id,name,status,lastSeenAt}]}`.
- `execute_on_executor(executor_name, command, timeout_sec=60)` — runs a
  shell command on the named executor. Blocks the agent's inference thread
  until the daemon posts a result or `timeout_sec` elapses. Returns
  `{success, exit_code, stdout, stderr, executor}` (stdout/stderr truncated
  to 8000 chars), or `{success:false, error}` on failure/timeout.

## v1 caveats / trade-offs

These are **known v1 limitations**, documented for daemon implementers:

1. **Single runner-agent instance required.** In-memory queues, pollers, and
   in-flight futures live in the JVM. If you scale runner-agent behind a
   load balancer, a daemon's polls and the agent's `execute_on_executor`
   calls must land on the **same** instance (sticky routing) or the command
   is never delivered. v2: Redis-backed state.
2. **Daemon crash mid-command = command lost.** If the daemon dies after
   receiving a command but before posting the result, the agent's
   `execute_on_executor` blocks until `timeout_sec`, then returns a timeout
   failure. There is no redelivery. v2: persist in-flight commands and
   redeliver on reconnect.
3. **Token stored plaintext** in `remote_executors.token` (matches the
   existing `Agent.token` and `SkillConfig` posture). v2: SHA-256 hash.
4. **Blocking the agent inference thread.** `execute_on_executor` blocks the
   agent run for one command until it completes or times out. Fine for the
   single-user v1 agent; revisit if you pipeline many commands. v2: async
   tool support or a dedicated remote-exec executor pool.
5. **Lost token = delete + recreate.** The id changes, so the daemon config
   must be updated. v2: `POST /executors/{id}/rotate-token`.
6. **No command cancellation.** Once delivered, a command runs to completion
   on the daemon (up to `timeoutSec`); the agent cannot cancel it. v2: a
   cancel control message.

## UI endpoints (for reference)

The daemon never calls these — they're for the runner-agent UI (gated by
`AGENT_TOKEN` via `ApiKeyFilter`, auto-injected by the UI proxy):

- `GET /executors` — list (token stripped).
- `POST /executors {name}` — create, returns `{id,name,token,status}` with
  the token shown **once**.
- `DELETE /executors/{id}` — delete (fails any in-flight command as
  `"executor deleted"`).

## Config example

A minimal daemon config (env vars):

```
RUNNER_URL=https://runner.example.com
EXECUTOR_ID=1
EXECUTOR_TOKEN=3f4a...32hex
```

Equivalent curl smoke test (with `AGENT_TOKEN=1234`, runner-agent on
`localhost:8090`):

```bash
# 1. Create an executor (UI path, AGENT_TOKEN auth)
curl -sX POST localhost:8090/executors \
  -H "Authorization: Bearer 1234" -H "Content-Type: application/json" \
  -d '{"name":"prod-web-1"}'
# -> {"success":true,"id":1,"name":"prod-web-1","token":"<32hex>","status":"offline"}

TOKEN=<32hex from above>

# 2. Daemon registers
curl -sX POST localhost:8090/daemon/1/register -H "Authorization: Bearer $TOKEN"
# -> {"id":1,"name":"prod-web-1","status":"ONLINE","pollIntervalMs":30000}

# 3. Daemon long-polls (background)
curl -sN localhost:8090/daemon/1/work -H "Authorization: Bearer $TOKEN" &

# 4. Agent invokes execute_on_executor via /agent/chat -> the curl from step 3 returns:
#    {"commands":[{"workId":"...","command":"uname -a","timeoutSec":60}]}

# 5. Daemon posts the result
WORK_ID=<workId from step 4>
curl -sX POST localhost:8090/daemon/1/results \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"workId\":\"$WORK_ID\",\"exitCode\":0,\"stdout\":\"Linux prod-web-1\\n\",\"stderr\":\"\"}"
# -> {"success":true}

# 6. Idle long-poll returns {"commands":[]} after 30s.
# 7. Stop polling >90s -> the scheduled sweep marks the executor OFFLINE:
curl -s localhost:8090/executors -H "Authorization: Bearer 1234"
```