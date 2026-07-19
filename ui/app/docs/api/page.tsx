import { CodeBlock, Endpoint, TableRow, StatusCard, InfoBox } from '../components';

export default function APIPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">API Reference</h1>
      <p className="text-[#888] mb-8">
        GRIPHOOK has two API surfaces: the <strong className="text-white">agent API</strong> (Spring Boot on the target host)
        and the <strong className="text-white">UI API</strong> (Next.js on the control plane). The UI API is a thin
        proxy that adds local caching, sync, and per-agent routing.
      </p>

      <InfoBox type="info" title="Authentication">
        All endpoints except <code className="text-[#ff6600]">/health</code>, the H2 console, and OAuth callbacks require
        a Bearer token. On the agent: <code>Authorization: Bearer &lt;AGENT_TOKEN&gt;</code>. On the UI:
        the token is stored per-agent in <code>ui/data/runner.db</code> and automatically attached to proxied requests.
        For SSE endpoints, the token can also be passed as <code>?token=...</code> since EventSource can&apos;t set headers.
      </InfoBox>

      {/* Agent API */}
      <h2 className="text-xl font-bold text-white mt-10 mb-6">Agent API (Spring Boot)</h2>
      <p className="text-[#888] mb-6">
        Direct endpoints on each agent. All paths below are relative to the agent&apos;s base URL
        (e.g. <code>http://localhost:8090</code>).
      </p>

      <Endpoint method="GET" path="/health" auth={false}>
        Health check. Returns agent status and version.
        <CodeBlock language="json" className="mt-4">
{`{
  "status": "ok",
  "version": "0.1.0-SNAPSHOT"
}`}
        </CodeBlock>
      </Endpoint>

      <h3 className="text-lg font-semibold text-white mt-8 mb-4">Executions</h3>

      <Endpoint method="POST" path="/execute" auth={true}>
        Submit a new execution. Returns an <code>id</code> you can poll or stream.
        <CodeBlock language="json" className="mt-4">
{`{
  "name": "Deploy Application",
  "steps": [
    { "name": "Pull",  "run": "docker pull myapp:latest",   "timeout": 60 },
    { "name": "Restart", "run": "docker compose up -d",     "timeout": 120, "continueOnError": false }
  ],
  "env": { "DEPLOY_ENV": "production" },
  "workingDir": "/opt/app",
  "shell": "/bin/bash",
  "timeout": 300
}`}
        </CodeBlock>
      </Endpoint>

      <Endpoint method="GET" path="/execution/{id}" auth={true}>
        Get execution status, step results, and exit codes.
      </Endpoint>

      <Endpoint method="GET" path="/execution/{id}/logs" auth={true}>
        Stream real-time logs via Server-Sent Events. <code>Content-Type: text/event-stream</code>.
      </Endpoint>

      <Endpoint method="GET" path="/executions" auth={true}>
        List recent executions. Query params: <code>?limit=N</code> (default 50), <code>?status=RUNNING</code>.
      </Endpoint>

      <Endpoint method="POST" path="/execution/{id}/cancel" auth={true}>
        Cancel a running execution. Returns 409 if already in a terminal state.
      </Endpoint>

      <h3 className="text-lg font-semibold text-white mt-8 mb-4">AI Chat</h3>

      <Endpoint method="POST" path="/agent/chat" auth={true}>
        Send a message and get a complete response. For streaming, use <code>/agent/chat/stream</code> instead.
        <CodeBlock language="json" className="mt-4">
{`// Request
{ "sessionId": "optional-id", "message": "List recent executions" }

// Response
{ "sessionId": "abc123", "response": "Here are your recent executions..." }`}
        </CodeBlock>
      </Endpoint>

      <Endpoint method="GET" path="/agent/chat/stream" auth={true}>
        SSE stream. Query params: <code>?sessionId=ID&amp;message=TEXT</code>. The browser&apos;s
        EventSource can&apos;t set <code>Authorization</code>, so you can also pass <code>?token=...</code>.
      </Endpoint>

      <Endpoint method="GET" path="/agent/ai-config" auth={true}>
        Get the current AI provider/model. Live — reflects the last <code>POST /agent/ai-config</code>.
      </Endpoint>

      <Endpoint method="POST" path="/agent/ai-config" auth={true}>
        Update AI provider/model. Persists to H2 (<code>skill_configs</code>, key <code>ai-provider</code>). No restart.
        <CodeBlock language="json" className="mt-4">
{`{
  "provider": "ollama",         // or "gemini"
  "geminiModel": "gemini-2.0-flash",
  "ollamaBaseUrl": "http://127.0.0.1:11434",
  "ollamaModel": "minimax-m3:cloud"
}`}
        </CodeBlock>
      </Endpoint>

      <h3 className="text-lg font-semibold text-white mt-8 mb-4">Skills &amp; Sessions</h3>

      <Endpoint method="GET" path="/agent/skills" auth={true}>
        List built-in skills with their configured/enabled state.
      </Endpoint>

      <Endpoint method="POST" path="/agent/skills/{name}/configure" auth={true}>
        Configure a skill with its credentials and settings.
        <CodeBlock language="json" className="mt-4">
{`{
  "config": {
    "botToken": "xoxb-...",
    "appToken": "xapp-...",
    "defaultChannel": "#deployments"
  },
  "enabled": true
}`}
        </CodeBlock>
      </Endpoint>

      <Endpoint method="GET" path="/agent/custom-skills" auth={true}>
        List user-defined custom skills (PROMPT or COMMAND type).
      </Endpoint>

      <Endpoint method="POST" path="/agent/custom-skills" auth={true}>
        Create a custom skill. Body: <code>&#123; name, displayName, description, type, definitionJson, icon? &#125;</code>.
      </Endpoint>

      <Endpoint method="POST" path="/agent/custom-skills/{name}/run" auth={true}>
        Invoke a custom skill (COMMAND type) immediately.
      </Endpoint>

      <Endpoint method="POST" path="/agent/custom-skills/{name}/toggle" auth={true}>
        Enable/disable a custom skill.
      </Endpoint>

      <Endpoint method="POST" path="/agent/custom-skills/{name}/visibility" auth={true}>
        Hide/show a custom skill from the UI sidebar.
      </Endpoint>

      <Endpoint method="GET" path="/agent/schedules" auth={true}>
        List scheduled tasks (INTERVAL or CRON).
      </Endpoint>

      <Endpoint method="POST" path="/agent/schedules" auth={true}>
        Create a schedule. Body: <code>&#123; name, description, type, action, scheduleType, intervalMinutes?, cronExpression? &#125;</code>.
      </Endpoint>

      <Endpoint method="POST" path="/agent/schedules/{id}/toggle" auth={true}>
        Enable/disable a schedule.
      </Endpoint>

      <Endpoint method="POST" path="/agent/schedules/{id}/run" auth={true}>
        Run a schedule immediately (skip waiting for the next tick).
      </Endpoint>

      <Endpoint method="GET" path="/agent/sessions?limit=N" auth={true}>
        List chat sessions for the agent.
      </Endpoint>

      <Endpoint method="GET" path="/agent/sessions/{id}" auth={true}>
        Get a chat session with all messages.
      </Endpoint>

      <Endpoint method="DELETE" path="/agent/sessions/{id}" auth={true}>
        Delete a chat session.
      </Endpoint>

      <h3 className="text-lg font-semibold text-white mt-8 mb-4">Wingman &amp; Gmail</h3>
      <Endpoint method="GET" path="/agent/wingman/export" auth={true}>
        Export wingman profiles + chat history as JSON.
      </Endpoint>
      <Endpoint method="GET" path="/agent/gmail/auth-url" auth={true}>
        Get the OAuth URL to start the Gmail authorization flow.
      </Endpoint>
      <Endpoint method="GET" path="/agent/gmail/status" auth={true}>
        Check if the agent has valid Gmail OAuth tokens.
      </Endpoint>
      <Endpoint method="POST" path="/agent/gmail/revoke" auth={true}>
        Revoke stored Gmail OAuth tokens.
      </Endpoint>

      {/* UI API */}
      <h2 className="text-xl font-bold text-white mt-12 mb-6">UI API (Next.js)</h2>
      <p className="text-[#888] mb-6">
        The Next.js app exposes its own API for the dashboard. Most of these proxy to the agent
        but add per-agent routing, auth, and local caching. Paths below are relative to the UI&apos;s
        base URL (e.g. <code>http://localhost:3000</code>).
      </p>

      <h3 className="text-lg font-semibold text-white mt-8 mb-4">Agents (UI control plane)</h3>

      <Endpoint method="GET" path="/api/agents" auth={false}>
        List registered agents (read from local SQLite).
      </Endpoint>

      <Endpoint method="POST" path="/api/agents" auth={false}>
        Register a new agent. Body: <code>&#123; name, url, token &#125;</code>.
      </Endpoint>

      <Endpoint method="GET" path="/api/agents/{id}" auth={false}>
        Get a single registered agent (token is stripped from the response).
      </Endpoint>

      <Endpoint method="PATCH" path="/api/agents/{id}" auth={false}>
        Update an agent&apos;s <code>name</code>, <code>url</code>, and/or <code>token</code>.
      </Endpoint>

      <Endpoint method="DELETE" path="/api/agents/{id}" auth={false}>
        Unregister an agent. Cascades to all synced executions/steps/logs.
      </Endpoint>

      <h3 className="text-lg font-semibold text-white mt-8 mb-4">Executions &amp; sync</h3>

      <Endpoint method="GET" path="/api/executions?agentId=…&limit=…" auth={false}>
        List mirrored executions from the local SQLite cache.
      </Endpoint>

      <Endpoint method="POST" path="/api/sync" auth={false}>
        Pull execution history from every registered agent into the local cache. Returns per-agent counts.
      </Endpoint>

      <h3 className="text-lg font-semibold text-white mt-8 mb-4">Database export / import</h3>

      <Endpoint method="GET" path="/api/database/stats" auth={false}>
        Row counts for each table in the UI&apos;s local SQLite.
        <CodeBlock language="json" className="mt-4">
{`{ "counts": { "agents": 2, "executions": 104, "steps": 12, "logLines": 0 } }`}
        </CodeBlock>
      </Endpoint>

      <Endpoint method="GET" path="/api/database/export?format=json" auth={false}>
        Download the entire UI database as JSON. Agent tokens are stripped.
      </Endpoint>

      <Endpoint method="GET" path="/api/database/export?format=sqlite" auth={false}>
        Download the raw <code>runner.db</code> file (binary SQLite).
      </Endpoint>

      <Endpoint method="POST" path="/api/database/import" auth={false}>
        Replace the UI database from a JSON export. Body: the JSON payload from the export endpoint.
        All existing rows are wiped in a transaction; tokens are re-entered manually afterwards.
      </Endpoint>

      <h3 className="text-lg font-semibold text-white mt-8 mb-4">Settings &amp; setup</h3>

      <Endpoint method="GET" path="/api/settings" auth={false}>
        Read the UI&apos;s <code>settings.json</code> (tokens, ports, AI defaults).
      </Endpoint>

      <Endpoint method="POST" path="/api/settings" auth={false}>
        Write to <code>settings.json</code>. Body matches the schema in the Configuration page.
      </Endpoint>

      <Endpoint method="GET" path="/api/settings/status" auth={false}>
        Boolean <code>setupComplete</code> flag used by the setup wizard.
      </Endpoint>

      <Endpoint method="GET" path="/api/download/agent" auth={false}>
        Streams the agent JAR (downloads from <code>downloads/</code> or <code>build/libs/</code>).
      </Endpoint>

      {/* Request format */}
      <h2 className="text-xl font-bold text-white mt-12 mb-6">Execute request schema</h2>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Field</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Required</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            <TableRow field="name" type="string" required="Yes" description="Human-readable execution name" />
            <TableRow field="steps" type="array" required="Yes" description="List of steps to run sequentially" />
            <TableRow field="steps[].name" type="string" required="Yes" description="Step name (shown in logs)" />
            <TableRow field="steps[].run" type="string" required="Yes" description="Shell command to execute" />
            <TableRow field="steps[].timeout" type="int" required="No" description="Step timeout in seconds (default 60)" />
            <TableRow field="steps[].continueOnError" type="bool" required="No" description="Continue if this step fails (default false)" />
            <TableRow field="env" type="object" required="No" description="Extra environment variables" />
            <TableRow field="workingDir" type="string" required="No" description="Override working directory (default /tmp)" />
            <TableRow field="shell" type="string" required="No" description="Override shell (default /bin/sh)" />
            <TableRow field="timeout" type="int" required="No" description="Total execution timeout in seconds (default 300)" />
          </tbody>
        </table>
      </div>

      {/* Statuses */}
      <h2 className="text-xl font-bold text-white mt-12 mb-6">Execution status</h2>
      <div className="grid grid-cols-2 gap-4">
        <StatusCard status="PENDING" color="neutral" description="Queued, waiting to start" />
        <StatusCard status="RUNNING" color="amber" description="Currently executing" />
        <StatusCard status="SUCCESS" color="green" description="All steps completed" />
        <StatusCard status="FAILED" color="red" description="One or more steps failed" />
        <StatusCard status="CANCELLED" color="neutral" description="Manually cancelled" />
      </div>

      {/* CI/CD */}
      <h2 className="text-xl font-bold text-white mt-12 mb-6">CI/CD examples</h2>
      <h3 className="text-md font-medium text-[#ccc] mb-3">GitHub Actions</h3>
      <CodeBlock language="yaml">
{`- name: Deploy to Production
  run: |
    curl -sf -X POST http://\${{ vars.AGENT_HOST }}:8090/execute \\
      -H "Authorization: Bearer \${{ secrets.AGENT_TOKEN }}" \\
      -H "Content-Type: application/json" \\
      -d '{
        "name": "Deploy \${{ github.repository }}",
        "steps": [
          {"name": "Pull",  "run": "docker pull myapp:\${{ github.sha }}"},
          {"name": "Stop",  "run": "docker stop myapp || true"},
          {"name": "Start", "run": "docker run -d --name myapp myapp:\${{ github.sha }}"}
        ]
      }'`}
      </CodeBlock>

      <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">GitLab CI</h3>
      <CodeBlock language="yaml">
{`deploy:
  stage: deploy
  script:
    - |
      curl -sf -X POST http://$AGENT_HOST:8090/execute \\
        -H "Authorization: Bearer $AGENT_TOKEN" \\
        -H "Content-Type: application/json" \\
        -d @deploy/production.json`}
      </CodeBlock>

      <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">Trigger via the UI proxy</h3>
      <p className="text-[#888] text-sm mb-4">
        The UI exposes <code>POST /api/agents/&#123;id&#125;/executions</code> for triggering executions from the
        browser; the Next.js route handler forwards the request to the agent with the correct Bearer token.
      </p>
    </div>
  );
}
