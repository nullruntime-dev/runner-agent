import Link from 'next/link';
import { FeatureCard, CodeBlock } from './components';

export default function DocsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Runner Agent</h1>
      <p className="text-lg text-neutral-400 mb-8">
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
        <div className="bg-neutral-900 border border-neutral-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Agent (Java/Spring Boot)</h3>
          <p className="text-sm text-neutral-400">
            Runs on target servers. Executes shell commands, streams logs via SSE, stores history in H2 database.
          </p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Control Center (Next.js)</h3>
          <p className="text-sm text-neutral-400">
            Central dashboard for managing multiple agents. Caches data in SQLite, provides unified view of all executions.
          </p>
        </div>
      </div>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Get Started</h2>
      <p className="text-neutral-400 mb-4">
        Ready to deploy? Follow the quick start guide to get up and running.
      </p>
      <Link
        href="/docs/quickstart"
        className="inline-flex h-10 px-6 bg-white hover:bg-neutral-200 text-neutral-900 text-sm font-semibold items-center transition-colors"
      >
        Quick Start Guide
      </Link>
    </div>
  );
}
