'use client';

import { useState, useEffect } from 'react';
import {
  Skill,
  CustomSkill,
  getSkills,
  getCustomSkills,
  getAgents,
  configureSkill,
  deactivateSkill,
  toggleSkillVisibility,
  toggleCustomSkill,
  toggleCustomSkillVisibility,
  deleteCustomSkill,
} from '@/lib/api';
import SkillConfigModal from './SkillConfigModal';
import CustomSkillEditor from './CustomSkillEditor';

interface SkillsManagementProps {
  agentId?: string;
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

export default function SkillsManagement({ agentId: propAgentId }: SkillsManagementProps) {
  const [agentId, setAgentId] = useState<string | null>(propAgentId || null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [noAgent, setNoAgent] = useState(false);
  const [configModalSkill, setConfigModalSkill] = useState<Skill | null>(null);
  const [editingCustomSkill, setEditingCustomSkill] = useState<CustomSkill | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSkills = async (id: string) => {
    try {
      const [builtIn, custom] = await Promise.all([
        getSkills(id),
        getCustomSkills(id),
      ]);
      setSkills(builtIn);
      setCustomSkills(custom);
    } catch (err) {
      console.error('Failed to fetch skills:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      // If we have a prop agentId that's not "default", use it directly
      if (propAgentId && propAgentId !== 'default') {
        setAgentId(propAgentId);
        await fetchSkills(propAgentId);
        return;
      }

      // Otherwise, fetch agents and use the first one
      try {
        const fetchedAgents = await getAgents();
        if (fetchedAgents.length > 0) {
          const firstAgent = fetchedAgents[0];
          setAgentId(firstAgent.id);
          await fetchSkills(firstAgent.id);
        } else {
          setNoAgent(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch agents:', err);
        setNoAgent(true);
        setLoading(false);
      }
    };
    init();
  }, [propAgentId]);

  const handleConfigureSkill = async (config: Record<string, string>, enabled: boolean) => {
    if (!configModalSkill || !agentId) return;
    setSaving(true);
    try {
      await configureSkill(agentId, configModalSkill.name, config, enabled);
      await fetchSkills(agentId);
      setConfigModalSkill(null);
    } catch (err) {
      console.error('Failed to configure skill:', err);
    }
    setSaving(false);
  };

  const handleDeactivateSkill = async () => {
    if (!configModalSkill || !agentId) return;
    try {
      await deactivateSkill(agentId, configModalSkill.name);
      await fetchSkills(agentId);
      setConfigModalSkill(null);
    } catch (err) {
      console.error('Failed to deactivate skill:', err);
    }
  };

  const handleToggleSkillVisibility = async (skill: Skill) => {
    if (!agentId) return;
    try {
      const result = await toggleSkillVisibility(agentId, skill.name, !skill.hidden);
      if (!result.success) {
        console.error('Failed to toggle skill visibility:', result.error);
        alert(`Failed to toggle visibility: ${result.error || 'Unknown error'}`);
        return;
      }
      await fetchSkills(agentId);
    } catch (err) {
      console.error('Failed to toggle skill visibility:', err);
      alert('Failed to toggle visibility. Check console for details.');
    }
  };

  const handleToggleCustomSkillEnabled = async (skill: CustomSkill) => {
    if (!agentId) return;
    try {
      await toggleCustomSkill(agentId, skill.name, !skill.enabled);
      await fetchSkills(agentId);
    } catch (err) {
      console.error('Failed to toggle custom skill:', err);
    }
  };

  const handleToggleCustomSkillVisibility = async (skill: CustomSkill) => {
    if (!agentId) return;
    try {
      const result = await toggleCustomSkillVisibility(agentId, skill.name, !skill.hidden);
      if (!result.success) {
        console.error('Failed to toggle custom skill visibility:', result.error);
        alert(`Failed to toggle visibility: ${result.error || 'Unknown error'}`);
        return;
      }
      await fetchSkills(agentId);
    } catch (err) {
      console.error('Failed to toggle custom skill visibility:', err);
      alert('Failed to toggle visibility. Check console for details.');
    }
  };

  const handleDeleteCustomSkill = async (skill: CustomSkill) => {
    if (!agentId) return;
    if (!confirm(`Are you sure you want to delete "${skill.displayName}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteCustomSkill(agentId, skill.name);
      await fetchSkills(agentId);
    } catch (err) {
      console.error('Failed to delete custom skill:', err);
    }
  };

  const handleCustomSkillUpdated = () => {
    setEditingCustomSkill(null);
    if (agentId) {
      fetchSkills(agentId);
    }
  };

  if (noAgent) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-500">No agents configured. Add an agent first to manage skills.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="w-5 h-5 text-[#00fff2] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Built-in Skills */}
      <div>
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Built-in Skills</h3>
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.name}
              className={`flex items-center gap-4 p-4 bg-[#111] border border-[#1a1a1a] ${
                skill.hidden ? 'opacity-50' : ''
              }`}
            >
              {/* Icon */}
              <div className={`w-10 h-10 bg-[#0a0a0a] flex items-center justify-center ${
                skill.configured && skill.enabled ? skillColors[skill.icon] || 'text-[#00fff2]' : 'text-neutral-600'
              }`}>
                {skillIcons[skill.icon] || (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${skill.hidden ? 'text-neutral-500 line-through' : 'text-white'}`}>
                    {skill.displayName}
                  </span>
                  {skill.configured && (
                    <span className={`text-[10px] px-1.5 py-0.5 ${
                      skill.enabled
                        ? 'bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                    }`}>
                      {skill.enabled ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  )}
                  {!skill.configured && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-500 border border-neutral-700">
                      NOT CONFIGURED
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 truncate">{skill.description}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Configure Button */}
                <button
                  onClick={() => setConfigModalSkill(skill)}
                  className="p-2 hover:bg-[#1a1a1a] text-neutral-500 hover:text-[#00fff2] transition-colors"
                  title="Configure"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {/* Visibility Toggle */}
                <button
                  onClick={() => handleToggleSkillVisibility(skill)}
                  className={`p-2 hover:bg-[#1a1a1a] transition-colors ${
                    skill.hidden ? 'text-neutral-600 hover:text-neutral-400' : 'text-neutral-500 hover:text-white'
                  }`}
                  title={skill.hidden ? 'Show in UI' : 'Hide from UI'}
                >
                  {skill.hidden ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Skills */}
      {customSkills.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-3">Custom Skills</h3>
          <div className="space-y-2">
            {customSkills.map((skill) => (
              <div
                key={skill.name}
                className={`flex items-center gap-4 p-4 bg-[#111] border border-[#1a1a1a] ${
                  skill.hidden ? 'opacity-50' : ''
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 flex items-center justify-center ${
                  skill.type === 'COMMAND' ? 'bg-[#00aaff]/10 text-[#00aaff]' :
                  skill.type === 'PROMPT' ? 'bg-[#aa00ff]/10 text-[#aa00ff]' :
                  'bg-[#ffaa00]/10 text-[#ffaa00]'
                }`}>
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

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${skill.hidden ? 'text-neutral-500 line-through' : 'text-white'}`}>
                      {skill.displayName}
                    </span>
                    <span className={`text-[8px] px-1 py-0.5 ${
                      skill.type === 'COMMAND' ? 'bg-[#00aaff]/10 text-[#00aaff] border border-[#00aaff]/30' :
                      skill.type === 'PROMPT' ? 'bg-[#aa00ff]/10 text-[#aa00ff] border border-[#aa00ff]/30' :
                      'bg-[#ffaa00]/10 text-[#ffaa00] border border-[#ffaa00]/30'
                    }`}>
                      {skill.type}
                    </span>
                    {skill.enabled ? (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-400 border border-neutral-700">
                        DISABLED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 truncate">{skill.description}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Edit Button (for PROMPT type) */}
                  {skill.type === 'PROMPT' && (
                    <button
                      onClick={() => setEditingCustomSkill(skill)}
                      className="p-2 hover:bg-[#1a1a1a] text-neutral-500 hover:text-[#aa00ff] transition-colors"
                      title="Edit Prompt"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}

                  {/* Enable/Disable Toggle */}
                  <button
                    onClick={() => handleToggleCustomSkillEnabled(skill)}
                    className={`relative w-10 h-5 transition-colors ${
                      skill.enabled ? 'bg-[#00fff2]' : 'bg-[#1a1a1a]'
                    }`}
                    title={skill.enabled ? 'Disable' : 'Enable'}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white transition-transform ${
                      skill.enabled ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>

                  {/* Visibility Toggle */}
                  <button
                    onClick={() => handleToggleCustomSkillVisibility(skill)}
                    className={`p-2 hover:bg-[#1a1a1a] transition-colors ${
                      skill.hidden ? 'text-neutral-600 hover:text-neutral-400' : 'text-neutral-500 hover:text-white'
                    }`}
                    title={skill.hidden ? 'Show in UI' : 'Hide from UI'}
                  >
                    {skill.hidden ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteCustomSkill(skill)}
                    className="p-2 hover:bg-[#1a1a1a] text-neutral-500 hover:text-[#ff0044] transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {skills.length === 0 && customSkills.length === 0 && (
        <div className="text-center py-8">
          <p className="text-neutral-500">No skills available</p>
        </div>
      )}

      {/* Config Modal */}
      {configModalSkill && agentId && (
        <SkillConfigModal
          skill={configModalSkill}
          agentId={agentId}
          onClose={() => setConfigModalSkill(null)}
          onSave={handleConfigureSkill}
          onDeactivate={configModalSkill.configured ? handleDeactivateSkill : undefined}
          saving={saving}
        />
      )}

      {/* Custom Skill Editor Modal */}
      {editingCustomSkill && agentId && (
        <CustomSkillEditor
          skill={editingCustomSkill}
          agentId={agentId}
          onClose={() => setEditingCustomSkill(null)}
          onSaved={handleCustomSkillUpdated}
        />
      )}
    </div>
  );
}
