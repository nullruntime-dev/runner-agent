import Link from 'next/link';
import { CodeBlock, InfoBox } from '../components';

export default function ConfigurationPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Configuration</h1>
      <p className="text-[#888] mb-8">
        GRIPHOOK has two halves: the <strong className="text-white">agent</strong> (Spring Boot) and the
        <strong className="text-white"> Control Center</strong> (Next.js). Most configuration happens through the
        UI; everything that can be set in <code>application.yml</code> can also be set via environment variables.
      </p>

      {/* Agent */}
      <h2 className="text-xl font-bold text-white mb-4">Agent configuration</h2>
      <p className="text-[#888] mb-4">
        Loaded from <code className="text-[#00fff2]">application.yml</code> with env-var overrides. The current defaults:
      </p>
      <CodeBlock language="yaml">
{`# Defaults shipped in src/main/resources/application.yml
server:
  port: \${SERVER_PORT:8009}                  # install.sh / docker-compose set 8090

agent:
  token: \${AGENT_TOKEN:1234}                 # CHANGE in production
  working-dir: \${AGENT_WORKING_DIR:/tmp}
  default-shell: \${AGENT_DEFAULT_SHELL:/bin/sh}
  max-concurrent: \${AGENT_MAX_CONCURRENT:5}
  adk:
    enabled: \${AGENT_ADK_ENABLED:true}
    provider: \${AGENT_ADK_PROVIDER:ollama}   # "gemini" or "ollama"
    model: \${AGENT_ADK_MODEL:gemini-flash-lite-latest}
    api-key: \${GOOGLE_AI_API_KEY:}
    ollama-base-url: \${OLLAMA_BASE_URL:http://127.0.0.1:11434}
    ollama-model: \${OLLAMA_MODEL:minimax-m3:cloud}

spring:
  datasource:
    url: \${SPRING_DATASOURCE_URL:jdbc:h2:file:./agent-data;AUTO_SERVER=TRUE}

  h2:
    console:
      enabled: \${H2_CONSOLE_ENABLED:true}    # http://<host>:8090/h2-console`}
      </CodeBlock>

      <InfoBox type="info" title="Defaults that differ from older docs">
        <code>AGENT_ADK_PROVIDER</code> defaults to <strong>ollama</strong> (not gemini) and{' '}
        <code>OLLAMA_MODEL</code> defaults to <strong>minimax-m3:cloud</strong>. The Gemini env vars are only read when
        the provider is set to <code>gemini</code>. Ollama models must support tool calling
        (e.g. <code>llama3.1</code>, <code>mistral</code>, <code>qwen3</code>, <code>mixtral</code>).
      </InfoBox>

      <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">Command-line overrides</h3>
      <CodeBlock language="bash">
{`# All yml keys can be overridden via Spring's CLI args
java -jar runner-agent-0.1.0-SNAPSHOT.jar \\
  --server.port=8090 \\
  --agent.working-dir=/opt/workspace \\
  --agent.default-shell=/bin/bash \\
  --agent.max-concurrent=10

# Or via env vars
SERVER_PORT=8090 AGENT_TOKEN=secret java -jar ...`}
      </CodeBlock>

      {/* UI */}
      <h2 className="text-xl font-bold text-white mt-10 mb-4">Control Center configuration</h2>
      <p className="text-[#888] mb-4">
        The Next.js UI keeps its own SQLite database at <code className="text-[#00fff2]">ui/data/runner.db</code>{' '}
        (Prisma 7 + LibSQL). It mirrors agent state by calling the agent&apos;s API and caching results.
        You rarely need to touch the UI&apos;s config directly — the setup wizard does it for you.
      </p>

      <h3 className="text-md font-medium text-[#ccc] mb-3">What the settings wizard writes</h3>
      <p className="text-[#888] mb-4">
        The wizard saves your config to <code className="text-[#00fff2]">../settings.json</code> at the repo root
        (one level up from <code>ui/</code>). The file is gitignored. You can also edit it directly:
      </p>
      <CodeBlock language="json">
{`{
  "setupComplete": true,
  "googleAiApiKey": "",
  "agentToken": "your-strong-token",
  "agentAdkProvider": "ollama",
  "agentAdkModel": "gemini-flash-lite-latest",
  "agentAdkEnabled": true,
  "ollamaBaseUrl": "http://127.0.0.1:11434",
  "ollamaModel": "minimax-m3:cloud",
  "serverPort": "8090",
  "agentWorkingDir": "/tmp",
  "agentDefaultShell": "/bin/bash",
  "agentMaxConcurrent": "5"
}`}
      </CodeBlock>
      <p className="text-[#888] text-sm mt-2">
        Note: settings written here describe defaults the <em>UI</em> uses when calling agents. Per-agent
        tokens live in <code>ui/data/runner.db</code> and are managed through <Link href="/agents" className="text-[#00fff2] hover:underline">Manage Agents</Link>.
      </p>

      {/* AI config */}
      <h2 className="text-xl font-bold text-white mt-10 mb-4">AI configuration (live, no restart)</h2>
      <InfoBox type="tip" title="The only thing you can change at runtime">
        AI provider + model are persisted to the agent&apos;s H2 <code>skill_configs</code> table under the
        key <code>ai-provider</code>. Changes take effect on the very next chat request, no agent restart required.
        Reset by deleting that row or by exporting <code>AGENT_ADK_*</code> env vars before first launch.
      </InfoBox>
      <p className="text-[#888] mb-4">
        Configure it in <strong>Settings → AI Configuration</strong>:
      </p>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li><strong>Google Gemini</strong> — choose from <code>gemini-2.0-flash</code>, <code>gemini-1.5-pro</code>, <code>gemini-1.5-flash</code>, <code>gemini-2.0-flash-lite</code>. Requires <code>GOOGLE_AI_API_KEY</code> on the agent.</li>
        <li><strong>Ollama</strong> — point at any local Ollama server. <code>ollamaBaseUrl</code> defaults to <code>http://127.0.0.1:11434</code>. Model must support tool calling.</li>
      </ul>

      {/* Settings sections */}
      <h2 className="text-xl font-bold text-white mt-10 mb-4">The Settings page</h2>
      <p className="text-[#888] mb-4">
        The Settings UI has six sections:
      </p>
      <div className="space-y-3 mb-6">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <h3 className="text-sm font-semibold text-white">AI Configuration <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30">LIVE</span></h3>
          <p className="text-xs text-[#888] mt-1">Switch provider/model. Applies on next chat request.</p>
        </div>
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <h3 className="text-sm font-semibold text-white">API Keys</h3>
          <p className="text-xs text-[#888] mt-1">Google AI API key, AI chat on/off toggle. Requires backend restart.</p>
        </div>
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <h3 className="text-sm font-semibold text-white">Security</h3>
          <p className="text-xs text-[#888] mt-1">Agent token (with random generator). Requires backend restart.</p>
        </div>
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <h3 className="text-sm font-semibold text-white">Server Settings</h3>
          <p className="text-xs text-[#888] mt-1">Port, max concurrent, working dir, default shell. Requires backend restart.</p>
        </div>
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <h3 className="text-sm font-semibold text-white">Skills Management</h3>
          <p className="text-xs text-[#888] mt-1">Built-in and custom skills — configure, enable/disable, hide.</p>
        </div>
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <h3 className="text-sm font-semibold text-white">Database</h3>
          <p className="text-xs text-[#888] mt-1">Stats, JSON / SQLite export, JSON import. See <Link href="/docs/backup" className="text-[#00fff2] hover:underline">Backup &amp; Database</Link>.</p>
        </div>
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <h3 className="text-sm font-semibold text-white">Setup Wizard</h3>
          <p className="text-xs text-[#888] mt-1">Re-run the wizard. Reset the <code>setupComplete</code> flag for fresh installs.</p>
        </div>
      </div>

      {/* Skills */}
      <h2 className="text-xl font-bold text-white mt-10 mb-4">Skills (integrations)</h2>
      <p className="text-[#888] mb-4">
        Skills add capabilities to the agent. Configure them in <strong>Settings → Skills Management</strong>,
        or per-agent from the <em>Skills</em> tab of the chat sidebar.
      </p>

      <h3 className="text-lg font-semibold text-white mt-8 mb-3">Slack</h3>
      <p className="text-[#888] mb-4">
        Send notifications to Slack and receive commands via slash commands (Socket Mode — no public URL needed).
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
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">App-Level Token</td><td className="px-4 py-3 text-[#ff0044]">Yes</td><td className="px-4 py-3 text-[#888]">Starts with <code>xapp-</code></td></tr>
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">Bot Token</td><td className="px-4 py-3 text-[#ff0044]">Yes</td><td className="px-4 py-3 text-[#888]">Starts with <code>xoxb-</code></td></tr>
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">Default Channel</td><td className="px-4 py-3 text-[#ff0044]">Yes</td><td className="px-4 py-3 text-[#888]">e.g. <code>#deployments</code></td></tr>
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">Webhook URL</td><td className="px-4 py-3 text-[#444]">No</td><td className="px-4 py-3 text-[#888]">Optional incoming webhook</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">Slash Command</td><td className="px-4 py-3 text-[#444]">No</td><td className="px-4 py-3 text-[#888]">Default: <code>griphook</code></td></tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-semibold text-white mt-8 mb-3">Gmail (SMTP)</h3>
      <p className="text-[#888] mb-4">Send email notifications via Gmail SMTP.</p>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1a1a1a]"><th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Field</th><th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Required</th><th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Description</th></tr></thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">Gmail Address</td><td className="px-4 py-3 text-[#ff0044]">Yes</td><td className="px-4 py-3 text-[#888]">Your Gmail address</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">App Password</td><td className="px-4 py-3 text-[#ff0044]">Yes</td><td className="px-4 py-3 text-[#888]">Generate at myaccount.google.com/apppasswords</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">Default Recipient</td><td className="px-4 py-3 text-[#444]">No</td><td className="px-4 py-3 text-[#888]">Default To: address</td></tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-semibold text-white mt-8 mb-3">Gmail API (OAuth)</h3>
      <p className="text-[#888] mb-4">
        Full Gmail access (read, search, reply) via OAuth2. Click <em>Authorize</em> in the skill config to grant access.
        Tokens are stored in the agent&apos;s H2 DB (<code>gmail_tokens</code> table) and can be revoked from the UI.
      </p>

      <h3 className="text-lg font-semibold text-white mt-8 mb-3">SMTP (generic)</h3>
      <p className="text-[#888] mb-4">Send emails via any SMTP server (SendGrid, Mailgun, Amazon SES, etc.).</p>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1a1a1a]"><th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Field</th><th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Required</th><th className="px-4 py-3 text-left text-xs font-medium text-[#444] uppercase">Description</th></tr></thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">SMTP Host / Port</td><td className="px-4 py-3 text-[#ff0044]">Yes</td><td className="px-4 py-3 text-[#888]">587 (TLS), 465 (SSL), 25 (plain)</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">Username / Password</td><td className="px-4 py-3 text-[#ff0044]">Yes</td><td className="px-4 py-3 text-[#888]">SMTP credentials or API key</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">From Email / Name</td><td className="px-4 py-3 text-[#ff0044]">Yes</td><td className="px-4 py-3 text-[#888]">Sender identity</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">Encryption</td><td className="px-4 py-3 text-[#444]">No</td><td className="px-4 py-3 text-[#888]">TLS (default), SSL, NONE</td></tr>
            <tr><td className="px-4 py-3 font-mono text-[#ff6600]">Default Recipient</td><td className="px-4 py-3 text-[#444]">No</td><td className="px-4 py-3 text-[#888]">Default To: address</td></tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-semibold text-white mt-8 mb-3">Web Search</h3>
      <p className="text-[#888] mb-4">
        Lets the AI look things up on the web. Three backends:
      </p>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-4">
        <li><strong>SearXNG</strong> — self-hosted meta search. Configure <code>SEARXNG_BASE_URL</code> on the agent (default <code>http://localhost:8081</code>) or set <code>baseUrl</code> in the skill config.</li>
        <li><strong>DuckDuckGo</strong> — uses <code>html.duckduckgo.com</code>. No config needed.</li>
        <li><strong>Wolfram Alpha</strong> — computational knowledge engine. Optional <code>appId</code>.</li>
      </ul>

      <h3 className="text-lg font-semibold text-white mt-8 mb-3">Wingman (Flirt)</h3>
      <p className="text-[#888] mb-4">
        AI assistant for crafting flirty responses and dating openers. Stores per-person profiles
        (interests, traits, communication style) and learns over time. Configure with optional
        <code> yourName</code>, <code>flirtingStyle</code> (playful / witty / romantic / bold / subtle / mysterious),
        <code> interestedIn</code>, and <code>yourPersonality</code> free-text fields.
      </p>
      <p className="text-[#888] mb-4">Example prompts:</p>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>&quot;Sarah said &apos;I love hiking&apos; — what should I reply?&quot;</li>
        <li>&quot;Write an opener for Emma who likes photography&quot;</li>
        <li>&quot;Analyze my conversation with Alex&quot;</li>
        <li>&quot;List all my crushes&quot; / &quot;Forget about Mike&quot;</li>
      </ul>

      <h3 className="text-lg font-semibold text-white mt-8 mb-3">Custom Skills</h3>
      <p className="text-[#888] mb-4">
        Define your own reusable prompts or shell command bundles. Two types:
      </p>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li><strong>PROMPT</strong> — a reusable prompt template. Invoke from AI chat to load context.</li>
        <li><strong>COMMAND</strong> — a JSON definition of one or more shell steps, with <code>commands</code>, <code>workingDir</code>, and <code>timeout</code>.</li>
      </ul>
      <CodeBlock language="json">
{`{
  "commands": ["docker ps -a", "docker images"],
  "workingDir": "/",
  "timeout": 60
}`}
      </CodeBlock>

      <h3 className="text-lg font-semibold text-white mt-8 mb-3">Schedule (autopilot)</h3>
      <p className="text-[#888] mb-4">
        Cron and interval-based triggers that fire a prompt or command automatically. Manage from
        the per-agent <em>Autopilot</em> tab. Two schedule types:
      </p>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li><strong>INTERVAL</strong> — fire every N minutes.</li>
        <li><strong>CRON</strong> — standard 5-field cron expression.</li>
      </ul>
    </div>
  );
}
