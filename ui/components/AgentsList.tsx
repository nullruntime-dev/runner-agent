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
        <p className="text-xs text-neutral-600">No agents configured</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-neutral-800">
      {agents.map((agent) => (
        <Link
          key={agent.id}
          href={`/agents/${agent.id}`}
          className="block px-4 py-3 hover:bg-neutral-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 ${agent.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-neutral-200 truncate">{agent.name}</div>
              <div className="text-xs text-neutral-600 truncate">{agent.url}</div>
            </div>
            <svg className="w-4 h-4 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  );
}
