import { CodeBlock, InfoBox } from '../components';

export default function MigrationPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Migration</h1>
      <p className="text-neutral-400 mb-8">
        Move Runner Agent components to new servers or upgrade to new versions.
      </p>

      <h2 className="text-xl font-bold text-white mb-4">Migrate Control Center</h2>
      <p className="text-neutral-400 mb-4">
        Transfer the SQLite database and configuration to a new server.
      </p>
      <CodeBlock language="bash">
{`# On OLD server
sudo systemctl stop runner-control-center
sqlite3 /opt/runner-ui/data/runner.db ".backup '/tmp/runner.db.backup'"
scp /tmp/runner.db.backup newserver:/tmp/

# On NEW server
# Install Node.js 22+, clone repo, npm install, npm run build

mkdir -p /opt/runner-ui/data
cp /tmp/runner.db.backup /opt/runner-ui/data/runner.db

# Run migrations if upgrading
cd /opt/runner-ui
npx prisma migrate deploy

sudo systemctl start runner-control-center`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Migrate Agent</h2>
      <p className="text-neutral-400 mb-4">
        Preserve execution history when moving to a new server.
      </p>
      <CodeBlock language="bash">
{`# On OLD server
sudo systemctl stop runner-agent
scp /opt/runner-agent/agent-data.mv.db newserver:/opt/runner-agent/
scp /opt/runner-agent/runner-agent.jar newserver:/opt/runner-agent/

# On NEW server
# Set up systemd service (see Deployment docs)
sudo systemctl start runner-agent

# Update Control Center
# Go to /agents and update the agent URL`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Schema Migrations</h2>
      <p className="text-neutral-400 mb-4">
        When upgrading to a new version with schema changes:
      </p>
      <CodeBlock language="bash">
{`# Pull latest version
git pull origin main

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# Rebuild
npm run build

# Restart
sudo systemctl restart runner-control-center`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Change Agent URL</h2>
      <p className="text-neutral-400 mb-4">
        If you change an agent&apos;s IP or hostname:
      </p>
      <ol className="list-decimal list-inside text-neutral-400 space-y-2 mb-6">
        <li>Go to the Control Center dashboard</li>
        <li>Navigate to <code className="text-amber-400">/agents</code></li>
        <li>Delete the old agent entry</li>
        <li>Add the agent again with the new URL</li>
      </ol>
      <p className="text-neutral-400 text-sm">
        Note: Execution history is preserved in the Control Center&apos;s cache even after re-adding.
      </p>

      <div className="mt-8">
        <InfoBox type="warning" title="Migration Warning">
          Always backup databases before migration. Test in staging first.
          The agent H2 database uses <code>ddl-auto: update</code> which auto-migrates on startup.
        </InfoBox>
      </div>
    </div>
  );
}
