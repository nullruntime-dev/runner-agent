import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAgent, checkAgentHealth } from '@/lib/agents';
import AgentChatClient from '@/components/AgentChatClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ agentId: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { agentId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    notFound();
  }

  const isOnline = await checkAgentHealth(agent);

  return (
    <main className="h-screen bg-[#050505] flex flex-col">
      {/* Header */}
      <header className="bg-[#0a0a0a] border-b border-[#1a1a1a] flex-shrink-0">
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 bg-[#111] border border-[#2a2a2a] flex items-center justify-center">
                <span className="text-sm font-bold text-[#00fff2]">G</span>
              </div>
              <span className="text-sm font-semibold text-white tracking-tight">GRIPHOOK</span>
            </Link>
            <div className="h-4 w-px bg-[#2a2a2a]" />
            {/* Back to agent */}
            <Link href={`/agents/${agentId}`} className="flex items-center gap-2 text-[#888] hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-xs">Back</span>
            </Link>
            <div className="h-4 w-px bg-[#2a2a2a]" />
            {/* Agent info */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${isOnline ? 'bg-[#00ff66] shadow-[0_0_8px_rgba(0,255,102,0.5)]' : 'bg-[#ff0044]'}`} />
              <span className="text-sm font-medium text-white">{agent.name}</span>
            </div>
            <div className="h-4 w-px bg-[#2a2a2a]" />
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#00fff2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="text-xs text-[#00fff2] uppercase tracking-wider font-medium">AI Chat</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className="h-8 px-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white text-xs font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              DOCS
            </Link>
            <span className={`text-xs px-2 py-1 ${isOnline ? 'bg-[#00ff66]/10 text-[#00ff66]' : 'bg-[#ff0044]/10 text-[#ff0044]'}`}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      {/* Offline warning */}
      {!isOnline && (
        <div className="bg-[#ff6600]/10 border-b border-[#ff6600]/30 px-6 py-3 flex-shrink-0">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <svg className="w-5 h-5 text-[#ff6600]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <span className="text-sm text-[#ff6600]">Agent Offline</span>
              <span className="text-xs text-[#ff6600]/70 ml-2">Chat requires the agent to be online</span>
            </div>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-hidden flex">
        {isOnline ? (
          <AgentChatClient agentId={agentId} />
        ) : (
          <div className="flex items-center justify-center h-full w-full">
            <div className="text-center">
              <svg className="w-16 h-16 text-[#2a2a2a] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
              </svg>
              <p className="text-[#888] text-sm mb-2">Cannot connect to agent</p>
              <p className="text-[#444] text-xs">Please check that the agent is running and try again</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
