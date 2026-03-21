import { CodeBlock } from '../components';

export default function ConfigurationPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Configuration</h1>
      <p className="text-[#888] mb-8">
        Configure the agent and Control Center for your environment.
      </p>

      <h2 className="text-xl font-bold text-white mb-4">Agent Configuration</h2>
      <p className="text-[#888] mb-4">
        The agent is configured via <code className="text-[#ff6600]">application.yml</code> or environment variables.
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
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Variable</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Required</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Default</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">AGENT_TOKEN</td>
              <td className="px-4 py-3 text-[#ff0044]">Yes</td>
              <td className="px-4 py-3 text-[#444]">-</td>
              <td className="px-4 py-3 text-[#888]">API authentication token</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">SERVER_PORT</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#444]">8090</td>
              <td className="px-4 py-3 text-[#888]">HTTP server port</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">AGENT_WORKING_DIR</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#444]">/tmp</td>
              <td className="px-4 py-3 text-[#888]">Default working directory</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">AGENT_DEFAULT_SHELL</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#444]">/bin/sh</td>
              <td className="px-4 py-3 text-[#888]">Default shell for commands</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">AGENT_MAX_CONCURRENT</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#444]">5</td>
              <td className="px-4 py-3 text-[#888]">Maximum parallel executions</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Control Center Configuration</h2>
      <p className="text-[#888] mb-4">
        The Control Center uses environment variables in <code className="text-[#ff6600]">.env.local</code>.
      </p>
      <CodeBlock language="bash">
{`# .env.local
# Database URL (SQLite)
DATABASE_URL="file:./data/runner.db"

# Optional: Default API URL for development
NEXT_PUBLIC_API_URL=http://localhost:8090`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Command Line Arguments</h2>
      <p className="text-[#888] mb-4">
        Override configuration when running the agent JAR:
      </p>
      <CodeBlock language="bash">
{`# Override port
java -jar griphook-agent.jar --server.port=9090

# Override working directory
java -jar griphook-agent.jar --agent.working-dir=/opt/workspace

# Override shell
java -jar griphook-agent.jar --agent.default-shell=/bin/bash

# Multiple overrides
AGENT_TOKEN=secret java -jar griphook-agent.jar \\
  --server.port=8090 \\
  --agent.working-dir=/opt/workspace \\
  --agent.max-concurrent=10`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Skills (Integrations)</h2>
      <p className="text-[#888] mb-4">
        Skills add additional capabilities to your agent. Configure them from the UI via{' '}
        <code className="text-[#ff6600]">Agent → Chat → Skills</code> sidebar.
      </p>

      <h3 className="text-lg font-semibold text-white mt-8 mb-3">Slack Integration</h3>
      <p className="text-[#888] mb-4">
        Send notifications to Slack and receive commands via slash commands (Socket Mode - no public URL needed).
        Configure the slash command name in the Skills settings (default: griphook).
      </p>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Field</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Required</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">App-Level Token</td>
              <td className="px-4 py-3 text-[#ff0044]">Yes</td>
              <td className="px-4 py-3 text-[#888]">Token for Socket Mode (starts with xapp-)</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Bot Token</td>
              <td className="px-4 py-3 text-[#ff0044]">Yes</td>
              <td className="px-4 py-3 text-[#888]">Bot User OAuth Token (starts with xoxb-)</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Webhook URL</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#888]">Optional incoming webhook for simple notifications</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Default Channel</td>
              <td className="px-4 py-3 text-[#ff0044]">Yes</td>
              <td className="px-4 py-3 text-[#888]">Channel for bot responses (e.g., #deployments)</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Slash Command</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#888]">Command name without / (default: griphook)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[#888] mb-4">
        <strong className="text-white">Setup in Slack:</strong>
      </p>
      <ol className="list-decimal list-inside text-[#888] space-y-2 mb-6">
        <li>Create a Slack App at <code className="text-[#ff6600]">api.slack.com/apps</code></li>
        <li>Enable <strong>Socket Mode</strong> and generate an App-Level Token</li>
        <li>Add <strong>OAuth Scopes</strong>: chat:write, commands, app_mentions:read</li>
        <li>Create a <strong>Slash Command</strong> (e.g., /griphook)</li>
        <li>Install the app to your workspace</li>
        <li>Copy the tokens to the GRIPHOOK skill configuration</li>
      </ol>

      <h3 className="text-lg font-semibold text-white mt-8 mb-3">Gmail Integration</h3>
      <p className="text-[#888] mb-4">
        Send email notifications via Gmail SMTP.
      </p>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Field</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Required</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Gmail Address</td>
              <td className="px-4 py-3 text-[#ff0044]">Yes</td>
              <td className="px-4 py-3 text-[#888]">Your Gmail email address</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">App Password</td>
              <td className="px-4 py-3 text-[#ff0044]">Yes</td>
              <td className="px-4 py-3 text-[#888]">Generate at myaccount.google.com/apppasswords</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Default Recipient</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#888]">Default email recipient for notifications</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-semibold text-white mt-8 mb-3">SMTP Integration</h3>
      <p className="text-[#888] mb-4">
        Send emails via any SMTP server (SendGrid, Mailgun, Amazon SES, etc.).
      </p>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Field</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Required</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">SMTP Host</td>
              <td className="px-4 py-3 text-[#ff0044]">Yes</td>
              <td className="px-4 py-3 text-[#888]">SMTP server hostname</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">SMTP Port</td>
              <td className="px-4 py-3 text-[#ff0044]">Yes</td>
              <td className="px-4 py-3 text-[#888]">587 (TLS), 465 (SSL), or 25 (plain)</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Username</td>
              <td className="px-4 py-3 text-[#ff0044]">Yes</td>
              <td className="px-4 py-3 text-[#888]">SMTP username or API key</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Password</td>
              <td className="px-4 py-3 text-[#ff0044]">Yes</td>
              <td className="px-4 py-3 text-[#888]">SMTP password or API secret</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">From Email</td>
              <td className="px-4 py-3 text-[#ff0044]">Yes</td>
              <td className="px-4 py-3 text-[#888]">Sender email address</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">From Name</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#888]">Sender display name</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Encryption</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#888]">TLS (default), SSL, or NONE</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Default Recipient</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#888]">Default email recipient</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-semibold text-white mt-8 mb-3">Flirt Assistant</h3>
      <p className="text-[#888] mb-4">
        AI-powered wingman to help you craft smooth responses and openers for dating conversations.
      </p>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Field</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Required</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Your Name</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#888]">Your name for personalized responses</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Flirting Style</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#888]">playful, witty, romantic, bold, subtle, mysterious</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Interested In</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#888]">Who you&apos;re interested in (for context)</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-[#ff6600]">Your Personality</td>
              <td className="px-4 py-3 text-[#444]">No</td>
              <td className="px-4 py-3 text-[#888]">Describe your vibe (funny, nerdy, adventurous)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[#888] mb-4">
        <strong className="text-white">Profile Learning:</strong> The assistant learns about each person you talk to. It stores their messages, interests, personality traits, and communication style to give increasingly personalized advice.
      </p>
      <p className="text-[#888] mb-4">
        <strong className="text-white">Example prompts:</strong>
      </p>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>&quot;Sarah said &apos;I love hiking&apos; - what should I reply?&quot;</li>
        <li>&quot;Write an opener for Emma who likes photography&quot;</li>
        <li>&quot;Analyze my conversation with Alex&quot;</li>
        <li>&quot;What do you know about Sarah?&quot;</li>
        <li>&quot;List all my crushes&quot;</li>
        <li>&quot;Forget about Mike&quot;</li>
      </ul>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">AI Chat (ADK)</h2>
      <p className="text-[#888] mb-4">
        The AI Chat feature uses Google ADK (Agent Development Kit) to provide a natural language interface.
        Enable it in <code className="text-[#ff6600]">application.yml</code>:
      </p>
      <CodeBlock language="yaml">
{`agent:
  adk:
    enabled: true
    model: gemini-2.0-flash  # or gemini-2.5-pro`}
      </CodeBlock>
      <p className="text-[#888] mt-4">
        The AI assistant can:
      </p>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>Execute shell commands on the server</li>
        <li>Check execution status and logs</li>
        <li>Cancel running executions</li>
        <li>Send Slack messages and deployment notifications</li>
        <li>Send emails via Gmail or SMTP</li>
        <li>Troubleshoot failed deployments</li>
        <li>Help craft flirty responses and dating openers</li>
        <li>Analyze conversations for interest signals</li>
      </ul>
    </div>
  );
}
