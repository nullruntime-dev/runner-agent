'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Execution } from '@/lib/api';
import StatusIcon from './StatusIcon';

interface ExecutionListProps {
  executions: Execution[];
  showAgent?: boolean;
}

const ITEMS_PER_PAGE = 10;

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
    case 'SUCCESS': return 'border-l-[#00ff66]';
    case 'FAILED': return 'border-l-[#ff0044]';
    case 'RUNNING': return 'border-l-[#ff6600]';
    case 'CANCELLED': return 'border-l-[#888]';
    default: return 'border-l-[#2a2a2a]';
  }
}

export default function ExecutionList({ executions, showAgent = false }: ExecutionListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(executions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentExecutions = executions.slice(startIndex, endIndex);

  if (executions.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-[#444] mb-2">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-sm text-[#888]">No executions found</p>
        <p className="text-xs text-[#444] mt-1">Submit a job via API to get started</p>
      </div>
    );
  }

  return (
    <div>
      {/* Security Notice */}
      <div className="px-4 py-3 bg-[#111] border-b border-[#1a1a1a]">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-[#00fff2] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-[#888]">
            <span className="text-[#00fff2] font-medium">Host Commands</span> — These executions represent shell commands run directly on the agent host machine. All commands are logged for security and transparency.
          </p>
        </div>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-[#1a1a1a] text-left">
            <th className="px-4 py-2 text-xs font-medium text-[#888] uppercase tracking-wider w-12">Status</th>
            <th className="px-4 py-2 text-xs font-medium text-[#888] uppercase tracking-wider">Name</th>
            {showAgent && (
              <th className="px-4 py-2 text-xs font-medium text-[#888] uppercase tracking-wider">Agent</th>
            )}
            <th className="px-4 py-2 text-xs font-medium text-[#888] uppercase tracking-wider w-24">Duration</th>
            <th className="px-4 py-2 text-xs font-medium text-[#888] uppercase tracking-wider w-24">Created</th>
            <th className="px-4 py-2 text-xs font-medium text-[#888] uppercase tracking-wider w-16">Exit</th>
            <th className="px-4 py-2 w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1a1a1a]">
          {currentExecutions.map((execution) => (
            <tr
              key={`${execution.agentId}-${execution.id}`}
              className={`border-l-2 ${getStatusBorder(execution.status)} hover:bg-[#111] transition-colors`}
            >
              <td className="px-4 py-3">
                <StatusIcon status={execution.status} size="sm" />
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/agents/${execution.agentId}/executions/${execution.id}`}
                  className="text-sm text-white hover:text-[#00fff2] font-medium"
                >
                  {execution.name}
                </Link>
                <div className="font-mono text-xs text-[#444] mt-0.5">{execution.id.substring(0, 12)}</div>
              </td>
              {showAgent && (
                <td className="px-4 py-3">
                  <Link
                    href={`/agents/${execution.agentId}`}
                    className="text-xs text-[#888] hover:text-white"
                  >
                    {execution.agentName}
                  </Link>
                </td>
              )}
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-[#888]">
                  {formatDuration(execution.startedAt, execution.completedAt)}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-[#888]">{formatDate(execution.createdAt)}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`font-mono text-xs ${execution.exitCode === 0 ? 'text-[#888]' : execution.exitCode ? 'text-[#ff0044]' : 'text-[#444]'}`}>
                  {execution.exitCode ?? '-'}
                </span>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/agents/${execution.agentId}/executions/${execution.id}`}
                  className="text-xs text-[#888] hover:text-[#00fff2]"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-[#1a1a1a] flex items-center justify-between">
          <div className="text-xs text-[#888]">
            Showing {startIndex + 1}-{Math.min(endIndex, executions.length)} of {executions.length}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs text-[#888] hover:text-white hover:bg-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 text-xs transition-colors ${
                  currentPage === page
                    ? 'bg-[#00fff2] text-black font-medium'
                    : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-xs text-[#888] hover:text-white hover:bg-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
