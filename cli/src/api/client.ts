import type {
  HealthResponse,
  SkillsResponse,
  ChatSession,
  Execution,
  ChatRequest,
  ChatResponse,
  SSEEvent,
  CustomSkill,
  Schedule,
  AIConfig,
} from './types.js';

export interface ClientConfig {
  baseUrl: string;
  token: string;
}

export class ApiClient {
  private baseUrl: string;
  private token: string;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
  }

  private headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error ${response.status}: ${text}`);
    }

    return response.json();
  }

  // Health check
  async health(): Promise<HealthResponse> {
    return this.fetch('/health');
  }

  // Skills
  async skills(): Promise<SkillsResponse> {
    return this.fetch('/agent/skills');
  }

  // Chat sessions
  async listSessions(): Promise<ChatSession[]> {
    return this.fetch('/agent/sessions');
  }

  async getSession(id: string): Promise<ChatSession> {
    return this.fetch(`/agent/sessions/${id}`);
  }

  // Chat (non-streaming)
  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.fetch('/agent/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Chat (streaming via fetch-based SSE)
  chatStream(
    message: string,
    sessionId: string,
    onEvent: (event: SSEEvent) => void,
    onError: (error: Error) => void,
    options: { timeout?: number; idleTimeout?: number } = {},
  ): () => void {
    const { timeout = 300000, idleTimeout = 300000 } = options; // 5min total, 5min idle
    const params = new URLSearchParams({
      message,
      sessionId,
    });
    const url = `${this.baseUrl}/agent/chat/stream?${params}`;

    let aborted = false;
    const controller = new AbortController();
    let lastActivity = Date.now();
    let idleTimer: ReturnType<typeof setInterval> | null = null;

    // Idle timeout checker
    idleTimer = setInterval(() => {
      if (Date.now() - lastActivity > idleTimeout) {
        onError(new Error(`No response for ${idleTimeout / 1000}s - request may still be processing`));
        controller.abort();
        if (idleTimer) clearInterval(idleTimer);
      }
    }, 1000);

    // Overall timeout
    const overallTimeout = setTimeout(() => {
      if (!aborted) {
        onError(new Error(`Request timeout after ${timeout / 1000}s`));
        controller.abort();
      }
    }, timeout);

    (async () => {
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'text/event-stream',
          },
          signal: controller.signal,
        });

        lastActivity = Date.now();

        if (!response.ok) {
          const text = await response.text();
          onError(new Error(`SSE error ${response.status}: ${text || 'Server error'}`));
          return;
        }

        if (!response.body) {
          onError(new Error('No response body'));
          return;
        }

        // Connection established, notify UI
        onEvent({ type: 'connected', data: '' });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let gotDone = false;

        while (!aborted) {
          const { done, value } = await reader.read();
          lastActivity = Date.now();

          if (done) {
            if (!gotDone) {
              onEvent({ type: 'done', data: '' });
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (!data) continue;

              if (data.startsWith('[[FUNCTION_CALL:')) {
                const match = data.match(/\[\[FUNCTION_CALL:(\w+)\]\]/);
                if (match) {
                  onEvent({ type: 'function_call', data, toolName: match[1] });
                }
              } else if (data.startsWith('[[FUNCTION_RESPONSE:')) {
                const match = data.match(/\[\[FUNCTION_RESPONSE:(\w+)\]\]/);
                if (match) {
                  onEvent({ type: 'function_response', data, toolName: match[1] });
                }
              } else if (data === '[[DONE]]') {
                gotDone = true;
                onEvent({ type: 'done', data: '' });
                return;
              } else {
                onEvent({ type: 'content', data });
              }
            }
          }
        }
      } catch (err) {
        if (!aborted) {
          const msg = err instanceof Error ? err.message : 'SSE connection failed';
          if (!msg.includes('aborted')) {
            onError(new Error(msg));
          }
        }
      } finally {
        if (idleTimer) clearInterval(idleTimer);
        clearTimeout(overallTimeout);
      }
    })();

    return () => {
      aborted = true;
      controller.abort();
      if (idleTimer) clearInterval(idleTimer);
      clearTimeout(overallTimeout);
    };
  }

  // Executions
  async listExecutions(): Promise<Execution[]> {
    return this.fetch('/executions');
  }

  async getExecution(id: string): Promise<Execution> {
    return this.fetch(`/execution/${id}`);
  }

  async cancelExecution(id: string): Promise<void> {
    await this.fetch(`/execution/${id}/cancel`, { method: 'POST' });
  }

  // Execution logs (SSE)
  streamLogs(
    executionId: string,
    onLine: (line: string) => void,
    onError: (error: Error) => void,
  ): () => void {
    const url = `${this.baseUrl}/execution/${executionId}/logs`;

    let aborted = false;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'text/event-stream',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          onError(new Error(`Log stream error ${response.status}`));
          return;
        }

        if (!response.body) {
          onError(new Error('No response body'));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data:')) {
              onLine(line.slice(5).trim());
            }
          }
        }
      } catch (err) {
        if (!aborted) {
          onError(new Error('Log stream failed'));
        }
      }
    })();

    return () => {
      aborted = true;
      controller.abort();
    };
  }

  // Delete session
  async deleteSession(id: string): Promise<void> {
    await this.fetch(`/agent/sessions/${id}`, { method: 'DELETE' });
  }

  // List executions with optional status filter
  async listExecutionsByStatus(status?: string): Promise<Execution[]> {
    const path = status ? `/executions?status=${status}` : '/executions';
    return this.fetch(path);
  }

  // Custom skills
  async listCustomSkills(): Promise<CustomSkill[]> {
    return this.fetch('/custom-skills');
  }

  async getCustomSkill(name: string): Promise<CustomSkill> {
    return this.fetch(`/custom-skills/${encodeURIComponent(name)}`);
  }

  async runCustomSkill(name: string): Promise<{ success: boolean; output?: string; error?: string }> {
    return this.fetch(`/custom-skills/${encodeURIComponent(name)}/run`, { method: 'POST' });
  }

  async toggleCustomSkill(name: string): Promise<CustomSkill> {
    return this.fetch(`/custom-skills/${encodeURIComponent(name)}/toggle`, { method: 'POST' });
  }

  // Schedules
  async listSchedules(): Promise<Schedule[]> {
    return this.fetch('/schedules');
  }

  async runScheduleNow(id: string): Promise<{ success: boolean; executionId?: string }> {
    return this.fetch(`/schedules/${id}/run`, { method: 'POST' });
  }

  async toggleSchedule(id: string): Promise<Schedule> {
    return this.fetch(`/schedules/${id}/toggle`, { method: 'POST' });
  }

  // AI config
  async getAIConfig(): Promise<AIConfig> {
    return this.fetch('/ai-config');
  }

  async updateAIConfig(config: Partial<AIConfig>): Promise<AIConfig> {
    return this.fetch('/ai-config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }
}
