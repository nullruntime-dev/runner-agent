'use client';

import React, { useState } from 'react';
import { Skill, configureSkill, deactivateSkill } from '@/lib/api';
import SkillConfigModal from './SkillConfigModal';

interface SkillsListProps {
  agentId: string;
  skills: Skill[];
  onRefresh: () => void;
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

const skillColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  slack: { bg: 'bg-[#9900ff]/10', text: 'text-[#9900ff]', border: 'border-[#9900ff]/30', glow: 'rgba(153,0,255,0.2)' },
  email: { bg: 'bg-[#ff0044]/10', text: 'text-[#ff0044]', border: 'border-[#ff0044]/30', glow: 'rgba(255,0,68,0.2)' },
  smtp: { bg: 'bg-[#ff6600]/10', text: 'text-[#ff6600]', border: 'border-[#ff6600]/30', glow: 'rgba(255,102,0,0.2)' },
  heart: { bg: 'bg-[#ff00ea]/10', text: 'text-[#ff00ea]', border: 'border-[#ff00ea]/30', glow: 'rgba(255,0,234,0.2)' },
};

const defaultColors = { bg: 'bg-[#00fff2]/10', text: 'text-[#00fff2]', border: 'border-[#00fff2]/30', glow: 'rgba(0,255,242,0.2)' };

export default function SkillsList({ agentId, skills, onRefresh }: SkillsListProps) {
  const [configuring, setConfiguring] = useState<Skill | null>(null);
  const [saving, setSaving] = useState(false);

  const handleConfigure = (skill: Skill) => {
    setConfiguring(skill);
  };

  const handleSave = async (config: Record<string, string>, enabled: boolean) => {
    if (!configuring) return;

    setSaving(true);
    try {
      const result = await configureSkill(agentId, configuring.name, config, enabled);
      if (result.success) {
        setConfiguring(null);
        onRefresh();
      } else {
        alert(result.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving skill config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!configuring) return;

    try {
      const result = await deactivateSkill(agentId, configuring.name);
      if (result.success) {
        setConfiguring(null);
        onRefresh();
      } else {
        alert(result.error || 'Failed to deactivate skill');
      }
    } catch (error) {
      console.error('Error deactivating skill:', error);
      alert('Failed to deactivate skill');
    }
  };

  if (skills.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-neutral-600">No skills available</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1 p-1">
        {skills.map((skill) => {
          const colors = skillColors[skill.icon] || defaultColors;
          const isActive = skill.configured && skill.enabled;

          return (
            <button
              key={skill.name}
              onClick={() => handleConfigure(skill)}
              className={`w-full p-2.5  transition-all text-left group hover:bg-[#111] border ${
                isActive ? 'border-[#1a1a1a] bg-[#0f0f0f]' : 'border-transparent'
              }`}
              style={{
                boxShadow: isActive ? `0 0 15px ${colors.glow}` : 'none',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8  ${colors.bg} ${colors.text} flex items-center justify-center border ${colors.border}`}>
                  {skillIcons[skill.icon] || (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-200 truncate">
                      {skill.displayName}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5  bg-[#00ff66] shadow-[0_0_6px_rgba(0,255,102,0.5)]" />
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-600 truncate">{skill.description}</p>
                </div>
                <svg
                  className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 transition-colors flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>

      {configuring && (
        <SkillConfigModal
          skill={configuring}
          agentId={agentId}
          onClose={() => setConfiguring(null)}
          onSave={handleSave}
          onDeactivate={handleDeactivate}
          saving={saving}
        />
      )}
    </>
  );
}
