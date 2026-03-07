import { CodeBlock, TroubleshootItem } from '../components';

export default function TroubleshootingPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Troubleshooting</h1>
      <p className="text-neutral-400 mb-8">
        Common issues and how to resolve them.
      </p>

      <h2 className="text-xl font-bold text-white mb-6">Common Issues</h2>
      <div className="space-y-6">
        <TroubleshootItem
          problem="Agent shows as OFFLINE in Control Center"
          solutions={[
            "Verify the agent is running: curl http://agent-host:8090/health",
            "Check network connectivity between Control Center and agent",
            "Ensure the agent URL includes http:// prefix",
            "Check firewall rules allow port 8090"
          ]}
        />

        <TroubleshootItem
          problem="401 Unauthorized when connecting to agent"
          solutions={[
            "Verify the token in Control Center matches AGENT_TOKEN on the agent",
            "Check the token doesn't have extra whitespace",
            "Restart the agent after changing AGENT_TOKEN"
          ]}
        />

        <TroubleshootItem
          problem="Database locked errors (SQLite)"
          solutions={[
            "Ensure only one instance of Control Center is running",
            "Check for zombie processes: ps aux | grep node",
            "Delete lock file: rm data/runner.db-journal"
          ]}
        />

        <TroubleshootItem
          problem="Execution stuck in RUNNING status"
          solutions={[
            "Use the cancel endpoint: POST /execution/{id}/cancel",
            "Check agent logs: journalctl -u runner-agent",
            "Restart the agent to clean up stuck processes"
          ]}
        />

        <TroubleshootItem
          problem="Logs not streaming in real-time"
          solutions={[
            "Check proxy timeouts (nginx/apache)",
            "Add to nginx: proxy_buffering off;",
            "Increase timeout: proxy_read_timeout 3600s;"
          ]}
        />

        <TroubleshootItem
          problem="Java not found or wrong version"
          solutions={[
            "Install Java 21+: apt install openjdk-21-jre-headless",
            "Check version: java -version",
            "Set JAVA_HOME if needed"
          ]}
        />

        <TroubleshootItem
          problem="Agent fails to start - token not set"
          solutions={[
            "Set AGENT_TOKEN environment variable",
            "For systemd: add Environment=AGENT_TOKEN=xxx in service file",
            "For Docker: add -e AGENT_TOKEN=xxx"
          ]}
        />

        <TroubleshootItem
          problem="Control Center can't connect to database"
          solutions={[
            "Check data directory exists: mkdir -p data",
            "Check permissions: chown -R user:user data",
            "Run migrations: npx prisma migrate deploy"
          ]}
        />
      </div>

      <h2 className="text-xl font-bold text-white mt-12 mb-4">Useful Commands</h2>
      <CodeBlock language="bash">
{`# Check agent health
curl -s http://localhost:8090/health | jq

# List recent executions
curl -s -H "Authorization: Bearer $TOKEN" \\
  http://localhost:8090/executions?limit=10 | jq

# View agent logs
journalctl -u runner-agent -f

# View Control Center logs
journalctl -u runner-control-center -f

# Check database size
du -h data/runner.db
du -h agent-data.mv.db

# Compact SQLite (reclaim space)
sqlite3 data/runner.db "VACUUM;"

# Check what's using a port
lsof -i :8090
lsof -i :3000

# Test SSE connection
curl -N -H "Authorization: Bearer $TOKEN" \\
  http://localhost:8090/execution/{id}/logs`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-12 mb-4">Debug Mode</h2>
      <p className="text-neutral-400 mb-4">
        Enable verbose logging for debugging:
      </p>
      <CodeBlock language="bash">
{`# Agent - enable debug logging
AGENT_TOKEN=xxx java -jar runner-agent.jar \\
  --logging.level.dev.runner.agent=DEBUG

# Control Center - enable verbose output
DEBUG=* npm run dev`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-12 mb-4">Reset Database</h2>
      <p className="text-neutral-400 mb-4">
        If you need to start fresh (warning: deletes all data):
      </p>
      <CodeBlock language="bash">
{`# Control Center
rm data/runner.db
npx prisma migrate deploy

# Agent
rm agent-data.mv.db agent-data.trace.db
# Database will be recreated on next start`}
      </CodeBlock>
    </div>
  );
}
