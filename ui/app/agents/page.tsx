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
    <main className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="h-4 w-px bg-neutral-700" />
            <span className="text-sm font-semibold text-white tracking-tight">MANAGE AGENTS</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 gap-8">
          {/* Add Agent Form */}
          <div className="bg-neutral-900 border border-neutral-800">
            <div className="px-4 py-3 border-b border-neutral-800">
              <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Add New Agent</h2>
            </div>
            <div className="p-4">
              <AddAgentForm />
            </div>
          </div>

          {/* Agents List */}
          <div className="bg-neutral-900 border border-neutral-800">
            <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Registered Agents</h2>
              <span className="text-xs text-neutral-600">{agents.length}</span>
            </div>
            {agentsWithStatus.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-neutral-500">No agents registered</p>
                <p className="text-xs text-neutral-600 mt-1">Add an agent using the form</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-800">
                {agentsWithStatus.map((agent) => (
                  <div key={agent.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 ${agent.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="text-sm text-neutral-200">{agent.name}</div>
                        <div className="text-xs text-neutral-600">{agent.url}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${agent.status === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                        {agent.status.toUpperCase()}
                      </span>
                      <Link
                        href={`/agents/${agent.id}`}
                        className="text-xs text-neutral-500 hover:text-neutral-300"
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
