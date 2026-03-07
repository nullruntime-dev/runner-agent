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
        <div className="p-3 bg-red-950 border border-red-900 text-red-400 text-xs">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-1.5">
          Agent Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Production Server"
          required
          className="w-full h-9 px-3 bg-neutral-950 border border-neutral-800 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-1.5">
          Agent URL
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.1.100:8090"
          required
          className="w-full h-9 px-3 bg-neutral-950 border border-neutral-800 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-1.5">
          API Token
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter agent token"
          required
          className="w-full h-9 px-3 bg-neutral-950 border border-neutral-800 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-9 bg-white hover:bg-neutral-200 text-neutral-900 text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
      >
        {loading ? 'CONNECTING...' : 'ADD AGENT'}
      </button>
    </form>
  );
}
