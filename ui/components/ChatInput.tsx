'use client';

import { useState, useRef, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  accentColor?: 'blue' | 'pink' | 'cyan';
}

export default function ChatInput({ onSend, disabled, placeholder, accentColor = 'cyan' }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const accentColors = {
    blue: {
      button: 'from-[#0066ff] to-[#0044cc]',
      glow: 'rgba(0, 102, 255, 0.3)',
      border: '#0066ff',
    },
    pink: {
      button: 'from-[#ff00ea] to-[#cc00bb]',
      glow: 'rgba(255, 0, 234, 0.3)',
      border: '#ff00ea',
    },
    cyan: {
      button: 'from-[#00fff2] to-[#00cccc]',
      glow: 'rgba(0, 255, 242, 0.3)',
      border: '#00fff2',
    },
  };

  const colors = accentColors[accentColor];
  const hasText = message.trim().length > 0;

  return (
    <div className="border-t border-[#1a1a1a] bg-[#0a0a0a] p-4">
      <div
        className={`flex gap-3 p-1 border transition-all duration-300 ${
          isFocused
            ? 'border-[#2a2a2a] bg-[#111]'
            : 'border-[#1a1a1a] bg-[#0f0f0f]'
        }`}
        style={{
          boxShadow: isFocused ? `0 0 20px ${colors.glow}` : 'none',
        }}
      >
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder || "Send a message..."}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent px-4 py-3 text-sm text-[#ccc] placeholder-[#444] resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !hasText}
          className={`px-5 py-2 my-1 mr-1 bg-gradient-to-r ${colors.button} disabled:from-[#1a1a1a] disabled:to-[#1a1a1a] disabled:cursor-not-allowed text-white text-sm font-medium transition-all duration-200 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100`}
          style={{
            boxShadow: hasText && !disabled ? `0 4px 20px ${colors.glow}` : 'none',
          }}
        >
          {disabled ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          )}
          <span className="hidden sm:inline">{disabled ? 'Sending...' : 'Send'}</span>
        </button>
      </div>
      <div className="flex items-center justify-between mt-2 px-2">
        <span className="text-[10px] text-[#444]">
          Press <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] text-[#888]">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] text-[#888]">Shift + Enter</kbd> for new line
        </span>
        <span className="text-[10px] text-[#444]">
          {message.length > 0 && `${message.length} characters`}
        </span>
      </div>
    </div>
  );
}
