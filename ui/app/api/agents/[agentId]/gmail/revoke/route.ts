import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const response = await fetch(`${agent.url}/agent/gmail/auth`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${agent.token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to revoke Gmail auth' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Gmail revoke error:', error);
    return NextResponse.json(
      { error: 'Failed to communicate with agent' },
      { status: 500 }
    );
  }
}
