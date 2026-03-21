import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAgent, syncExecutionDetails } from '@/lib/agents';
import { Execution } from '@/lib/api';
import prisma from '@/lib/db';
import ExecutionDetail from '@/components/ExecutionDetail';
import { Step } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ agentId: string; executionId: string }>;
}

async function getExecution(agentId: string, executionId: string): Promise<Execution | null> {
  const exec = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      agent: { select: { id: true, name: true } },
      steps: { orderBy: { stepIndex: 'asc' } },
    },
  });

  if (!exec || exec.agentId !== agentId) return null;

  return {
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
    steps: exec.steps.map((step: Step) => ({
      id: step.id,
      stepIndex: step.stepIndex,
      name: step.name,
      run: step.run,
      status: step.status || 'PENDING',
      exitCode: step.exitCode,
      output: step.output,
      error: step.error,
      continueOnError: step.continueOnError,
      startedAt: step.startedAt?.toISOString() || null,
      completedAt: step.completedAt?.toISOString() || null,
    })),
  };
}

export default async function ExecutionPage({ params }: PageProps) {
  const { agentId, executionId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    notFound();
  }

  // Sync execution details from agent
  await syncExecutionDetails(agent, executionId);

  const execution = await getExecution(agentId, executionId);

  if (!execution) {
    notFound();
  }

  return (
    <main className="h-screen flex flex-col bg-[#050505]">
      {/* Top navigation */}
      <header className="bg-[#0a0a0a] border-b border-[#1a1a1a] flex-shrink-0">
        <div className="h-12 px-4 flex items-center gap-4">
          <Link
            href={`/agents/${agentId}`}
            className="flex items-center gap-2 text-[#888] hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-xs font-medium uppercase tracking-wider">Back</span>
          </Link>
          <div className="h-4 w-px bg-[#1a1a1a]" />
          <span className="text-xs text-[#888]">{agent.name}</span>
          <div className="h-4 w-px bg-[#1a1a1a]" />
          <span className="text-xs text-[#444] uppercase tracking-wider">Execution</span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <ExecutionDetail
          agentId={agentId}
          executionId={executionId}
          initialExecution={execution}
        />
      </div>
    </main>
  );
}
