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

      {/* Security Warning */}
      <div className="bg-[#ff4400]/10 border border-[#ff4400]/50 p-5 mb-8">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-[#ff4400] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="text-sm font-bold text-[#ff4400] uppercase tracking-wider mb-2">Private Deployment Only</h3>
            <p className="text-sm text-[#ccc] mb-3">
              <strong className="text-white">Do not expose GRIPHOOK to the public internet.</strong> This system executes shell commands on your servers and should only be deployed in a private, secured environment accessible to you and authorized personnel only.
            </p>
            <p className="text-sm text-[#888] mb-3">
              For secure remote access, use a zero-trust tunnel solution:
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://www.cloudflare.com/products/tunnel/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-[#00fff2] hover:text-white bg-[#00fff2]/10 hover:bg-[#00fff2]/20 px-3 py-1.5 border border-[#00fff2]/30 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5088 16.8447C16.5088 16.8447 16.7358 16.1471 16.7358 15.7882C16.7358 15.4294 16.5088 15.2706 16.1818 15.2706H7.8182C7.4912 15.2706 7.2642 15.4294 7.2642 15.7882C7.2642 16.1471 7.4912 16.8447 7.4912 16.8447H16.5088ZM19.0218 8.78823C18.8858 8.78823 18.7498 8.81764 18.6138 8.85176L17.3438 6.63529C17.1308 6.24706 16.6278 6.08824 16.2328 6.30588L14.8628 7.09411C14.4678 7.31176 14.3088 7.81176 14.5218 8.2L15.5768 10.0118C15.3408 10.3235 15.1818 10.6941 15.1358 11.0941H12.8638C12.4228 11.0941 12.0738 11.4471 12.0738 11.8824V13.4118C12.0738 13.8471 12.4228 14.2 12.8638 14.2H19.0218C20.3378 14.2 21.4138 13.1235 21.4138 11.8C21.4138 10.4765 20.3378 8.78823 19.0218 8.78823Z"/>
                  <path d="M4.97823 8.78823C5.11423 8.78823 5.25023 8.81764 5.38623 8.85176L6.65623 6.63529C6.86923 6.24706 7.37223 6.08824 7.76723 6.30588L9.13723 7.09411C9.53223 7.31176 9.69123 7.81176 9.47823 8.2L8.42323 10.0118C8.65923 10.3235 8.81823 10.6941 8.86423 11.0941H11.1362C11.5772 11.0941 11.9262 11.4471 11.9262 11.8824V13.4118C11.9262 13.8471 11.5772 14.2 11.1362 14.2H4.97823C3.66223 14.2 2.58623 13.1235 2.58623 11.8C2.58623 10.4765 3.66223 8.78823 4.97823 8.78823Z"/>
                </svg>
                Cloudflare Zero Trust
              </a>
              <a
                href="https://www.twingate.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-[#00fff2] hover:text-white bg-[#00fff2]/10 hover:bg-[#00fff2]/20 px-3 py-1.5 border border-[#00fff2]/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Twingate
              </a>
              <a
                href="https://tailscale.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-[#00fff2] hover:text-white bg-[#00fff2]/10 hover:bg-[#00fff2]/20 px-3 py-1.5 border border-[#00fff2]/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Tailscale
              </a>
            </div>
          </div>
        </div>
      </div>

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
          description="Connect to Slack, Gmail, SMTP, and even a Wingman for dating help"
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
