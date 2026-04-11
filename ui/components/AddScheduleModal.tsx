'use client';

import { useState } from 'react';
import { createScheduledTask, ScheduledTaskType, ScheduleType, NotificationTarget } from '@/lib/api';

interface AddScheduleModalProps {
  agentId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddScheduleModal({ agentId, onClose, onCreated }: AddScheduleModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ScheduledTaskType>('COMMAND');
  const [action, setAction] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('DAILY');
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [cronExpression, setCronExpression] = useState('0 9 * * *');
  const [notificationTarget, setNotificationTarget] = useState<NotificationTarget>('LOG');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const result = await createScheduledTask(agentId, {
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
        onCreated();
        onClose();
      } else {
        setError(result.error || 'Failed to create schedule');
      }
    } catch (err) {
      setError('Failed to create schedule');
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#0a0a0a] border border-[#1a1a1a] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between sticky top-0 bg-[#0a0a0a]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#00fff2]/10 border border-[#00fff2]/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#00fff2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Add Schedule</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Name <span className="text-[#ff0044]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Backup"
              required
              className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this schedule do?"
              className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors"
            />
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Task Type <span className="text-[#ff0044]">*</span>
            </label>
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
              <span className="text-[#ff0044]"> *</span>
            </label>
            {type === 'PROMPT' ? (
              <textarea
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="e.g., Summarize the latest system logs and report any errors"
                required
                rows={3}
                className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors resize-none"
              />
            ) : (
              <input
                type="text"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder={type === 'COMMAND' ? 'e.g., df -h' : 'e.g., slack'}
                required
                className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors font-mono text-sm"
              />
            )}
          </div>

          {/* Schedule Type */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Schedule <span className="text-[#ff0044]">*</span>
            </label>
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
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Time of Day
              </label>
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
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Day of Week
                </label>
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
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Time
                </label>
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
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Interval (minutes)
              </label>
              <input
                type="number"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                min={1}
                className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white focus:border-[#00fff2] focus:outline-none transition-colors"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Task will run every {intervalMinutes} minute{intervalMinutes !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {scheduleType === 'CRON' && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Cron Expression
              </label>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="0 9 * * *"
                className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white font-mono text-sm focus:border-[#00fff2] focus:outline-none transition-colors"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Format: minute hour day month weekday
              </p>
            </div>
          )}

          {/* Notification */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Notification
            </label>
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

          {/* Error */}
          {error && (
            <div className="p-3 bg-[#ff0044]/10 border border-[#ff0044]/30 text-[#ff0044] text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !action.trim()}
              className="px-5 py-2.5 bg-[#00fff2] text-black font-medium hover:bg-[#00fff2]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Schedule'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
