import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAgent, checkAgentHealth, syncAgentExecutions } from '@/lib/agents';
import { Execution } from '@/lib/api';
import prisma from '@/lib/db';
import ExecutionList from '@/components/ExecutionList';
import DeleteAgentButton from '@/components/DeleteAgentButton';
import AgentSkills from '@/components/AgentSkills';

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
    <main className="min-h-screen bg-[#050505]">
      {/* Header */}
      <header className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-[#888] hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="h-4 w-px bg-[#2a2a2a]" />
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${isOnline ? 'bg-[#00ff66] shadow-[0_0_8px_rgba(0,255,102,0.5)]' : 'bg-[#ff0044]'}`} />
              <span className="text-sm font-semibold text-white tracking-tight">{agent.name}</span>
            </div>
            <div className="h-4 w-px bg-[#2a2a2a]" />
            <span className="text-xs text-[#888]">{agent.url}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${isOnline ? 'text-[#00ff66]' : 'text-[#ff0044]'}`}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
            {isOnline && (
              <Link
                href={`/agents/${agentId}/chat`}
                className="h-8 px-3 bg-gradient-to-r from-[#00fff2] to-[#00cccc] hover:from-[#00cccc] hover:to-[#00fff2] text-black text-xs font-medium transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,255,242,0.3)]"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                AI CHAT
              </Link>
            )}
            <DeleteAgentButton agentId={agentId} agentName={agent.name} />
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#ff6600]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Running</span>
              <span className="text-lg font-semibold text-white tabular-nums">{runningCount}</span>
            </div>
            <div className="h-4 w-px bg-[#1a1a1a]" />
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#00ff66]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Success</span>
              <span className="text-lg font-semibold text-white tabular-nums">{successCount}</span>
            </div>
            <div className="h-4 w-px bg-[#1a1a1a]" />
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#ff0044]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Failed</span>
              <span className="text-lg font-semibold text-white tabular-nums">{failedCount}</span>
            </div>
            <div className="ml-auto text-xs text-[#444]">
              {executions.length} total executions
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {!isOnline && (
          <div className="bg-[#ff6600]/10 border border-[#ff6600]/30 p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#ff6600]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-[#ff6600]">Agent Offline</div>
                <div className="text-xs text-[#ff6600]/80 mt-0.5">Showing cached data. Cannot connect to {agent.url}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Skills Panel */}
          <div className="col-span-3">
            <div className="bg-[#0a0a0a] border border-[#1a1a1a]">
              <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
                <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Skills</h2>
              </div>
              <AgentSkills agentId={agentId} isOnline={isOnline} />
            </div>
          </div>

          {/* Executions Panel */}
          <div className="col-span-9">
            <div className="bg-[#0a0a0a] border border-[#1a1a1a]">
              <div className="px-4 py-3 border-b border-[#1a1a1a]">
                <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Executions</h2>
              </div>
              <ExecutionList executions={executions} showAgent={false} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
