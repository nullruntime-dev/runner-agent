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
    <main>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold text-white mb-6">Manage Agents</h1>
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
