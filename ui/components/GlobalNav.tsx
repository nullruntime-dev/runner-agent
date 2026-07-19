'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function GlobalNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <header className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 bg-[#111] border border-[#2a2a2a] flex items-center justify-center">
              <span className="text-sm font-bold text-[#00fff2]">G</span>
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">GRIPHOOK</span>
          </Link>
          <div className="h-4 w-px bg-[#2a2a2a]" />
          <span className="text-xs text-[#888] uppercase tracking-wider">Control Center</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className={`h-8 px-3 border text-xs font-medium transition-colors flex items-center gap-2 ${
              pathname === '/settings'
                ? 'bg-[#00fff2]/10 border-[#00fff2]/50 text-[#00fff2]'
                : 'bg-[#111] hover:bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            SETTINGS
          </Link>
          <Link
            href="/docs"
            className={`h-8 px-3 border text-xs font-medium transition-colors flex items-center gap-2 ${
              pathname.startsWith('/docs')
                ? 'bg-[#00fff2]/10 border-[#00fff2]/50 text-[#00fff2]'
                : 'bg-[#111] hover:bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            DOCS
          </Link>
          <Link
            href="/agents"
            className={`h-8 px-3 border text-xs font-medium transition-colors flex items-center gap-2 ${
              pathname === '/agents'
                ? 'bg-[#00fff2]/10 border-[#00fff2]/50 text-[#00fff2]'
                : 'bg-[#111] hover:bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            MANAGE AGENTS
          </Link>
          <Link
            href="/chat"
            className={`h-8 px-3 text-xs font-medium transition-all flex items-center gap-2 ${
              pathname === '/chat'
                ? 'bg-[#00fff2] text-black shadow-[0_0_20px_rgba(0,255,242,0.5)]'
                : 'bg-gradient-to-r from-[#00fff2] to-[#00cccc] hover:from-[#00cccc] hover:to-[#00fff2] text-black shadow-[0_0_20px_rgba(0,255,242,0.3)]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            AI CHAT
          </Link>
          <button
            onClick={handleRefresh}
            className="h-8 px-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white text-xs font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            REFRESH
          </button>
        </div>
      </div>
    </header>
  );
}
