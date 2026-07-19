'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Agent, updateAgent } from '@/lib/api';

interface EditAgentModalProps {
  agent: Agent;
  onClose: () => void;
}

export default function EditAgentModal({ agent, onClose }: EditAgentModalProps) {
  const router = useRouter();
  const [name, setName] = useState(agent.name);
  const [url, setUrl] = useState(agent.url);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updates: { name?: string; url?: string; token?: string } = {};
      if (name.trim() !== agent.name) updates.name = name.trim();
      if (url.trim() !== agent.url) updates.url = url.trim();
      if (token.trim().length > 0) updates.token = token;

      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }

      await updateAgent(agent.id, updates);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a0a] border border-[#1a1a1a] w-full max-w-md mx-4 shadow-[0_0_40px_rgba(0,255,242,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[#00fff2] uppercase tracking-wider">Edit Agent</h2>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-[#ff0044]/10 border border-[#ff0044]/30 text-[#ff0044] text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">
              Agent Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full h-9 px-3 bg-[#111] border border-[#1a1a1a] text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#00fff2] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">
              Agent URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="w-full h-9 px-3 bg-[#111] border border-[#1a1a1a] text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#00fff2] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">
              API Token <span className="text-[#444] normal-case tracking-normal">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="••••••••"
              className="w-full h-9 px-3 bg-[#111] border border-[#1a1a1a] text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#00fff2] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-9 bg-gradient-to-r from-[#00fff2] to-[#00cccc] hover:from-[#00cccc] hover:to-[#00fff2] text-black text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(0,255,242,0.3)]"
            >
              {loading ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 h-9 border border-[#1a1a1a] text-[#888] hover:text-white hover:border-[#2a2a2a] text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50"
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
