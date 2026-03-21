import { CodeBlock, InfoBox } from '../components';

export default function BackupPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Backup</h1>
      <p className="text-[#888] mb-8">
        GRIPHOOK uses two databases: <strong className="text-white">H2</strong> on each agent
        for execution history, and <strong className="text-white">SQLite</strong> on the Control Center
        for aggregated data.
      </p>

      <h2 className="text-xl font-bold text-white mb-4">Control Center (SQLite)</h2>
      <p className="text-[#888] mb-4">
        The database is located at <code className="text-[#ff6600]">data/griphook.db</code>.
      </p>
      <CodeBlock language="bash">
{`# Simple file copy (stop Control Center first)
cp data/griphook.db data/griphook.db.backup

# With timestamp
cp data/griphook.db "backups/griphook-$(date +%Y%m%d-%H%M%S).db"

# Safe backup while running (using sqlite3)
sqlite3 data/griphook.db ".backup 'data/griphook.db.backup'"

# Automated daily backup (crontab)
0 2 * * * sqlite3 /opt/griphook-ui/data/griphook.db ".backup '/backups/griphook-$(date +\\%Y\\%m\\%d).db'"`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Agent (H2)</h2>
      <p className="text-[#888] mb-4">
        Each agent stores history in <code className="text-[#ff6600]">./agent-data.mv.db</code>.
      </p>
      <CodeBlock language="bash">
{`# Stop the agent first
sudo systemctl stop griphook-agent

# Copy the database files
cp agent-data.mv.db agent-data.mv.db.backup

# With timestamp
cp agent-data.mv.db "backups/agent-$(date +%Y%m%d-%H%M%S).mv.db"

# Restart the agent
sudo systemctl start griphook-agent`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Full System Backup Script</h2>
      <CodeBlock language="bash">
{`#!/bin/bash
# backup-griphook.sh

BACKUP_DIR="/backups/griphook/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup Control Center
sqlite3 /opt/griphook-ui/data/griphook.db ".backup '$BACKUP_DIR/control-center.db'"
echo "Control Center backed up"

# Backup each agent (requires SSH access)
for host in server1 server2 server3; do
  echo "Backing up $host..."
  ssh "$host" "systemctl stop griphook-agent"
  scp "$host:/opt/griphook-agent/agent-data.mv.db" "$BACKUP_DIR/$host-agent.mv.db"
  ssh "$host" "systemctl start griphook-agent"
done

# Compress
tar -czf "$BACKUP_DIR.tar.gz" -C "$(dirname $BACKUP_DIR)" "$(basename $BACKUP_DIR)"
rm -rf "$BACKUP_DIR"

echo "Backup complete: $BACKUP_DIR.tar.gz"`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Restore from Backup</h2>
      <h3 className="text-md font-medium text-[#ccc] mb-3">Control Center</h3>
      <CodeBlock language="bash">
{`# Stop the Control Center
sudo systemctl stop griphook-control-center

# Restore the database
cp /backups/griphook-20240101.db /opt/griphook-ui/data/griphook.db

# Start the Control Center
sudo systemctl start griphook-control-center`}
      </CodeBlock>

      <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">Agent</h3>
      <CodeBlock language="bash">
{`# Stop the agent
sudo systemctl stop griphook-agent

# Restore the database
cp /backups/agent-20240101.mv.db /opt/griphook-agent/agent-data.mv.db

# Start the agent
sudo systemctl start griphook-agent`}
      </CodeBlock>

      <div className="mt-8">
        <InfoBox type="info" title="Backup Tip">
          The Control Center automatically syncs execution data from agents. If you lose agent data,
          historical executions will still be available in the Control Center&apos;s cache.
        </InfoBox>
      </div>
    </div>
  );
}
