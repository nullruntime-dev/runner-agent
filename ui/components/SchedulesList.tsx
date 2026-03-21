'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ScheduledTask,
  getScheduledTasks,
  toggleScheduledTask,
  runScheduledTaskNow,
  deleteScheduledTask,
} from '@/lib/api';

interface SchedulesListProps {
  agentId: string;
  isOnline: boolean;
}

export default function SchedulesList({ agentId, isOnline }: SchedulesListProps) {
  const [schedules, setSchedules] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<number | null>(null);

  const fetchSchedules = async () => {
    if (!isOnline) {
      setLoading(false);
      return;
    }

    try {
      const tasks = await getScheduledTasks(agentId);
      setSchedules(tasks);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSchedules();
  }, [agentId, isOnline]);

  const handleToggle = async (task: ScheduledTask) => {
    try {
      await toggleScheduledTask(agentId, task.id, !task.enabled);
      setSchedules(prev =>
        prev.map(t => (t.id === task.id ? { ...t, enabled: !t.enabled } : t))
      );
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  };

  const handleRunNow = async (task: ScheduledTask) => {
    if (running) return;
    setRunning(task.id);
    try {
      await runScheduledTaskNow(agentId, task.id);
      // Refresh to get updated lastRun info
      fetchSchedules();
    } catch (err) {
      console.error('Failed to run schedule:', err);
    }
    setRunning(null);
  };

  const handleDelete = async (task: ScheduledTask) => {
    if (!confirm(`Delete schedule "${task.name}"?`)) return;
    try {
      await deleteScheduledTask(agentId, task.id);
      setSchedules(prev => prev.filter(t => t.id !== task.id));
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  const formatSchedule = (task: ScheduledTask) => {
    switch (task.scheduleType) {
      case 'DAILY':
        return `Daily at ${task.timeOfDay}`;
      case 'WEEKLY':
        const days = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return `${days[task.dayOfWeek || 1]} at ${task.timeOfDay}`;
      case 'INTERVAL':
        return `Every ${task.intervalMinutes} min`;
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
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const typeColors = {
    PROMPT: { bg: 'bg-[#aa00ff]/10', text: 'text-[#aa00ff]', border: 'border-[#aa00ff]/30' },
    SKILL: { bg: 'bg-[#00aaff]/10', text: 'text-[#00aaff]', border: 'border-[#00aaff]/30' },
    COMMAND: { bg: 'bg-[#ffaa00]/10', text: 'text-[#ffaa00]', border: 'border-[#ffaa00]/30' },
  };

  if (!isOnline) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <svg className="w-4 h-4 text-[#00fff2] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <Link
        href={`/agents/${agentId}/chat`}
        className="block px-3 py-3 hover:bg-[#111] transition-colors group cursor-pointer"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-[#00fff2]/10 text-[#00fff2] flex items-center justify-center border border-[#00fff2]/30 group-hover:bg-[#00fff2]/20 transition-colors">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[10px] font-medium text-neutral-400 group-hover:text-neutral-300 transition-colors">
            Add Schedule
          </span>
        </div>
        <p className="text-[10px] text-neutral-600 leading-relaxed group-hover:text-neutral-500 transition-colors">
          Say: &quot;Schedule daily email summary at 9am&quot;
        </p>
      </Link>
    );
  }

  return (
    <div className="space-y-1 p-1">
      {schedules.map((task) => {
        const colors = typeColors[task.type] || typeColors.PROMPT;

        return (
          <div
            key={task.id}
            className={`w-full p-2.5 transition-all text-left group border ${
              task.enabled
                ? 'border-[#1a1a1a] bg-[#0f0f0f] hover:bg-[#111]'
                : 'border-transparent hover:bg-[#111] opacity-60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 ${colors.bg} ${colors.text} flex items-center justify-center border ${colors.border} flex-shrink-0`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-200 truncate">
                    {task.name}
                  </span>
                  {task.enabled && (
                    <span className="w-1.5 h-1.5 bg-[#00ff66] shadow-[0_0_6px_rgba(0,255,102,0.5)]" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-neutral-600">
                    {formatSchedule(task)}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Next: {formatNextRun(task.nextRunAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Run Now */}
                <button
                  onClick={() => handleRunNow(task)}
                  disabled={running === task.id}
                  className="p-1 text-neutral-600 hover:text-[#00fff2] transition-colors disabled:opacity-50"
                  title="Run now"
                >
                  {running === task.id ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(task)}
                  className="p-1 text-neutral-600 hover:text-neutral-400 transition-colors"
                  title={task.enabled ? 'Disable' : 'Enable'}
                >
                  {task.enabled ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(task)}
                  className="p-1 text-neutral-600 hover:text-[#ff0044] transition-colors"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Last run info */}
            {task.lastRunAt && (
              <div className="mt-2 pt-2 border-t border-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${task.lastRunStatus === 'SUCCESS' ? 'text-[#00ff66]' : 'text-[#ff0044]'}`}>
                    {task.lastRunStatus === 'SUCCESS' ? '✓' : '✗'} Last: {new Date(task.lastRunAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-[10px] text-neutral-600">
                    ({task.runCount} runs{task.failureCount > 0 ? `, ${task.failureCount} failed` : ''})
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Schedule link */}
      <Link
        href={`/agents/${agentId}/chat`}
        className="flex items-center gap-2 px-2 py-2 hover:bg-[#111] transition-colors group"
      >
        <div className="w-6 h-6 bg-[#00fff2]/10 text-[#00fff2] flex items-center justify-center group-hover:bg-[#00fff2]/20 transition-colors">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <span className="text-[10px] text-neutral-500 group-hover:text-neutral-400 transition-colors">
          Add Schedule via Chat
        </span>
      </Link>
    </div>
  );
}
