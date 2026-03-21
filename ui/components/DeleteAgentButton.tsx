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
        <span className="text-xs text-[#888]">Delete {agentName}?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="h-7 px-2 bg-[#ff0044]/20 hover:bg-[#ff0044]/30 border border-[#ff0044]/30 text-[#ff0044] text-xs font-medium transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'YES'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="h-7 px-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-xs font-medium transition-colors"
        >
          NO
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="h-8 px-3 bg-[#111] hover:bg-[#ff0044]/20 border border-[#2a2a2a] hover:border-[#ff0044]/30 text-[#888] hover:text-[#ff0044] text-xs font-medium transition-colors"
    >
      DELETE
    </button>
  );
}
