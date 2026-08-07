'use client';

import { useState, useEffect } from 'react';
import {
  Executor,
  CreatedExecutor,
  getExecutors,
  createExecutor,
  deleteExecutor,
  getAgents,
} from '@/lib/api';

interface ExecutorsManagementProps {
  agentId?: string;
}

export default function ExecutorsManagement({ agentId: propAgentId }: ExecutorsManagementProps) {
  const [agentId, setAgentId] = useState<string | null>(propAgentId || null);
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [loading, setLoading] = useState(true);
  const [noAgent, setNoAgent] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [tokenModal, setTokenModal] = useState<CreatedExecutor | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchExecutors = async (id: string) => {
    try {
      const list = await getExecutors(id);
      setExecutors(list);
    } catch (err) {
      console.error('Failed to fetch executors:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      if (propAgentId && propAgentId !== 'default') {
        setAgentId(propAgentId);
        await fetchExecutors(propAgentId);
        return;
      }
      try {
        const fetchedAgents = await getAgents();
        if (fetchedAgents.length > 0) {
          const firstAgent = fetchedAgents[0];
          setAgentId(firstAgent.id);
          await fetchExecutors(firstAgent.id);
        } else {
          setNoAgent(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch agents:', err);
        setNoAgent(true);
        setLoading(false);
      }
    };
    init();
  }, [propAgentId]);

  const handleCreate = async () => {
    if (!agentId || !newName.trim()) return;
    setCreating(true);
    try {
      const created = await createExecutor(agentId, newName.trim());
      if (created.success) {
        setNewName('');
        setTokenModal(created);
        await fetchExecutors(agentId);
      } else {
        alert(`Failed to create executor: ${created.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to create executor:', err);
      alert('Failed to create executor. Check console for details.');
    }
    setCreating(false);
  };

  const handleDelete = async (executor: Executor) => {
    if (!agentId) return;
    if (!confirm(`Are you sure you want to delete "${executor.name}"? The daemon will no longer be able to connect.`)) {
      return;
    }
    try {
      const res = await deleteExecutor(agentId, executor.id);
      if (!res.success) {
        alert(`Failed to delete: ${res.error || 'Unknown error'}`);
        return;
      }
      await fetchExecutors(agentId);
    } catch (err) {
      console.error('Failed to delete executor:', err);
      alert('Failed to delete executor. Check console for details.');
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (noAgent) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-500">No agents configured. Add an agent first to manage executors.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="w-5 h-5 text-[#00fff2] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Executor name (e.g. prod-web-1)"
          className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] focus:border-[#00fff2]/40 text-sm text-white placeholder-neutral-600 outline-none"
          disabled={creating}
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          className="px-4 py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#1a1a1a] hover:border-[#00fff2]/40 text-sm text-neutral-300 hover:text-[#00fff2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          title="Add executor"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {creating ? 'Adding...' : 'Add Executor'}
        </button>
      </div>

      {/* Executor list */}
      <div className="space-y-2">
        {executors.map((executor) => (
          <div
            key={executor.id}
            className="flex items-center gap-4 p-4 bg-[#111] border border-[#1a1a1a]"
          >
            {/* Status dot */}
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                executor.status === 'ONLINE' ? 'bg-[#00ff66]' : 'bg-neutral-600'
              }`}
              title={executor.status === 'ONLINE' ? 'Online' : 'Offline'}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{executor.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 ${
                    executor.status === 'ONLINE'
                      ? 'bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}
                >
                  {executor.status}
                </span>
                <span className="text-[10px] text-neutral-600">id: {executor.id}</span>
              </div>
              <p className="text-xs text-neutral-500 truncate">
                {executor.lastSeenAt
                  ? `last seen ${new Date(executor.lastSeenAt).toLocaleString()}`
                  : 'never connected'}
              </p>
            </div>

            {/* Delete */}
            <button
              onClick={() => handleDelete(executor)}
              className="p-2 hover:bg-[#1a1a1a] text-neutral-500 hover:text-[#ff0044] transition-colors"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}

        {executors.length === 0 && (
          <p className="text-xs text-neutral-600 px-4 py-3 bg-[#0a0a0a] border border-[#1a1a1a] border-dashed">
            No executors yet. Add one above and a token will be shown once — copy it into the daemon config.
          </p>
        )}
      </div>

      {/* Token-shown-once modal */}
      {tokenModal && tokenModal.success && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setTokenModal(null)}
        >
          <div
            className="bg-[#0f0f0f] border border-[#1a1a1a] max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#00ff66]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Executor created
              </h3>
              <button
                onClick={() => setTokenModal(null)}
                className="p-1 text-neutral-500 hover:text-white"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-[#ffaa00] mb-3 bg-[#ffaa00]/10 border border-[#ffaa00]/30 px-3 py-2">
              The token below is shown <strong>only once</strong>. Copy it now — you will not be able to retrieve it later. If lost, delete the executor and create a new one.
            </p>

            <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 mb-4">
              <p className="text-xs text-neutral-500 mb-1">Daemon config:</p>
              <pre className="text-xs text-[#00fff2] overflow-x-auto whitespace-pre-wrap break-all">
{`RUNNER_URL=<your runner-agent base url>
EXECUTOR_ID=${tokenModal.id}
EXECUTOR_TOKEN=${tokenModal.token}`}
              </pre>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleCopy(`RUNNER_URL=<your runner-agent base url>\nEXECUTOR_ID=${tokenModal.id}\nEXECUTOR_TOKEN=${tokenModal.token}`)}
                  className="px-3 py-1.5 bg-[#111] hover:bg-[#1a1a1a] border border-[#1a1a1a] hover:border-[#00fff2]/40 text-xs text-neutral-300 hover:text-[#00fff2] transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copied ? 'Copied!' : 'Copy config'}
                </button>
              </div>
            </div>

            <p className="text-xs text-neutral-500">
              The daemon should call <code className="text-[#00fff2]">POST {`/daemon/${tokenModal.id}/register`}</code> with a
              <code className="text-[#00fff2]"> Bearer {tokenModal.token}</code> header, then long-poll
              <code className="text-[#00fff2]"> GET {`/daemon/${tokenModal.id}/work`}</code> and post results back to
              <code className="text-[#00fff2]"> POST {`/daemon/${tokenModal.id}/results`}</code>.
              See <code className="text-[#00fff2]">docs/remote-executor-protocol.md</code> for the full protocol.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}