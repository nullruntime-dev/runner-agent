'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ScheduledTask, getScheduledTasks, runScheduledTaskNow } from '@/lib/api';
import AddScheduleModal from './AddScheduleModal';
import ScheduleDetailModal from './ScheduleDetailModal';

interface HomeAutopilotProps {
  agentId: string | null;
  isOnline: boolean;
}

export default function HomeAutopilot({ agentId, isOnline }: HomeAutopilotProps) {
  const [schedules, setSchedules] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!agentId || !isOnline) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const tasks = await getScheduledTasks(agentId);
        if (!cancelled) {
          setSchedules(tasks);
        }
      } catch {
        // Ignore errors
      }
      if (!cancelled) {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agentId, isOnline, refreshKey]);

  const refreshSchedules = () => {
    setRefreshKey(k => k + 1);
  };

  const handleRunNow = async (task: ScheduledTask) => {
    if (!agentId || running) return;
    setRunning(task.id);
    try {
      await runScheduledTaskNow(agentId, task.id);
      refreshSchedules();
      // Update the selected task
      const tasks = await getScheduledTasks(agentId);
      const updated = tasks.find(t => t.id === task.id);
      if (updated) setSelectedTask(updated);
    } catch {
      // Ignore errors
    }
    setRunning(null);
  };

  const formatSchedule = (task: ScheduledTask) => {
    switch (task.scheduleType) {
      case 'DAILY':
        return `Daily at ${task.timeOfDay}`;
      case 'WEEKLY':
        const days = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return `${days[task.dayOfWeek || 1]} at ${task.timeOfDay}`;
      case 'INTERVAL':
        return `Every ${task.intervalMinutes}m`;
      case 'CRON':
        return task.cronExpression;
      default:
        return 'Unknown';
    }
  };

  const formatNextRun = (nextRunAt: string | null) => {
    if (!nextRunAt) return '—';
    const date = new Date(nextRunAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'Now';
    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffMins < 1440) return `in ${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // No agent connected
  if (!agentId) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-[#888] mb-1">No agents connected</p>
        <p className="text-xs text-[#444]">Add an agent to create autopilot tasks</p>
      </div>
    );
  }

  // Agent offline
  if (!isOnline) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829" />
          </svg>
        </div>
        <p className="text-sm text-[#888] mb-1">Agent offline</p>
        <p className="text-xs text-[#444]">Start the agent to view schedules</p>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <svg className="w-5 h-5 text-[#00fff2] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const typeColors = {
    PROMPT: { bg: 'bg-[#aa00ff]/10', text: 'text-[#aa00ff]', border: 'border-[#aa00ff]/30' },
    SKILL: { bg: 'bg-[#00aaff]/10', text: 'text-[#00aaff]', border: 'border-[#00aaff]/30' },
    COMMAND: { bg: 'bg-[#ffaa00]/10', text: 'text-[#ffaa00]', border: 'border-[#ffaa00]/30' },
  };

  return (
    <div>
      {/* Schedule List */}
      {schedules.length > 0 ? (
        <div className="divide-y divide-[#1a1a1a]">
          {schedules.map((task) => {
            const colors = typeColors[task.type] || typeColors.COMMAND;

            return (
              <div
                key={task.id}
                className={`p-4 hover:bg-[#111] transition-colors ${!task.enabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <button
                    onClick={() => setSelectedTask(task)}
                    className={`w-10 h-10 ${colors.bg} ${colors.text} flex items-center justify-center border ${colors.border} flex-shrink-0 hover:opacity-80 transition-opacity`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>

                  {/* Content */}
                  <button
                    onClick={() => setSelectedTask(task)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{task.name}</span>
                      {task.enabled && (
                        <span className="w-2 h-2 bg-[#00ff66] shadow-[0_0_6px_rgba(0,255,102,0.5)]" />
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 ${colors.bg} ${colors.text} ${colors.border} border`}>
                        {task.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#666]">
                      <span>{formatSchedule(task)}</span>
                      <span className="text-[#444]">|</span>
                      <span>Next: {formatNextRun(task.nextRunAt)}</span>
                      {task.lastRunStatus && (
                        <>
                          <span className="text-[#444]">|</span>
                          <span className={task.lastRunStatus === 'SUCCESS' ? 'text-[#00ff66]' : 'text-[#ff0044]'}>
                            Last: {task.lastRunStatus === 'SUCCESS' ? '✓ Success' : '✗ Failed'}
                          </span>
                        </>
                      )}
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRunNow(task)}
                      disabled={running === task.id}
                      className="p-2 text-[#666] hover:text-[#00fff2] transition-colors disabled:opacity-50"
                      title="Run now"
                    >
                      {running === task.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-[#00fff2]/5 border border-[#00fff2]/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#00fff2]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-[#888] mb-2">No scheduled tasks yet</p>
          <p className="text-xs text-[#444] mb-4">Automate recurring tasks like backups, reports, and monitoring</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00fff2] text-black text-sm font-medium hover:bg-[#00fff2]/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create First Schedule
          </button>
        </div>
      )}

      {/* Add button when there are schedules */}
      {schedules.length > 0 && (
        <div className="p-4 border-t border-[#1a1a1a]">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-[#333] text-[#666] hover:text-[#00fff2] hover:border-[#00fff2]/50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Schedule
          </button>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && agentId && (
        <AddScheduleModal
          agentId={agentId}
          onClose={() => setShowAddModal(false)}
          onCreated={refreshSchedules}
        />
      )}

      {/* Detail Modal */}
      {selectedTask && agentId && (
        <ScheduleDetailModal
          task={selectedTask}
          agentId={agentId}
          onClose={() => setSelectedTask(null)}
          onRunNow={() => handleRunNow(selectedTask)}
          onUpdated={async () => {
            refreshSchedules();
            const tasks = await getScheduledTasks(agentId);
            const updated = tasks.find(t => t.id === selectedTask.id);
            if (updated) setSelectedTask(updated);
          }}
          onDeleted={refreshSchedules}
          running={running === selectedTask.id}
        />
      )}
    </div>
  );
}
