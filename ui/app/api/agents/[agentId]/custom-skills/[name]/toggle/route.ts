import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string; name: string }> }
) {
  const { agentId, name } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const body = await request.json();

    const response = await fetch(`${agent.url}/agent/custom-skills/${name}/toggle`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${agent.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Custom skill toggle error:', error);
    return NextResponse.json(
      { error: 'Failed to communicate with agent' },
      { status: 500 }
    );
  }
}
