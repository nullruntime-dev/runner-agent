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

  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit') || '50';

  try {
    const response = await fetch(`${agent.url}/executions?limit=${limit}`, {
      headers: { Authorization: `Bearer ${agent.token}` },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch executions from agent' },
        { status: response.status }
      );
    }

    const executions = await response.json();

    // Add agent info to each execution
    const executionsWithAgent = executions.map((exec: Record<string, unknown>) => ({
      ...exec,
      agentId: agent.id,
      agentName: agent.name,
    }));

    return NextResponse.json(executionsWithAgent);
  } catch (error) {
    console.error('Failed to fetch executions:', error);
    return NextResponse.json(
      { error: 'Failed to connect to agent' },
      { status: 502 }
    );
  }
}
