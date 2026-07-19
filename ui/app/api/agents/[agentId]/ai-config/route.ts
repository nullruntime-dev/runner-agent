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
    const response = await fetch(`${agent.url}/agent/ai-config`, {
      headers: {
        'Authorization': `Bearer ${agent.token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch AI config' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('AI config fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to communicate with agent' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const body = await request.json();

    const response = await fetch(`${agent.url}/agent/ai-config`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${agent.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to update AI config' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('AI config update error:', error);
    return NextResponse.json(
      { error: 'Failed to communicate with agent' },
      { status: 500 }
    );
  }
}
