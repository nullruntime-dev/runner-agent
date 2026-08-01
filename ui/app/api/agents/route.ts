import { NextRequest, NextResponse } from 'next/server';
import { getAgents, addAgent, checkAgentHealth, syncAgentExecutions } from '@/lib/agents';

function resolveBaseUrl(submittedUrl: string): string {
  const override = process.env.AGENT_URL?.trim();
  if (override) return override.replace(/\/+$/, '');
  let normalized = submittedUrl.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `http://${normalized}`;
  }
  return normalized.replace(/\/+$/, '');
}

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

    const resolvedUrl = resolveBaseUrl(url);
    let storedUrl = url.trim();
    if (!storedUrl.startsWith('http://') && !storedUrl.startsWith('https://')) {
      storedUrl = `http://${storedUrl}`;
    }
    // Catch the common typo `host.8090` instead of `host:8090` — without this
    // the agent card displays a broken URL even though the runtime uses AGENT_URL.
    const dotPortMatch = storedUrl.match(/^(https?:\/\/[^\/]+)\.(\d+)(\/.*)?$/i);
    if (dotPortMatch) {
      storedUrl = `${dotPortMatch[1]}:${dotPortMatch[2]}${dotPortMatch[3] || ''}`;
    }
    storedUrl = storedUrl.replace(/\/$/, '');

    // Test connection to agent
    try {
      const healthResponse = await fetch(`${resolvedUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!healthResponse.ok) {
        return NextResponse.json(
          { error: `Could not connect to agent: health check failed (${healthResponse.status})` },
          { status: 400 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Could not connect to agent at ${resolvedUrl}: ${err instanceof Error ? err.message : 'connection failed'}` },
        { status: 400 }
      );
    }

    // Test authentication
    try {
      const authResponse = await fetch(`${resolvedUrl}/executions?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (authResponse.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API token' },
          { status: 400 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Could not verify authentication: ${err instanceof Error ? err.message : 'connection failed'}` },
        { status: 400 }
      );
    }

    const agent = await addAgent({ name, url: storedUrl, token });

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
