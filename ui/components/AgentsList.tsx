'use client';

import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  url: string;
  status: 'online' | 'offline' | 'unknown';
}

interface AgentsListProps {
  agents: Agent[];
}

export default function AgentsList({ agents }: AgentsListProps) {
  if (agents.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-[#444]">No agents configured</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#1a1a1a]">
      {agents.map((agent) => (
        <div key={agent.id} className="px-4 py-3 hover:bg-[#111] transition-colors">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 ${agent.status === 'online' ? 'bg-[#00ff66] shadow-[0_0_8px_rgba(0,255,102,0.5)]' : 'bg-[#ff0044]'}`} />
            <Link href={`/agents/${agent.id}`} className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{agent.name}</div>
              <div className="text-xs text-[#444] truncate">{agent.url}</div>
            </Link>
            <div className="flex items-center gap-1">
              {agent.status === 'online' && (
                <Link
                  href={`/agents/${agent.id}/chat`}
                  className="p-1.5 text-[#888] hover:text-[#00fff2] hover:bg-[#1a1a1a] transition-colors"
                  title="AI Chat"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </Link>
              )}
              <Link
                href={`/agents/${agent.id}`}
                className="p-1.5 text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
