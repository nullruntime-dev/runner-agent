'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage as ChatMessageType, Skill, getSkills, getChatStreamUrl } from '@/lib/api';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

interface ChatViewProps {
  agentId: string;
  selectedSkill?: string | null;
  onSelectSkill?: (skillName: string | null) => void;
  externalSkills?: Skill[];
}

const skillModePrompts: Record<string, { prefix: string; placeholder: string; color: string; quickActions: { label: string; message: string }[] }> = {
  flirt: {
    prefix: '[Flirt Assistant Mode] ',
    placeholder: 'e.g., "Sarah said she loves hiking - what should I reply?"',
    color: 'pink',
    quickActions: [
      { label: 'Help respond', message: '[Name] said "[their message]" - help me respond' },
      { label: 'New opener', message: 'Write an opener for [name] who likes ' },
      { label: 'Analyze chat', message: 'Analyze my conversation with [name]: ' },
      { label: 'My crushes', message: 'List all the people I\'m talking to' },
    ],
  },
  slack: {
    prefix: '[Slack Mode] ',
    placeholder: 'e.g., "Send a message to the team about deployment"',
    color: 'cyan',
    quickActions: [
      { label: 'Send message', message: 'Send a Slack message: ' },
      { label: 'Notify deployment', message: 'Send a deployment notification for ' },
    ],
  },
  gmail: {
    prefix: '[Gmail Mode] ',
    placeholder: 'e.g., "Send an email about the project status"',
    color: 'cyan',
    quickActions: [
      { label: 'Send email', message: 'Send an email to ' },
      { label: 'Deployment email', message: 'Send a deployment notification email for ' },
    ],
  },
  'gmail-api': {
    prefix: '[Gmail API Mode] ',
    placeholder: 'e.g., "Show my unread emails" or "Reply to the last email from John"',
    color: 'cyan',
    quickActions: [
      { label: 'Unread emails', message: 'Show me my recent unread emails' },
      { label: 'Search emails', message: 'Search for emails from ' },
      { label: 'Read email', message: 'Read the latest email about ' },
      { label: 'Reply', message: 'Reply to that email saying ' },
    ],
  },
  smtp: {
    prefix: '[SMTP Mode] ',
    placeholder: 'e.g., "Send a notification email"',
    color: 'cyan',
    quickActions: [
      { label: 'Send email', message: 'Send an email to ' },
    ],
  },
  'custom-skills': {
    prefix: '[Custom Skills Mode] ',
    placeholder: 'e.g., "Create a skill that runs: npm test" or "Run my deploy-prod skill"',
    color: 'cyan',
    quickActions: [
      { label: 'List skills', message: 'List my custom skills' },
      { label: 'Create command', message: 'Create a skill called "my-skill" that runs: ' },
      { label: 'Create prompt', message: 'Create a skill that acts as a ' },
      { label: 'Run skill', message: 'Run the skill ' },
    ],
  },
};

const defaultMode = {
  prefix: '',
  placeholder: 'Ask me anything...',
  color: 'cyan',
  quickActions: [
    { label: 'List executions', message: 'List recent executions' },
    { label: 'Run command', message: 'Execute: ' },
    { label: 'What can you do?', message: 'What can you help me with?' },
  ],
};

export default function ChatView({
  agentId,
  selectedSkill: externalSelectedSkill,
  onSelectSkill: externalOnSelectSkill,
  externalSkills
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [internalSkills, setInternalSkills] = useState<Skill[]>([]);
  const [internalSelectedSkill, setInternalSelectedSkill] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Use external state if provided, otherwise use internal state
  const selectedSkill = externalSelectedSkill !== undefined ? externalSelectedSkill : internalSelectedSkill;
  const setSelectedSkill = externalOnSelectSkill || setInternalSelectedSkill;
  const skills = externalSkills || internalSkills.filter(s => s.configured && s.enabled);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Handle scroll to show/hide scroll button
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom && messages.length > 0);
    }
  }, [messages.length]);

  // Fetch skills on mount (only if not using external skills)
  useEffect(() => {
    if (externalSkills) return; // Skip if using external skills

    const fetchSkills = async () => {
      try {
        const data = await getSkills(agentId);
        setInternalSkills(data);
      } catch (err) {
        console.error('Failed to fetch skills:', err);
      }
    };
    fetchSkills();
  }, [agentId, externalSkills]);

  const currentMode = selectedSkill ? (skillModePrompts[selectedSkill] || defaultMode) : defaultMode;
  const accentColor = currentMode.color as 'cyan' | 'pink';

  const handleSendMessage = async (content: string) => {
    const messageToSend = selectedSkill ? `${currentMode.prefix}${content}` : content;

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingContent('');

    try {
      const url = getChatStreamUrl(agentId, sessionId, messageToSend);
      const eventSource = new EventSource(url);

      let accumulatedContent = '';

      eventSource.onmessage = (event) => {
        // Handle SSE data
        const data = event.data;
        if (data !== undefined && data !== null && data !== '') {
          accumulatedContent += data;
          setStreamingContent(accumulatedContent);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();

        // Trim the content and create assistant message
        const trimmedContent = accumulatedContent.trim();
        if (trimmedContent) {
          const assistantMessage: ChatMessageType = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: trimmedContent,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else {
          // Add a fallback message if no content was received
          const fallbackMessage: ChatMessageType = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'I processed your request but have no response to display.',
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, fallbackMessage]);
        }

        setStreamingContent('');
        setIsLoading(false);
      };

      if (!sessionId) {
        setSessionId(crypto.randomUUID());
      }
    } catch (error) {
      console.error('Chat error:', error);
      setIsLoading(false);
      setStreamingContent('');

      const errorMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Failed to connect to the agent. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setSessionId('');
    setStreamingContent('');
  };

  const getSkillIcon = (skillName: string) => {
    switch (skillName) {
      case 'flirt':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        );
      case 'slack':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
          </svg>
        );
      case 'gmail':
      case 'gmail-api':
      case 'smtp':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
    }
  };

  const getSkillColor = (skillName: string) => {
    if (skillName === 'flirt') return 'pink';
    return 'cyan';
  };

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Chat header */}
      <div className="bg-[#0a0a0a] border-b border-[#1a1a1a] px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#111] border border-[#2a2a2a] flex items-center justify-center">
              <span className="text-sm font-bold text-[#00fff2]">G</span>
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">AI Assistant</h2>
              <p className="text-[10px] text-[#444]">
                {messages.length === 0 ? 'Ready to help' : `${messages.length} messages`}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="px-3 py-1.5 text-xs text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            >
              Clear chat
            </button>
          )}
        </div>

        {/* Skill mode selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedSkill(null)}
            className={`px-3 py-1.5 text-xs transition-all flex items-center gap-2 ${
              selectedSkill === null
                ? 'bg-gradient-to-r from-[#00fff2] to-[#00cccc] text-black font-medium shadow-[0_0_20px_rgba(0,255,242,0.3)]'
                : 'bg-[#111] border border-[#1a1a1a] text-[#888] hover:border-[#2a2a2a] hover:text-[#ccc]'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            General
          </button>
          {skills.map((skill) => {
            const isSelected = selectedSkill === skill.name;
            const color = getSkillColor(skill.name);
            const gradientClass = color === 'pink'
              ? 'from-[#ff00ea] to-[#cc00bb]'
              : 'from-[#00fff2] to-[#00cccc]';
            const glowClass = color === 'pink'
              ? 'shadow-[0_0_20px_rgba(255,0,234,0.3)]'
              : 'shadow-[0_0_20px_rgba(0,255,242,0.3)]';

            return (
              <button
                key={skill.name}
                onClick={() => setSelectedSkill(skill.name)}
                className={`px-3 py-1.5 text-xs transition-all flex items-center gap-2 ${
                  isSelected
                    ? `bg-gradient-to-r ${gradientClass} text-black font-medium ${glowClass}`
                    : 'bg-[#111] border border-[#1a1a1a] text-[#888] hover:border-[#2a2a2a] hover:text-[#ccc]'
                }`}
              >
                {getSkillIcon(skill.name)}
                {skill.displayName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 relative"
        style={{
          background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 100%)',
        }}
      >
        {/* Empty state */}
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className={`w-20 h-20 flex items-center justify-center mb-6 ${
              selectedSkill === 'flirt'
                ? 'bg-gradient-to-br from-[#ff00ea]/20 to-[#ff00ea]/5 border border-[#ff00ea]/20'
                : 'bg-gradient-to-br from-[#00fff2]/20 to-[#00fff2]/5 border border-[#00fff2]/20'
            }`}>
              {selectedSkill === 'flirt' ? (
                <svg className="w-10 h-10 text-[#ff00ea]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-[#00fff2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              )}
            </div>

            <h3 className={`text-lg font-medium mb-2 ${
              selectedSkill === 'flirt' ? 'text-[#ff00ea]' : 'text-white'
            }`}>
              {selectedSkill === 'flirt'
                ? 'Flirt Assistant'
                : selectedSkill
                  ? skills.find(s => s.name === selectedSkill)?.displayName
                  : 'AI Assistant'
              }
            </h3>

            <p className="text-[#888] text-sm max-w-md mb-6">
              {selectedSkill === 'flirt'
                ? 'Your AI wingman that learns and remembers. Share their messages and I\'ll help you craft the perfect response.'
                : selectedSkill
                  ? skills.find(s => s.name === selectedSkill)?.description
                  : 'Run commands, check executions, send notifications, and more.'
              }
            </p>

            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {currentMode.quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(action.message)}
                  className={`px-4 py-2 border text-sm transition-all hover:scale-[1.02] ${
                    selectedSkill === 'flirt'
                      ? 'bg-[#ff00ea]/10 hover:bg-[#ff00ea]/20 border-[#ff00ea]/30 text-[#ff00ea]'
                      : 'bg-[#00fff2]/10 hover:bg-[#00fff2]/20 border-[#00fff2]/30 text-[#00fff2]'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message, index) => {
          const showTimeDivider = index === 0 || shouldShowTimeDivider(
            messages[index - 1].timestamp,
            message.timestamp
          );

          return (
            <div key={message.id}>
              {showTimeDivider && (
                <div className="flex items-center justify-center my-4">
                  <div className="text-[10px] text-[#444] bg-[#111] px-3 py-1">
                    {formatTimeDivider(message.timestamp)}
                  </div>
                </div>
              )}
              <ChatMessage message={message} />
            </div>
          );
        })}

        {/* Streaming content */}
        {streamingContent && (
          <ChatMessage
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingContent,
              timestamp: new Date().toISOString(),
            }}
            isStreaming
          />
        )}

        {/* Typing indicator */}
        {isLoading && !streamingContent && (
          <div className="flex justify-start">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-[#00fff2] to-[#ff00ea] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              <div className="bg-[#111] border border-[#1a1a1a] px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#00fff2] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[#00fff2] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[#00fff2] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-24 right-6 w-10 h-10 bg-[#111] border border-[#2a2a2a] flex items-center justify-center text-[#888] hover:text-[#00fff2] hover:border-[#00fff2] transition-all shadow-lg hover:shadow-[0_0_20px_rgba(0,255,242,0.2)]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}

      {/* Input area */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={isLoading}
        placeholder={currentMode.placeholder}
        accentColor={accentColor}
      />
    </div>
  );
}

// Helper functions
function shouldShowTimeDivider(prevTimestamp: string, currentTimestamp: string): boolean {
  const prev = new Date(prevTimestamp);
  const current = new Date(currentTimestamp);
  const diffMinutes = (current.getTime() - prev.getTime()) / (1000 * 60);
  return diffMinutes > 10; // Show divider if more than 10 minutes apart
}

function formatTimeDivider(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

  if (isToday) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (isYesterday) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ` at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
}
