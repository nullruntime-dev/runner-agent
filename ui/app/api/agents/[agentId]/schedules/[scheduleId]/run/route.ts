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
    const res = await fetch(`${agent.url}/agent/schedules/${scheduleId}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${agent.token}`,
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Failed to run schedule:', error);
    return NextResponse.json({ error: 'Failed to run schedule' }, { status: 500 });
  }
}
