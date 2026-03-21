import { CodeBlock, Endpoint, TableRow, StatusCard } from '../components';

export default function APIPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">API Reference</h1>
      <p className="text-[#888] mb-8">
        All endpoints (except <code className="text-[#ff6600]">/health</code>) require authentication
        via Bearer token in the Authorization header.
      </p>

      <h2 className="text-xl font-bold text-white mb-6">Endpoints</h2>

      <Endpoint method="GET" path="/health" auth={false}>
        Health check endpoint. Returns agent status and version.
        <CodeBlock language="json" className="mt-4">
{`{
  "status": "ok",
  "version": "0.1.0"
}`}
        </CodeBlock>
      </Endpoint>

      <Endpoint method="POST" path="/execute" auth={true}>
        Submit a new execution with one or more steps.
        <CodeBlock language="json" className="mt-4">
{`{
  "name": "Deploy Application",
  "steps": [
    {
      "name": "Pull Image",
      "run": "docker pull myapp:latest",
      "timeout": 60
    },
    {
      "name": "Restart Container",
      "run": "docker compose up -d",
      "timeout": 120,
      "continueOnError": false
    }
  ],
  "env": {
    "DEPLOY_ENV": "production"
  },
  "workingDir": "/opt/app",
  "timeout": 300
}`}
        </CodeBlock>
      </Endpoint>

      <Endpoint method="GET" path="/execution/{id}" auth={true}>
        Get execution status and step results.
      </Endpoint>

      <Endpoint method="GET" path="/execution/{id}/logs" auth={true}>
        Stream real-time logs via Server-Sent Events (SSE).
        <p className="mt-2 text-xs text-[#444]">Content-Type: text/event-stream</p>
      </Endpoint>

      <Endpoint method="GET" path="/executions" auth={true}>
        List recent executions. Supports query parameters:
        <ul className="mt-2 list-disc list-inside text-xs">
          <li><code className="text-[#ff6600]">?limit=N</code> - Number of results (default: 50)</li>
          <li><code className="text-[#ff6600]">?status=RUNNING</code> - Filter by status</li>
        </ul>
      </Endpoint>

      <Endpoint method="POST" path="/execution/{id}/cancel" auth={true}>
        Cancel a running execution. Returns 409 if already in terminal state.
      </Endpoint>

      <h2 className="text-xl font-bold text-white mt-12 mb-6">AI Chat Endpoints</h2>

      <Endpoint method="POST" path="/agent/chat" auth={true}>
        Send a message to the AI assistant and get a response.
        <CodeBlock language="json" className="mt-4">
{`// Request
{
  "sessionId": "optional-session-id",
  "message": "List recent executions"
}

// Response
{
  "sessionId": "abc123",
  "response": "Here are your recent executions..."
}`}
        </CodeBlock>
      </Endpoint>

      <Endpoint method="GET" path="/agent/chat/stream" auth={true}>
        Stream AI responses via Server-Sent Events.
        <ul className="mt-2 list-disc list-inside text-xs">
          <li><code className="text-[#ff6600]">?sessionId=ID</code> - Session ID for conversation context</li>
          <li><code className="text-[#ff6600]">?message=TEXT</code> - The message to send</li>
        </ul>
        <p className="mt-2 text-xs text-[#444]">Content-Type: text/event-stream</p>
      </Endpoint>

      <h2 className="text-xl font-bold text-white mt-12 mb-6">Skills Endpoints</h2>

      <Endpoint method="GET" path="/agent/skills" auth={true}>
        List all available skills and their configuration status.
      </Endpoint>

      <Endpoint method="POST" path="/agent/skills/{name}/configure" auth={true}>
        Configure a skill with credentials and settings.
        <CodeBlock language="json" className="mt-4">
{`{
  "config": {
    "botToken": "xoxb-...",
    "appToken": "xapp-...",
    "defaultChannel": "#deployments",
    "slashCommand": "griphook"
  },
  "enabled": true
}`}
        </CodeBlock>
      </Endpoint>

      <Endpoint method="DELETE" path="/agent/skills/{name}" auth={true}>
        Deactivate a skill and remove its configuration.
      </Endpoint>

      <h2 className="text-xl font-bold text-white mt-12 mb-6">Request Format</h2>
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
            <TableRow field="name" type="string" required="Yes" description="Human-readable name for the execution" />
            <TableRow field="steps" type="array" required="Yes" description="List of steps to execute sequentially" />
            <TableRow field="steps[].name" type="string" required="Yes" description="Step name" />
            <TableRow field="steps[].run" type="string" required="Yes" description="Shell command to execute" />
            <TableRow field="steps[].timeout" type="int" required="No" description="Step timeout in seconds (default: 60)" />
            <TableRow field="steps[].continueOnError" type="bool" required="No" description="Continue if step fails (default: false)" />
            <TableRow field="env" type="object" required="No" description="Environment variables" />
            <TableRow field="workingDir" type="string" required="No" description="Working directory (default: /tmp)" />
            <TableRow field="shell" type="string" required="No" description="Shell to use (default: /bin/sh)" />
            <TableRow field="timeout" type="int" required="No" description="Total timeout in seconds (default: 300)" />
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-bold text-white mt-12 mb-6">Execution Status</h2>
      <div className="grid grid-cols-2 gap-4">
        <StatusCard status="PENDING" color="neutral" description="Execution is queued and waiting to start" />
        <StatusCard status="RUNNING" color="amber" description="Execution is currently in progress" />
        <StatusCard status="SUCCESS" color="green" description="All steps completed successfully" />
        <StatusCard status="FAILED" color="red" description="One or more steps failed" />
        <StatusCard status="CANCELLED" color="neutral" description="Execution was manually cancelled" />
      </div>

      <h2 className="text-xl font-bold text-white mt-12 mb-6">CI/CD Examples</h2>
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
          {"name": "Pull", "run": "docker pull myapp:\${{ github.sha }}"},
          {"name": "Stop", "run": "docker stop myapp || true"},
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
    </div>
  );
}
