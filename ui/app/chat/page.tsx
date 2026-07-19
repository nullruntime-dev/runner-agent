import Link from 'next/link';
import { getAgents, checkAgentHealth } from '@/lib/agents';
import ChatPageClient from '@/components/ChatPageClient';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const agents = await getAgents();

  // Check health of all agents
  const agentsWithStatus = await Promise.all(
    agents.map(async (agent) => ({
      id: agent.id,
      name: agent.name,
      url: agent.url,
      status: (await checkAgentHealth(agent)) ? 'online' as const : 'offline' as const,
    }))
  );

  const onlineAgents = agentsWithStatus.filter(a => a.status === 'online');

  return (
    <main className="h-[calc(100vh-3.5rem)] flex flex-col">
      {onlineAgents.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <svg className="w-16 h-16 text-[#444] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
            <p className="text-[#888] text-sm mb-2">No agents online</p>
            <p className="text-[#444] text-xs mb-4">Start an agent to begin chatting</p>
            <Link
              href="/agents"
              className="inline-flex h-8 px-4 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white text-xs font-medium items-center transition-colors"
            >
              Manage Agents
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <ChatPageClient agents={onlineAgents} />
        </div>
      )}
    </main>
  );
}
