'use client';

import { Step } from '@/lib/api';
import StatusIcon from './StatusIcon';

interface StepsSidebarProps {
  steps: Step[];
  selectedStep: number | null;
  onSelectStep: (index: number | null) => void;
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '';
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const duration = Math.floor((endTime - startTime) / 1000);
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function StepsSidebar({ steps, selectedStep, onSelectStep }: StepsSidebarProps) {
  return (
    <div className="w-72 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col">
      <div className="px-4 py-3 border-b border-[#1a1a1a]">
        <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Steps</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <button
          onClick={() => onSelectStep(null)}
          className={`w-full text-left px-4 py-3 flex items-center gap-3 border-l-2 transition-colors ${
            selectedStep === null
              ? 'bg-[#111] border-l-[#00fff2]'
              : 'border-l-transparent hover:bg-[#111]'
          }`}
        >
          <div className="w-4 h-4 bg-[#2a2a2a] flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <span className="text-xs text-white font-medium uppercase tracking-wider">All Output</span>
        </button>

        <div className="border-t border-[#1a1a1a]" />

        {steps.map((step, index) => (
          <button
            key={step.id || index}
            onClick={() => onSelectStep(index)}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 border-l-2 transition-colors ${
              selectedStep === index
                ? 'bg-[#111] border-l-[#00fff2]'
                : 'border-l-transparent hover:bg-[#111]'
            }`}
          >
            <StatusIcon status={step.status || 'PENDING'} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{step.name}</div>
            </div>
            {step.startedAt && (
              <span className="font-mono text-xs text-[#444]">
                {formatDuration(step.startedAt, step.completedAt)}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-[#1a1a1a] bg-[#050505]">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-[#00ff66]" />
              <span className="text-[#888] tabular-nums">{steps.filter(s => s.status === 'SUCCESS').length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-[#ff0044]" />
              <span className="text-[#888] tabular-nums">{steps.filter(s => s.status === 'FAILED').length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-[#444]" />
              <span className="text-[#888] tabular-nums">{steps.filter(s => !s.status || s.status === 'PENDING').length}</span>
            </div>
          </div>
          <span className="text-[#444]">{steps.length} steps</span>
        </div>
      </div>
    </div>
  );
}
