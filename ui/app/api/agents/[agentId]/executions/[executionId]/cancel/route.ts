import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string; executionId: string }> }
) {
  const { agentId, executionId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const response = await fetch(`${agent.url}/execution/${executionId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${agent.token}` },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to cancel execution' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to cancel execution:', error);
    return NextResponse.json(
      { error: 'Failed to connect to agent' },
      { status: 502 }
    );
  }
}
