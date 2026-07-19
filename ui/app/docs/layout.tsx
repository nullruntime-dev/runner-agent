'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/docs', label: 'Overview' },
  { href: '/docs/quickstart', label: 'Quick Start' },
  { href: '/docs/api', label: 'API Reference' },
  { href: '/docs/configuration', label: 'Configuration' },
  { href: '/docs/security', label: 'Security' },
  { href: '/docs/backup', label: 'Backup & Database' },
  { href: '/docs/deployment', label: 'Deployment' },
  { href: '/docs/migration', label: 'Migration' },
  { href: '/docs/troubleshooting', label: 'Troubleshooting' },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
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
