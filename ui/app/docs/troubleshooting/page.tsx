import { CodeBlock, TroubleshootItem, InfoBox } from '../components';

export default function TroubleshootingPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Troubleshooting</h1>
      <p className="text-[#888] mb-8">
        Common issues and how to resolve them.
      </p>

      <h2 className="text-xl font-bold text-white mb-6">Common issues</h2>
      <div className="space-y-6">
        <TroubleshootItem
          problem="Agent shows as OFFLINE in the Control Center"
          solutions={[
            "Verify the agent is running: curl http://agent-host:8090/health",
            "Check network connectivity between the UI and the agent",
            "Ensure the agent URL includes the http:// (or https://) prefix",
            "Check firewall rules allow port 8090 (or whatever SERVER_PORT is set to)",
          ]}
        />

        <TroubleshootItem
          problem="401 Unauthorized when fetching skills / sessions / schedules / custom-skills"
          solutions={[
            "Open Manage Agents → Edit the agent → paste the correct AGENT_TOKEN → Save.",
            "If the backend is on the default AGENT_TOKEN=1234, the UI auto-falls back to '1234' when the stored token is empty — make sure the backend is actually using that default, not a custom token.",
            "Check the token has no extra whitespace.",
            "Restart the agent after changing AGENT_TOKEN.",
          ]}
        />

        <TroubleshootItem
          problem="AI chat / Ollama save returns 401"
          solutions={[
            "Same as above: the stored agent token doesn't match AGENT_TOKEN on the agent.",
            "Edit the agent in Manage Agents and set the correct token.",
          ]}
        />

        <TroubleshootItem
          problem="SQLite database locked (ui/data/runner.db)"
          solutions={[
            "Ensure only one instance of the Next.js UI is running.",
            "Check for zombie node processes: ps aux | grep node",
            "Remove stale journal file: rm ui/data/runner.db-journal",
            "Compact: sqlite3 ui/data/runner.db 'VACUUM;'",
          ]}
        />

        <TroubleshootItem
          problem="Execution stuck in RUNNING"
          solutions={[
            "Cancel via UI, or POST /execution/{id}/cancel to the agent.",
            "Inspect agent logs: journalctl -u griphook-agent -f",
            "Restart the agent to clean up zombie processes (the active Process is held in a ConcurrentHashMap).",
          ]}
        />

        <TroubleshootItem
          problem="SSE logs not streaming in the browser"
          solutions={[
            "Check the agent URL is reachable and the token is correct.",
            "If behind nginx: set proxy_buffering off; proxy_read_timeout 3600s; and proxy_cache off;",
            "Check the browser dev tools Network tab — the EventSource request must stay open with text/event-stream content type.",
          ]}
        />

        <TroubleshootItem
          problem="Java not found / wrong version"
          solutions={[
            "Install Java 21+: apt install openjdk-21-jre-headless (or dnf / pacman / brew).",
            "Check version: java -version",
            "Set JAVA_HOME if needed.",
          ]}
        />

        <TroubleshootItem
          problem="Prisma client errors after editing schema"
          solutions={[
            "Run npx prisma generate inside ui/.",
            "Then npm run build.",
            "Never run npx prisma migrate dev against the Docker DB — the entrypoint applies the SQL directly.",
          ]}
        />

        <TroubleshootItem
          problem="Slack slash command not working"
          solutions={[
            "Verify the command name in Slack matches the Slash Command field in the skill config.",
            "Check agent logs for 'No SlashCommandHandler registered for command'.",
            "Ensure Socket Mode is enabled in your Slack App settings and the App-Level Token starts with xapp-.",
            "Reinstall the Slack app after adding slash commands.",
            "Restart the agent after changing Slack configuration.",
          ]}
        />

        <TroubleshootItem
          problem="Slack responses stuck at 'Processing...'"
          solutions={[
            "Check agent logs for command processing errors.",
            "Verify the bot token has chat:write permission.",
            "Ensure the default channel is accessible by the bot.",
            "Check the AI provider (Gemini / Ollama) is reachable and the API key is valid.",
          ]}
        />

        <TroubleshootItem
          problem="AI chat not responding"
          solutions={[
            "Settings → AI Configuration — pick a provider and model, then Apply.",
            "For Gemini: verify GOOGLE_AI_API_KEY is set on the agent.",
            "For Ollama: check OLLAMA_BASE_URL is reachable and the model supports tool calling (ollama show MODEL | grep tools).",
            "Inspect agent logs for ADK errors.",
          ]}
        />

        <TroubleshootItem
          problem="Gmail / SMTP emails not sending"
          solutions={[
            "For Gmail SMTP: use an App Password, not your account password (myaccount.google.com/apppasswords).",
            "Match port to encryption: 587 TLS, 465 SSL, 25 plain.",
            "Check agent logs for javax.mail errors.",
          ]}
        />

        <TroubleshootItem
          problem="Web Search returns no results"
          solutions={[
            "SearXNG: ensure SEARXNG_BASE_URL points to a running instance (default http://localhost:8081).",
            "DuckDuckGo: works out of the box, but the html endpoint can rate-limit under heavy use.",
            "Wolfram Alpha: requires an appId configured in the skill.",
          ]}
        />

        <TroubleshootItem
          problem="Settings wizard won't go away on /docs or /settings"
          solutions={[
            "These two paths are excluded from the setup check by design (see SetupCheck.tsx).",
            "If /agents or other pages also re-trigger the wizard, your ../settings.json has setupComplete=false; set it to true manually or use Settings → Reset Setup → Run Setup Wizard.",
          ]}
        />
      </div>

      <h2 className="text-xl font-bold text-white mt-12 mb-4">Useful commands</h2>
      <CodeBlock language="bash">
{`# Agent health
curl -s http://localhost:8090/health | jq

# List recent executions
curl -s -H "Authorization: Bearer $TOKEN" \\
  http://localhost:8090/executions?limit=10 | jq

# Stream SSE logs
curl -N -H "Authorization: Bearer $TOKEN" \\
  http://localhost:8090/execution/{id}/logs

# Test AI chat
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"message": "list executions"}' http://localhost:8090/agent/chat

# View agent logs
journalctl -u griphook-agent -f

# View Control Center logs
journalctl -u griphook-ui -f

# UI database stats
sqlite3 ui/data/runner.db "SELECT 'agents', COUNT(*) FROM Agent
  UNION ALL SELECT 'executions', COUNT(*) FROM Execution
  UNION ALL SELECT 'steps',     COUNT(*) FROM Step
  UNION ALL SELECT 'logLines',  COUNT(*) FROM LogLine;"

# Compact the UI database
sqlite3 ui/data/runner.db "VACUUM;"

# Check port usage
lsof -i :8090   # agent
lsof -i :3000   # UI

# Confirm Slack is up
journalctl -u griphook-agent | grep -i "slack"`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-12 mb-4">Debug mode</h2>
      <CodeBlock language="bash">
{`# Agent: enable DEBUG logging for your package
java -jar runner-agent-0.1.0-SNAPSHOT.jar \\
  --logging.level.dev.runner.agent=DEBUG

# UI: verbose Next.js output
DEBUG=* npm run dev`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-12 mb-4">Reset database</h2>
      <InfoBox type="warning" title="Deletes all data — irreversible">
        Back up first (see the Backup page).
      </InfoBox>
      <CodeBlock language="bash">
{`# Control Center
rm -f ui/data/runner.db ui/data/runner.db-journal ui/data/runner.db-shm ui/data/runner.db-wal
# Restart the UI; the schema is recreated on first request

# Agent
rm -f agent-data.mv.db agent-data.trace.db
# Schema is recreated on next agent start (ddl-auto: update)`}
      </CodeBlock>
    </div>
  );
}
