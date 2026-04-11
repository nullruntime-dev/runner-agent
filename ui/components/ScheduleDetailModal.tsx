'use client';

import { useState } from 'react';
import {
  ScheduledTask,
  ScheduledTaskType,
  ScheduleType,
  NotificationTarget,
  toggleScheduledTask,
  deleteScheduledTask,
  updateScheduledTask,
} from '@/lib/api';

interface ScheduleDetailModalProps {
  task: ScheduledTask;
  agentId: string;
  onClose: () => void;
  onRunNow: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  running: boolean;
}

export default function ScheduleDetailModal({
  task,
  agentId,
  onClose,
  onRunNow,
  onUpdated,
  onDeleted,
  running,
}: ScheduleDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description || '');
  const [type, setType] = useState<ScheduledTaskType>(task.type);
  const [action, setAction] = useState(task.action);
  const [scheduleType, setScheduleType] = useState<ScheduleType>(task.scheduleType);
  const [timeOfDay, setTimeOfDay] = useState(task.timeOfDay || '09:00');
  const [dayOfWeek, setDayOfWeek] = useState(task.dayOfWeek || 1);
  const [intervalMinutes, setIntervalMinutes] = useState(task.intervalMinutes || 60);
  const [cronExpression, setCronExpression] = useState(task.cronExpression || '0 9 * * *');
  const [notificationTarget, setNotificationTarget] = useState<NotificationTarget>(
    task.notificationTarget || 'LOG'
  );

  const formatSchedule = () => {
    switch (task.scheduleType) {
      case 'DAILY':
        return `Daily at ${task.timeOfDay}`;
      case 'WEEKLY':
        const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return `Every ${days[task.dayOfWeek || 1]} at ${task.timeOfDay}`;
      case 'INTERVAL':
        return `Every ${task.intervalMinutes} minutes`;
      case 'CRON':
        return `Cron: ${task.cronExpression}`;
      default:
        return 'Unknown';
    }
  };

  const typeColors = {
    PROMPT: { bg: 'bg-[#aa00ff]/10', text: 'text-[#aa00ff]', border: 'border-[#aa00ff]/30', label: 'AI Prompt' },
    SKILL: { bg: 'bg-[#00aaff]/10', text: 'text-[#00aaff]', border: 'border-[#00aaff]/30', label: 'Skill' },
    COMMAND: { bg: 'bg-[#ffaa00]/10', text: 'text-[#ffaa00]', border: 'border-[#ffaa00]/30', label: 'Command' },
  };

  const colors = typeColors[task.type] || typeColors.COMMAND;

  const handleToggle = async () => {
    setToggling(true);
    setError(null);
    try {
      const result = await toggleScheduledTask(agentId, task.id, !task.enabled);
      if (result.success) {
        onUpdated();
      } else {
        setError(result.error || 'Failed to toggle schedule');
      }
    } catch {
      setError('Failed to toggle schedule');
    }
    setToggling(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteScheduledTask(agentId, task.id);
      if (result.success) {
        onDeleted();
        onClose();
      } else {
        setError(result.error || 'Failed to delete schedule');
      }
    } catch {
      setError('Failed to delete schedule');
    }
    setDeleting(false);
    setConfirmDelete(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await updateScheduledTask(agentId, task.id, {
        name,
        description,
        type,
        action,
        scheduleType,
        timeOfDay: scheduleType === 'DAILY' || scheduleType === 'WEEKLY' ? timeOfDay : undefined,
        dayOfWeek: scheduleType === 'WEEKLY' ? dayOfWeek : undefined,
        intervalMinutes: scheduleType === 'INTERVAL' ? intervalMinutes : undefined,
        cronExpression: scheduleType === 'CRON' ? cronExpression : undefined,
        notificationTarget,
      });
      if (result.success) {
        setIsEditing(false);
        onUpdated();
      } else {
        setError(result.error || 'Failed to update schedule');
      }
    } catch {
      setError('Failed to update schedule');
    }
    setSaving(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setName(task.name);
    setDescription(task.description || '');
    setType(task.type);
    setAction(task.action);
    setScheduleType(task.scheduleType);
    setTimeOfDay(task.timeOfDay || '09:00');
    setDayOfWeek(task.dayOfWeek || 1);
    setIntervalMinutes(task.intervalMinutes || 60);
    setCronExpression(task.cronExpression || '0 9 * * *');
    setNotificationTarget(task.notificationTarget || 'LOG');
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-[#0a0a0a] border border-[#1a1a1a] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${colors.bg} ${colors.text} flex items-center justify-center border ${colors.border}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{task.name}</h2>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 ${colors.bg} ${colors.text} ${colors.border} border`}>
                  {colors.label}
                </span>
                <span className={`text-xs ${task.enabled ? 'text-[#00ff66]' : 'text-neutral-500'}`}>
                  {task.enabled ? 'Active' : 'Paused'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle Button */}
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`px-3 py-1.5 text-xs font-medium border transition-colors disabled:opacity-50 ${
                task.enabled
                  ? 'border-[#ff6600]/50 text-[#ff6600] hover:bg-[#ff6600]/10'
                  : 'border-[#00ff66]/50 text-[#00ff66] hover:bg-[#00ff66]/10'
              }`}
              title={task.enabled ? 'Pause schedule' : 'Activate schedule'}
            >
              {toggling ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : task.enabled ? (
                'Pause'
              ) : (
                'Activate'
              )}
            </button>
            {/* Edit Button */}
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-xs font-medium border border-[#00fff2]/50 text-[#00fff2] hover:bg-[#00fff2]/10 transition-colors"
              >
                Edit
              </button>
            )}
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1 text-neutral-500 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Error */}
          {error && (
            <div className="p-3 bg-[#ff0044]/10 border border-[#ff0044]/30 text-[#ff0044] text-sm">
              {error}
            </div>
          )}

          {isEditing ? (
            /* Edit Form */
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white focus:border-[#00fff2] focus:outline-none transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white focus:border-[#00fff2] focus:outline-none transition-colors"
                />
              </div>

              {/* Task Type */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Task Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['COMMAND', 'PROMPT', 'SKILL'] as ScheduledTaskType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`px-3 py-2 border text-sm font-medium transition-colors ${
                        type === t
                          ? 'bg-[#00fff2]/10 border-[#00fff2] text-[#00fff2]'
                          : 'bg-[#111] border-[#333] text-neutral-400 hover:border-neutral-500'
                      }`}
                    >
                      {t === 'COMMAND' && '$ Command'}
                      {t === 'PROMPT' && 'AI Prompt'}
                      {t === 'SKILL' && 'Skill'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {type === 'COMMAND' && 'Command'}
                  {type === 'PROMPT' && 'Prompt'}
                  {type === 'SKILL' && 'Skill Name'}
                </label>
                {type === 'PROMPT' ? (
                  <textarea
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    rows={3}
                    className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white focus:border-[#00fff2] focus:outline-none transition-colors resize-none"
                  />
                ) : (
                  <input
                    type="text"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white font-mono text-sm focus:border-[#00fff2] focus:outline-none transition-colors"
                  />
                )}
              </div>

              {/* Schedule Type */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Schedule</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['DAILY', 'WEEKLY', 'INTERVAL', 'CRON'] as ScheduleType[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScheduleType(s)}
                      className={`px-3 py-2 border text-xs font-medium transition-colors ${
                        scheduleType === s
                          ? 'bg-[#00fff2]/10 border-[#00fff2] text-[#00fff2]'
                          : 'bg-[#111] border-[#333] text-neutral-400 hover:border-neutral-500'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule Details */}
              {scheduleType === 'DAILY' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Time of Day</label>
                  <input
                    type="time"
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white focus:border-[#00fff2] focus:outline-none transition-colors"
                  />
                </div>
              )}

              {scheduleType === 'WEEKLY' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Day of Week</label>
                    <select
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(Number(e.target.value))}
                      className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white focus:border-[#00fff2] focus:outline-none transition-colors"
                    >
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                      <option value={7}>Sunday</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Time</label>
                    <input
                      type="time"
                      value={timeOfDay}
                      onChange={(e) => setTimeOfDay(e.target.value)}
                      className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white focus:border-[#00fff2] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {scheduleType === 'INTERVAL' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Interval (minutes)</label>
                  <input
                    type="number"
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                    min={1}
                    className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white focus:border-[#00fff2] focus:outline-none transition-colors"
                  />
                </div>
              )}

              {scheduleType === 'CRON' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Cron Expression</label>
                  <input
                    type="text"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white font-mono text-sm focus:border-[#00fff2] focus:outline-none transition-colors"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Format: minute hour day month weekday</p>
                </div>
              )}

              {/* Notification */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Notification</label>
                <select
                  value={notificationTarget}
                  onChange={(e) => setNotificationTarget(e.target.value as NotificationTarget)}
                  className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white focus:border-[#00fff2] focus:outline-none transition-colors"
                >
                  <option value="LOG">Log Only</option>
                  <option value="SLACK">Slack</option>
                  <option value="EMAIL">Email</option>
                  <option value="NONE">None</option>
                </select>
              </div>

              {/* Edit Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim() || !action.trim()}
                  className="px-4 py-2 bg-[#00fff2] text-black font-medium hover:bg-[#00fff2]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* View Mode */
            <>
              {/* Description */}
              {task.description && (
                <div>
                  <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Description</h3>
                  <p className="text-sm text-neutral-300">{task.description}</p>
                </div>
              )}

              {/* Schedule Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111] border border-[#1a1a1a] p-4">
                  <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Schedule</h3>
                  <p className="text-sm text-white">{formatSchedule()}</p>
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] p-4">
                  <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Next Run</h3>
                  <p className="text-sm text-white">
                    {task.nextRunAt
                      ? new Date(task.nextRunAt).toLocaleString()
                      : 'Not scheduled'}
                  </p>
                </div>
              </div>

              {/* Action */}
              <div>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                  {task.type === 'COMMAND' ? 'Command' : task.type === 'PROMPT' ? 'Prompt' : 'Skill'}
                </h3>
                <div className="bg-[#111] border border-[#1a1a1a] p-4">
                  <pre className="text-sm text-[#00fff2] font-mono whitespace-pre-wrap break-all">
                    {task.action}
                  </pre>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#111] border border-[#1a1a1a] p-4 text-center">
                  <p className="text-2xl font-bold text-white">{task.runCount || 0}</p>
                  <p className="text-xs text-neutral-500">Total Runs</p>
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] p-4 text-center">
                  <p className="text-2xl font-bold text-[#00ff66]">{(task.runCount || 0) - (task.failureCount || 0)}</p>
                  <p className="text-xs text-neutral-500">Successful</p>
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] p-4 text-center">
                  <p className="text-2xl font-bold text-[#ff0044]">{task.failureCount || 0}</p>
                  <p className="text-xs text-neutral-500">Failed</p>
                </div>
              </div>

              {/* Last Execution */}
              {task.lastRunAt && (
                <div>
                  <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Last Execution</h3>
                  <div className={`border p-4 ${
                    task.lastRunStatus === 'SUCCESS'
                      ? 'bg-[#00ff66]/5 border-[#00ff66]/30'
                      : 'bg-[#ff0044]/5 border-[#ff0044]/30'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {task.lastRunStatus === 'SUCCESS' ? (
                          <svg className="w-5 h-5 text-[#00ff66]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-[#ff0044]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        <span className={`text-sm font-medium ${task.lastRunStatus === 'SUCCESS' ? 'text-[#00ff66]' : 'text-[#ff0044]'}`}>
                          {task.lastRunStatus}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-500">
                        {new Date(task.lastRunAt).toLocaleString()}
                      </span>
                    </div>

                    {task.lastRunResult && (
                      <div className="bg-black/50 p-3 max-h-48 overflow-y-auto">
                        <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap break-all">
                          {task.lastRunResult}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* No executions yet */}
              {!task.lastRunAt && (
                <div className="text-center py-8 border border-dashed border-[#333]">
                  <svg className="w-12 h-12 text-[#333] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-neutral-500">No executions yet</p>
                  <p className="text-xs text-neutral-600 mt-1">Click Run Now to execute this task</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1a1a1a] flex justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500">
              Created: {new Date(task.createdAt).toLocaleDateString()}
            </span>
            {/* Delete Button */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-[#ff0044] hover:text-[#ff0044]/80 transition-colors"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#ff0044]">Confirm delete?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs px-2 py-1 bg-[#ff0044] text-white hover:bg-[#ff0044]/80 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2 py-1 border border-[#333] text-neutral-400 hover:text-white transition-colors"
                >
                  No
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
            >
              Close
            </button>
            {!isEditing && (
              <button
                onClick={onRunNow}
                disabled={running}
                className="px-4 py-2 bg-[#00fff2] text-black font-medium hover:bg-[#00fff2]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {running ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Run Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
