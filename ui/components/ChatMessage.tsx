'use client';

import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ChatMessage as ChatMessageType } from '@/lib/api';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

// Function call badge — kept for the agent's tool-call markers.
function FunctionCallBadge({ name, type }: { name: string; type: 'call' | 'response' }) {
  const isCall = type === 'call';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 my-0.5 text-xs font-mono rounded ${
        isCall
          ? 'bg-[#9900ff]/10 text-[#c77dff] border border-[#9900ff]/30'
          : 'bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30'
      }`}
    >
      {isCall ? '→ ' : '✓ '}
      {name}
    </span>
  );
}

// Parse [[FUNCTION_CALL:name]] / [[FUNCTION_RESPONSE:name]] markers.
// Returns an array of segments: each is either { kind: 'badge', ... } or
// { kind: 'text', value: string }. The caller renders text segments through
// ReactMarkdown and badges as inline React nodes, so markdown still works
// in the text surrounding the badges.
type Segment = { kind: 'badge'; name: string; type: 'call' | 'response' } | { kind: 'text'; value: string };

function segmentFunctionCalls(text: string): Segment[] {
  if (!text) return [];
  const out: Segment[] = [];
  const regex = /\[\[(FUNCTION_CALL|FUNCTION_RESPONSE):([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }
    out.push({
      kind: 'badge',
      name: match[2],
      type: match[1] === 'FUNCTION_CALL' ? 'call' : 'response',
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    out.push({ kind: 'text', value: text.slice(lastIndex) });
  }
  return out;
}

// Code block with copy button — openwebui style. Has language label + copy
// button on top bar, code below in scrollable area. Children come from
// rehype-highlight so syntax highlighting is preserved.
function CodeBlock({ code, language, children }: { code: string; language: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-2 border border-[#222] bg-[#0d0d0d] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1a1a1a] bg-[#111]">
        <span className="text-[11px] text-[#666] font-mono">{language}</span>
        <button
          onClick={copy}
          className="text-[11px] text-[#666] hover:text-[#00fff2] transition-colors flex items-center gap-1"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[13px] leading-relaxed">
        <code className="font-mono text-[#ccc] hljs">{children ?? code}</code>
      </pre>
    </div>
  );
}

export default function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';

  const segments = useMemo<Segment[]>(() => {
    const c = message.content || '';
    if (c.includes('[[FUNCTION_CALL:') || c.includes('[[FUNCTION_RESPONSE:')) {
      return segmentFunctionCalls(c);
    }
    return [{ kind: 'text', value: c }];
  }, [message.content]);

  const formattedTime = useMemo(() => {
    return new Date(message.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [message.timestamp]);

  // openwebui layout: full-width row, avatar + name on top, content fills width.
  return (
    <div className="group py-3">
      <div className="flex items-start gap-3 max-w-3xl mx-auto">
        {/* Avatar */}
        <div
          className={`w-7 h-7 flex-shrink-0 flex items-center justify-center text-xs font-bold ${
            isUser
              ? 'bg-gradient-to-br from-[#0066ff] to-[#0044cc] text-white'
              : 'bg-[#111] border border-[#2a2a2a] text-[#00fff2]'
          }`}
        >
          {isUser ? (
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          ) : (
            'G'
          )}
        </div>

        {/* Content column */}
        <div className="flex-1 min-w-0">
          {/* Header: name + timestamp (openwebui shows both; we hide time on hover) */}
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold text-white">
              {isUser ? 'You' : 'Griphook'}
            </span>
            <span className="text-[10px] text-[#444] opacity-0 group-hover:opacity-100 transition-opacity">
              {formattedTime}
            </span>
          </div>

          {/* Body */}
          <div className="text-[14px] leading-relaxed text-[#ccc]">
            {isUser ? (
              <div className="whitespace-pre-wrap break-words">{message.content || ''}</div>
            ) : (
              <div className="prose-chat">
                {segments.map((seg, idx) =>
                  seg.kind === 'badge' ? (
                    <FunctionCallBadge key={`b-${idx}`} name={seg.name} type={seg.type} />
                  ) : (
                    <ReactMarkdown
                      key={`t-${idx}`}
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
                      components={{
                        code: ({ className, children }) => {
                          const cls = className || '';
                          if (cls.startsWith('language-')) {
                            const lang = cls.replace(/^language-/, '');
                            const code = String(children).replace(/\n$/, '');
                            return <CodeBlock code={code} language={lang}>{children}</CodeBlock>;
                          }
                          return <code className="prose-chat-code-inline">{children}</code>;
                        },
                        pre: ({ children }) => <>{children}</>,
                      }}
                    >
                      {seg.value}
                    </ReactMarkdown>
                  )
                )}
              </div>
            )}
            {isStreaming && (
              <span className="inline-block w-1.5 h-3.5 bg-[#00fff2] ml-1 animate-pulse align-text-bottom" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}