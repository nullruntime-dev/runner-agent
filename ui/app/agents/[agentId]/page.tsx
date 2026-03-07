import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAgent, checkAgentHealth, syncAgentExecutions } from '@/lib/agents';
import { Execution } from '@/lib/api';
import prisma from '@/lib/db';
import ExecutionList from '@/components/ExecutionList';
import DeleteAgentButton from '@/components/DeleteAgentButton';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ agentId: string }>;
}

async function getAgentExecutions(agentId: string): Promise<Execution[]> {
  const executions = await prisma.execution.findMany({
    where: { agentId },
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

export default async function AgentDetailPage({ params }: PageProps) {
  const { agentId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    notFound();
  }

  const isOnline = await checkAgentHealth(agent);

  // Sync if online
  if (isOnline) {
    await syncAgentExecutions(agent);
  }

  const executions = await getAgentExecutions(agentId);

  const runningCount = executions.filter(e => e.status === 'RUNNING').length;
  const successCount = executions.filter(e => e.status === 'SUCCESS').length;
  const failedCount = executions.filter(e => e.status === 'FAILED').length;

  return (
    <main className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="h-4 w-px bg-neutral-700" />
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-semibold text-white tracking-tight">{agent.name}</span>
            </div>
            <div className="h-4 w-px bg-neutral-700" />
            <span className="text-xs text-neutral-500">{agent.url}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
            <DeleteAgentButton agentId={agentId} agentName={agent.name} />
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-8">
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
            <div className="ml-auto text-xs text-neutral-600">
              {executions.length} total executions
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {!isOnline && (
          <div className="bg-amber-950 border border-amber-900 p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-amber-400">Agent Offline</div>
                <div className="text-xs text-amber-500 mt-0.5">Showing cached data. Cannot connect to {agent.url}</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-neutral-900 border border-neutral-800">
          <div className="px-4 py-3 border-b border-neutral-800">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Executions</h2>
          </div>
          <ExecutionList executions={executions} showAgent={false} />
        </div>
      </div>
    </main>
  );
}
