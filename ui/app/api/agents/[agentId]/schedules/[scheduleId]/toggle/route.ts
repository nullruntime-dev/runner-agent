import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string; scheduleId: string }> }
) {
  const { agentId, scheduleId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const body = await request.json();

    const res = await fetch(`${agent.url}/agent/schedules/${scheduleId}/toggle`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${agent.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Failed to toggle schedule:', error);
    return NextResponse.json({ error: 'Failed to toggle schedule' }, { status: 500 });
  }
}
