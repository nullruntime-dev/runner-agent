'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddAgentForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to add agent');
        return;
      }

      setName('');
      setUrl('');
      setToken('');
      router.refresh();
    } catch {
      setError('Failed to add agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          placeholder="Production Server"
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
          placeholder="http://192.168.1.100:8090"
          required
          className="w-full h-9 px-3 bg-[#111] border border-[#1a1a1a] text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#00fff2] transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">
          API Token
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter agent token"
          required
          className="w-full h-9 px-3 bg-[#111] border border-[#1a1a1a] text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#00fff2] transition-colors"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-9 bg-gradient-to-r from-[#00fff2] to-[#00cccc] hover:from-[#00cccc] hover:to-[#00fff2] text-black text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(0,255,242,0.3)]"
      >
        {loading ? 'CONNECTING...' : 'ADD AGENT'}
      </button>
    </form>
  );
}
