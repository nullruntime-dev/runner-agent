import { NextRequest } from 'next/server';
import { getAgent } from '@/lib/agents';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return new Response(JSON.stringify({ error: 'Agent not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId') || '';
  const message = searchParams.get('message') || '';

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = `${agent.url}/agent/chat/stream?sessionId=${encodeURIComponent(sessionId)}&message=${encodeURIComponent(message)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${agent.token}`,
        'Accept': 'text/event-stream',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error: error || 'Failed to start chat stream' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pass through the SSE stream
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat stream error:', error);
    return new Response(JSON.stringify({ error: 'Failed to communicate with agent' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
