import { CodeBlock } from '../components';

export default function QuickStartPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Quick Start</h1>
      <p className="text-[#888] mb-8">
        Get GRIPHOOK up and running in minutes. Choose between Docker Compose (recommended) or building from source.
      </p>

      {/* Option 1: Docker Compose */}
      <div className="bg-[#0f0f0f] border border-[#2a2a2a] p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Option 1: Docker Compose (Recommended)</h2>
        <p className="text-[#888] mb-4">
          The fastest way to get started. Runs both the backend agent and the UI.
        </p>
        <CodeBlock language="bash">
{`# Clone the repository
git clone https://github.com/nullruntime-dev/runner-agent.git
cd runner-agent

# Configure environment
cp .env.example .env
# Edit .env and set AGENT_TOKEN and GOOGLE_AI_API_KEY

# Start with Docker Compose (local development with build)
docker compose -f docker-compose.local.yml up -d

# Or use pre-built images (production)
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.local.yml logs -f`}
        </CodeBlock>
        <p className="text-[#666] text-sm mt-4">
          Backend runs on <code className="text-[#00fff2]">http://localhost:8090</code>, UI on <code className="text-[#00fff2]">http://localhost:3000</code>
        </p>
      </div>

      {/* Option 2: JAR File */}
      <div className="bg-[#0f0f0f] border border-[#2a2a2a] p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Option 2: Build from Source (JAR)</h2>
        <p className="text-[#888] mb-4">
          Build and run the backend JAR directly. Requires Java 21+.
        </p>
        <CodeBlock language="bash">
{`# Clone and build
git clone https://github.com/nullruntime-dev/runner-agent.git
cd runner-agent
./gradlew bootJar

# Run the JAR (requires GOOGLE_AI_API_KEY for AI chat)
AGENT_TOKEN=your-secret-token \\
GOOGLE_AI_API_KEY=your-google-ai-key \\
java -jar build/libs/runner-agent-0.1.0-SNAPSHOT.jar

# Or run directly with Gradle
AGENT_TOKEN=your-secret-token \\
GOOGLE_AI_API_KEY=your-google-ai-key \\
./gradlew bootRun`}
        </CodeBlock>

        <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">Start the UI (separate terminal)</h3>
        <CodeBlock language="bash">
{`cd ui
npm install
npm run dev`}
        </CodeBlock>
      </div>

      {/* Verify Installation */}
      <h2 className="text-xl font-bold text-white mb-4">Verify Installation</h2>
      <p className="text-[#888] mb-4">
        Check that the agent is running:
      </p>
      <CodeBlock language="bash">
{`curl http://localhost:8090/health

# Expected response:
# {"status":"ok","version":"0.1.0"}`}
      </CodeBlock>

      {/* Execute First Command */}
      <h2 className="text-xl font-bold text-white mb-4 mt-10">Execute Your First Command</h2>
      <p className="text-[#888] mb-4">
        Submit an execution via the API:
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

      {/* AI Chat */}
      <h2 className="text-xl font-bold text-white mb-4 mt-10">Try AI Chat</h2>
      <p className="text-[#888] mb-4">
        Open the UI at <code className="text-[#00fff2]">http://localhost:3000</code> and click <code className="text-[#ff6600]">AI CHAT</code> in the header.
      </p>
      <p className="text-[#888] mb-4">Example prompts:</p>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>&quot;Run echo hello world&quot;</li>
        <li>&quot;List recent executions&quot;</li>
        <li>&quot;What&apos;s the status of the last deployment?&quot;</li>
        <li>&quot;Send a Slack message saying deployment complete&quot; (requires Slack skill)</li>
      </ul>

      {/* Environment Variables */}
      <h2 className="text-xl font-bold text-white mb-4 mt-10">Environment Variables</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left py-3 px-4 text-[#888]">Variable</th>
              <th className="text-left py-3 px-4 text-[#888]">Required</th>
              <th className="text-left py-3 px-4 text-[#888]">Default</th>
              <th className="text-left py-3 px-4 text-[#888]">Description</th>
            </tr>
          </thead>
          <tbody className="text-[#ccc]">
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4"><code className="text-[#00fff2]">AGENT_TOKEN</code></td>
              <td className="py-3 px-4">No</td>
              <td className="py-3 px-4"><code>1234</code></td>
              <td className="py-3 px-4">API authentication token</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4"><code className="text-[#00fff2]">GOOGLE_AI_API_KEY</code></td>
              <td className="py-3 px-4">Yes (for AI)</td>
              <td className="py-3 px-4">—</td>
              <td className="py-3 px-4">Google AI API key for Gemini</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4"><code className="text-[#00fff2]">SERVER_PORT</code></td>
              <td className="py-3 px-4">No</td>
              <td className="py-3 px-4"><code>8090</code></td>
              <td className="py-3 px-4">Backend server port</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4"><code className="text-[#00fff2]">AGENT_ADK_MODEL</code></td>
              <td className="py-3 px-4">No</td>
              <td className="py-3 px-4"><code>gemini-2.0-flash</code></td>
              <td className="py-3 px-4">Gemini model ID</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[#666] text-sm mt-4">
        See <code className="text-[#888]">.env.example</code> for all available options including Slack, Gmail, and SMTP configuration.
      </p>

      {/* Next Steps */}
      <h2 className="text-xl font-bold text-white mb-4 mt-10">Next Steps</h2>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>Configure skills (Slack, Gmail, SMTP) from the <a href="/docs/configuration" className="text-[#00fff2] hover:underline">Configuration</a> page</li>
        <li>Set up production deployment with <a href="/docs/deployment" className="text-[#00fff2] hover:underline">systemd or Docker</a></li>
        <li>Explore the <a href="/docs/api" className="text-[#00fff2] hover:underline">API reference</a></li>
      </ul>
    </div>
  );
}
