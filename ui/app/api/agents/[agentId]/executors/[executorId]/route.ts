import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents';
import { proxyToAgent } from '@/lib/proxy';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string; executorId: string }> }
) {
  const { agentId, executorId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const res = await proxyToAgent(agent, `/executors/${executorId}`, {
      method: 'DELETE',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Failed to delete executor:', error);
    return NextResponse.json({ error: 'Failed to delete executor' }, { status: 500 });
  }
}