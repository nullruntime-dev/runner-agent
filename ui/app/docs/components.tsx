'use client';

import React from 'react';

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12">
      <h2 className="text-2xl font-bold text-white mb-6 pb-2 border-b border-[#1a1a1a]">{title}</h2>
      {children}
    </section>
  );
}

export function CodeBlock({ children, language, className }: { children: string; language?: string; className?: string }) {
  return (
    <div className={`bg-[#0a0a0a] border border-[#1a1a1a] ${className || ''}`}>
      {language && (
        <div className="px-4 py-2 border-b border-[#1a1a1a]">
          <span className="text-xs text-[#888] uppercase">{language}</span>
        </div>
      )}
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm text-white font-mono">{children}</code>
      </pre>
    </div>
  );
}

export function Endpoint({ method, path, auth, children }: { method: string; path: string; auth: boolean; children: React.ReactNode }) {
  const methodColors: Record<string, string> = {
    GET: 'bg-[#00ff66]/20 text-[#00ff66]',
    POST: 'bg-[#00fff2]/20 text-[#00fff2]',
    DELETE: 'bg-[#ff0044]/20 text-[#ff0044]',
  };

  return (
    <div className="mb-8 bg-[#0a0a0a] border border-[#1a1a1a]">
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-3">
        <span className={`px-2 py-0.5 text-xs font-semibold ${methodColors[method]}`}>{method}</span>
        <code className="text-sm text-white font-mono">{path}</code>
        {auth && <span className="text-xs text-[#444] ml-auto">Requires Auth</span>}
      </div>
      <div className="p-4 text-sm text-[#888]">{children}</div>
    </div>
  );
}

export function TableRow({ field, type, required, description }: { field: string; type: string; required: string; description: string }) {
  return (
    <tr>
      <td className="px-4 py-3 font-mono text-[#00fff2]">{field}</td>
      <td className="px-4 py-3 text-[#888]">{type}</td>
      <td className="px-4 py-3 text-[#888]">{required}</td>
      <td className="px-4 py-3 text-[#888]">{description}</td>
    </tr>
  );
}

export function StatusCard({ status, color, description }: { status: string; color: string; description: string }) {
  const colors: Record<string, string> = {
    green: 'bg-[#00ff66]',
    red: 'bg-[#ff0044]',
    amber: 'bg-[#ff6600]',
    neutral: 'bg-[#888]',
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 flex items-start gap-3">
      <div className={`w-3 h-3 mt-0.5 ${colors[color]}`} />
      <div>
        <div className="text-sm font-semibold text-white">{status}</div>
        <div className="text-xs text-[#888] mt-0.5">{description}</div>
      </div>
    </div>
  );
}

export function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4">
      <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
      <p className="text-xs text-[#888]">{description}</p>
    </div>
  );
}

export function TroubleshootItem({ problem, solutions }: { problem: string; solutions: string[] }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a]">
      <div className="px-4 py-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#ff0044]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-white">{problem}</span>
        </div>
      </div>
      <div className="p-4">
        <ul className="space-y-2">
          {solutions.map((solution, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[#888]">
              <span className="text-[#00ff66] mt-0.5">-</span>
              {solution}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function InfoBox({ type, title, children }: { type: 'warning' | 'info' | 'tip'; title: string; children: React.ReactNode }) {
  const styles = {
    warning: {
      bg: 'bg-[#ff6600]/10 border-[#ff6600]/30',
      icon: 'text-[#ff6600]',
      title: 'text-[#ff6600]',
      text: 'text-[#ff6600]/80',
    },
    info: {
      bg: 'bg-[#00fff2]/10 border-[#00fff2]/30',
      icon: 'text-[#00fff2]',
      title: 'text-[#00fff2]',
      text: 'text-[#00fff2]/80',
    },
    tip: {
      bg: 'bg-[#00ff66]/10 border-[#00ff66]/30',
      icon: 'text-[#00ff66]',
      title: 'text-[#00ff66]',
      text: 'text-[#00ff66]/80',
    },
  };

  const s = styles[type];

  return (
    <div className={`${s.bg} border p-4`}>
      <div className="flex items-start gap-3">
        <svg className={`w-5 h-5 ${s.icon} mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {type === 'warning' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
        <div>
          <div className={`text-sm font-medium ${s.title}`}>{title}</div>
          <div className={`text-xs ${s.text} mt-1`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
