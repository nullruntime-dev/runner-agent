'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteAgentButtonProps {
  agentId: string;
  agentName: string;
}

export default function DeleteAgentButton({ agentId, agentName }: DeleteAgentButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/');
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Delete {agentName}?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="h-7 px-2 bg-red-900 hover:bg-red-800 border border-red-800 text-red-200 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'YES'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="h-7 px-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-medium transition-colors"
        >
          NO
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="h-8 px-3 bg-neutral-800 hover:bg-red-900 border border-neutral-700 hover:border-red-800 text-neutral-400 hover:text-red-200 text-xs font-medium transition-colors"
    >
      DELETE
    </button>
  );
}
