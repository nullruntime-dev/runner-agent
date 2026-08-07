import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents';
import { proxyToAgent } from '@/lib/proxy';

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
    const res = await proxyToAgent(agent, '/executors', { cache: 'no-store' });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch executors:', error);
    return NextResponse.json({ error: 'Failed to fetch executors' }, { status: 500 });
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

    const res = await proxyToAgent(agent, '/executors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Failed to create executor:', error);
    return NextResponse.json({ error: 'Failed to create executor' }, { status: 500 });
  }
}