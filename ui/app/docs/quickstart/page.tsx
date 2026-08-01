import Link from 'next/link';
import { CodeBlock, InfoBox } from '../components';

export default function QuickStartPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Quick Start</h1>
      <p className="text-[#888] mb-8">
        Get GRIPHOOK up and running in a few minutes. The fastest path is Docker Compose &mdash;
        one command brings up Postgres, the agent, and the UI. For development, run the agent and
        UI separately.
      </p>

      <InfoBox type="tip" title="What you need">
        Docker (with the Compose plugin). Default ports: agent{' '}
        <code className="text-[#00fff2]">8090</code>, UI{' '}
        <code className="text-[#00fff2]">3000</code>. For local dev without Docker: Java 21+ and
        Node.js 22+.
      </InfoBox>

      {/* Option 1: Docker Compose */}
      <h2 className="text-xl font-bold text-white mb-4 mt-10">Option 1 &mdash; Docker Compose</h2>
      <p className="text-[#888] mb-4">
        Use <code className="text-[#00fff2]">docker-compose.local.yml</code> to build from source,
        or <code className="text-[#00fff2]">docker-compose.prod.yml</code> to pull pre-built images.
        Both bring up Postgres, the agent, and the UI on a shared network.
      </p>
      <CodeBlock language="bash">
{`# Clone
git clone https://github.com/nullruntime-dev/runner-agent.git
cd runner-agent

# Configure (required: AGENT_TOKEN)
cp .env.example .env
#   Set AGENT_TOKEN to a strong random string. Default "1234" is dev-only.
#   AI provider, skills, and everything else are optional &mdash; configure later from the UI.

# Start (build from source)
docker compose -f docker-compose.local.yml up --build -d

# ...or pull pre-built images
docker compose -f docker-compose.prod.yml up -d

# Watch logs
docker compose -f docker-compose.local.yml logs -f

# Stop
docker compose -f docker-compose.local.yml down`}
      </CodeBlock>
      <p className="text-[#666] text-sm mt-4">
        Agent: <a href="http://localhost:8090" className="text-[#00fff2] hover:underline">http://localhost:8090</a>{' '}
        &middot; UI:{' '}
        <a href="http://localhost:3000" className="text-[#00fff2] hover:underline">http://localhost:3000</a>
      </p>

      {/* Option 2: Local dev */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Option 2 &mdash; Local development</h2>
      <p className="text-[#888] mb-4">
        Best when editing code. The agent runs under Gradle, the UI under <code>next dev</code>.
        You&apos;ll also need the standalone Postgres from <code>docker-compose.postgres.yml</code>.
      </p>

      <h3 className="text-base font-medium text-[#ccc] mb-3">Terminal 1 &mdash; Postgres</h3>
      <CodeBlock language="bash">
{`docker compose -f docker-compose.postgres.yml up -d`}
      </CodeBlock>

      <h3 className="text-base font-medium text-[#ccc] mb-3 mt-6">Terminal 2 &mdash; Agent</h3>
      <CodeBlock language="bash">
{`# From the repo root
SERVER_PORT=8090 \\
AGENT_TOKEN=your-secret-token \\
./gradlew bootRun`}
      </CodeBlock>

      <h3 className="text-base font-medium text-[#ccc] mb-3 mt-6">Terminal 3 &mdash; UI</h3>
      <CodeBlock language="bash">
{`cd ui
npm install
npx prisma generate     # required before first run / after schema changes
npm run dev             # http://localhost:3000`}
      </CodeBlock>
      <p className="text-[#666] text-sm mt-4">
        Run a second agent on the same machine by giving it a different port:
      </p>
      <CodeBlock language="bash">
{`SERVER_PORT=8091 AGENT_TOKEN=token-two ./gradlew bootRun`}
      </CodeBlock>

      {/* First-time setup wizard */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">First-time setup wizard</h2>
      <p className="text-[#888] mb-4">
        Open the UI at{' '}
        <a href="http://localhost:3000" className="text-[#00fff2] hover:underline">http://localhost:3000</a>.
        The setup wizard launches on first run and asks you to connect your first agent:
      </p>
      <ol className="list-decimal list-inside text-[#888] space-y-2 mb-6">
        <li><strong>Agent name</strong> &mdash; any label, e.g. &ldquo;Production&rdquo;</li>
        <li><strong>Agent URL</strong> &mdash; <code className="text-[#00fff2]">http://agent:8090</code> from the compose network, or <code className="text-[#00fff2]">http://localhost:8090</code> for local dev</li>
        <li><strong>Agent token</strong> &mdash; the <code className="text-[#00fff2]">AGENT_TOKEN</code> from your <code>.env</code></li>
      </ol>
      <InfoBox type="tip" title="AI configuration is optional">
        The wizard only connects an agent. AI provider (Gemini or Ollama) and model are configured
        later from <strong>Settings &rarr; AI Configuration</strong> &mdash; both are optional and
        can be changed at any time without a restart.
      </InfoBox>
      <p className="text-[#888] mt-4">
        Re-run the wizard anytime from <strong>Settings &rarr; Setup Wizard</strong>, or add more
        agents via <Link href="/agents" className="text-[#00fff2] hover:underline">Manage Agents</Link>.
      </p>

      {/* Verify */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Verify the agent</h2>
      <CodeBlock language="bash">
{`curl http://localhost:8090/health
# {"status":"ok","version":"0.1.0-SNAPSHOT"}`}
      </CodeBlock>

      {/* Execute First Command */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Submit your first execution</h2>
      <p className="text-[#888] mb-4">
        From the UI (per-agent &rarr; New Execution) or directly via the API:
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
        The response includes an <code>id</code> &mdash; open{' '}
        <code>/executions/&#123;id&#125;</code> in the UI to see live logs.
      </p>

      {/* AI Chat */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Try AI chat</h2>
      <p className="text-[#888] mb-4">
        Click <strong>AI CHAT</strong> in the top bar. Example prompts:
      </p>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>&ldquo;List recent executions&rdquo;</li>
        <li>&ldquo;Run <code>echo hello world</code>&rdquo;</li>
        <li>&ldquo;What&apos;s the status of the last deployment?&rdquo;</li>
        <li>&ldquo;Send a Slack message saying deployment complete&rdquo; (requires Slack skill)</li>
        <li>&ldquo;Help me reply to Sarah who said she loves hiking&rdquo; (Wingman mode)</li>
      </ul>
      <p className="text-[#888]">
        Provider and model are in <strong>Settings &rarr; AI Configuration</strong>. Changes apply on
        the next request &mdash; no restart.
      </p>

      {/* Next steps */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Next steps</h2>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>Set up skills (Slack, Gmail, web search) &mdash; <Link href="/docs/configuration" className="text-[#00fff2] hover:underline">Configuration</Link></li>
        <li>Deploy to production &mdash; <Link href="/docs/deployment" className="text-[#00fff2] hover:underline">Deployment</Link></li>
        <li>Wire CI/CD to the execution API &mdash; <Link href="/docs/api" className="text-[#00fff2] hover:underline">API Reference</Link></li>
        <li>Back up the database &mdash; <Link href="/docs/backup" className="text-[#00fff2] hover:underline">Backup &amp; Database</Link></li>
      </ul>
    </div>
  );
}
