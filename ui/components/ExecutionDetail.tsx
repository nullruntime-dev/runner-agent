'use client';

import { useEffect, useState } from 'react';
import { Execution, getExecutionClient, cancelExecution, getLogsStreamUrl } from '@/lib/api';
import StatusIcon from './StatusIcon';
import StepsSidebar from './StepsSidebar';
import LogViewer from './LogViewer';

interface ExecutionDetailProps {
  agentId: string;
  executionId: string;
  initialExecution: Execution;
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '--:--';
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const duration = Math.floor((endTime - startTime) / 1000);

  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  if (duration < 3600) return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const hours = Math.floor(duration / 3600);
  return `${hours}h ${Math.floor((duration % 3600) / 60)}m`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

export default function ExecutionDetail({ agentId, executionId, initialExecution }: ExecutionDetailProps) {
  const [execution, setExecution] = useState<Execution>(initialExecution);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const isComplete = ['SUCCESS', 'FAILED', 'CANCELLED'].includes(execution.status);

  useEffect(() => {
    if (isComplete) return;

    const interval = setInterval(async () => {
      try {
        const updated = await getExecutionClient(agentId, executionId);
        setExecution(updated);
      } catch (err) {
        console.error('Failed to refresh execution:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [agentId, executionId, isComplete]);

  const handleCancel = async () => {
    if (cancelling || isComplete) return;
    setCancelling(true);
    try {
      await cancelExecution(agentId, executionId);
      const updated = await getExecutionClient(agentId, executionId);
      setExecution(updated);
    } catch (err) {
      console.error('Failed to cancel:', err);
    } finally {
      setCancelling(false);
    }
  };

  const getStatusLabel = () => {
    switch (execution.status) {
      case 'SUCCESS': return 'COMPLETED';
      case 'FAILED': return 'FAILED';
      case 'CANCELLED': return 'CANCELLED';
      case 'RUNNING': return 'IN PROGRESS';
      case 'PENDING': return 'QUEUED';
      default: return execution.status;
    }
  };

  const getStatusColor = () => {
    switch (execution.status) {
      case 'SUCCESS': return 'text-green-500';
      case 'FAILED': return 'text-red-500';
      case 'CANCELLED': return 'text-neutral-500';
      case 'RUNNING': return 'text-amber-500';
      default: return 'text-neutral-500';
    }
  };

  const logsUrl = getLogsStreamUrl(agentId, executionId);

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      {/* Header */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <StatusIcon status={execution.status} size="lg" />
            <div>
              <h1 className="text-lg font-semibold text-white">{execution.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs font-semibold uppercase tracking-wider ${getStatusColor()}`}>
                  {getStatusLabel()}
                </span>
                <span className="text-neutral-700">|</span>
                <span className="font-mono text-xs text-neutral-500">{executionId}</span>
              </div>
            </div>
          </div>
          {!isComplete && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="h-8 px-4 bg-red-900 hover:bg-red-800 border border-red-800 text-red-200 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {cancelling ? 'CANCELLING...' : 'CANCEL'}
            </button>
          )}
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-neutral-800">
          <div>
            <div className="text-xs text-neutral-600 uppercase tracking-wider">Duration</div>
            <div className="font-mono text-sm text-neutral-300 mt-0.5">
              {formatDuration(execution.startedAt, execution.completedAt)}
            </div>
          </div>
          <div className="h-8 w-px bg-neutral-800" />
          <div>
            <div className="text-xs text-neutral-600 uppercase tracking-wider">Started</div>
            <div className="text-sm text-neutral-300 mt-0.5">
              {formatDate(execution.startedAt)}
            </div>
          </div>
          <div className="h-8 w-px bg-neutral-800" />
          <div>
            <div className="text-xs text-neutral-600 uppercase tracking-wider">Exit Code</div>
            <div className={`font-mono text-sm mt-0.5 ${execution.exitCode === 0 ? 'text-green-500' : execution.exitCode ? 'text-red-500' : 'text-neutral-500'}`}>
              {execution.exitCode ?? '-'}
            </div>
          </div>
        </div>

        {execution.error && (
          <div className="mt-4 p-3 bg-red-950 border border-red-900 text-red-400 text-sm">
            <span className="font-semibold">Error:</span> {execution.error}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <StepsSidebar
          steps={execution.steps || []}
          selectedStep={selectedStep}
          onSelectStep={setSelectedStep}
        />
        <LogViewer
          logsUrl={logsUrl}
          steps={execution.steps || []}
          selectedStep={selectedStep}
          isComplete={isComplete}
        />
      </div>
    </div>
  );
}
