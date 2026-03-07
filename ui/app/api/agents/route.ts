import { NextRequest, NextResponse } from 'next/server';
import { getAgents, addAgent, checkAgentHealth, syncAgentExecutions } from '@/lib/agents';

export async function GET() {
  const agents = await getAgents();

  // Check health status for each agent
  const agentsWithStatus = await Promise.all(
    agents.map(async (agent) => {
      const isOnline = await checkAgentHealth(agent);
      return {
        id: agent.id,
        name: agent.name,
        url: agent.url,
        status: isOnline ? 'online' : 'offline',
        createdAt: agent.createdAt,
      };
    })
  );

  return NextResponse.json(agentsWithStatus);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, token } = body;

    if (!name || !url || !token) {
      return NextResponse.json(
        { error: 'Missing required fields: name, url, token' },
        { status: 400 }
      );
    }

    // Validate URL format
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `http://${normalizedUrl}`;
    }
    // Remove trailing slash
    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    // Test connection to agent
    try {
      const healthResponse = await fetch(`${normalizedUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!healthResponse.ok) {
        return NextResponse.json(
          { error: 'Could not connect to agent: health check failed' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Could not connect to agent: connection failed' },
        { status: 400 }
      );
    }

    // Test authentication
    try {
      const authResponse = await fetch(`${normalizedUrl}/executions?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (authResponse.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API token' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Could not verify authentication' },
        { status: 400 }
      );
    }

    const agent = await addAgent({ name, url: normalizedUrl, token });

    // Sync executions from the new agent
    await syncAgentExecutions(agent);

    return NextResponse.json({
      id: agent.id,
      name: agent.name,
      url: agent.url,
      status: 'online',
    });
  } catch (error) {
    console.error('Failed to add agent:', error);
    return NextResponse.json(
      { error: 'Failed to add agent' },
      { status: 500 }
    );
  }
}
