import Link from 'next/link';
import { getAgents, checkAgentHealth } from '@/lib/agents';
import AddAgentForm from '@/components/AddAgentForm';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const agents = await getAgents();

  const agentsWithStatus = await Promise.all(
    agents.map(async (agent) => ({
      ...agent,
      status: (await checkAgentHealth(agent)) ? 'online' as const : 'offline' as const,
      token: undefined,
    }))
  );

  return (
    <main className="min-h-screen bg-[#050505]">
      {/* Header */}
      <header className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-[#888] hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="h-4 w-px bg-[#2a2a2a]" />
            <span className="text-sm font-semibold text-white tracking-tight">MANAGE AGENTS</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 gap-8">
          {/* Add Agent Form */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a]">
            <div className="px-4 py-3 border-b border-[#1a1a1a]">
              <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Add New Agent</h2>
            </div>
            <div className="p-4">
              <AddAgentForm />
            </div>
          </div>

          {/* Agents List */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a]">
            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Registered Agents</h2>
              <span className="text-xs text-[#444]">{agents.length}</span>
            </div>
            {agentsWithStatus.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-[#888]">No agents registered</p>
                <p className="text-xs text-[#444] mt-1">Add an agent using the form</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1a1a1a]">
                {agentsWithStatus.map((agent) => (
                  <div key={agent.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 ${agent.status === 'online' ? 'bg-[#00ff66]' : 'bg-[#ff0044]'}`} />
                      <div>
                        <div className="text-sm text-white">{agent.name}</div>
                        <div className="text-xs text-[#444]">{agent.url}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${agent.status === 'online' ? 'text-[#00ff66]' : 'text-[#ff0044]'}`}>
                        {agent.status.toUpperCase()}
                      </span>
                      <Link
                        href={`/agents/${agent.id}`}
                        className="text-xs text-[#888] hover:text-[#00fff2]"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
