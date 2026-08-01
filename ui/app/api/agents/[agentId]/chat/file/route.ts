import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents';
import { proxyToAgent } from '@/lib/proxy';

export const runtime = 'nodejs';

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
    const inbound = await request.formData();
    const file = inbound.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const fd = new FormData();
    fd.append('file', file as Blob, (file as Blob & { name?: string }).name ?? 'upload.bin');
    const message = inbound.get('message');
    if (typeof message === 'string') fd.append('message', message);
    const sessionId = inbound.get('sessionId');
    if (typeof sessionId === 'string') fd.append('sessionId', sessionId);
    const skill = inbound.get('skill');
    if (typeof skill === 'string') fd.append('skill', skill);

    const response = await proxyToAgent(agent, '/agent/chat/file', {
      method: 'POST',
      body: fd,
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to send chat message with file' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Chat-with-file error:', error);
    return NextResponse.json(
      { error: 'Failed to communicate with agent' },
      { status: 500 }
    );
  }
}
