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
    <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[#888] uppercase tracking-wider">
            {selectedStep !== null ? steps[selectedStep]?.name : 'Output Log'}
          </span>
          {!isComplete && connected && (
            <span className="flex items-center gap-1.5 text-xs text-[#ff6600]">
              <span className="w-1.5 h-1.5 bg-[#ff6600] animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <span className="font-mono text-xs text-[#444]">
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
              <div className="sticky top-0 bg-[#0a0a0a] border-y border-[#1a1a1a] px-4 py-2 flex items-center gap-3">
                <span className="text-[#444]">#{step.stepIndex + 1}</span>
                <span className="text-white font-medium">{step.name}</span>
                <div className="flex-1" />
                {step.status === 'SUCCESS' && (
                  <span className="text-[#00ff66] text-xs">PASSED</span>
                )}
                {step.status === 'FAILED' && (
                  <span className="text-[#ff0044] text-xs">FAILED</span>
                )}
                {step.status === 'RUNNING' && (
                  <span className="text-[#ff6600] text-xs animate-pulse">RUNNING</span>
                )}
                {(!step.status || step.status === 'PENDING') && (
                  <span className="text-[#444] text-xs">PENDING</span>
                )}
              </div>
              <div className="px-4 py-2">
                {stepLogs.length === 0 ? (
                  <div className="text-[#444] py-2">
                    {step.status === 'PENDING' ? 'Waiting to start...' : 'No output'}
                  </div>
                ) : (
                  stepLogs.map((log, index) => (
                    <div key={log.id || index} className="flex hover:bg-[#0a0a0a]">
                      <span className="text-[#2a2a2a] select-none w-10 text-right pr-3 flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-white whitespace-pre-wrap break-all">
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
              <div className="text-[#444] py-8 text-center">
                {isComplete ? 'No output for this step' : 'Waiting for output...'}
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={log.id || index} className="flex hover:bg-[#0a0a0a]">
                  <span className="text-[#2a2a2a] select-none w-10 text-right pr-3 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-white whitespace-pre-wrap break-all">
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
