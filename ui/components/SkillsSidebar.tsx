'use client';

import React, { useState, useEffect } from 'react';
import { Skill, configureSkill, deactivateSkill, CustomSkill, getCustomSkills, toggleCustomSkill, deleteCustomSkill } from '@/lib/api';
import SkillConfigModal from './SkillConfigModal';

interface SkillsSidebarProps {
  agentId: string;
  skills: Skill[];
  loading: boolean;
  error: string | null;
  selectedSkill: string | null;
  onSelectSkill: (skillName: string | null) => void;
  onRefresh: () => void;
  showCustomSkillsMode?: boolean;
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
  custom: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
    </svg>
  ),
};

const skillColors: Record<string, { bg: string; text: string; border: string; glow: string; selectedBg: string }> = {
  slack: { bg: 'bg-[#9900ff]/10', text: 'text-[#9900ff]', border: 'border-[#9900ff]/30', glow: 'rgba(153,0,255,0.3)', selectedBg: 'bg-[#9900ff]/20' },
  email: { bg: 'bg-[#ff0044]/10', text: 'text-[#ff0044]', border: 'border-[#ff0044]/30', glow: 'rgba(255,0,68,0.3)', selectedBg: 'bg-[#ff0044]/20' },
  smtp: { bg: 'bg-[#ff6600]/10', text: 'text-[#ff6600]', border: 'border-[#ff6600]/30', glow: 'rgba(255,102,0,0.3)', selectedBg: 'bg-[#ff6600]/20' },
  heart: { bg: 'bg-[#ff00ea]/10', text: 'text-[#ff00ea]', border: 'border-[#ff00ea]/30', glow: 'rgba(255,0,234,0.3)', selectedBg: 'bg-[#ff00ea]/20' },
  custom: { bg: 'bg-[#00cc88]/10', text: 'text-[#00cc88]', border: 'border-[#00cc88]/30', glow: 'rgba(0,204,136,0.3)', selectedBg: 'bg-[#00cc88]/20' },
};

const defaultColors = { bg: 'bg-[#00fff2]/10', text: 'text-[#00fff2]', border: 'border-[#00fff2]/30', glow: 'rgba(0,255,242,0.3)', selectedBg: 'bg-[#00fff2]/20' };

const customSkillTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  COMMAND: { bg: 'bg-[#00aaff]/10', text: 'text-[#00aaff]', border: 'border-[#00aaff]/30' },
  PROMPT: { bg: 'bg-[#aa00ff]/10', text: 'text-[#aa00ff]', border: 'border-[#aa00ff]/30' },
  WORKFLOW: { bg: 'bg-[#ffaa00]/10', text: 'text-[#ffaa00]', border: 'border-[#ffaa00]/30' },
};

export default function SkillsSidebar({
  agentId,
  skills,
  loading,
  error,
  selectedSkill,
  onSelectSkill,
  onRefresh,
  showCustomSkillsMode = true,
}: SkillsSidebarProps) {
  const [configuring, setConfiguring] = useState<Skill | null>(null);
  const [saving, setSaving] = useState(false);
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([]);
  const [customSkillsLoading, setCustomSkillsLoading] = useState(false);

  useEffect(() => {
    const fetchCustomSkills = async () => {
      setCustomSkillsLoading(true);
      try {
        const data = await getCustomSkills(agentId);
        setCustomSkills(data);
      } catch (err) {
        console.error('Failed to fetch custom skills:', err);
      } finally {
        setCustomSkillsLoading(false);
      }
    };
    fetchCustomSkills();
  }, [agentId]);

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
      if (selectedSkill === `custom:${skill.name}`) {
        onSelectSkill(null);
      }
    } catch (err) {
      console.error('Failed to delete custom skill:', err);
    }
  };

  const handleSkillClick = (skill: Skill) => {
    if (skill.configured && skill.enabled) {
      // Select the skill for chat
      onSelectSkill(skill.name);
    } else {
      // Open config modal for unconfigured skills
      setConfiguring(skill);
    }
  };

  const handleConfigClick = (e: React.MouseEvent, skill: Skill) => {
    e.stopPropagation();
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
        if (selectedSkill === configuring.name) {
          onSelectSkill(null);
        }
        onRefresh();
      } else {
        alert(result.error || 'Failed to deactivate skill');
      }
    } catch (error) {
      console.error('Error deactivating skill:', error);
      alert('Failed to deactivate skill');
    }
  };

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
        <p className="text-xs text-[#ff0044] mb-2">{error}</p>
        <button onClick={onRefresh} className="text-xs text-[#888] hover:text-[#00fff2] transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-[#888]">No skills available</p>
      </div>
    );
  }

  const enabledCustomSkills = customSkills.filter(s => s.enabled);

  return (
    <>
      <div className="space-y-1 p-1">
        {/* Built-in skills */}
        {skills.map((skill) => {
          const colors = skillColors[skill.icon] || defaultColors;
          const isActive = skill.configured && skill.enabled;
          const isSelected = selectedSkill === skill.name;

          return (
            <div
              key={skill.name}
              onClick={() => handleSkillClick(skill)}
              className={`w-full p-2.5 transition-all text-left group border cursor-pointer ${
                isSelected
                  ? `${colors.selectedBg} border-${skill.icon === 'heart' ? '[#ff00ea]' : skill.icon === 'slack' ? '[#9900ff]' : '[#00fff2]'}/50`
                  : isActive
                    ? 'border-[#1a1a1a] bg-[#0f0f0f] hover:bg-[#111]'
                    : 'border-transparent hover:bg-[#111]'
              }`}
              style={{
                boxShadow: isSelected ? `0 0 20px ${colors.glow}` : isActive ? `0 0 10px ${colors.glow}` : 'none',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 ${colors.bg} ${colors.text} flex items-center justify-center border ${colors.border}`}>
                  {skillIcons[skill.icon] || (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
                      {skill.displayName}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 bg-[#00ff66] shadow-[0_0_6px_rgba(0,255,102,0.5)]" />
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-600 truncate">
                    {isActive ? 'Click to select' : 'Click to configure'}
                  </p>
                </div>
                {isActive && (
                  <button
                    onClick={(e) => handleConfigClick(e, skill)}
                    className="p-1 text-neutral-600 hover:text-neutral-400 transition-colors"
                    title="Configure"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
                {!isActive && (
                  <svg
                    className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 transition-colors flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            </div>
          );
        })}

        {/* Custom Skills Mode Button */}
        {showCustomSkillsMode && (
          <>
            <div className="border-t border-[#1a1a1a] my-2" />
            <div
              onClick={() => onSelectSkill('custom-skills')}
              className={`w-full p-2.5 transition-all text-left group border cursor-pointer ${
                selectedSkill === 'custom-skills'
                  ? 'bg-[#00cc88]/20 border-[#00cc88]/50'
                  : 'border-[#1a1a1a] bg-[#0f0f0f] hover:bg-[#111]'
              }`}
              style={{
                boxShadow: selectedSkill === 'custom-skills' ? '0 0 20px rgba(0,204,136,0.3)' : 'none',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#00cc88]/10 text-[#00cc88] flex items-center justify-center border border-[#00cc88]/30">
                  {skillIcons.custom}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium truncate ${selectedSkill === 'custom-skills' ? 'text-white' : 'text-neutral-200'}`}>
                      Custom Skills
                    </span>
                    <span className="w-1.5 h-1.5 bg-[#00cc88] shadow-[0_0_6px_rgba(0,204,136,0.5)]" />
                  </div>
                  <p className="text-[10px] text-neutral-600 truncate">
                    Create &amp; manage skills
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Custom Skills List */}
        {enabledCustomSkills.length > 0 && (
          <>
            <div className="border-t border-[#1a1a1a] my-2" />
            <div className="px-2 py-1">
              <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                My Skills ({enabledCustomSkills.length})
              </span>
            </div>
            {customSkillsLoading ? (
              <div className="p-2 text-center">
                <span className="text-[10px] text-neutral-600">Loading...</span>
              </div>
            ) : (
              enabledCustomSkills.map((skill) => {
                const typeColors = customSkillTypeColors[skill.type] || defaultColors;
                const isSelected = selectedSkill === `custom:${skill.name}`;

                return (
                  <div
                    key={skill.name}
                    onClick={() => onSelectSkill(`custom:${skill.name}`)}
                    className={`w-full p-2.5 transition-all text-left group border cursor-pointer ${
                      isSelected
                        ? 'bg-[#00cc88]/20 border-[#00cc88]/50'
                        : 'border-[#1a1a1a] bg-[#0f0f0f] hover:bg-[#111]'
                    }`}
                    style={{
                      boxShadow: isSelected ? '0 0 20px rgba(0,204,136,0.3)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 ${typeColors.bg} ${typeColors.text} flex items-center justify-center border ${typeColors.border}`}>
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
                          <span className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
                            {skill.displayName}
                          </span>
                          <span className={`text-[8px] px-1 py-0.5 ${typeColors.bg} ${typeColors.text} ${typeColors.border} border`}>
                            {skill.type}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-600 truncate">
                          {skill.description || 'No description'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
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
              })
            )}
          </>
        )}
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
