export interface Step {
  id: number;
  stepIndex: number;
  name: string;
  run: string;
  status: string;
  exitCode: number | null;
  output: string | null;
  error: string | null;
  continueOnError: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Execution {
  id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  shell: string;
  workingDir: string;
  exitCode: number | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  steps?: Step[];
  agentId?: string;
  agentName?: string;
}

export interface LogLine {
  id: number;
  executionId: string;
  stepName: string;
  line: string;
  stream: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  url: string;
  token: string;
  status?: 'online' | 'offline' | 'unknown';
}

// Client-side API calls (through Next.js API routes)

export async function getAgents(): Promise<Agent[]> {
  const res = await fetch('/api/agents', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export async function addAgent(agent: { name: string; url: string; token: string }): Promise<Agent> {
  const res = await fetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agent),
  });
  if (!res.ok) throw new Error('Failed to add agent');
  return res.json();
}

export async function removeAgent(id: string): Promise<void> {
  const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove agent');
}

export async function getExecutions(agentId?: string): Promise<Execution[]> {
  const url = agentId ? `/api/executions?agentId=${agentId}` : '/api/executions';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch executions');
  return res.json();
}

export async function getExecution(agentId: string, executionId: string): Promise<Execution> {
  const res = await fetch(`/api/agents/${agentId}/executions/${executionId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch execution');
  return res.json();
}

export async function getExecutionClient(agentId: string, executionId: string): Promise<Execution> {
  const res = await fetch(`/api/agents/${agentId}/executions/${executionId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch execution');
  return res.json();
}

export async function cancelExecution(agentId: string, executionId: string): Promise<void> {
  const res = await fetch(`/api/agents/${agentId}/executions/${executionId}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to cancel execution');
}

export function getLogsStreamUrl(agentId: string, executionId: string): string {
  return `/api/agents/${agentId}/executions/${executionId}/logs`;
}
