'use client';

import { Step } from '@/lib/api';
import StatusBadge from './StatusBadge';
import { useState } from 'react';

interface StepListProps {
  steps: Step[];
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '-';
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const duration = Math.floor((endTime - startTime) / 1000);
  return `${duration}s`;
}

export default function StepList({ steps }: StepListProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  if (!steps || steps.length === 0) {
    return <div className="text-gray-500 p-4">No steps</div>;
  }

  return (
    <div className="divide-y divide-gray-200">
      {steps.map((step) => (
        <div key={step.id} className="p-4">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() =>
              setExpandedStep(expandedStep === step.id ? null : step.id)
            }
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm w-6">
                #{step.stepIndex + 1}
              </span>
              <span className="font-medium">{step.name}</span>
              {step.continueOnError && (
                <span className="text-xs text-gray-400">(continue on error)</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {formatDuration(step.startedAt, step.completedAt)}
              </span>
              <StatusBadge status={step.status || 'PENDING'} />
              <span className="text-gray-400">
                {expandedStep === step.id ? '▼' : '▶'}
              </span>
            </div>
          </div>

          {expandedStep === step.id && (
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Command</div>
                <pre className="bg-gray-100 p-3  text-sm overflow-x-auto">
                  {step.run}
                </pre>
              </div>

              {step.output && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Output</div>
                  <pre className="bg-gray-900 text-gray-200 p-3  text-sm overflow-x-auto max-h-64 overflow-y-auto">
                    {step.output}
                  </pre>
                </div>
              )}

              {step.error && (
                <div>
                  <div className="text-xs text-red-500 mb-1">Error</div>
                  <pre className="bg-red-50 text-red-700 p-3  text-sm overflow-x-auto">
                    {step.error}
                  </pre>
                </div>
              )}

              {step.exitCode !== null && (
                <div className="text-sm text-gray-500">
                  Exit code: <span className="font-mono">{step.exitCode}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
