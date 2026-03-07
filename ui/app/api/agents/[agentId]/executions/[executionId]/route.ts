import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string; executionId: string }> }
) {
  const { agentId, executionId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const response = await fetch(`${agent.url}/execution/${executionId}`, {
      headers: { Authorization: `Bearer ${agent.token}` },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch execution from agent' },
        { status: response.status }
      );
    }

    const execution = await response.json();

    return NextResponse.json({
      ...execution,
      agentId: agent.id,
      agentName: agent.name,
    });
  } catch (error) {
    console.error('Failed to fetch execution:', error);
    return NextResponse.json(
      { error: 'Failed to connect to agent' },
      { status: 502 }
    );
  }
}
