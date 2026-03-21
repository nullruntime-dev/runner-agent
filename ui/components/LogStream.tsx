'use client';

import { useEffect, useRef, useState } from 'react';
import { LogLine } from '@/lib/api';

interface LogStreamProps {
  executionId: string;
  isComplete: boolean;
}

export default function LogStream({ executionId, isComplete }: LogStreamProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    const eventSource = new EventSource(`/api/logs/${executionId}`);

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.addEventListener('log', (event) => {
      const logLine: LogLine = JSON.parse(event.data);
      setLogs((prev) => [...prev, logLine]);
    });

    eventSource.onerror = () => {
      setConnected(false);
      if (!isComplete) {
        setError('Connection lost. Retrying...');
      }
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [executionId, isComplete]);

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm text-gray-300">Output</span>
        <div className="flex items-center gap-2">
          {!isComplete && (
            <span
              className={`w-2 h-2  ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
          )}
          <span className="text-xs text-gray-500">
            {logs.length} lines
          </span>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-900 text-red-200 text-sm">
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-gray-900 p-4 font-mono text-sm"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500">
            {isComplete ? 'No output' : 'Waiting for output...'}
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={log.id || index} className="flex hover:bg-gray-800">
              <span className="text-gray-600 select-none w-12 text-right pr-4 flex-shrink-0">
                {index + 1}
              </span>
              <span className="text-blue-400 w-32 flex-shrink-0 truncate pr-2">
                [{log.stepName}]
              </span>
              <span className="text-gray-200 whitespace-pre-wrap break-all">
                {log.line}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
