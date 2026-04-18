import Link from 'next/link';
import { getAgents, checkAgentHealth, syncAgentExecutions } from '@/lib/agents';
import { Execution } from '@/lib/api';
import prisma from '@/lib/db';
import ExecutionList from '@/components/ExecutionList';
import AgentsList from '@/components/AgentsList';
import HomeSkills from '@/components/HomeSkills';
import HomeAutopilot from '@/components/HomeAutopilot';

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

  // Get the first online agent for skills display
  const firstOnlineAgent = agentsWithStatus.find(a => a.status === 'online');

  return (
    <main className="min-h-screen bg-[#050505]">
      {/* Header */}
      <header className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#111] border border-[#2a2a2a] flex items-center justify-center">
                <span className="text-sm font-bold text-[#00fff2]">G</span>
              </div>
              <span className="text-sm font-semibold text-white tracking-tight">GRIPHOOK</span>
            </div>
            <div className="h-4 w-px bg-[#2a2a2a]" />
            <span className="text-xs text-[#888] uppercase tracking-wider">Control Center</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="h-8 px-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white text-xs font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              SETTINGS
            </Link>
            <Link
              href="/docs"
              className="h-8 px-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white text-xs font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              DOCS
            </Link>
            <Link
              href="/agents"
              className="h-8 px-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white text-xs font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              MANAGE AGENTS
            </Link>
            <Link
              href="/chat"
              className="h-8 px-3 bg-gradient-to-r from-[#00fff2] to-[#00cccc] hover:from-[#00cccc] hover:to-[#00fff2] text-black text-xs font-medium transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,255,242,0.3)]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              AI CHAT
            </Link>
            <Link
              href="/"
              className="h-8 px-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white text-xs font-medium transition-colors flex items-center gap-2"
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
      <div className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#00fff2]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Agents</span>
              <span className="text-lg font-semibold text-white tabular-nums">{onlineAgents}/{agents.length}</span>
            </div>
            <div className="h-4 w-px bg-[#1a1a1a]" />
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
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Agents & Skills */}
          <div className="col-span-3 space-y-6">
            {/* Agents Panel */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a]">
              <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
                <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Connected Agents</h2>
                <span className="text-xs text-[#444]">{agents.length}</span>
              </div>
              <AgentsList agents={agentsWithStatus} />
            </div>

            {/* Autopilot Panel */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a]">
              <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
                <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-[#00fff2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Autopilot
                </h2>
                {firstOnlineAgent && (
                  <Link
                    href={`/agents/${firstOnlineAgent.id}/autopilot`}
                    className="text-xs text-[#00fff2] hover:text-white"
                  >
                    Manage
                  </Link>
                )}
              </div>
              <HomeAutopilot
                agentId={firstOnlineAgent?.id || null}
                isOnline={!!firstOnlineAgent}
              />
            </div>

            {/* Skills Panel */}
            {firstOnlineAgent && (
              <div className="bg-[#0a0a0a] border border-[#1a1a1a]">
                <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Skills</h2>
                  <Link
                    href={`/agents/${firstOnlineAgent.id}/chat`}
                    className="text-xs text-[#00fff2] hover:text-white"
                  >
                    Manage
                  </Link>
                </div>
                <div className="p-2">
                  <HomeSkills
                    agentId={firstOnlineAgent.id}
                    agentName={firstOnlineAgent.name}
                    isOnline={true}
                  />
                </div>
              </div>
            )}

            {/* Skills Getting Started - show when no agents online */}
            {!firstOnlineAgent && agents.length > 0 && (
              <div className="bg-[#0a0a0a] border border-[#1a1a1a]">
                <div className="px-4 py-3 border-b border-[#1a1a1a]">
                  <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Skills</h2>
                </div>
                <div className="p-4 text-center">
                  <svg className="w-8 h-8 text-[#444] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829" />
                  </svg>
                  <p className="text-xs text-[#888]">Agent offline</p>
                  <p className="text-xs text-[#444]">Start an agent to configure skills</p>
                </div>
              </div>
            )}

            {/* Skills Intro - show when no agents at all */}
            {agents.length === 0 && (
              <div className="bg-[#0a0a0a] border border-[#1a1a1a]">
                <div className="px-4 py-3 border-b border-[#1a1a1a]">
                  <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">AI Skills</h2>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#9900ff]/20 border border-[#9900ff]/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[#9900ff]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-white">Slack</p>
                      <p className="text-xs text-[#888]">Send & receive messages</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#ff0044]/20 border border-[#ff0044]/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[#ff0044]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-white">Gmail & SMTP</p>
                      <p className="text-xs text-[#888]">Send email notifications</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#ff00ea]/20 border border-[#ff00ea]/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[#ff00ea]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-white">Wingman</p>
                      <p className="text-xs text-[#888]">AI dating wingman</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#444] pt-2 border-t border-[#1a1a1a]">
                    Add an agent to unlock AI-powered skills
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Main Content - Executions */}
          <div className="col-span-9">
            {agents.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-8 text-center">
                <div className="text-[#444] mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-sm text-[#888] mb-2">No agents connected</p>
                <p className="text-xs text-[#444] mb-4">Add an agent to start monitoring executions</p>
                <Link
                  href="/agents"
                  className="inline-flex h-8 px-4 bg-gradient-to-r from-[#00fff2] to-[#00cccc] text-black text-xs font-semibold items-center shadow-[0_0_20px_rgba(0,255,242,0.3)]"
                >
                  ADD AGENT
                </Link>
              </div>
            ) : (
              <div className="bg-[#0a0a0a] border border-[#1a1a1a]">
                <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Recent Executions</h2>
                  <span className="text-xs text-[#444]">{executions.length} total</span>
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
