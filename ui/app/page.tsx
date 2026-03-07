import Link from 'next/link';
import { getAgents, checkAgentHealth, syncAgentExecutions } from '@/lib/agents';
import { Execution } from '@/lib/api';
import prisma from '@/lib/db';
import ExecutionList from '@/components/ExecutionList';
import AgentsList from '@/components/AgentsList';

export const dynamic = 'force-dynamic';

async function syncAndFetchExecutions(agents: { id: string; name: string; url: string; token: string }[]): Promise<Execution[]> {
  // Sync from all agents
  await Promise.all(agents.map(agent => syncAgentExecutions(agent)));

  // Fetch from local database
  const executions = await prisma.execution.findMany({
    include: {
      agent: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return executions.map((exec) => ({
    id: exec.id,
    name: exec.name,
    status: exec.status as Execution['status'],
    shell: exec.shell || '',
    workingDir: exec.workingDir || '',
    exitCode: exec.exitCode,
    error: exec.error,
    startedAt: exec.startedAt?.toISOString() || null,
    completedAt: exec.completedAt?.toISOString() || null,
    createdAt: exec.createdAt.toISOString(),
    agentId: exec.agent.id,
    agentName: exec.agent.name,
  }));
}

export default async function Home() {
  const agents = await getAgents();

  // Check health and sync
  const agentsWithStatus = await Promise.all(
    agents.map(async (agent) => ({
      ...agent,
      status: (await checkAgentHealth(agent)) ? 'online' as const : 'offline' as const,
      token: undefined,
    }))
  );

  const executions = await syncAndFetchExecutions(agents);

  const runningCount = executions.filter(e => e.status === 'RUNNING').length;
  const successCount = executions.filter(e => e.status === 'SUCCESS').length;
  const failedCount = executions.filter(e => e.status === 'FAILED').length;
  const onlineAgents = agentsWithStatus.filter(a => a.status === 'online').length;

  return (
    <main className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white flex items-center justify-center">
                <svg className="w-4 h-4 text-neutral-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white tracking-tight">RUNNER AGENT</span>
            </div>
            <div className="h-4 w-px bg-neutral-700" />
            <span className="text-xs text-neutral-500 uppercase tracking-wider">Control Center</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className="h-8 px-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              DOCS
            </Link>
            <Link
              href="/agents"
              className="h-8 px-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              MANAGE AGENTS
            </Link>
            <Link
              href="/"
              className="h-8 px-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-medium transition-colors flex items-center gap-2"
              prefetch={false}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              REFRESH
            </Link>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500" />
              <span className="text-xs text-neutral-400 uppercase tracking-wider">Agents</span>
              <span className="text-lg font-semibold text-white tabular-nums">{onlineAgents}/{agents.length}</span>
            </div>
            <div className="h-4 w-px bg-neutral-800" />
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-amber-500" />
              <span className="text-xs text-neutral-400 uppercase tracking-wider">Running</span>
              <span className="text-lg font-semibold text-white tabular-nums">{runningCount}</span>
            </div>
            <div className="h-4 w-px bg-neutral-800" />
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500" />
              <span className="text-xs text-neutral-400 uppercase tracking-wider">Success</span>
              <span className="text-lg font-semibold text-white tabular-nums">{successCount}</span>
            </div>
            <div className="h-4 w-px bg-neutral-800" />
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500" />
              <span className="text-xs text-neutral-400 uppercase tracking-wider">Failed</span>
              <span className="text-lg font-semibold text-white tabular-nums">{failedCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Agents Panel */}
          <div className="col-span-3">
            <div className="bg-neutral-900 border border-neutral-800">
              <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Connected Agents</h2>
                <span className="text-xs text-neutral-600">{agents.length}</span>
              </div>
              <AgentsList agents={agentsWithStatus} />
            </div>
          </div>

          {/* Executions Panel */}
          <div className="col-span-9">
            {agents.length === 0 ? (
              <div className="bg-neutral-900 border border-neutral-800 p-8 text-center">
                <div className="text-neutral-600 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-sm text-neutral-400 mb-2">No agents connected</p>
                <p className="text-xs text-neutral-600 mb-4">Add a runner agent to start monitoring executions</p>
                <Link
                  href="/agents"
                  className="inline-flex h-8 px-4 bg-white text-neutral-900 text-xs font-semibold items-center"
                >
                  ADD AGENT
                </Link>
              </div>
            ) : (
              <div className="bg-neutral-900 border border-neutral-800">
                <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Recent Executions</h2>
                  <span className="text-xs text-neutral-600">{executions.length} total</span>
                </div>
                <ExecutionList executions={executions} showAgent={true} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
