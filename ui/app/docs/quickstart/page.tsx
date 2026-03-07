import { CodeBlock } from '../components';

export default function QuickStartPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Quick Start</h1>
      <p className="text-neutral-400 mb-8">
        Get Runner Agent up and running in minutes.
      </p>

      <h2 className="text-xl font-bold text-white mb-4">1. Start an Agent</h2>
      <p className="text-neutral-400 mb-4">
        Download and run the agent JAR on your target server.
      </p>
      <CodeBlock language="bash">
{`# Download the agent
curl -o runner-agent.jar http://your-control-center:3000/api/download/agent

# Run with Java 21+
AGENT_TOKEN=your-secret-token java -jar runner-agent.jar

# Or with Docker
docker run -e AGENT_TOKEN=your-secret-token -p 8090:8090 runner-agent`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mb-4 mt-10">2. Start the Control Center</h2>
      <CodeBlock language="bash">
{`cd ui
npm install
npm run dev`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mb-4 mt-10">3. Add Agent to Dashboard</h2>
      <p className="text-neutral-400 mb-4">
        Navigate to <code className="text-amber-400">/agents</code> and add your agent:
      </p>
      <ul className="list-disc list-inside text-neutral-400 space-y-2 mb-6">
        <li>Enter a name for the agent (e.g., &quot;Production Server&quot;)</li>
        <li>Enter the agent URL (e.g., <code className="text-amber-400">http://192.168.1.100:8090</code>)</li>
        <li>Enter the same token you used for <code className="text-amber-400">AGENT_TOKEN</code></li>
      </ul>

      <h2 className="text-xl font-bold text-white mb-4 mt-10">4. Execute Your First Command</h2>
      <p className="text-neutral-400 mb-4">
        Use curl or any HTTP client to submit an execution:
      </p>
      <CodeBlock language="bash">
{`curl -X POST http://localhost:8090/execute \\
  -H "Authorization: Bearer your-secret-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Hello World",
    "steps": [
      {"name": "Echo", "run": "echo Hello from Runner Agent!"},
      {"name": "Date", "run": "date"}
    ]
  }'`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mb-4 mt-10">5. View Results</h2>
      <p className="text-neutral-400">
        Go to the dashboard to see your execution. Click on it to view step details and logs.
        For real-time log streaming, the Control Center automatically connects to the agent&apos;s SSE endpoint.
      </p>
    </div>
  );
}
