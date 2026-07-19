import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAgent, checkAgentHealth } from '@/lib/agents';
import AutopilotClient from './AutopilotClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ agentId: string }>;
}

export default async function AutopilotPage({ params }: PageProps) {
  const { agentId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    notFound();
  }

  const isOnline = await checkAgentHealth(agent);

  return (
    <main>
      {/* Context Bar */}
      <div className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-6 h-10 flex items-center gap-4">
          <Link href={`/agents/${agentId}`} className="flex items-center gap-2 text-[#888] hover:text-white transition-colors text-xs">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </Link>
          <div className="h-4 w-px bg-[#2a2a2a]" />
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 ${isOnline ? 'bg-[#00ff66]' : 'bg-[#ff0044]'}`} />
            <span className="text-sm text-white">{agent.name}</span>
          </div>
          <div className="h-4 w-px bg-[#2a2a2a]" />
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#00fff2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-[#888]">Autopilot</span>
          </div>
        </div>
      </div>

      {/* Offline Warning */}
      {!isOnline && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-[#ff6600]/10 border border-[#ff6600]/30 p-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#ff6600]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-[#ff6600]">Agent Offline</div>
                <div className="text-xs text-[#ff6600]/80 mt-0.5">Cannot manage schedules while agent is offline</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <AutopilotClient agentId={agentId} isOnline={isOnline} agentName={agent.name} />
    </main>
  );
}
