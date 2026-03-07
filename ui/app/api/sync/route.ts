import { NextResponse } from 'next/server';
import { getAgents, syncAgentExecutions } from '@/lib/agents';

// Sync all executions from all agents
export async function POST() {
  try {
    const agents = await getAgents();
    const results = await Promise.all(
      agents.map(async (agent) => {
        const synced = await syncAgentExecutions(agent);
        return { agentId: agent.id, agentName: agent.name, synced };
      })
    );

    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);

    return NextResponse.json({
      success: true,
      totalSynced,
      agents: results,
    });
  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    );
  }
}
