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

// Chat types and functions

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  sessionId?: string;
  message: string;
}

export interface ChatResponse {
  sessionId: string;
  response: string;
}

export async function sendChatMessage(
  agentId: string,
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  const res = await fetch(`/api/agents/${agentId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });
  if (!res.ok) throw new Error('Failed to send chat message');
  return res.json();
}

export function getChatStreamUrl(agentId: string, sessionId: string, message: string): string {
  return `/api/agents/${agentId}/chat/stream?sessionId=${encodeURIComponent(sessionId)}&message=${encodeURIComponent(message)}`;
}

// Skill types and functions

export interface SkillConfigField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  description: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface Skill {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  configFields: SkillConfigField[];
  configured: boolean;
  enabled: boolean;
}

export async function getSkills(agentId: string): Promise<Skill[]> {
  const res = await fetch(`/api/agents/${agentId}/skills`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch skills');
  return res.json();
}

export async function configureSkill(
  agentId: string,
  skillName: string,
  config: Record<string, string>,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/agents/${agentId}/skills/${skillName}/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, enabled }),
  });
  return res.json();
}

export async function deactivateSkill(
  agentId: string,
  skillName: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/agents/${agentId}/skills/${skillName}`, {
    method: 'DELETE',
  });
  return res.json();
}

// Gmail API OAuth types and functions

export interface GmailAuthStatus {
  configured: boolean;
  authorized: boolean;
  email: string;
  ready: boolean;
}

export interface GmailAuthUrl {
  authUrl: string;
  redirectUri: string;
  message: string;
}

export async function getGmailAuthStatus(agentId: string): Promise<GmailAuthStatus> {
  const res = await fetch(`/api/agents/${agentId}/gmail/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch Gmail auth status');
  return res.json();
}

export async function getGmailAuthUrl(agentId: string): Promise<GmailAuthUrl> {
  const res = await fetch(`/api/agents/${agentId}/gmail/auth-url`, { cache: 'no-store' });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to get Gmail auth URL');
  }
  return res.json();
}

export async function revokeGmailAuth(agentId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/agents/${agentId}/gmail/revoke`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to revoke Gmail auth');
  return res.json();
}

// Custom Skill types and functions

export type CustomSkillType = 'COMMAND' | 'PROMPT' | 'WORKFLOW';

export interface CustomSkill {
  id: number;
  name: string;
  displayName: string;
  description: string;
  type: CustomSkillType;
  definitionJson: string;
  icon: string;
  enabled: boolean;
  executionCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateCustomSkillRequest {
  name: string;
  displayName?: string;
  description: string;
  type: CustomSkillType;
  definitionJson: string;
  icon?: string;
}

export interface UpdateCustomSkillRequest {
  displayName?: string;
  description?: string;
  definitionJson?: string;
  icon?: string;
}

export interface RunCustomSkillRequest {
  input?: string;
  params?: Record<string, unknown>;
}

export async function getCustomSkills(agentId: string): Promise<CustomSkill[]> {
  const res = await fetch(`/api/agents/${agentId}/custom-skills`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch custom skills');
  return res.json();
}

export async function getCustomSkill(agentId: string, name: string): Promise<CustomSkill> {
  const res = await fetch(`/api/agents/${agentId}/custom-skills/${name}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch custom skill');
  return res.json();
}

export async function createCustomSkill(
  agentId: string,
  skill: CreateCustomSkillRequest
): Promise<{ success: boolean; skill?: CustomSkill; error?: string }> {
  const res = await fetch(`/api/agents/${agentId}/custom-skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(skill),
  });
  return res.json();
}

export async function updateCustomSkill(
  agentId: string,
  name: string,
  updates: UpdateCustomSkillRequest
): Promise<{ success: boolean; skill?: CustomSkill; error?: string }> {
  const res = await fetch(`/api/agents/${agentId}/custom-skills/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deleteCustomSkill(
  agentId: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/agents/${agentId}/custom-skills/${name}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function toggleCustomSkill(
  agentId: string,
  name: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/agents/${agentId}/custom-skills/${name}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  return res.json();
}

export async function runCustomSkill(
  agentId: string,
  name: string,
  request?: RunCustomSkillRequest
): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/agents/${agentId}/custom-skills/${name}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request || {}),
  });
  return res.json();
}
