import Link from 'next/link';
import { CodeBlock, InfoBox } from '../components';

export default function BackupPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Backup &amp; Database</h1>
      <p className="text-[#888] mb-8">
        GRIPHOOK has two databases. <strong className="text-white">PostgreSQL</strong> on each agent holds the
        canonical execution history. <strong className="text-white">SQLite</strong> on the Control Center
        mirrors agent state for fast querying and offline browsing. Back both up.
      </p>

      <InfoBox type="info" title="Recommended: use the UI">
        The fastest way to back up the Control Center is <strong>Settings → Database → Download JSON</strong>.
        It produces a complete snapshot of every agent, execution, step, and log line, with secrets stripped.
        See <Link href="#export-from-the-ui" className="text-[#00fff2] hover:underline">Export from the UI</Link> below.
      </InfoBox>

      {/* Locations */}
      <h2 className="text-xl font-bold text-white mt-8 mb-4">Where the data lives</h2>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left py-3 px-4 text-[#888]">Component</th>
              <th className="text-left py-3 px-4 text-[#888]">Database</th>
              <th className="text-left py-3 px-4 text-[#888]">File</th>
              <th className="text-left py-3 px-4 text-[#888]">Tables</th>
            </tr>
          </thead>
          <tbody className="text-[#ccc]">
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4">Agent (Spring Boot)</td>
              <td className="py-3 px-4">PostgreSQL</td>
              <td className="py-3 px-4"><code>postgres</code> service (Docker volume <code>postgres-data</code>)</td>
              <td className="py-3 px-4 text-xs">executions, step_results, log_lines, skill_configs, crush_profiles, gmail_tokens, chat_sessions, chat_messages, scheduled_tasks, custom_skills</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4">Control Center (UI)</td>
              <td className="py-3 px-4">SQLite (Prisma 7 / LibSQL)</td>
              <td className="py-3 px-4"><code>ui/data/runner.db</code></td>
              <td className="py-3 px-4 text-xs">Agent, Execution, Step, LogLine (FK-cascade from Agent)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* UI export */}
      <h2 id="export-from-the-ui" className="text-xl font-bold text-white mt-8 mb-4">Export from the UI</h2>
      <p className="text-[#888] mb-4">
        <strong>Settings → Database</strong> shows live row counts and three actions:
      </p>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <h3 className="text-sm font-semibold text-white">Download JSON</h3>
          <p className="text-xs text-[#888] mt-1">
            Full snapshot: every agent, execution, step, and log line. Agent <strong>tokens are stripped</strong> —
            safe to share for debugging or to keep versioned in git (after you scrub other secrets).
            Re-importable via the same UI.
          </p>
        </div>
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <h3 className="text-sm font-semibold text-white">Download .db</h3>
          <p className="text-xs text-[#888] mt-1">
            Raw binary copy of <code>ui/data/runner.db</code>. Includes tokens. Use for full restore
            when you also have the agent tokens in another secret store.
          </p>
        </div>
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <h3 className="text-sm font-semibold text-white">Choose JSON file (import)</h3>
          <p className="text-xs text-[#888] mt-1">
            Pick a previously-exported JSON. Wipes all current agents/executions/steps/logs in a
            transaction and re-inserts. You&apos;ll need to re-enter agent tokens in <Link href="/agents" className="text-[#00fff2] hover:underline">Manage Agents</Link>.
          </p>
        </div>
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <h3 className="text-sm font-semibold text-white">Auto-sync</h3>
          <p className="text-xs text-[#888] mt-1">
            The Control Center auto-syncs from every registered agent on home page load. You can also
            force a sync via <code>POST /api/sync</code> or the top-bar <em>Refresh</em> button.
          </p>
        </div>
      </div>

      <h3 className="text-base font-medium text-[#ccc] mb-3">Export schema (JSON)</h3>
      <CodeBlock language="json">
{`{
  "version": 1,
  "exportedAt": "2026-07-19T05:22:59.699Z",
  "counts": { "agents": 2, "executions": 104, "steps": 12, "logLines": 0 },
  "data": {
    "agents":     [ { "id": "...", "name": "...", "url": "...", "token": "", ... } ],
    "executions": [ { "id": "...", "agentId": "...", "name": "...", "status": "...", ... } ],
    "steps":      [ { "id": 1, "executionId": "...", "name": "...", "run": "...", ... } ],
    "logLines":   [ { "id": 1, "executionId": "...", "stepName": "...", "line": "...", ... } ]
  }
}`}
      </CodeBlock>

      {/* CLI backups */}
      <h2 className="text-xl font-bold text-white mt-10 mb-4">CLI backups</h2>

      <h3 className="text-base font-medium text-[#ccc] mb-3">Control Center (SQLite)</h3>
      <CodeBlock language="bash">
{`# Hot backup while the UI is running (safe, atomic)
sqlite3 ui/data/runner.db ".backup 'ui/data/runner.db.backup'"

# With a timestamp
sqlite3 ui/data/runner.db ".backup 'backups/runner-\$(date +%Y%m%d-%H%M%S).db'"

# Daily cron (writes one file per day, 7-day retention)
0 2 * * * find /opt/griphook-ui/data -name 'runner.db' -exec \\
  sqlite3 {} ".backup '/backups/runner-\$(date +\\%F).db'" \\;
find /backups -name 'runner-*.db' -mtime +7 -delete`}
      </CodeBlock>

      <h3 className="text-base font-medium text-[#ccc] mb-3 mt-6">Agent (PostgreSQL)</h3>
      <CodeBlock language="bash">
{`# Safest: stop the agent first
sudo systemctl stop griphook-agent

# Dump the database (adjust credentials/host to match your setup)
pg_dump -U runner -d runner -h localhost > "backups/agent-$(date +%Y%m%d-%H%M%S).sql"

sudo systemctl start griphook-agent`}
      </CodeBlock>

      {/* Full system backup script */}
      <h2 className="text-xl font-bold text-white mt-10 mb-4">Full system backup script</h2>
      <CodeBlock language="bash">
{`#!/bin/bash
# backup-griphook.sh — backs up the UI on this host plus SSH&apos;d agents.
set -euo pipefail
BACKUP_DIR="/backups/griphook/\$(date +%Y%m%d-%H%M%S)"
mkdir -p "\$BACKUP_DIR"

# 1. UI SQLite (hot)
sqlite3 /opt/griphook-ui/data/runner.db ".backup '\$BACKUP_DIR/control-center.db'"

# 2. Settings file
cp ../settings.json "\$BACKUP_DIR/settings.json" 2>/dev/null || true

# 3. Each agent (must be reachable over SSH)
for host in server1 server2 server3; do
  echo "Backing up $host..."
  ssh "$host" "pg_dump -U runner -d runner > /tmp/agent-$(date +%Y%m%d).sql"
  scp "$host:/tmp/agent-$(date +%Y%m%d).sql" "$BACKUP_DIR/$host-agent.sql"
done

# 4. Compress
tar -czf "\$BACKUP_DIR.tar.gz" -C "\$(dirname \$BACKUP_DIR)" "\$(basename \$BACKUP_DIR)"
rm -rf "\$BACKUP_DIR"
echo "Backup complete: \$BACKUP_DIR.tar.gz"`}
      </CodeBlock>

      {/* Restore */}
      <h2 className="text-xl font-bold text-white mt-10 mb-4">Restore</h2>

      <h3 className="text-base font-medium text-[#ccc] mb-3">Control Center (SQLite)</h3>
      <CodeBlock language="bash">
{`# Option A: hot replace (UI is running, but the DB file is held open)
#   Use the UI: Settings → Database → Choose JSON file. Safer than file-copy.

# Option B: stop and copy
sudo systemctl stop griphook-ui           # or your service name
cp /backups/runner-20240101.db /opt/griphook-ui/data/runner.db
sudo systemctl start griphook-ui

# Then refresh each agent&apos;s token via Manage Agents → Edit.`}
      </CodeBlock>

      <h3 className="text-base font-medium text-[#ccc] mb-3 mt-6">Agent (PostgreSQL)</h3>
      <CodeBlock language="bash">
{`sudo systemctl stop griphook-agent
psql -U runner -d runner -h localhost < /backups/agent-20240101.sql
sudo systemctl start griphook-agent`}
      </CodeBlock>

      <InfoBox type="warning" title="Always back up before migration">
        The agent uses Hibernate <code>ddl-auto: update</code> and will auto-migrate its PostgreSQL schema on first start.
        The Control Center uses Prisma migrations applied at <code>ui/docker-entrypoint.sh</code>
        when running in Docker, or <code>npx prisma generate</code> locally. Always snapshot before upgrading.
      </InfoBox>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Reset database</h2>
      <p className="text-[#888] mb-4">
        To start completely fresh (deletes all data — irreversible):
      </p>
      <CodeBlock language="bash">
{`# Control Center
rm -f ui/data/runner.db ui/data/runner.db-journal
# The DB is recreated on next request (Prisma creates the schema; run npx prisma generate first)

# Agent (PostgreSQL)
docker compose -f docker-compose.postgres.yml down -v
# The schema is recreated on next agent start (ddl-auto: update)`}
      </CodeBlock>
    </div>
  );
}
