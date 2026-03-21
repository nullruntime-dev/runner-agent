'use client';

import React, { useState, useMemo } from 'react';
import { ChatMessage as ChatMessageType } from '@/lib/api';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

// Function call badge component
function FunctionCallBadge({ name, type }: { name: string; type: 'call' | 'response' }) {
  const isCall = type === 'call';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 my-1 text-xs font-medium rounded-sm ${
        isCall
          ? 'bg-[#9900ff]/10 text-[#c77dff] border border-[#9900ff]/30'
          : 'bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30'
      }`}
    >
      {isCall ? (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      ) : (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 13l4 4L19 7" />
        </svg>
      )}
      <span className="font-mono">{name}</span>
    </span>
  );
}

// Parse function call markers from content
function parseFunctionCalls(text: string): React.ReactNode[] {
  if (!text) return [];

  const elements: React.ReactNode[] = [];
  const regex = /\[\[(FUNCTION_CALL|FUNCTION_RESPONSE):([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      if (beforeText.trim()) {
        elements.push(<React.Fragment key={`text-${key++}`}>{beforeText}</React.Fragment>);
      }
    }

    // Add function call badge
    const type = match[1] === 'FUNCTION_CALL' ? 'call' : 'response';
    const name = match[2];
    elements.push(
      <FunctionCallBadge key={`fn-${key++}`} name={name} type={type} />
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(<React.Fragment key={`text-${key++}`}>{text.slice(lastIndex)}</React.Fragment>);
  }

  return elements.length > 0 ? elements : [<React.Fragment key="original">{text}</React.Fragment>];
}

// Simple markdown parser for code blocks, inline code, bold, and lists
function parseMarkdown(text: string): React.ReactNode[] {
  // Handle empty or invalid input
  if (!text || typeof text !== 'string') {
    return [];
  }

  const elements: React.ReactNode[] = [];
  let key = 0;

  // Split by code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  const processInlineContent = (content: string): React.ReactNode[] => {
    if (!content) return [];

    const inlineElements: React.ReactNode[] = [];
    let inlineKey = 0;

    // Process inline code, bold, and regular text
    const parts = content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

    for (const part of parts) {
      if (!part) continue;

      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        // Inline code
        inlineElements.push(
          <code
            key={`inline-${inlineKey++}`}
            className="bg-[#1a1a1a] text-[#00fff2] px-1.5 py-0.5 text-[13px] font-mono"
          >
            {part.slice(1, -1)}
          </code>
        );
      } else if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        // Bold text
        inlineElements.push(
          <strong key={`bold-${inlineKey++}`} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      } else {
        // Regular text - preserve as-is including whitespace
        inlineElements.push(
          <React.Fragment key={`text-${inlineKey++}`}>{part}</React.Fragment>
        );
      }
    }

    return inlineElements;
  };

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      elements.push(
        <span key={`text-${key++}`}>
          {processInlineContent(beforeText)}
        </span>
      );
    }

    // Add code block
    const language = match[1] || 'plaintext';
    const code = match[2].trim();
    elements.push(
      <CodeBlock key={`code-${key++}`} code={code} language={language} />
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    elements.push(
      <span key={`text-${key++}`}>
        {processInlineContent(remainingText)}
      </span>
    );
  }

  // If nothing was parsed, just return the text as-is
  if (elements.length === 0 && text.length > 0) {
    return [<span key="fallback">{text}</span>];
  }

  return elements;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden bg-[#0a0a0a] border border-[#1a1a1a] group">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 bg-[#ff5f56]" />
            <span className="w-3 h-3 bg-[#ffbd2e]" />
            <span className="w-3 h-3 bg-[#27ca40]" />
          </div>
          <span className="text-xs text-[#444] font-mono ml-2">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-[#444] hover:text-[#00fff2] transition-colors flex items-center gap-1.5 opacity-0 group-hover:opacity-100"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className="text-[#ccc] font-mono">{code}</code>
      </pre>
    </div>
  );
}

export default function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';

  const parsedContent = useMemo(() => {
    if (isUser) {
      return message.content || '';
    }
    const content = message.content || '';

    // First check for function call markers
    if (content.includes('[[FUNCTION_CALL:') || content.includes('[[FUNCTION_RESPONSE:')) {
      return parseFunctionCalls(content);
    }

    const parsed = parseMarkdown(content);
    // If parsing returned empty but we have content, show content as-is
    if (parsed.length === 0 && content.length > 0) {
      return content;
    }
    return parsed;
  }, [message.content, isUser]);

  const formattedTime = useMemo(() => {
    return new Date(message.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [message.timestamp]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      {/* Avatar for assistant */}
      {!isUser && (
        <div className="w-8 h-8 bg-[#111] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 mr-3 mt-1">
          <span className="text-sm font-bold text-[#00fff2]">G</span>
        </div>
      )}

      <div
        className={`max-w-[75%] relative ${
          isUser
            ? 'bg-gradient-to-r from-[#0066ff] to-[#0044cc] text-white px-4 py-3'
            : 'bg-[#111] border border-[#1a1a1a] text-[#ccc] px-4 py-3'
        } ${isStreaming ? 'animate-pulse' : ''}`}
      >
        {/* Glow effect for user messages */}
        {isUser && (
          <div className="absolute inset-0 bg-gradient-to-r from-[#0066ff] to-[#0044cc] blur-xl opacity-30 -z-10" />
        )}

        <div className={`text-sm leading-relaxed ${isUser ? '' : 'prose prose-invert prose-sm max-w-none'}`}>
          {isUser ? (
            <span className="whitespace-pre-wrap break-words">{message.content || ''}</span>
          ) : (
            <div className="whitespace-pre-wrap break-words">
              {typeof parsedContent === 'string' ? parsedContent : parsedContent}
            </div>
          )}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-[#00fff2] ml-1 animate-pulse" />
          )}
        </div>

        {/* Timestamp */}
        <div
          className={`text-[10px] mt-2 flex items-center gap-1.5 ${
            isUser ? 'text-blue-200/70 justify-end' : 'text-[#444]'
          }`}
        >
          {formattedTime}
        </div>
      </div>

      {/* Avatar for user */}
      {isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-[#0066ff] to-[#0044cc] flex items-center justify-center flex-shrink-0 ml-3 mt-1">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
      )}
    </div>
  );
}
