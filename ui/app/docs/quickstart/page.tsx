import Link from 'next/link';
import { CodeBlock, InfoBox } from '../components';

export default function QuickStartPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Quick Start</h1>
      <p className="text-[#888] mb-8">
        Get GRIPHOOK up and running in a few minutes. You can run the whole stack with Docker
        Compose, or build the agent JAR and the Next.js UI separately for development.
      </p>

      <InfoBox type="tip" title="What you need">
        Java 21+ for the agent, Node.js 22+ for the UI, Docker (optional but recommended).
        Default ports: agent <code className="text-[#00fff2]">8090</code>, UI <code className="text-[#00fff2]">3000</code>.
      </InfoBox>

      {/* Option 1: Docker Compose */}
      <div className="bg-[#0f0f0f] border border-[#2a2a2a] p-6 mb-8 mt-8">
        <h2 className="text-xl font-bold text-white mb-4">Option 1: Docker Compose (recommended)</h2>
        <p className="text-[#888] mb-4">
          Brings up both the agent and the UI in one command. Use <code className="text-[#00fff2]">docker-compose.local.yml</code> to build from source, or <code className="text-[#00fff2]">docker-compose.prod.yml</code> to pull pre-built images.
        </p>
        <CodeBlock language="bash">
{`# Clone
git clone https://github.com/nullruntime-dev/runner-agent.git
cd runner-agent

# Configure
cp .env.example .env
# Edit .env and set at minimum:
#   AGENT_TOKEN=<a-strong-random-token>
#   GOOGLE_AI_API_KEY=<your-key>     # only if you want Gemini
# If you leave AGENT_TOKEN unset the default is "1234" (dev only).

# Start (build from source, local dev)
docker compose -f docker-compose.local.yml up --build -d

# OR start pre-built images (production)
docker compose -f docker-compose.prod.yml up -d

# Watch logs
docker compose -f docker-compose.local.yml logs -f

# Stop
docker compose -f docker-compose.local.yml down`}
        </CodeBlock>
        <p className="text-[#666] text-sm mt-4">
          Agent: <a href="http://localhost:8090" className="text-[#00fff2] hover:underline">http://localhost:8090</a> &middot; UI: <a href="http://localhost:3000" className="text-[#00fff2] hover:underline">http://localhost:3000</a>
        </p>
      </div>

      {/* Option 2: Local dev (two terminals) */}
      <div className="bg-[#0f0f0f] border border-[#2a2a2a] p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Option 2: Local development (two terminals)</h2>
        <p className="text-[#888] mb-4">
          Best when you&apos;re editing code. Backend with Gradle, UI with <code>next dev</code>.
        </p>

        <h3 className="text-md font-medium text-[#ccc] mb-3">Terminal 1 — Agent</h3>
        <CodeBlock language="bash">
{`# From the repo root
SERVER_PORT=8090 \\
AGENT_TOKEN=your-secret-token \\
GOOGLE_AI_API_KEY=your-google-ai-key \\
./gradlew bootRun`}
        </CodeBlock>

        <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">Terminal 2 — UI</h3>
        <CodeBlock language="bash">
{`cd ui
npm install
npx prisma generate     # required before first run / after schema changes
npm run dev             # http://localhost:3000`}
        </CodeBlock>
        <p className="text-[#666] text-sm mt-4">
          Run two agents on the same machine by giving them different ports:
        </p>
        <CodeBlock language="bash">
{`# In a 3rd terminal, run a second agent on 8091
SERVER_PORT=8091 AGENT_TOKEN=token-two ./gradlew bootRun`}
        </CodeBlock>
      </div>

      {/* First-time setup wizard */}
      <h2 className="text-xl font-bold text-white mb-4 mt-10">First-time setup wizard</h2>
      <p className="text-[#888] mb-4">
        Open the UI at <a href="http://localhost:3000" className="text-[#00fff2] hover:underline">http://localhost:3000</a>. The setup wizard walks you through:
      </p>
      <ol className="list-decimal list-inside text-[#888] space-y-2 mb-6">
        <li>Setting a Google AI API key (optional — only needed for Gemini)</li>
        <li>Generating an agent token</li>
        <li>Registering your first agent by URL and token</li>
      </ol>
      <p className="text-[#888] mb-4">
        The wizard writes to <code className="text-[#00fff2]">../settings.json</code> at the repo root. You can re-run it from <strong>Settings → Setup Wizard</strong> at any time.
      </p>

      {/* Verify */}
      <h2 className="text-xl font-bold text-white mb-4 mt-10">Verify the agent</h2>
      <CodeBlock language="bash">
{`curl http://localhost:8090/health
# {"status":"ok","version":"0.1.0-SNAPSHOT"}`}
      </CodeBlock>

      {/* Register in the UI */}
      <h2 className="text-xl font-bold text-white mb-4 mt-10">Register the agent in the UI</h2>
      <ol className="list-decimal list-inside text-[#888] space-y-2 mb-6">
        <li>Open the UI, complete the setup wizard (or skip it via <code>Settings</code>)</li>
        <li>Go to <Link href="/agents" className="text-[#00fff2] hover:underline">Manage Agents</Link></li>
        <li>Fill in <strong>Name</strong>, <strong>Agent URL</strong> (e.g. <code>http://localhost:8090</code>), and the <strong>API Token</strong> you set above</li>
        <li>Click <strong>Add Agent</strong></li>
      </ol>
      <p className="text-[#888] mb-4">
        The dashboard auto-syncs execution history on load. You can also click <strong>Refresh</strong> in the top bar, or use <code>POST /api/sync</code> to force a sync.
      </p>

      {/* Execute First Command */}
      <h2 className="text-xl font-bold text-white mb-4 mt-10">Submit your first execution</h2>
      <p className="text-[#888] mb-4">
        Either from the UI (per-agent → New Execution) or directly via the API:
      </p>
      <CodeBlock language="bash">
{`curl -X POST http://localhost:8090/execute \\
  -H "Authorization: Bearer your-secret-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Hello World",
    "steps": [
      {"name": "Echo", "run": "echo Hello from GRIPHOOK!"},
      {"name": "Date", "run": "date"}
    ]
  }'`}
      </CodeBlock>
      <p className="text-[#888] text-sm mt-2">
        The response includes an <code>id</code> — visit <code>/executions/&#123;id&#125;</code> in the UI (or your agent) to see live logs.
      </p>

      {/* AI Chat */}
      <h2 className="text-xl font-bold text-white mb-4 mt-10">Try AI chat</h2>
      <p className="text-[#888] mb-4">
        Click <strong>AI CHAT</strong> in the top bar. Example prompts:
      </p>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>&quot;List recent executions&quot;</li>
        <li>&quot;Run <code>echo hello world</code>&quot;</li>
        <li>&quot;What&apos;s the status of the last deployment?&quot;</li>
        <li>&quot;Send a Slack message saying deployment complete&quot; (requires Slack skill configured)</li>
        <li>&quot;Help me reply to Sarah who said she loves hiking&quot; (Wingman mode)</li>
      </ul>
      <p className="text-[#888] mb-4">
        Provider and model are configured in <strong>Settings → AI Configuration</strong>. Changes apply on the next request, no restart.
      </p>

      {/* Next steps */}
      <h2 className="text-xl font-bold text-white mb-4 mt-10">Next steps</h2>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>Set up skills (Slack, Gmail, web search) — <Link href="/docs/configuration" className="text-[#00fff2] hover:underline">Configuration</Link></li>
        <li>Deploy to production — <Link href="/docs/deployment" className="text-[#00fff2] hover:underline">Deployment</Link></li>
        <li>Wire CI/CD to the execution API — <Link href="/docs/api" className="text-[#00fff2] hover:underline">API Reference</Link></li>
        <li>Back up the database — <Link href="/docs/backup" className="text-[#00fff2] hover:underline">Backup &amp; Database</Link></li>
      </ul>
    </div>
  );
}
