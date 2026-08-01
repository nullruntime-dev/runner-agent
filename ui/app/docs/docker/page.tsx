import Link from 'next/link';
import { CodeBlock, InfoBox } from '../components';

export default function DockerPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Docker</h1>
      <p className="text-[#888] mb-8">
        Docker is the recommended way to run GRIPHOOK. The repo ships three Compose files: a full
        local-dev stack, a production stack with pre-built images, and a standalone Postgres for
        when you run the agent on the host. All services share a single{' '}
        <code className="text-[#00fff2]">runner-agent-net</code> network so the UI can reach agents
        by service name.
      </p>

      {/* Prerequisites */}
      <h2 className="text-xl font-bold text-white mb-4">Prerequisites</h2>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>Docker Engine 24+ with the Compose plugin (v2)</li>
        <li>Verify with <code>docker compose version</code></li>
        <li>Linux has native Docker; macOS and Windows use Docker Desktop (Windows needs WSL 2 first)</li>
      </ul>
      <InfoBox type="info" title="Installing Docker">
        Follow the official Docker docs for your platform:{' '}
        <a href="https://docs.docker.com/engine/install/" target="_blank" rel="noopener noreferrer" className="text-[#00fff2] hover:underline">Linux</a>{' '}
        &middot;{' '}
        <a href="https://docs.docker.com/desktop/install/mac-install/" target="_blank" rel="noopener noreferrer" className="text-[#00fff2] hover:underline">macOS</a>{' '}
        &middot;{' '}
        <a href="https://docs.docker.com/desktop/install/windows-install/" target="_blank" rel="noopener noreferrer" className="text-[#00fff2] hover:underline">Windows</a>{' '}
        (install <a href="https://learn.microsoft.com/en-us/windows/wsl/install" target="_blank" rel="noopener noreferrer" className="text-[#00fff2] hover:underline">WSL 2</a> first on Windows).
      </InfoBox>

      {/* The .env file */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">The <code className="text-[#00fff2]">.env</code> file</h2>
      <p className="text-[#888] mb-4">
        All configuration flows through a single <code>.env</code> file next to your Compose file.
        Copy <code>.env.example</code> and edit the values. Only{' '}
        <strong className="text-white">AGENT_TOKEN</strong> is required &mdash; everything else has
        sensible defaults or can be set later from the UI&apos;s Settings page.
      </p>
      <CodeBlock language="bash">
{`cp .env.example .env`}
      </CodeBlock>
      <p className="text-[#888] mt-4 mb-2">Key variables:</p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left py-3 px-4 text-[#888]">Variable</th>
              <th className="text-left py-3 px-4 text-[#888]">Required</th>
              <th className="text-left py-3 px-4 text-[#888]">Description</th>
            </tr>
          </thead>
          <tbody className="text-[#ccc]">
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#ff6600]">AGENT_TOKEN</td>
              <td className="py-3 px-4 text-[#ff0044]">Yes</td>
              <td className="py-3 px-4 text-[#888]">Secret token for API auth and the setup wizard. Default <code>1234</code> (dev only).</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#ff6600]">AGENT_ADK_PROVIDER</td>
              <td className="py-3 px-4 text-[#444]">No</td>
              <td className="py-3 px-4 text-[#888]"><code>ollama</code> (default) or <code>gemini</code>. Switchable at runtime from the UI.</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#ff6600]">GOOGLE_AI_API_KEY</td>
              <td className="py-3 px-4 text-[#444]">No</td>
              <td className="py-3 px-4 text-[#888]">Only needed when <code>AGENT_ADK_PROVIDER=gemini</code>.</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#ff6600]">OLLAMA_BASE_URL</td>
              <td className="py-3 px-4 text-[#444]">No</td>
              <td className="py-3 px-4 text-[#888]">Default <code>http://127.0.0.1:11434</code>. From inside a container, use <code>http://host.docker.internal:11434</code>.</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#ff6600]">AGENT_WORKING_DIR</td>
              <td className="py-3 px-4 text-[#444]">No</td>
              <td className="py-3 px-4 text-[#888]">Where the agent runs shell commands. Default <code>/tmp</code>.</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#ff6600]">SLACK_* / GMAIL_* / SMTP_*</td>
              <td className="py-3 px-4 text-[#444]">No</td>
              <td className="py-3 px-4 text-[#888]">Optional skill credentials. See <Link href="/docs/configuration" className="text-[#00fff2] hover:underline">Configuration</Link>.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <InfoBox type="tip" title="Minimal .env">
        For a first run, a one-line <code>.env</code> is enough:{' '}
        <code className="text-[#00fff2]">AGENT_TOKEN=change-me</code>. Everything else can be
        configured from the UI later.
      </InfoBox>

      {/* Compose files */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">The three Compose files</h2>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left py-3 px-4 text-[#888]">File</th>
              <th className="text-left py-3 px-4 text-[#888]">Services</th>
              <th className="text-left py-3 px-4 text-[#888]">Use case</th>
            </tr>
          </thead>
          <tbody className="text-[#ccc]">
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#00fff2]">docker-compose.local.yml</td>
              <td className="py-3 px-4 text-[#888]">postgres, agent-1, agent-2, ui</td>
              <td className="py-3 px-4 text-[#888]">Local dev &mdash; builds from source, includes two agents</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#00fff2]">docker-compose.prod.yml</td>
              <td className="py-3 px-4 text-[#888]">agent, ui</td>
              <td className="py-3 px-4 text-[#888]">Production &mdash; pulls pre-built images, expects external Postgres</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#00fff2]">docker-compose.postgres.yml</td>
              <td className="py-3 px-4 text-[#888]">postgres</td>
              <td className="py-3 px-4 text-[#888]">Standalone Postgres &mdash; for when agents run on the host</td>
            </tr>
          </tbody>
        </table>
      </div>
      <InfoBox type="warning" title="Don&apos;t run two stacks at once">
        <code>docker-compose.local.yml</code> and <code>docker-compose.postgres.yml</code> both
        define a network and volume named <code>runner-agent-net</code> /{' '}
        <code>postgres-data</code>. Run <strong>one or the other</strong>, not both &mdash; otherwise
        Compose will fail trying to create duplicate resources. The <code>local</code> file already
        includes its own Postgres.
      </InfoBox>

      {/* Local dev */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Local development (build from source)</h2>
      <p className="text-[#888] mb-4">
        Brings up Postgres, two agents (<code>agent-1</code> on 8090, <code>agent-2</code> on 8091),
        and the UI on 3000 &mdash; all built from source.
      </p>
      <CodeBlock language="bash">
{`git clone https://github.com/nullruntime-dev/runner-agent.git
cd runner-agent
cp .env.example .env
#   Set AGENT_TOKEN to a strong random string.

docker compose -f docker-compose.local.yml up --build -d

# Watch logs
docker compose -f docker-compose.local.yml logs -f

# Rebuild after code changes
docker compose -f docker-compose.local.yml up --build -d

# Stop
docker compose -f docker-compose.local.yml down`}
      </CodeBlock>
      <p className="text-[#666] text-sm mt-4">
        Agent 1: <a href="http://localhost:8090" className="text-[#00fff2] hover:underline">http://localhost:8090</a>{' '}
        &middot; Agent 2:{' '}
        <a href="http://localhost:8091" className="text-[#00fff2] hover:underline">http://localhost:8091</a>{' '}
        &middot; UI:{' '}
        <a href="http://localhost:3000" className="text-[#00fff2] hover:underline">http://localhost:3000</a>
      </p>

      {/* Production */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Production (pre-built images)</h2>
      <p className="text-[#888] mb-4">
        Pulls <code>nullruntimedev/griphook-agent</code> and <code>nullruntimedev/griphook-ui</code>{' '}
        from Docker Hub. Expects an external Postgres on the{' '}
        <code>runner-agent-net</code> network &mdash; bring it up first with{' '}
        <code>docker-compose.postgres.yml</code>.
      </p>
      <CodeBlock language="bash">
{`git clone https://github.com/nullruntime-dev/runner-agent.git
cd runner-agent
cp .env.example .env
#   Set AGENT_TOKEN and any skill credentials you need.

# 1. Bring up Postgres (one-time, or after down -v)
docker compose -f docker-compose.postgres.yml up -d

# 2. Bring up the agent + UI
docker compose -f docker-compose.prod.yml up -d

# Watch logs
docker compose -f docker-compose.prod.yml logs -f`}
      </CodeBlock>
      <InfoBox type="info" title="Why two files for production?">
        <code>docker-compose.prod.yml</code> declares the <code>runner-agent-net</code> network as{' '}
        <code>external: true</code> &mdash; it expects Postgres to already be running on it. This
        lets you restart the agent and UI without touching the database.{' '}
        <code>docker-compose.postgres.yml</code> creates that network and volume.
      </InfoBox>

      {/* Services */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Services</h2>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left py-3 px-4 text-[#888]">Service</th>
              <th className="text-left py-3 px-4 text-[#888]">Host port</th>
              <th className="text-left py-3 px-4 text-[#888]">Container port</th>
              <th className="text-left py-3 px-4 text-[#888]">Image</th>
            </tr>
          </thead>
          <tbody className="text-[#ccc]">
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4"><code className="text-[#00fff2]">postgres</code></td>
              <td className="py-3 px-4">5432</td>
              <td className="py-3 px-4">5432</td>
              <td className="py-3 px-4"><code>postgres:16-alpine</code></td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4"><code className="text-[#00fff2]">agent-1</code></td>
              <td className="py-3 px-4">8090</td>
              <td className="py-3 px-4">8009</td>
              <td className="py-3 px-4"><code>nullruntimedev/griphook-agent</code></td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4"><code className="text-[#00fff2]">agent-2</code></td>
              <td className="py-3 px-4">8091</td>
              <td className="py-3 px-4">8009</td>
              <td className="py-3 px-4"><code>nullruntimedev/griphook-agent</code></td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4"><code className="text-[#00fff2]">ui</code></td>
              <td className="py-3 px-4">3000</td>
              <td className="py-3 px-4">3000</td>
              <td className="py-3 px-4"><code>nullruntimedev/griphook-ui</code></td>
            </tr>
          </tbody>
        </table>
      </div>
      <InfoBox type="info" title="Container port vs host port">
        The agent listens on <code>8009</code> inside the container (the default in{' '}
        <code>application.yml</code>). Compose maps it to <code>8090</code> on the host. Inside the{' '}
        <code>runner-agent-net</code> network, the UI reaches the agent at{' '}
        <code>http://agent-1:8009</code> &mdash; not <code>8090</code>. The host port only matters
        for direct <code>curl</code> access from outside Docker.
      </InfoBox>

      {/* Multi-agent */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Running multiple agents</h2>
      <p className="text-[#888] mb-4">
        The UI is a control plane &mdash; one UI can manage many agents.{' '}
        <code>docker-compose.local.yml</code> already ships with two (<code>agent-1</code> and{' '}
        <code>agent-2</code>). To add a third, duplicate the <code>agent-2</code> service block,
        give it a unique name and host port, and connect it to the same network:
      </p>
      <CodeBlock language="yaml">
{`  agent-3:
    build:
      context: .
      dockerfile: Dockerfile
    image: test-agent-3
    container_name: griphookdev-agent-3
    restart: unless-stopped
    ports:
      - "8092:8009"
    environment:
      - AGENT_TOKEN=\${AGENT_TOKEN:-1234}
      - SPRING_PROFILES_ACTIVE=production
      - SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/runner
      - SPRING_DATASOURCE_USERNAME=runner
      - SPRING_DATASOURCE_PASSWORD=runner
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - runner-agent-net`}
      </CodeBlock>
      <p className="text-[#888] mt-4 mb-4">
        Then register each agent in the UI:
      </p>
      <ol className="list-decimal list-inside text-[#888] space-y-2 mb-6">
        <li>Open the UI at <code className="text-[#00fff2]">http://localhost:3000</code> &mdash; the setup wizard appears on first run.</li>
        <li>Enter the agent URL as <code className="text-[#00fff2]">http://agent-1:8009</code> (service name + container port, not the host port).</li>
        <li>Paste the <code className="text-[#00fff2]">AGENT_TOKEN</code> from your <code>.env</code>.</li>
        <li>Repeat for <code className="text-[#00fff2]">http://agent-2:8009</code>, <code className="text-[#00fff2]">http://agent-3:8009</code>, etc.</li>
      </ol>
      <p className="text-[#888]">
        All agents share the same Postgres database for history. Add more via{' '}
        <Link href="/agents" className="text-[#00fff2] hover:underline">Manage Agents &rarr; Add</Link>{' '}
        at any time.
      </p>

      {/* Connecting to Ollama */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Connecting to Ollama</h2>
      <p className="text-[#888] mb-4">
        If you&apos;re running Ollama on the host (not in a container), the agent container can&apos;t
        reach <code>127.0.0.1</code>. Use Docker&apos;s special hostname instead:
      </p>
      <CodeBlock language="bash">
{`# In your .env
OLLAMA_BASE_URL=http://host.docker.internal:11434`}
      </CodeBlock>
      <p className="text-[#888] mt-2">
        On Linux, add <code>--add-host=host.docker.internal:host-gateway</code> to the agent service
        (or use <code>extra_hosts</code> in Compose) since Linux doesn&apos;t resolve it by default.
      </p>

      {/* Volumes & persistence */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Volumes &amp; persistence</h2>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left py-3 px-4 text-[#888]">Volume</th>
              <th className="text-left py-3 px-4 text-[#888]">Used by</th>
              <th className="text-left py-3 px-4 text-[#888]">Holds</th>
            </tr>
          </thead>
          <tbody className="text-[#ccc]">
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#00fff2]">postgres-data</td>
              <td className="py-3 px-4 text-[#888]">postgres</td>
              <td className="py-3 px-4 text-[#888]">All agent state &mdash; executions, logs, skills, chat history</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#00fff2]">ui-data</td>
              <td className="py-3 px-4 text-[#888]">ui</td>
              <td className="py-3 px-4 text-[#888]">SQLite cache of agents + mirrored executions</td>
            </tr>
          </tbody>
        </table>
      </div>
      <CodeBlock language="bash">
{`# Stop and remove containers (keeps data)
docker compose -f docker-compose.local.yml down

# Wipe the Postgres data volume too (fresh start)
docker compose -f docker-compose.local.yml down -v`}
      </CodeBlock>
      <InfoBox type="warning" title="down -v is destructive">
        <code>down -v</code> deletes the <code>postgres-data</code> volume &mdash; all execution
        history, skills, and chat sessions are lost. Back up first (see{' '}
        <Link href="/docs/backup" className="text-[#00fff2] hover:underline">Backup &amp; Database</Link>).
      </InfoBox>

      {/* Health checks */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Health checks</h2>
      <CodeBlock language="bash">
{`# Check all containers
docker compose -f docker-compose.local.yml ps

# Agent health endpoint
curl http://localhost:8090/health
# {"status":"ok","version":"0.1.0-SNAPSHOT"}

# UI
curl -I http://localhost:3000/`}
      </CodeBlock>
      <p className="text-[#888] mt-4">
        The agent and UI services both have <code>healthcheck</code> entries in Compose. The UI&apos;s{' '}
        <code>depends_on</code> uses <code>condition: service_healthy</code>, so it won&apos;t start
        until the agent is responding.
      </p>

      {/* Resource limits */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Resource limits</h2>
      <p className="text-[#888] mb-4">
        The Compose files set memory limits via <code>deploy.resources.limits.memory</code>:
      </p>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li><code className="text-[#00fff2]">postgres</code> &mdash; 512 MB</li>
        <li><code className="text-[#00fff2]">agent</code> &mdash; 1 GB (each)</li>
      </ul>
      <p className="text-[#888]">
        On Docker Desktop (macOS / Windows), also bump the VM&apos;s total memory in{' '}
        <strong>Settings &rarr; Resources</strong> &mdash; the default 2 GB is too low for the full
        stack. 4 GB is a safe minimum.
      </p>

      {/* Next steps */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Next steps</h2>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>Configure AI and skills &mdash; <Link href="/docs/configuration" className="text-[#00fff2] hover:underline">Configuration</Link></li>
        <li>Back up the database &mdash; <Link href="/docs/backup" className="text-[#00fff2] hover:underline">Backup &amp; Database</Link></li>
        <li>Move or scale the stack &mdash; <Link href="/docs/migration" className="text-[#00fff2] hover:underline">Migration</Link></li>
        <li>Troubleshoot container issues &mdash; <Link href="/docs/troubleshooting" className="text-[#00fff2] hover:underline">Troubleshooting</Link></li>
      </ul>
    </div>
  );
}