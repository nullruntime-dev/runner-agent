import Link from 'next/link';
import { FeatureCard, CodeBlock } from './components';

export default function DocsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">GRIPHOOK</h1>
      <p className="text-lg text-[#888] mb-8">
        A lightweight, distributed remote command execution system. Deploy agents on your servers
        and execute commands remotely with real-time log streaming.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-12">
        <FeatureCard
          title="Distributed Execution"
          description="Deploy agents across multiple servers and manage them from a single dashboard"
        />
        <FeatureCard
          title="Real-time Streaming"
          description="Watch command output in real-time via Server-Sent Events (SSE)"
        />
        <FeatureCard
          title="Step-based Workflows"
          description="Execute multi-step workflows with sequential command execution"
        />
        <FeatureCard
          title="API-first Design"
          description="Full REST API for integration with CI/CD pipelines and automation tools"
        />
        <FeatureCard
          title="AI Chat Assistant"
          description="Natural language interface to execute commands, check status, and troubleshoot deployments"
        />
        <FeatureCard
          title="Integrations (Skills)"
          description="Connect to Slack, Gmail, SMTP, and even a Flirt Assistant for dating help"
        />
      </div>

      <h2 className="text-xl font-bold text-white mb-4">Architecture</h2>
      <CodeBlock>
{`┌─────────────────────────────────────────────────────────────────┐
│                       CONTROL CENTER                            │
│                     (Next.js Dashboard)                         │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │  Agent List │  │  Exec View  │  │  Live Logs  │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
└────────────────────────────┬───────────────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
     ┌──────────┐     ┌──────────┐     ┌──────────┐
     │  Agent   │     │  Agent   │     │  Agent   │
     │  :8090   │     │  :8090   │     │  :8090   │
     │          │     │          │     │          │
     │ Server A │     │ Server B │     │ Server C │
     └──────────┘     └──────────┘     └──────────┘`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Components</h2>
      <div className="space-y-4">
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Agent (Java/Spring Boot)</h3>
          <p className="text-sm text-[#888]">
            Runs on target servers. Executes shell commands, streams logs via SSE, stores history in H2 database.
          </p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Control Center (Next.js)</h3>
          <p className="text-sm text-[#888]">
            Central dashboard for managing multiple agents. Caches data in SQLite, provides unified view of all executions.
          </p>
        </div>
      </div>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Get Started</h2>
      <p className="text-[#888] mb-4">
        Ready to deploy? Follow the quick start guide to get up and running.
      </p>
      <Link
        href="/docs/quickstart"
        className="inline-flex h-10 px-6 bg-gradient-to-r from-[#00fff2] to-[#00cccc] hover:from-[#00cccc] hover:to-[#00fff2] text-black text-sm font-semibold items-center transition-all shadow-[0_0_20px_rgba(0,255,242,0.3)]"
      >
        Quick Start Guide
      </Link>
    </div>
  );
}
