// Health endpoint response
export interface HealthResponse {
  status: string;
  agentName: string;
  provider: string;
  model: string;
  workingDir: string;
  defaultShell: string;
  adkEnabled: boolean;
}

// Skill from backend
export interface Skill {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  configured: boolean;
  enabled: boolean;
  hidden: boolean;
  configFields?: Array<{
    name: string;
    label: string;
    type: string;
    description: string;
    required: boolean;
    placeholder?: string;
  }>;
}

// Skills response is array
export type SkillsResponse = Skill[];

// Chat message
export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

// Tool call within a message
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  output?: string;
  exitCode?: number;
  duration?: number;
  status: 'pending' | 'running' | 'success' | 'error';
}

// Chat session
export interface ChatSession {
  id: string;
  agentId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

// Execution
export interface Execution {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  command?: string;
  exitCode?: number;
  startTime: number;
  endTime?: number;
}

// Chat request
export interface ChatRequest {
  message: string;
  sessionId?: string;
  agentId?: string;
}

// Chat response (non-streaming)
export interface ChatResponse {
  sessionId: string;
  response: string;
  toolCalls?: ToolCall[];
}

// SSE event types
export type SSEEventType = 'content' | 'function_call' | 'function_response' | 'done' | 'error' | 'connected';

export interface SSEEvent {
  type: SSEEventType;
  data: string;
  toolName?: string;
}

// Custom skill
export interface CustomSkill {
  id: number;
  name: string;
  displayName: string;
  description: string;
  type: string;
  definitionJson: string;
  icon: string;
  enabled: boolean;
  hidden: boolean;
  visible?: boolean;
  executionCount: number;
  createdAt: string;
  updatedAt: string;
}

// Schedule
export interface Schedule {
  id: string;
  name: string;
  description?: string;
  type: 'daily' | 'interval' | 'weekly';
  enabled: boolean;
  expression: string;
  command: string;
  lastRun?: number;
  nextRun?: number;
  createdAt: number;
}

// AI config
export interface AIConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}
