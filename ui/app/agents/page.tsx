import { getAgents, checkAgentHealth } from '@/lib/agents';
import AddAgentForm from '@/components/AddAgentForm';
import AgentsListClient from '@/components/AgentsListClient';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const agents = await getAgents();

  const agentsWithStatus = await Promise.all(
    agents.map(async (agent) => {
      const status = await checkAgentHealth(agent);
      return { ...agent, status: status ? ('online' as const) : ('offline' as const) };
    })
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
            <AgentsListClient agents={agentsWithStatus} />
          </div>
        </div>
      </div>
    </main>
  );
}
