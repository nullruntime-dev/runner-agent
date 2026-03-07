'use client';

import { useEffect, useRef, useState } from 'react';
import { LogLine, Step } from '@/lib/api';

interface LogViewerProps {
  logsUrl: string;
  steps: Step[];
  selectedStep: number | null;
  isComplete: boolean;
}

export default function LogViewer({ logsUrl, steps, selectedStep, isComplete }: LogViewerProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    setLogs([]);
    const eventSource = new EventSource(logsUrl);

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.addEventListener('log', (event) => {
      const logLine: LogLine = JSON.parse(event.data);
      setLogs((prev) => [...prev, logLine]);
    });

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [logsUrl]);

  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  };

  const filteredLogs = selectedStep !== null
    ? logs.filter(log => log.stepName === steps[selectedStep]?.name)
    : logs;

  const groupedLogs = selectedStep === null
    ? steps.map(step => ({
        step,
        logs: logs.filter(log => log.stepName === step.name),
      }))
    : null;

  return (
    <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            {selectedStep !== null ? steps[selectedStep]?.name : 'Output Log'}
          </span>
          {!isComplete && connected && (
            <span className="flex items-center gap-1.5 text-xs text-amber-500">
              <span className="w-1.5 h-1.5 bg-amber-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <span className="font-mono text-xs text-neutral-600">
          {filteredLogs.length} lines
        </span>
      </div>

      {/* Log content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto font-mono text-xs leading-5"
      >
        {selectedStep === null ? (
          groupedLogs?.map(({ step, logs: stepLogs }, groupIndex) => (
            <div key={step.id || groupIndex}>
              <div className="sticky top-0 bg-neutral-900 border-y border-neutral-800 px-4 py-2 flex items-center gap-3">
                <span className="text-neutral-600">#{step.stepIndex + 1}</span>
                <span className="text-neutral-300 font-medium">{step.name}</span>
                <div className="flex-1" />
                {step.status === 'SUCCESS' && (
                  <span className="text-green-500 text-xs">PASSED</span>
                )}
                {step.status === 'FAILED' && (
                  <span className="text-red-500 text-xs">FAILED</span>
                )}
                {step.status === 'RUNNING' && (
                  <span className="text-amber-500 text-xs animate-pulse">RUNNING</span>
                )}
                {(!step.status || step.status === 'PENDING') && (
                  <span className="text-neutral-600 text-xs">PENDING</span>
                )}
              </div>
              <div className="px-4 py-2">
                {stepLogs.length === 0 ? (
                  <div className="text-neutral-600 py-2">
                    {step.status === 'PENDING' ? 'Waiting to start...' : 'No output'}
                  </div>
                ) : (
                  stepLogs.map((log, index) => (
                    <div key={log.id || index} className="flex hover:bg-neutral-900">
                      <span className="text-neutral-700 select-none w-10 text-right pr-3 flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-neutral-300 whitespace-pre-wrap break-all">
                        {log.line}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="p-4">
            {filteredLogs.length === 0 ? (
              <div className="text-neutral-600 py-8 text-center">
                {isComplete ? 'No output for this step' : 'Waiting for output...'}
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={log.id || index} className="flex hover:bg-neutral-900">
                  <span className="text-neutral-700 select-none w-10 text-right pr-3 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-neutral-300 whitespace-pre-wrap break-all">
                    {log.line}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
