import Link from 'next/link';
import { CodeBlock, InfoBox } from '../components';

export default function MigrationPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Migration</h1>
      <p className="text-[#888] mb-8">
        Move GRIPHOOK components to a new server, upgrade versions, or change agent URLs.
      </p>

      <InfoBox type="warning" title="Always snapshot first">
        Back up both databases (<code>ui/data/runner.db</code> and the agent&apos;s PostgreSQL database) before any
        migration. Test in staging if possible. The agent PostgreSQL schema auto-evolves via{' '}
        <code>ddl-auto: update</code>; the Control Center uses Prisma migrations.
      </InfoBox>

      <h2 className="text-xl font-bold text-white mb-4">Move the Control Center to a new host</h2>
      <CodeBlock language="bash">
{`# On the OLD host
sudo systemctl stop griphook-ui
sqlite3 /opt/griphook-ui/data/runner.db ".backup '/tmp/runner.db.backup'"
cp ../settings.json /tmp/settings.json       # one level up from ui/
scp /tmp/runner.db.backup /tmp/settings.json newhost:/tmp/

# On the NEW host — install Node 22+, clone the repo
cd /opt/griphook-ui  # or wherever
cp /tmp/runner.db.backup data/runner.db
cp /tmp/settings.json ../settings.json

npm install
npx prisma generate
npm run build
npm start           # or use a systemd unit (see Deployment docs)

# Then register every agent in the UI; tokens don&apos;t migrate with the JSON export
# (Settings → Database → Download JSON strips them for safety).`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Move an agent to a new host</h2>
      <CodeBlock language="bash">
{`# On the OLD host
sudo systemctl stop griphook-agent
pg_dump -U runner -d runner -h localhost > /tmp/agent.sql
scp /tmp/agent.sql newhost:/tmp/

# On the NEW host — install the JAR and systemd unit (see Deployment)
# Restore the database
psql -U runner -d runner -h localhost < /tmp/agent.sql
sudo systemctl start griphook-agent

# Update the Control Center
# 1. Open Manage Agents
# 2. Click Edit on the moved agent
# 3. Change the URL to https://newhost:8090
# 4. Save
# Executions stay mirrored in the UI cache; new ones sync automatically.`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Change an agent&apos;s URL (same host, new port)</h2>
      <ol className="list-decimal list-inside text-[#888] space-y-2 mb-6">
        <li>Open the <Link href="/agents" className="text-[#00fff2] hover:underline">Manage Agents</Link> page</li>
        <li>Click <strong>Edit</strong> on the agent</li>
        <li>Update the <strong>Agent URL</strong> field</li>
        <li>If the backend now uses a different token, paste it into the <strong>API Token</strong> field too</li>
        <li>Click <strong>Save Changes</strong></li>
      </ol>
      <p className="text-[#888] text-sm">
        Execution history is preserved in the Control Center&apos;s cache; new executions will sync against
        the new URL on the next <code>/api/sync</code> call.
      </p>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Upgrade the version</h2>
      <p className="text-[#888] mb-4">Standard upgrade flow:</p>
      <CodeBlock language="bash">
{`# Pull
cd runner-agent
git pull origin main

# Backend (rebuilds the JAR; PostgreSQL auto-migrates schema on start)
./gradlew clean bootJar
sudo systemctl restart griphook-agent

# Control Center
cd ui
npm install
npx prisma generate          # required after any prisma/schema.prisma change
npm run build
sudo systemctl restart griphook-ui    # or however you run the UI`}
      </CodeBlock>

      <InfoBox type="info" title="Schema migrations">
        The Control Center ships a single migration at <code>prisma/migrations/20260228064205_init</code>.
        In Docker, <code>docker-entrypoint.sh</code> applies it directly with <code>sqlite3</code> rather than{' '}
        <code>prisma migrate deploy</code> — the SQL is identical. Locally,{' '}
        <code>npx prisma generate</code> is all you need for the first run; for schema changes, generate a new
        migration and apply it.
      </InfoBox>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Run two agents on the same host</h2>
      <p className="text-[#888] mb-4">
        Useful for testing blue/green, canary deploys, or running prod + staging on one box. Each
        agent needs a different port, working directory, and token. They share the same Postgres
        database (the schema is per-tenant via the <code>agent</code> column on shared tables).
      </p>
      <CodeBlock language="bash">
{`# Agent A on 8090
SERVER_PORT=8090 \\
AGENT_TOKEN=token-A \\
SPRING_DATASOURCE_URL='jdbc:postgresql://localhost:5432/runner' \\
AGENT_WORKING_DIR=/opt/agent-a \\
./gradlew bootRun

# Agent B on 8091
SERVER_PORT=8091 \\
AGENT_TOKEN=token-B \\
SPRING_DATASOURCE_URL='jdbc:postgresql://localhost:5432/runner' \\
AGENT_WORKING_DIR=/opt/agent-b \\
./gradlew bootRun`}
      </CodeBlock>
      <p className="text-[#888] text-sm mt-2">
        Then add both to the UI (Manage Agents → Add New Agent).
      </p>
    </div>
  );
}
