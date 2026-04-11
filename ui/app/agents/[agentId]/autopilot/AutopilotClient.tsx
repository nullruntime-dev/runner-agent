'use client';

import { useState, useEffect } from 'react';
import {
  ScheduledTask,
  getScheduledTasks,
  runScheduledTaskNow,
  toggleScheduledTask,
  deleteScheduledTask,
} from '@/lib/api';
import AddScheduleModal from '@/components/AddScheduleModal';
import ScheduleDetailModal from '@/components/ScheduleDetailModal';

interface AutopilotClientProps {
  agentId: string;
  isOnline: boolean;
  agentName: string;
}

export default function AutopilotClient({ agentId, isOnline, agentName }: AutopilotClientProps) {
  const [schedules, setSchedules] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isOnline) {
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
    if (running) return;
    setRunning(task.id);
    try {
      await runScheduledTaskNow(agentId, task.id);
      refreshSchedules();
    } catch {
      // Ignore errors
    }
    setRunning(null);
  };

  const handleToggle = async (task: ScheduledTask) => {
    if (toggling) return;
    setToggling(task.id);
    try {
      await toggleScheduledTask(agentId, task.id, !task.enabled);
      setSchedules(prev =>
        prev.map(t => (t.id === task.id ? { ...t, enabled: !t.enabled } : t))
      );
    } catch {
      // Ignore errors
    }
    setToggling(null);
  };

  const handleDelete = async (task: ScheduledTask) => {
    if (!confirm(`Delete schedule "${task.name}"?`)) return;
    try {
      await deleteScheduledTask(agentId, task.id);
      setSchedules(prev => prev.filter(t => t.id !== task.id));
    } catch {
      // Ignore errors
    }
  };

  const formatSchedule = (task: ScheduledTask) => {
    switch (task.scheduleType) {
      case 'DAILY':
        return `Daily at ${task.timeOfDay}`;
      case 'WEEKLY':
        const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return `Every ${days[task.dayOfWeek || 1]} at ${task.timeOfDay}`;
      case 'INTERVAL':
        return `Every ${task.intervalMinutes} minutes`;
      case 'CRON':
        return task.cronExpression;
      default:
        return 'Unknown';
    }
  };

  const formatNextRun = (nextRunAt: string | null) => {
    if (!nextRunAt) return 'Not scheduled';
    const date = new Date(nextRunAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'Now';
    if (diffMins < 60) return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    if (diffMins < 1440) return `in ${Math.floor(diffMins / 60)} hour${Math.floor(diffMins / 60) !== 1 ? 's' : ''}`;
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const typeColors = {
    PROMPT: { bg: 'bg-[#aa00ff]/10', text: 'text-[#aa00ff]', border: 'border-[#aa00ff]/30', label: 'AI Prompt' },
    SKILL: { bg: 'bg-[#00aaff]/10', text: 'text-[#00aaff]', border: 'border-[#00aaff]/30', label: 'Skill' },
    COMMAND: { bg: 'bg-[#ffaa00]/10', text: 'text-[#ffaa00]', border: 'border-[#ffaa00]/30', label: 'Command' },
  };

  // Stats
  const activeCount = schedules.filter(s => s.enabled).length;
  const totalRuns = schedules.reduce((sum, s) => sum + (s.runCount || 0), 0);
  const totalFailures = schedules.reduce((sum, s) => sum + (s.failureCount || 0), 0);

  if (!isOnline) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 text-center">
        <div className="w-20 h-20 bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829" />
          </svg>
        </div>
        <p className="text-lg text-[#888] mb-2">Agent Offline</p>
        <p className="text-sm text-[#444]">Start the agent to manage autopilot schedules</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 flex items-center justify-center">
        <svg className="w-8 h-8 text-[#00fff2] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Stats Bar */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#00fff2]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Schedules</span>
              <span className="text-lg font-semibold text-white tabular-nums">{schedules.length}</span>
            </div>
            <div className="h-4 w-px bg-[#1a1a1a]" />
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#00ff66]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Active</span>
              <span className="text-lg font-semibold text-white tabular-nums">{activeCount}</span>
            </div>
            <div className="h-4 w-px bg-[#1a1a1a]" />
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#00aaff]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Total Runs</span>
              <span className="text-lg font-semibold text-white tabular-nums">{totalRuns}</span>
            </div>
            <div className="h-4 w-px bg-[#1a1a1a]" />
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#ff0044]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Failures</span>
              <span className="text-lg font-semibold text-white tabular-nums">{totalFailures}</span>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="h-9 px-4 bg-gradient-to-r from-[#00fff2] to-[#00cccc] hover:from-[#00cccc] hover:to-[#00fff2] text-black text-xs font-medium transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,255,242,0.3)]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            NEW SCHEDULE
          </button>
        </div>
      </div>

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-12 text-center">
          <div className="w-20 h-20 bg-[#00fff2]/5 border border-[#00fff2]/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-[#00fff2]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Scheduled Tasks</h3>
          <p className="text-sm text-[#888] mb-6 max-w-md mx-auto">
            Automate recurring tasks like backups, system checks, email reports, and more.
            Schedules run automatically even when you are not using the dashboard.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#00fff2] text-black font-medium hover:bg-[#00fff2]/90 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Schedule
          </button>
        </div>
      ) : (
        <div className="bg-[#0a0a0a] border border-[#1a1a1a]">
          <div className="px-4 py-3 border-b border-[#1a1a1a]">
            <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">All Schedules</h2>
          </div>
          <div className="divide-y divide-[#1a1a1a]">
            {schedules.map((task) => {
              const colors = typeColors[task.type] || typeColors.COMMAND;

              return (
                <div
                  key={task.id}
                  className={`p-4 hover:bg-[#111] transition-colors ${!task.enabled ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <button
                      onClick={() => setSelectedTask(task)}
                      className={`w-12 h-12 ${colors.bg} ${colors.text} flex items-center justify-center border ${colors.border} flex-shrink-0 hover:opacity-80 transition-opacity`}
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    {/* Content */}
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-base font-medium text-white">{task.name}</span>
                        {task.enabled && (
                          <span className="w-2 h-2 bg-[#00ff66] shadow-[0_0_6px_rgba(0,255,102,0.5)]" />
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 ${colors.bg} ${colors.text} ${colors.border} border`}>
                          {colors.label}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-[#666] mb-2 line-clamp-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-[#666]">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatSchedule(task)}
                        </span>
                        <span className="text-[#444]">|</span>
                        <span>Next: {formatNextRun(task.nextRunAt)}</span>
                        {task.runCount !== undefined && task.runCount > 0 && (
                          <>
                            <span className="text-[#444]">|</span>
                            <span>{task.runCount} runs</span>
                          </>
                        )}
                        {task.lastRunStatus && (
                          <>
                            <span className="text-[#444]">|</span>
                            <span className={task.lastRunStatus === 'SUCCESS' ? 'text-[#00ff66]' : 'text-[#ff0044]'}>
                              Last: {task.lastRunStatus === 'SUCCESS' ? 'Success' : 'Failed'}
                            </span>
                          </>
                        )}
                      </div>
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Run Now */}
                      <button
                        onClick={() => handleRunNow(task)}
                        disabled={running === task.id}
                        className="p-2 text-[#666] hover:text-[#00fff2] transition-colors disabled:opacity-50"
                        title="Run now"
                      >
                        {running === task.id ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>

                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(task)}
                        disabled={toggling === task.id}
                        className={`p-2 transition-colors disabled:opacity-50 ${
                          task.enabled ? 'text-[#00ff66] hover:text-[#ff6600]' : 'text-[#666] hover:text-[#00ff66]'
                        }`}
                        title={task.enabled ? 'Pause' : 'Activate'}
                      >
                        {toggling === task.id ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : task.enabled ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(task)}
                        className="p-2 text-[#666] hover:text-[#ff0044] transition-colors"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddScheduleModal
          agentId={agentId}
          onClose={() => setShowAddModal(false)}
          onCreated={refreshSchedules}
        />
      )}

      {/* Detail Modal */}
      {selectedTask && (
        <ScheduleDetailModal
          task={selectedTask}
          agentId={agentId}
          onClose={() => setSelectedTask(null)}
          onRunNow={async () => {
            setRunning(selectedTask.id);
            try {
              await runScheduledTaskNow(agentId, selectedTask.id);
              refreshSchedules();
              const tasks = await getScheduledTasks(agentId);
              const updated = tasks.find(t => t.id === selectedTask.id);
              if (updated) setSelectedTask(updated);
            } catch {
              // Ignore errors
            }
            setRunning(null);
          }}
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
