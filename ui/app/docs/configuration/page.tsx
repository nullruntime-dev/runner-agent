import { CodeBlock } from '../components';

export default function ConfigurationPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Configuration</h1>
      <p className="text-neutral-400 mb-8">
        Configure the agent and Control Center for your environment.
      </p>

      <h2 className="text-xl font-bold text-white mb-4">Agent Configuration</h2>
      <p className="text-neutral-400 mb-4">
        The agent is configured via <code className="text-amber-400">application.yml</code> or environment variables.
      </p>
      <CodeBlock language="yaml">
{`# application.yml
server:
  port: 8090

agent:
  token: \${AGENT_TOKEN}      # Required - API authentication
  working-dir: /tmp          # Default working directory
  default-shell: /bin/sh     # Default shell
  max-concurrent: 5          # Max parallel executions

spring:
  datasource:
    url: jdbc:h2:file:./agent-data  # Persistent H2 database
    driver-class-name: org.h2.Driver
  jpa:
    hibernate:
      ddl-auto: update
  h2:
    console:
      enabled: true
      path: /h2-console`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Environment Variables</h2>
      <div className="bg-neutral-900 border border-neutral-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Variable</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Required</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Default</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            <tr>
              <td className="px-4 py-3 font-mono text-amber-400">AGENT_TOKEN</td>
              <td className="px-4 py-3 text-red-400">Yes</td>
              <td className="px-4 py-3 text-neutral-500">-</td>
              <td className="px-4 py-3 text-neutral-400">API authentication token</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-amber-400">SERVER_PORT</td>
              <td className="px-4 py-3 text-neutral-500">No</td>
              <td className="px-4 py-3 text-neutral-500">8090</td>
              <td className="px-4 py-3 text-neutral-400">HTTP server port</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-amber-400">AGENT_WORKING_DIR</td>
              <td className="px-4 py-3 text-neutral-500">No</td>
              <td className="px-4 py-3 text-neutral-500">/tmp</td>
              <td className="px-4 py-3 text-neutral-400">Default working directory</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-amber-400">AGENT_DEFAULT_SHELL</td>
              <td className="px-4 py-3 text-neutral-500">No</td>
              <td className="px-4 py-3 text-neutral-500">/bin/sh</td>
              <td className="px-4 py-3 text-neutral-400">Default shell for commands</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-amber-400">AGENT_MAX_CONCURRENT</td>
              <td className="px-4 py-3 text-neutral-500">No</td>
              <td className="px-4 py-3 text-neutral-500">5</td>
              <td className="px-4 py-3 text-neutral-400">Maximum parallel executions</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Control Center Configuration</h2>
      <p className="text-neutral-400 mb-4">
        The Control Center uses environment variables in <code className="text-amber-400">.env.local</code>.
      </p>
      <CodeBlock language="bash">
{`# .env.local
# Database URL (SQLite)
DATABASE_URL="file:./data/runner.db"

# Optional: Default API URL for development
NEXT_PUBLIC_API_URL=http://localhost:8090`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Command Line Arguments</h2>
      <p className="text-neutral-400 mb-4">
        Override configuration when running the agent JAR:
      </p>
      <CodeBlock language="bash">
{`# Override port
java -jar runner-agent.jar --server.port=9090

# Override working directory
java -jar runner-agent.jar --agent.working-dir=/opt/workspace

# Override shell
java -jar runner-agent.jar --agent.default-shell=/bin/bash

# Multiple overrides
AGENT_TOKEN=secret java -jar runner-agent.jar \\
  --server.port=8090 \\
  --agent.working-dir=/opt/workspace \\
  --agent.max-concurrent=10`}
      </CodeBlock>
    </div>
  );
}
