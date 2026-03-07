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
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white flex items-center justify-center">
                <svg className="w-4 h-4 text-neutral-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white tracking-tight">RUNNER AGENT</span>
            </Link>
            <div className="h-4 w-px bg-neutral-700" />
            <span className="text-xs text-neutral-500 uppercase tracking-wider">Documentation</span>
          </div>
          <Link
            href="/"
            className="h-8 px-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-medium transition-colors"
          >
            DASHBOARD
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 border-r border-neutral-800 min-h-[calc(100vh-3.5rem)] sticky top-14 self-start">
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
                          ? 'bg-neutral-800 text-white font-medium'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
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
