'use client';

import Link from 'next/link';
import { Execution } from '@/lib/api';
import StatusIcon from './StatusIcon';

interface ExecutionListProps {
  executions: Execution[];
  showAgent?: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '--:--';
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const duration = Math.floor((endTime - startTime) / 1000);

  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getStatusBorder(status: string): string {
  switch (status) {
    case 'SUCCESS': return 'border-l-green-500';
    case 'FAILED': return 'border-l-red-500';
    case 'RUNNING': return 'border-l-amber-500';
    case 'CANCELLED': return 'border-l-neutral-500';
    default: return 'border-l-neutral-700';
  }
}

export default function ExecutionList({ executions, showAgent = false }: ExecutionListProps) {
  if (executions.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-neutral-600 mb-2">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-sm text-neutral-500">No executions found</p>
        <p className="text-xs text-neutral-600 mt-1">Submit a job via API to get started</p>
      </div>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-neutral-800 text-left">
          <th className="px-4 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider w-12">Status</th>
          <th className="px-4 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">Name</th>
          {showAgent && (
            <th className="px-4 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">Agent</th>
          )}
          <th className="px-4 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider w-24">Duration</th>
          <th className="px-4 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider w-24">Created</th>
          <th className="px-4 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider w-16">Exit</th>
          <th className="px-4 py-2 w-16"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-800">
        {executions.map((execution) => (
          <tr
            key={`${execution.agentId}-${execution.id}`}
            className={`border-l-2 ${getStatusBorder(execution.status)} hover:bg-neutral-800/50 transition-colors`}
          >
            <td className="px-4 py-3">
              <StatusIcon status={execution.status} size="sm" />
            </td>
            <td className="px-4 py-3">
              <Link
                href={`/agents/${execution.agentId}/executions/${execution.id}`}
                className="text-sm text-neutral-200 hover:text-white font-medium"
              >
                {execution.name}
              </Link>
              <div className="font-mono text-xs text-neutral-600 mt-0.5">{execution.id.substring(0, 12)}</div>
            </td>
            {showAgent && (
              <td className="px-4 py-3">
                <Link
                  href={`/agents/${execution.agentId}`}
                  className="text-xs text-neutral-400 hover:text-neutral-200"
                >
                  {execution.agentName}
                </Link>
              </td>
            )}
            <td className="px-4 py-3">
              <span className="font-mono text-xs text-neutral-400">
                {formatDuration(execution.startedAt, execution.completedAt)}
              </span>
            </td>
            <td className="px-4 py-3">
              <span className="text-xs text-neutral-500">{formatDate(execution.createdAt)}</span>
            </td>
            <td className="px-4 py-3">
              <span className={`font-mono text-xs ${execution.exitCode === 0 ? 'text-neutral-500' : execution.exitCode ? 'text-red-400' : 'text-neutral-600'}`}>
                {execution.exitCode ?? '-'}
              </span>
            </td>
            <td className="px-4 py-3">
              <Link
                href={`/agents/${execution.agentId}/executions/${execution.id}`}
                className="text-xs text-neutral-500 hover:text-neutral-300"
              >
                View →
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
