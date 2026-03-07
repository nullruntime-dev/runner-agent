import { NextRequest, NextResponse } from 'next/server';
import { getAgent, removeAgent } from '@/lib/agents';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...agent,
    token: undefined,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  try {
    await removeAgent(agentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove agent:', error);
    return NextResponse.json({ error: 'Failed to remove agent' }, { status: 500 });
  }
}
