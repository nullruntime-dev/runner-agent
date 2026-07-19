import { useState, useCallback, useRef } from 'react';
import type { ApiClient } from '../api/client.js';
import type { ChatMessage, ToolCall, SSEEvent } from '../api/types.js';
import { setConfig } from '../config/config.js';

interface UseChatResult {
  messages: ChatMessage[];
  streamingContent: string;
  currentToolCall: ToolCall | null;
  isStreaming: boolean;
  isConnecting: boolean;
  sessionId: string;
  error: string | null;
  sendMessage: (content: string) => void;
  clearMessages: () => void;
  newSession: () => void;
  cancelStream: () => void;
}

let messageIdCounter = 0;
function generateId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

export function useChat(client: ApiClient, initialSessionId?: string): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentToolCall, setCurrentToolCall] = useState<ToolCall | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId ?? crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);

  const sendMessage = useCallback((content: string) => {
    if (!content.trim() || isStreaming) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setStreamingContent('');
    setCurrentToolCall(null);
    setIsConnecting(true);
    setIsStreaming(true);
    setError(null);

    // Start streaming
    const cleanup = client.chatStream(
      content,
      sessionId,
      (event: SSEEvent) => {
        switch (event.type) {
          case 'connected':
            setIsConnecting(false);
            break;

          case 'content':
            setIsConnecting(false);
            setStreamingContent(prev => prev + event.data);
            break;

          case 'function_call':
            if (event.toolName) {
              setCurrentToolCall({
                id: generateId(),
                name: event.toolName,
                args: {},
                status: 'running',
              });
            }
            break;

          case 'function_response':
            setCurrentToolCall(prev => {
              if (!prev) return null;
              return { ...prev, status: 'success', exitCode: 0 };
            });
            break;

          case 'done':
            // Finalize agent message
            setStreamingContent(content => {
              if (content) {
                const agentMessage: ChatMessage = {
                  id: generateId(),
                  role: 'agent',
                  content,
                  timestamp: Date.now(),
                };
                setMessages(prev => [...prev, agentMessage]);
              }
              return '';
            });
            setCurrentToolCall(null);
            setIsConnecting(false);
            setIsStreaming(false);
            break;

          case 'error':
            setError(event.data);
            setIsConnecting(false);
            setIsStreaming(false);
            break;
        }
      },
      (err: Error) => {
        setError(err.message);
        setIsConnecting(false);
        setIsStreaming(false);
      },
    );

    cleanupRef.current = cleanup;
    setConfig({ lastSessionId: sessionId });
  }, [client, sessionId, isStreaming]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingContent('');
    setCurrentToolCall(null);
  }, []);

  const newSession = useCallback(() => {
    const newId = crypto.randomUUID();
    setSessionId(newId);
    clearMessages();
    setConfig({ lastSessionId: newId });
  }, [clearMessages]);

  const cancelStream = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setIsConnecting(false);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    streamingContent,
    currentToolCall,
    isStreaming,
    isConnecting,
    sessionId,
    error,
    sendMessage,
    clearMessages,
    newSession,
    cancelStream,
  };
}
