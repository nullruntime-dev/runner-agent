'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import SetupWizard from './SetupWizard';

interface SetupCheckProps {
  children: React.ReactNode;
}

// Pages where we don't show the setup wizard
const EXCLUDED_PATHS = ['/settings', '/docs'];

export default function SetupCheck({ children }: SetupCheckProps) {
  const pathname = usePathname();
  const isExcludedPath = EXCLUDED_PATHS.some(path => pathname?.startsWith(path));

  // Don't show loading for excluded paths - they skip the wizard check entirely
  const [loading, setLoading] = useState(!isExcludedPath);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    // Skip check for excluded paths
    if (isExcludedPath) {
      return;
    }

    let cancelled = false;

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/settings/status');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setNeedsSetup(!data.setupComplete);
        }
      } catch {
        // On error, assume setup is complete to not block users
      }
      if (!cancelled) {
        setLoading(false);
      }
    };

    checkStatus();

    return () => {
      cancelled = true;
    };
  }, [isExcludedPath]);

  const handleSetupComplete = () => {
    setNeedsSetup(false);
  };

  // Don't show wizard on excluded paths - render children directly
  if (isExcludedPath) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-[#00fff2] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-neutral-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {needsSetup && <SetupWizard onComplete={handleSetupComplete} />}
      {children}
    </>
  );
}
