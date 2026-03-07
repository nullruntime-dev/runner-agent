# Runner Agent

A lightweight remote command executor agent written in Java (Spring Boot). It accepts HTTP requests containing shell commands, executes them sequentially, and streams output back via SSE.

Includes a web UI built with Next.js for monitoring executions and viewing live logs.

## Quick Start

```bash
# Set the required token and run
AGENT_TOKEN=your-secret-token ./gradlew bootRun

# Or build and run with Docker
./gradlew bootJar
docker build -t deploy-agent .
docker run -e AGENT_TOKEN=your-secret-token -p 8090:8090 deploy-agent
```

The agent runs on port `8090` by default.

---

## Authentication

All endpoints except `/health` require authentication via Bearer token.

**Header:**
```
Authorization: Bearer <AGENT_TOKEN>
```

Unauthorized requests return:
```json
HTTP 401 Unauthorized
{"error": "Unauthorized"}
```

---

## API Endpoints

### Health Check

Check if the agent is running.

```
GET /health
```

**Authentication:** Not required

**Response:**
```json
HTTP 200 OK
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

### Execute Commands

Submit a new execution with one or more shell commands.

```
POST /execute
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": "optional-uuid",
  "name": "Deploy myapp",
  "steps": [
    {
      "name": "Pull image",
      "run": "docker pull myregistry/myapp:latest",
      "timeout": 60,
      "continueOnError": false
    },
    {
      "name": "Stop container",
      "run": "docker stop myapp || true",
      "timeout": 30,
      "continueOnError": true
    },
    {
      "name": "Start container",
      "run": "docker run -d --name myapp -p 8080:8080 myregistry/myapp:latest",
      "timeout": 60,
      "continueOnError": false
    }
  ],
  "env": {
    "MY_VAR": "value",
    "ANOTHER_VAR": "another_value"
  },
  "workingDir": "/tmp",
  "shell": "/bin/bash",
  "timeout": 300
}
```

**Request Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | No | auto-generated UUID | Unique execution identifier |
| `name` | string | Yes | - | Human-readable name for the execution |
| `steps` | array | Yes | - | List of steps to execute sequentially |
| `steps[].name` | string | Yes | - | Step name |
| `steps[].run` | string | Yes | - | Shell command to execute |
| `steps[].timeout` | int | No | 60 | Step timeout in seconds |
| `steps[].continueOnError` | bool | No | false | Continue to next step if this one fails |
| `env` | object | No | {} | Environment variables to set |
| `workingDir` | string | No | /tmp | Working directory for commands |
| `shell` | string | No | /bin/sh | Shell to use for execution |
| `timeout` | int | No | 300 | Total execution timeout in seconds |

**Response:**
```json
HTTP 202 Accepted
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING"
}
```

**Validation Errors:**
```json
HTTP 400 Bad Request
{
  "error": "Validation failed",
  "details": {
    "name": "name is required",
    "steps": "steps cannot be empty"
  }
}
```

---

### Get Execution Status

Get full status and step results for an execution.

```
GET /execution/{id}
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
HTTP 200 OK
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Deploy myapp",
  "status": "SUCCESS",
  "shell": "/bin/bash",
  "workingDir": "/tmp",
  "exitCode": 0,
  "error": null,
  "startedAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:30:45Z",
  "createdAt": "2024-01-15T10:29:59Z",
  "steps": [
    {
      "id": 1,
      "stepIndex": 0,
      "name": "Pull image",
      "run": "docker pull myregistry/myapp:latest",
      "status": "SUCCESS",
      "exitCode": 0,
      "output": "latest: Pulling from myregistry/myapp\nDigest: sha256:abc123\nStatus: Image is up to date\n",
      "error": null,
      "continueOnError": false,
      "startedAt": "2024-01-15T10:30:00Z",
      "completedAt": "2024-01-15T10:30:20Z"
    },
    {
      "id": 2,
      "stepIndex": 1,
      "name": "Start container",
      "run": "docker run -d --name myapp -p 8080:8080 myregistry/myapp:latest",
      "status": "SUCCESS",
      "exitCode": 0,
      "output": "abc123def456\n",
      "error": null,
      "continueOnError": false,
      "startedAt": "2024-01-15T10:30:20Z",
      "completedAt": "2024-01-15T10:30:45Z"
    }
  ]
}
```

**Status Values:** `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED`

**Not Found:**
```json
HTTP 404 Not Found
{
  "error": "Execution not found: <id>"
}
```

---

### List Executions

List recent executions (summary only, no step output).

```
GET /executions
GET /executions?limit=50
GET /executions?status=FAILED
GET /executions?limit=10&status=RUNNING
```

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 20 | Maximum number of results |
| `status` | string | - | Filter by status: PENDING, RUNNING, SUCCESS, FAILED, CANCELLED |

**Response:**
```json
HTTP 200 OK
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Deploy myapp",
    "status": "SUCCESS",
    "exitCode": 0,
    "startedAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:30:45Z",
    "createdAt": "2024-01-15T10:29:59Z"
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Deploy staging",
    "status": "FAILED",
    "exitCode": 1,
    "startedAt": "2024-01-15T09:00:00Z",
    "completedAt": "2024-01-15T09:01:30Z",
    "createdAt": "2024-01-15T08:59:59Z"
  }
]
```

---

### Stream Logs (SSE)

Stream live log lines via Server-Sent Events.

```
GET /execution/{id}/logs
```

**Headers:**
```
Authorization: Bearer <token>
Accept: text/event-stream
```

**Response:**
```
HTTP 200 OK
Content-Type: text/event-stream

event: log
data: {"id":1,"executionId":"550e8400...","stepName":"Pull image","line":"Pulling from myregistry/myapp","stream":"stdout","createdAt":"2024-01-15T10:30:01Z"}

event: log
data: {"id":2,"executionId":"550e8400...","stepName":"Pull image","line":"Digest: sha256:abc123","stream":"stdout","createdAt":"2024-01-15T10:30:02Z"}

event: log
data: {"id":3,"executionId":"550e8400...","stepName":"Start container","line":"abc123def456","stream":"stdout","createdAt":"2024-01-15T10:30:21Z"}
```

**Behavior:**
- If execution is still running: streams logs in real-time, closes when execution completes
- If execution is already complete: replays all stored log lines, then closes immediately

**Log Line Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | long | Log line ID |
| `executionId` | string | Parent execution ID |
| `stepName` | string | Name of the step that produced this line |
| `line` | string | The actual log content |
| `stream` | string | Always "stdout" (stderr is merged) |
| `createdAt` | string | ISO 8601 timestamp |

**Example with curl:**
```bash
curl -N -H "Authorization: Bearer your-token" \
  http://localhost:8090/execution/550e8400-e29b-41d4-a716-446655440000/logs
```

---

### Cancel Execution

Kill a running execution.

```
POST /execution/{id}/cancel
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (Success):**
```json
HTTP 200 OK
{
  "status": "cancelled"
}
```

**Response (Not Active):**
```json
HTTP 200 OK
{
  "status": "not_active"
}
```

**Response (Already Terminal):**
```json
HTTP 409 Conflict
{
  "error": "Execution is already in terminal state: SUCCESS"
}
```

**Not Found:**
```json
HTTP 404 Not Found
{
  "error": "Execution not found: <id>"
}
```

---

## Example Usage

### curl

```bash
# Health check
curl http://localhost:8090/health

# Execute commands
curl -X POST http://localhost:8090/execute \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test deployment",
    "steps": [
      {"name": "Echo", "run": "echo Hello World"},
      {"name": "List", "run": "ls -la"}
    ]
  }'

# Get execution status
curl -H "Authorization: Bearer your-token" \
  http://localhost:8090/execution/550e8400-e29b-41d4-a716-446655440000

# Stream logs
curl -N -H "Authorization: Bearer your-token" \
  http://localhost:8090/execution/550e8400-e29b-41d4-a716-446655440000/logs

# List recent executions
curl -H "Authorization: Bearer your-token" \
  http://localhost:8090/executions?limit=10

# Cancel execution
curl -X POST -H "Authorization: Bearer your-token" \
  http://localhost:8090/execution/550e8400-e29b-41d4-a716-446655440000/cancel
```

### GitHub Actions

```yaml
- name: Deploy to production
  run: |
    curl -sf -X POST http://${{ vars.AGENT_HOST }}:8090/execute \
      -H "Authorization: Bearer ${{ secrets.AGENT_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "Deploy ${{ github.repository }} @ ${{ github.sha }}",
        "steps": [
          {"name": "Pull", "run": "docker pull ${{ vars.REGISTRY }}/myapp:${{ github.sha }}"},
          {"name": "Stop", "run": "docker stop myapp || true", "continueOnError": true},
          {"name": "Remove", "run": "docker rm myapp || true", "continueOnError": true},
          {"name": "Start", "run": "docker run -d --name myapp --restart unless-stopped -p 8080:8080 ${{ vars.REGISTRY }}/myapp:${{ github.sha }}"},
          {"name": "Health", "run": "sleep 5 && curl -f http://localhost:8080/actuator/health"}
        ],
        "timeout": 120
      }'
```

---

## Configuration

Environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_TOKEN` | Yes | - | API authentication token |

Application properties (application.yml):

| Property | Default | Description |
|----------|---------|-------------|
| `server.port` | 8090 | HTTP server port |
| `agent.working-dir` | /tmp | Default working directory |
| `agent.default-shell` | /bin/sh | Default shell |
| `agent.max-concurrent` | 5 | Max concurrent executions |

---

## Database

The agent uses H2 embedded database in file mode. Data persists in `./agent-data.mv.db`.

Access H2 console (no auth required):
```
http://localhost:8090/h2-console
JDBC URL: jdbc:h2:file:./agent-data
Username: sa
Password: (empty)
```

---

## Web UI

A Next.js web interface is included in the `ui/` directory.

### Features

- View all executions with status, duration, and exit codes
- Real-time log streaming via SSE
- View step details and output
- Cancel running executions
- No authentication required (uses backend token from env)

### Setup

```bash
cd ui

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your backend URL and token:
#   NEXT_PUBLIC_API_URL=http://localhost:8090
#   NEXT_PUBLIC_API_TOKEN=your-secret-token

# Install dependencies
npm install

# Run development server
npm run dev
```

The UI runs on `http://localhost:3000` by default.

### Production Build

```bash
cd ui
npm run build
npm start
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | http://localhost:8090 | Backend API URL |
| `NEXT_PUBLIC_API_TOKEN` | - | Backend API token (must match AGENT_TOKEN) |
