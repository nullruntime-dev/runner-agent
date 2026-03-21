'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Skill, getSkills } from '@/lib/api';

interface HomeSkillsProps {
  agentId: string;
  agentName: string;
  isOnline: boolean;
}

const skillIcons: Record<string, React.ReactNode> = {
  slack: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
    </svg>
  ),
  email: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  smtp: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  heart: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ),
};

const skillColors: Record<string, string> = {
  slack: 'text-[#9900ff]',
  email: 'text-[#ff0044]',
  smtp: 'text-[#ff6600]',
  heart: 'text-[#ff00ea]',
};

export default function HomeSkills({ agentId, agentName, isOnline }: HomeSkillsProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOnline) {
      setLoading(false);
      return;
    }

    const fetchSkills = async () => {
      try {
        const data = await getSkills(agentId);
        setSkills(data);
      } catch (err) {
        console.error('Failed to fetch skills:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSkills();
  }, [agentId, isOnline]);

  if (!isOnline) {
    return null;
  }

  if (loading) {
    return (
      <div className="py-4 flex items-center justify-center">
        <svg className="w-5 h-5 text-[#888] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const activeSkills = skills.filter(s => s.configured && s.enabled);
  const inactiveSkills = skills.filter(s => !s.configured || !s.enabled);

  return (
    <div className="space-y-4">
      {/* Active Skills */}
      {activeSkills.length > 0 && (
        <div className="space-y-1">
          {activeSkills.map((skill) => (
            <Link
              key={skill.name}
              href={`/agents/${agentId}/chat`}
              className="flex items-center gap-3 px-2 py-2 hover:bg-[#111] transition-colors group"
            >
              <div className={`w-8 h-8 bg-[#111] flex items-center justify-center ${skillColors[skill.icon] || 'text-[#00fff2]'}`}>
                {skillIcons[skill.icon] || (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{skill.displayName}</div>
              </div>
              <div className="w-2 h-2 bg-[#00ff66] shadow-[0_0_8px_rgba(0,255,102,0.5)]" title="Active" />
            </Link>
          ))}
        </div>
      )}

      {/* Divider if both sections exist */}
      {activeSkills.length > 0 && inactiveSkills.length > 0 && (
        <div className="border-t border-[#1a1a1a]" />
      )}

      {/* Inactive Skills */}
      {inactiveSkills.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-[#444] uppercase tracking-wider px-2 mb-2">Not configured</p>
          {inactiveSkills.map((skill) => (
            <Link
              key={skill.name}
              href={`/agents/${agentId}/chat`}
              className="flex items-center gap-3 px-2 py-2 hover:bg-[#111] transition-colors group"
            >
              <div className={`w-8 h-8 bg-[#0a0a0a] flex items-center justify-center text-[#888]`}>
                {skillIcons[skill.icon] || (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#888]">{skill.displayName}</div>
              </div>
              <span className="text-[10px] text-[#444] group-hover:text-[#888]">Setup</span>
            </Link>
          ))}
        </div>
      )}

      {/* Empty state */}
      {skills.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-[#888]">No skills available</p>
        </div>
      )}
    </div>
  );
}
