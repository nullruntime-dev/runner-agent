'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Skill, getSkills, CustomSkill, getCustomSkills, toggleCustomSkill, deleteCustomSkill } from '@/lib/api';
import SkillsList from './SkillsList';
import SchedulesList from './SchedulesList';

interface AgentSkillsProps {
  agentId: string;
  isOnline: boolean;
}

export default function AgentSkills({ agentId, isOnline }: AgentSkillsProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = async () => {
    if (!isOnline) {
      setLoading(false);
      return;
    }

    // Fetch built-in skills
    try {
      const builtInSkills = await getSkills(agentId);
      setSkills(builtInSkills);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch built-in skills:', err);
      setError('Failed to load skills');
    }

    // Fetch custom skills separately
    try {
      const userCustomSkills = await getCustomSkills(agentId);
      console.log('Custom skills loaded:', userCustomSkills);
      setCustomSkills(userCustomSkills);
    } catch (err) {
      console.error('Failed to fetch custom skills:', err);
      // Don't set error for custom skills - just log
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchSkills();
  }, [agentId, isOnline]);

  const handleToggleCustomSkill = async (skill: CustomSkill) => {
    try {
      await toggleCustomSkill(agentId, skill.name, !skill.enabled);
      setCustomSkills(prev => prev.map(s =>
        s.name === skill.name ? { ...s, enabled: !s.enabled } : s
      ));
    } catch (err) {
      console.error('Failed to toggle custom skill:', err);
    }
  };

  const handleDeleteCustomSkill = async (skill: CustomSkill) => {
    if (!confirm(`Delete skill "${skill.displayName}"?`)) return;
    try {
      await deleteCustomSkill(agentId, skill.name);
      setCustomSkills(prev => prev.filter(s => s.name !== skill.name));
    } catch (err) {
      console.error('Failed to delete custom skill:', err);
    }
  };

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

  const enabledCustomSkills = customSkills.filter(s => s.enabled);

  return (
    <div className="space-y-1">
      <SkillsList agentId={agentId} skills={skills} onRefresh={fetchSkills} />

      {/* Custom Skills Section */}
      {customSkills.length > 0 ? (
        <>
          <div className="border-t border-[#1a1a1a] my-2" />
          <div className="px-2 py-1">
            <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
              Custom Skills ({enabledCustomSkills.length}/{customSkills.length})
            </span>
          </div>
          <div className="space-y-1 p-1">
            {customSkills.map((skill) => {
              const typeColors = {
                COMMAND: { bg: 'bg-[#00aaff]/10', text: 'text-[#00aaff]', border: 'border-[#00aaff]/30' },
                PROMPT: { bg: 'bg-[#aa00ff]/10', text: 'text-[#aa00ff]', border: 'border-[#aa00ff]/30' },
                WORKFLOW: { bg: 'bg-[#ffaa00]/10', text: 'text-[#ffaa00]', border: 'border-[#ffaa00]/30' },
              };
              const colors = typeColors[skill.type] || typeColors.COMMAND;

              return (
                <div
                  key={skill.name}
                  className={`w-full p-2.5 transition-all text-left group border ${
                    skill.enabled
                      ? 'border-[#1a1a1a] bg-[#0f0f0f] hover:bg-[#111]'
                      : 'border-transparent hover:bg-[#111] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Link
                      href={`/agents/${agentId}/chat`}
                      className="flex items-center gap-2.5 flex-1 min-w-0"
                    >
                      <div className={`w-8 h-8 ${colors.bg} ${colors.text} flex items-center justify-center border ${colors.border} flex-shrink-0`}>
                        {skill.type === 'COMMAND' ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        ) : skill.type === 'PROMPT' ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-neutral-200 truncate">
                            {skill.displayName}
                          </span>
                          {skill.enabled && (
                            <span className="w-1.5 h-1.5 bg-[#00cc88] shadow-[0_0_6px_rgba(0,204,136,0.5)]" />
                          )}
                          <span className={`text-[8px] px-1 py-0.5 ${colors.bg} ${colors.text} ${colors.border} border`}>
                            {skill.type}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-600 truncate">
                          {skill.description || 'Click to use in chat'}
                        </p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleToggleCustomSkill(skill);
                        }}
                        className="p-1 text-neutral-600 hover:text-neutral-400 transition-colors"
                        title={skill.enabled ? 'Disable' : 'Enable'}
                      >
                        {skill.enabled ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteCustomSkill(skill);
                        }}
                        className="p-1 text-neutral-600 hover:text-[#ff0044] transition-colors"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="border-t border-[#1a1a1a] my-2" />
          <Link
            href={`/agents/${agentId}/chat`}
            className="block px-3 py-3 hover:bg-[#111] transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-[#00cc88]/10 text-[#00cc88] flex items-center justify-center border border-[#00cc88]/30 group-hover:bg-[#00cc88]/20 transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-[10px] font-medium text-neutral-400 group-hover:text-neutral-300 transition-colors">
                Add Custom Skill
              </span>
            </div>
            <p className="text-[10px] text-neutral-600 leading-relaxed group-hover:text-neutral-500 transition-colors">
              Click to open chat and say: &quot;Create a skill called deploy-prod that runs: npm run build&quot;
            </p>
          </Link>
        </>
      )}

      {/* Scheduled Tasks Section */}
      <div className="border-t border-[#1a1a1a] my-2" />
      <div className="px-2 py-1">
        <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
          Autopilot Schedules
        </span>
      </div>
      <SchedulesList agentId={agentId} isOnline={isOnline} />
    </div>
  );
}
