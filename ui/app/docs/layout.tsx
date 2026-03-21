'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/docs', label: 'Overview' },
  { href: '/docs/quickstart', label: 'Quick Start' },
  { href: '/docs/api', label: 'API Reference' },
  { href: '/docs/configuration', label: 'Configuration' },
  { href: '/docs/security', label: 'Security' },
  { href: '/docs/backup', label: 'Backup' },
  { href: '/docs/deployment', label: 'Deployment' },
  { href: '/docs/migration', label: 'Migration' },
  { href: '/docs/troubleshooting', label: 'Troubleshooting' },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Header */}
      <header className="bg-[#0a0a0a] border-b border-[#1a1a1a] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#111] border border-[#2a2a2a] flex items-center justify-center">
                <span className="text-sm font-bold text-[#00fff2]">G</span>
              </div>
              <span className="text-sm font-semibold text-white tracking-tight">GRIPHOOK</span>
            </Link>
            <div className="h-4 w-px bg-[#2a2a2a]" />
            <span className="text-xs text-[#888] uppercase tracking-wider">Documentation</span>
          </div>
          <Link
            href="/"
            className="h-8 px-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white text-xs font-medium transition-colors"
          >
            DASHBOARD
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 border-r border-[#1a1a1a] min-h-[calc(100vh-3.5rem)] sticky top-14 self-start">
          <nav className="py-6 px-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-[#111] text-[#00fff2] font-medium border-l-2 border-[#00fff2] -ml-[2px] pl-[14px]'
                          : 'text-[#888] hover:text-white hover:bg-[#0a0a0a]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 px-12 py-10 max-w-4xl">
          {children}
        </main>
      </div>
    </div>
  );
}
