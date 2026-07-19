'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDatabaseStats, getDatabaseExportUrl, importDatabase, DatabaseStats } from '@/lib/api';

export default function DatabaseManagement() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState<{ file: File; payload: unknown } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getDatabaseStats();
      setStats(data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load database stats' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);

    if (!file.name.endsWith('.json')) {
      setMessage({ type: 'error', text: 'Only JSON exports are supported for import. Use the JSON button to download a compatible file.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result;
        if (typeof text !== 'string') throw new Error('Could not read file');
        const parsed = JSON.parse(text);
        if (!parsed || !parsed.data || !Array.isArray(parsed.data.agents)) {
          throw new Error('File does not look like a GRIPHOOK database export.');
        }
        setConfirmImport({ file, payload: parsed });
      } catch (err) {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to parse JSON file' });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setMessage({ type: 'error', text: 'Failed to read file' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const performImport = async () => {
    if (!confirmImport) return;
    setImporting(true);
    setMessage(null);
    try {
      const result = await importDatabase(confirmImport.payload);
      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Database imported successfully.' });
        setConfirmImport(null);
        fetchStats();
        router.refresh();
      } else {
        setMessage({ type: 'error', text: result.error || 'Import failed' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  const cancelImport = () => {
    setConfirmImport(null);
    setMessage(null);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Agents', value: stats?.counts.agents, color: 'text-[#00fff2]' },
            { label: 'Executions', value: stats?.counts.executions, color: 'text-[#00ff66]' },
            { label: 'Steps', value: stats?.counts.steps, color: 'text-[#ff00ea]' },
            { label: 'Log lines', value: stats?.counts.logLines, color: 'text-[#ff6600]' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3"
            >
              <div className={`text-xl font-semibold tabular-nums ${stat.color}`}>
                {loading ? '…' : (stat.value ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-[#666] uppercase tracking-wider mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Status message */}
        {message && (
          <div
            className={`p-3 border text-sm ${
              message.type === 'success'
                ? 'bg-[#00ff66]/10 border-[#00ff66]/30 text-[#00ff66]'
                : message.type === 'error'
                ? 'bg-[#ff0044]/10 border-[#ff0044]/30 text-[#ff0044]'
                : 'bg-[#00fff2]/10 border-[#00fff2]/30 text-[#00fff2]'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-4">
          {/* Export */}
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="flex items-start gap-3 mb-3">
              <svg className="w-5 h-5 text-[#00fff2] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <div>
                <p className="text-sm font-medium text-white">Export database</p>
                <p className="text-xs text-[#666] mt-1">
                  Download a backup. JSON strips agent tokens (secrets); SQLite is a full binary copy.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={getDatabaseExportUrl('json')}
                download
                className="flex-1 px-3 py-2 bg-[#00fff2] text-black text-xs font-semibold uppercase tracking-wider text-center hover:bg-[#00cccc] transition-colors"
              >
                Download JSON
              </a>
              <a
                href={getDatabaseExportUrl('sqlite')}
                download
                className="flex-1 px-3 py-2 border border-[#00fff2] text-[#00fff2] text-xs font-semibold uppercase tracking-wider text-center hover:bg-[#00fff2]/10 transition-colors"
              >
                Download .db
              </a>
            </div>
          </div>

          {/* Import */}
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="flex items-start gap-3 mb-3">
              <svg className="w-5 h-5 text-[#ff00ea] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <div>
                <p className="text-sm font-medium text-white">Import database</p>
                <p className="text-xs text-[#666] mt-1">
                  Replace the current database with a JSON export. <span className="text-[#ff6600]">Existing data will be overwritten.</span>
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelected}
              disabled={importing}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="w-full px-3 py-2 border border-[#ff00ea] text-[#ff00ea] text-xs font-semibold uppercase tracking-wider hover:bg-[#ff00ea]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'IMPORTING…' : 'Choose JSON file'}
            </button>
          </div>
        </div>

        <p className="text-xs text-[#555]">
          The database is the UI&apos;s local SQLite store at <code className="text-[#888] bg-black/30 px-1">ui/data/runner.db</code>.
          It contains registered agents and their synced executions/steps/logs. Agent tokens are not included in JSON exports — re-enter them in <Link href="/agents" className="text-[#00fff2] hover:underline">Manage Agents</Link> after restoring.
        </p>
      </div>

      {/* Confirm import dialog */}
      {confirmImport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={cancelImport}
        >
          <div
            className="bg-[#0a0a0a] border border-[#1a1a1a] w-full max-w-md mx-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-white mb-2">Replace database?</h3>
            <p className="text-xs text-[#888] mb-2">
              You are about to import <span className="text-white font-mono">{confirmImport.file.name}</span>.
            </p>
            <p className="text-xs text-[#ff0044] mb-4">
              All current agents, executions, steps, and log lines will be permanently replaced.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={performImport}
                disabled={importing}
                className="flex-1 h-9 bg-[#ff00ea] hover:bg-[#cc00bb] text-white text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {importing ? 'IMPORTING…' : 'REPLACE DATABASE'}
              </button>
              <button
                onClick={cancelImport}
                disabled={importing}
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
