import Link from 'next/link';
import { FeatureCard, CodeBlock } from './components';

export default function DocsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">GRIPHOOK</h1>
      <p className="text-lg text-[#888] mb-8">
        A control plane for distributed command execution. Run lightweight agents on your
        servers, drive them from a single web UI, and let an AI assistant orchestrate
        deployments, notifications, and integrations.
      </p>

      {/* Security Warning */}
      <div className="bg-[#ff4400]/10 border border-[#ff4400]/50 p-5 mb-8">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-[#ff4400] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="text-sm font-bold text-[#ff4400] uppercase tracking-wider mb-2">Private Deployment Only</h3>
            <p className="text-sm text-[#ccc] mb-3">
              <strong className="text-white">Do not expose GRIPHOOK to the public internet.</strong> The agent executes shell commands on the host it runs on. Deploy in a private, secured environment accessible to authorized personnel only.
            </p>
            <p className="text-sm text-[#888] mb-3">
              For secure remote access, use a zero-trust tunnel:
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://www.cloudflare.com/products/tunnel/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-[#00fff2] hover:text-white bg-[#00fff2]/10 hover:bg-[#00fff2]/20 px-3 py-1.5 border border-[#00fff2]/30 transition-colors"
              >
                Cloudflare Zero Trust
              </a>
              <a
                href="https://www.twingate.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-[#00fff2] hover:text-white bg-[#00fff2]/10 hover:bg-[#00fff2]/20 px-3 py-1.5 border border-[#00fff2]/30 transition-colors"
              >
                Twingate
              </a>
              <a
                href="https://tailscale.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-[#00fff2] hover:text-white bg-[#00fff2]/10 hover:bg-[#00fff2]/20 px-3 py-1.5 border border-[#00fff2]/30 transition-colors"
              >
                Tailscale
              </a>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-white mb-4">What you get</h2>
      <div className="grid grid-cols-2 gap-4 mb-12">
        <FeatureCard
          title="Multi-agent control plane"
          description="One UI manages many agents. Each agent is just a small Spring Boot service running on a target host."
        />
        <FeatureCard
          title="Step-based execution"
          description="Define multi-step shell workflows with per-step timeouts, error handling, env vars, and live SSE log streaming."
        />
        <FeatureCard
          title="AI chat (ADK)"
          description="Google ADK + LangChain4j for Ollama. Switch provider and model at runtime from the UI — no restart."
        />
        <FeatureCard
          title="Skills"
          description="Slack, Gmail, Gmail API, SMTP, Web Search (SearXNG / DuckDuckGo / Wolfram Alpha), Wingman, and user-defined custom skills."
        />
        <FeatureCard
          title="Scheduled tasks"
          description="Cron and interval-based autopilot schedules that trigger prompts or commands without manual intervention."
        />
        <FeatureCard
          title="Local cache & history"
          description="The UI keeps its own SQLite cache of agents, executions, steps, and chat history so the dashboard stays fast and queryable."
        />
      </div>

      <h2 className="text-xl font-bold text-white mb-4">Architecture</h2>
      <CodeBlock>{`┌──────────────────────────────────────────────────────────────────────┐
│                         CONTROL CENTER                              │
│                      (Next.js 16 / React 19)                        │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│   │  Dashboard │  │  Per-agent │  │  Settings  │  │   Docs     │    │
│   └────────────┘  └────────────┘  └────────────┘  └────────────┘    │
│         │ SQLite (data/runner.db): agents + mirrored execs         │
└─────────────┬────────────────────────────────────┬──────────────────┘
              │  HTTP (Bearer token)              │
              │  /sync, /execute, /agent/*, /execution/*               │
              ▼                                   ▼
      ┌───────────────┐                   ┌───────────────┐
      │  Agent #1     │                   │  Agent #2     │
      │  Spring Boot  │                   │  Spring Boot  │
      │  H2 DB        │                   │  H2 DB        │
      │  Port 8090    │                   │  Port 8091    │
      └───────────────┘                   └───────────────┘
              │
              ▼
       ┌─────────────┐
       │   Slack     │   SMTP   Gmail API  SearXNG  Ollama
       └─────────────┘`}</CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Components</h2>
      <div className="space-y-4">
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Agent (Java / Spring Boot 3.4)</h3>
          <p className="text-sm text-[#888]">
            A small service that runs on each target host. Executes shell commands via <code className="text-[#00fff2]">ExecutorService</code>, streams stdout/stderr over SSE, persists executions + logs in H2, and exposes a REST API (<code className="text-[#00fff2]">/execute</code>, <code className="text-[#00fff2]">/execution/&#123;id&#125;</code>, <code className="text-[#00fff2]">/agent/chat</code>, <code className="text-[#00fff2]">/agent/skills</code>, etc.). Google ADK powers the AI chat; LangChain4j bridges to Ollama.
          </p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Control Center (Next.js 16)</h3>
          <p className="text-sm text-[#888]">
            A web dashboard. <strong>Registers</strong> agents by URL + token, <strong>syncs</strong> their execution history into a local SQLite cache at <code className="text-[#00fff2]">ui/data/runner.db</code>, and acts as a control surface for AI chat, skill configuration, scheduled tasks, and database export/import. Acts as a thin proxy in front of each agent&apos;s API.
          </p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4">
          <h3 className="text-sm font-semibold text-white mb-2">CLI (griphook)</h3>
          <p className="text-sm text-[#888]">
            Optional Ink-based terminal TUI in <code className="text-[#00fff2]">cli/</code>. See the <Link href="/docs/api" className="text-[#00fff2] hover:underline">API Reference</Link> for the REST surface it uses.
          </p>
        </div>
      </div>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Get Started</h2>
      <p className="text-[#888] mb-4">
        Pick the install path that fits your environment.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/docs/quickstart"
          className="inline-flex h-10 px-6 bg-gradient-to-r from-[#00fff2] to-[#00cccc] hover:from-[#00cccc] hover:to-[#00fff2] text-black text-sm font-semibold items-center transition-all shadow-[0_0_20px_rgba(0,255,242,0.3)]"
        >
          Quick Start
        </Link>
        <Link
          href="/docs/deployment"
          className="inline-flex h-10 px-6 border border-[#1a1a1a] text-[#ccc] hover:text-white hover:border-[#2a2a2a] text-sm font-semibold items-center transition-all"
        >
          Deployment Options
        </Link>
        <Link
          href="/docs/configuration"
          className="inline-flex h-10 px-6 border border-[#1a1a1a] text-[#ccc] hover:text-white hover:border-[#2a2a2a] text-sm font-semibold items-center transition-all"
        >
          Configuration
        </Link>
      </div>
    </div>
  );
}
