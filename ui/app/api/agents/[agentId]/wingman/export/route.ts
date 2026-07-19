import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const response = await fetch(`${agent.url}/wingman/export`, {
      headers: {
        'Authorization': `Bearer ${agent.token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to export wingman history' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Wingman export error:', error);
    return NextResponse.json(
      { error: 'Failed to communicate with agent' },
      { status: 500 }
    );
  }
}
