'use client';

import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';

interface ChatInputProps {
  /** Plain text send. Use `onSendWithFile` to receive file uploads. */
  onSend: (message: string) => void;
  /** Optional override that receives the picked file alongside the message. */
  onSendWithFile?: (message: string, file: File) => void;
  disabled?: boolean;
  placeholder?: string;
  accentColor?: 'blue' | 'pink' | 'cyan';
}

export default function ChatInput({ onSend, onSendWithFile, disabled, placeholder, accentColor = 'cyan' }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = message.trim();
    if (disabled) return;
    if (file) {
      onSendWithFile?.(trimmed, file);
    } else if (trimmed) {
      onSend(trimmed);
    } else {
      return;
    }
    setMessage('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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

  const handlePickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
  const canSend = !disabled && (file !== null || hasText);

  return (
    <div className="border-t border-[#1a1a1a] bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-4">
        {file && (
          <div className="mb-2 inline-flex items-center gap-2 bg-[#111] border border-[#1a1a1a]  px-3 py-1.5 text-xs text-neutral-300">
            <svg className="w-3.5 h-3.5 text-[#00fff2]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/>
            </svg>
            <span className="font-medium max-w-[260px] truncate">{file.name}</span>
            <span className="text-neutral-500">({formatBytes(file.size)})</span>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="text-neutral-500 hover:text-[#ff0044] transition-colors leading-none"
              aria-label="Remove file"
            >
              ×
            </button>
          </div>
        )}
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
          <input
            ref={fileInputRef}
            type="file"
            onChange={handlePickFile}
            className="hidden"
            aria-label="Attach file"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="w-10 h-10 my-1 ml-1 flex items-center justify-center bg-[#111] hover:bg-[#1a1a1a] border border-[#1a1a1a] hover:border-[#2a2a2a] text-neutral-400 hover:text-[#00fff2] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Attach file"
            aria-label="Attach file"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={
              file
                ? `Add a message about ${file.name} (optional, just hit send)`
                : placeholder || 'Send a message...'
            }
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent px-4 py-3 text-sm text-[#ccc] placeholder-[#444] resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`px-5 py-2 my-1 mr-1 bg-gradient-to-r ${colors.button} disabled:from-[#1a1a1a] disabled:to-[#1a1a1a] disabled:cursor-not-allowed text-white text-sm font-medium transition-all duration-200 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100`}
            style={{
              boxShadow: canSend && !disabled ? `0 4px 20px ${colors.glow}` : 'none',
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
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
