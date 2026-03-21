'use client';

import { useState, useEffect } from 'react';
import { Skill, getSkills } from '@/lib/api';
import SkillsList from './SkillsList';

interface AgentSkillsProps {
  agentId: string;
  isOnline: boolean;
}

export default function AgentSkills({ agentId, isOnline }: AgentSkillsProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = async () => {
    if (!isOnline) {
      setLoading(false);
      return;
    }

    try {
      const data = await getSkills(agentId);
      setSkills(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch skills:', err);
      setError('Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, [agentId, isOnline]);

  if (!isOnline) {
    return (
      <div className="p-4 text-center">
        <div className="w-10 h-10 bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-2">
          <svg className="w-5 h-5 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
        </div>
        <p className="text-xs text-[#444]">Agent offline</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#00fff2] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs text-[#888]">Loading skills...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <div className="w-10 h-10 bg-[#ff0044]/10 border border-[#ff0044]/20 flex items-center justify-center mx-auto mb-2">
          <svg className="w-5 h-5 text-[#ff0044]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-xs text-[#ff0044] mb-2">{error}</p>
        <button
          onClick={fetchSkills}
          className="text-xs text-[#888] hover:text-[#00fff2] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return <SkillsList agentId={agentId} skills={skills} onRefresh={fetchSkills} />;
}
