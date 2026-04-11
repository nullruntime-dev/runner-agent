'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage as ChatMessageType, Skill, getSkills, getChatStreamUrl, CustomSkill, getCustomSkills, getChatSession } from '@/lib/api';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

interface ChatViewProps {
  agentId: string;
  selectedSkill?: string | null;
  onSelectSkill?: (skillName: string | null) => void;
  externalSkills?: Skill[];
  sessionId?: string | null;
  onSessionChange?: (sessionId: string) => void;
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
  externalSkills,
  sessionId: externalSessionId,
  onSessionChange,
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [internalSessionId, setInternalSessionId] = useState<string>(() => crypto.randomUUID());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Use external session ID if provided, otherwise use internal
  const sessionId = externalSessionId ?? internalSessionId;
  const setSessionId = (id: string) => {
    setInternalSessionId(id);
    onSessionChange?.(id);
  };
  const [streamingContent, setStreamingContent] = useState('');
  const [internalSkills, setInternalSkills] = useState<Skill[]>([]);
  const [internalCustomSkills, setInternalCustomSkills] = useState<CustomSkill[]>([]);
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

  // When external session becomes null (New Chat clicked), generate fresh internal ID
  useEffect(() => {
    if (externalSessionId === null) {
      setInternalSessionId(crypto.randomUUID());
      setMessages([]);
      setStreamingContent('');
    }
  }, [externalSessionId]);

  // Load session history when sessionId changes (from external prop)
  // Skip if the external ID matches our internal ID (we already have the data locally)
  useEffect(() => {
    if (!externalSessionId) return;
    if (externalSessionId === internalSessionId) return; // Already have local data

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const session = await getChatSession(agentId, externalSessionId);
        if (session?.messages && session.messages.length > 0) {
          const loadedMessages: ChatMessageType[] = session.messages.map((msg) => ({
            id: String(msg.id),
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.createdAt,
          }));
          setMessages(loadedMessages);
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.error('Failed to load session history:', err);
        setMessages([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [agentId, externalSessionId, internalSessionId]);

  // Fetch skills on mount (only if not using external skills)
  useEffect(() => {
    if (externalSkills) return; // Skip if using external skills

    const fetchSkills = async () => {
      // Fetch built-in skills
      try {
        const builtInSkills = await getSkills(agentId);
        setInternalSkills(builtInSkills);
      } catch (err) {
        console.error('Failed to fetch built-in skills:', err);
      }

      // Fetch custom skills separately
      try {
        const userCustomSkills = await getCustomSkills(agentId);
        setInternalCustomSkills(userCustomSkills);
      } catch (err) {
        console.error('Failed to fetch custom skills:', err);
      }
    };
    fetchSkills();
  }, [agentId, externalSkills]);

  // Get current mode - handle custom skills with custom: prefix
  const getCustomSkillMode = (skillName: string) => {
    const customSkillName = skillName.replace('custom:', '');
    const customSkill = internalCustomSkills.find(s => s.name === customSkillName);
    if (!customSkill) return defaultMode;

    return {
      prefix: `[Custom Skill: ${customSkill.displayName}] `,
      placeholder: customSkill.description || `Use ${customSkill.displayName}...`,
      color: 'cyan',
      quickActions: [
        { label: 'Run skill', message: `Run the skill ${customSkill.name}` },
        { label: 'Show info', message: `Show details about ${customSkill.name}` },
      ],
    };
  };

  const currentMode = selectedSkill
    ? selectedSkill.startsWith('custom:')
      ? getCustomSkillMode(selectedSkill)
      : (skillModePrompts[selectedSkill] || defaultMode)
    : defaultMode;
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

    // Notify parent of the session ID being used (for sidebar tracking)
    if (!externalSessionId && onSessionChange) {
      onSessionChange(sessionId);
    }

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
    setSessionId(crypto.randomUUID()); // Generate new session for fresh conversation
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
          {/* Custom Skills */}
          {internalCustomSkills.filter(s => s.enabled).map((skill) => {
            const isSelected = selectedSkill === `custom:${skill.name}`;
            const typeColor = skill.type === 'COMMAND' ? '#00aaff' : skill.type === 'PROMPT' ? '#aa00ff' : '#ffaa00';

            return (
              <button
                key={`custom:${skill.name}`}
                onClick={() => setSelectedSkill(`custom:${skill.name}`)}
                className={`px-3 py-1.5 text-xs transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#00cc88] to-[#00aa66] text-black font-medium shadow-[0_0_20px_rgba(0,204,136,0.3)]'
                    : 'bg-[#111] border border-[#1a1a1a] text-[#888] hover:border-[#2a2a2a] hover:text-[#ccc]'
                }`}
              >
                {skill.type === 'COMMAND' ? (
                  <svg className="w-3.5 h-3.5" style={{ color: isSelected ? 'black' : typeColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : skill.type === 'PROMPT' ? (
                  <svg className="w-3.5 h-3.5" style={{ color: isSelected ? 'black' : typeColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" style={{ color: isSelected ? 'black' : typeColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
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
        {/* Loading history state */}
        {isLoadingHistory && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="flex items-center gap-3 text-[#666]">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">Loading conversation...</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !streamingContent && !isLoadingHistory && (
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
                <span className="text-white font-bold text-sm">GH</span>
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
