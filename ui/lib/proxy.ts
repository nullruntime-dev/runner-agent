import { Agent } from './agents';

// Default token used by the backend Spring Boot service when AGENT_TOKEN env is not set.
// Sourced from application.yml: agent.token: ${AGENT_TOKEN:1234}
export const DEFAULT_AGENT_TOKEN = '1234';

export function resolveAgentToken(agent: Pick<Agent, 'token'>): string {
  if (typeof agent.token === 'string' && agent.token.trim().length > 0) {
    return agent.token;
  }
  return DEFAULT_AGENT_TOKEN;
}

function resolveAgentBaseUrl(agent: Pick<Agent, 'url'>): string {
  const override = process.env.AGENT_URL?.trim();
  if (override) return override.replace(/\/+$/, '');
  return agent.url.replace(/\/+$/, '');
}

export async function proxyToAgent(
  agent: Pick<Agent, 'url' | 'token'>,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const baseUrl = resolveAgentBaseUrl(agent);
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(init.headers);
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${resolveAgentToken(agent)}`);
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  return fetch(url, { ...init, headers });
}
