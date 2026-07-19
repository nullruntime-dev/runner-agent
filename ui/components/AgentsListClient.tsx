'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Agent, removeAgent } from '@/lib/api';
import EditAgentModal from './EditAgentModal';

interface AgentsListClientProps {
  agents: Agent[];
}

export default function AgentsListClient({ agents }: AgentsListClientProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Agent | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await removeAgent(id);
      setConfirmDeleteId(null);
      router.refresh();
    } catch (err) {
      console.error('Failed to remove agent:', err);
    } finally {
      setDeletingId(null);
    }
  };

  if (agents.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[#888]">No agents registered</p>
        <p className="text-xs text-[#444] mt-1">Add an agent using the form</p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-[#1a1a1a]">
        {agents.map((agent) => (
          <div key={agent.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`w-2 h-2 flex-shrink-0 ${
                agent.status === 'online'
                  ? 'bg-[#00ff66] shadow-[0_0_8px_rgba(0,255,102,0.5)]'
                  : agent.status === 'offline'
                  ? 'bg-[#ff0044]'
                  : 'bg-[#666]'
              }`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white truncate">{agent.name}</div>
                <div className="text-xs text-[#444] truncate">{agent.url}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs ${
                agent.status === 'online' ? 'text-[#00ff66]'
                : agent.status === 'offline' ? 'text-[#ff0044]'
                : 'text-[#666]'
              }`}>
                {(agent.status || 'unknown').toUpperCase()}
              </span>
              <Link
                href={`/agents/${agent.id}`}
                className="text-xs text-[#888] hover:text-[#00fff2] transition-colors"
              >
                View
              </Link>
              <button
                onClick={() => setEditing(agent)}
                className="text-xs text-[#888] hover:text-[#00fff2] transition-colors"
                title="Edit agent"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDeleteId(agent.id)}
                className="text-xs text-[#888] hover:text-[#ff4444] transition-colors"
                title="Delete agent"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditAgentModal
          agent={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-[#1a1a1a] w-full max-w-sm mx-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-white mb-2">Delete agent?</h3>
            <p className="text-xs text-[#888] mb-4">
              This will remove the agent and all of its synced executions. This cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="flex-1 h-9 bg-[#ff0044] hover:bg-[#cc0036] text-white text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {deletingId === confirmDeleteId ? 'DELETING...' : 'DELETE'}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deletingId === confirmDeleteId}
                className="px-4 h-9 border border-[#1a1a1a] text-[#888] hover:text-white hover:border-[#2a2a2a] text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
