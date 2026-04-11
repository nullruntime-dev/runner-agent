'use client';

import { useState, useEffect } from 'react';
import { CustomSkill, updateCustomSkill } from '@/lib/api';

interface CustomSkillEditorProps {
  skill: CustomSkill;
  agentId: string;
  onClose: () => void;
  onSaved: () => void;
}

interface PromptDefinition {
  systemPrompt?: string;
  personality?: string;
  outputFormat?: string;
}

interface CommandDefinition {
  commands?: string[];
  workingDir?: string;
  shell?: string;
  timeout?: number;
}

export default function CustomSkillEditor({
  skill,
  agentId,
  onClose,
  onSaved,
}: CustomSkillEditorProps) {
  const [displayName, setDisplayName] = useState(skill.displayName);
  const [description, setDescription] = useState(skill.description);
  const [definition, setDefinition] = useState<PromptDefinition | CommandDefinition>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(skill.definitionJson);
      setDefinition(parsed);
    } catch {
      setDefinition({});
    }
  }, [skill.definitionJson]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const result = await updateCustomSkill(agentId, skill.name, {
        displayName,
        description,
        definitionJson: JSON.stringify(definition),
      });

      if (result.success) {
        onSaved();
      } else {
        setError(result.error || 'Failed to save changes');
      }
    } catch (err) {
      setError('Failed to save changes');
    }

    setSaving(false);
  };

  const updateDefinitionField = (field: string, value: string | string[] | number) => {
    setDefinition((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Gradient top border */}
        <div className={`h-1 bg-gradient-to-r ${
          skill.type === 'COMMAND' ? 'from-[#00aaff] via-[#00ccff] to-[#00aaff]' :
          skill.type === 'PROMPT' ? 'from-[#aa00ff] via-[#cc00ff] to-[#aa00ff]' :
          'from-[#ffaa00] via-[#ffcc00] to-[#ffaa00]'
        }`} />

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 flex items-center justify-center ${
              skill.type === 'COMMAND' ? 'bg-[#00aaff]/20 border border-[#00aaff]/30' :
              skill.type === 'PROMPT' ? 'bg-[#aa00ff]/20 border border-[#aa00ff]/30' :
              'bg-[#ffaa00]/20 border border-[#ffaa00]/30'
            }`}>
              {skill.type === 'COMMAND' ? (
                <svg className="w-5 h-5 text-[#00aaff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ) : skill.type === 'PROMPT' ? (
                <svg className="w-5 h-5 text-[#aa00ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-[#ffaa00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Edit {skill.type} Skill</h2>
              <p className="text-xs text-neutral-500">{skill.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-[#111] border border-[#1a1a1a] flex items-center justify-center text-neutral-500 hover:text-white hover:border-[#2a2a2a] transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-[#ff0044]/10 border border-[#ff0044]/30 text-[#ff0044] text-sm">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div>
            <label className="block text-xs text-neutral-400 mb-2 font-medium">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#00fff2] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-2 font-medium">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#00fff2] transition-colors"
            />
          </div>

          {/* PROMPT Type Fields */}
          {skill.type === 'PROMPT' && (
            <>
              <div>
                <label className="block text-xs text-neutral-400 mb-2 font-medium">
                  System Prompt <span className="text-[#ff0044]">*</span>
                </label>
                <textarea
                  value={(definition as PromptDefinition).systemPrompt || ''}
                  onChange={(e) => updateDefinitionField('systemPrompt', e.target.value)}
                  rows={6}
                  className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#aa00ff] transition-colors resize-none font-mono"
                  placeholder="Enter the system prompt that defines how this skill behaves..."
                />
                <p className="text-[10px] text-neutral-600 mt-1.5">
                  This is the main instruction that guides the AI&apos;s behavior when this skill is activated.
                </p>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-2 font-medium">Personality</label>
                <input
                  type="text"
                  value={(definition as PromptDefinition).personality || ''}
                  onChange={(e) => updateDefinitionField('personality', e.target.value)}
                  className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#aa00ff] transition-colors"
                  placeholder="e.g., friendly, professional, humorous"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-2 font-medium">Output Format</label>
                <input
                  type="text"
                  value={(definition as PromptDefinition).outputFormat || ''}
                  onChange={(e) => updateDefinitionField('outputFormat', e.target.value)}
                  className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#aa00ff] transition-colors"
                  placeholder="e.g., markdown, JSON, bullet points"
                />
              </div>
            </>
          )}

          {/* COMMAND Type Fields */}
          {skill.type === 'COMMAND' && (
            <>
              <div>
                <label className="block text-xs text-neutral-400 mb-2 font-medium">
                  Commands <span className="text-neutral-600">(read-only)</span>
                </label>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4">
                  {((definition as CommandDefinition).commands || []).map((cmd, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2 last:mb-0">
                      <span className="text-[10px] text-neutral-600 w-6">{i + 1}.</span>
                      <code className="text-xs text-[#00aaff] font-mono">{cmd}</code>
                    </div>
                  ))}
                  {!((definition as CommandDefinition).commands || []).length && (
                    <p className="text-neutral-600 text-xs">No commands defined</p>
                  )}
                </div>
                <p className="text-[10px] text-neutral-600 mt-1.5">
                  Commands cannot be edited here for security. Delete and recreate the skill to change commands.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-2 font-medium">Working Directory</label>
                  <input
                    type="text"
                    value={(definition as CommandDefinition).workingDir || ''}
                    onChange={(e) => updateDefinitionField('workingDir', e.target.value)}
                    className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#00aaff] transition-colors font-mono"
                    placeholder="/tmp"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-2 font-medium">Timeout (seconds)</label>
                  <input
                    type="number"
                    value={(definition as CommandDefinition).timeout || 300}
                    onChange={(e) => updateDefinitionField('timeout', parseInt(e.target.value) || 300)}
                    className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#00aaff] transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {/* WORKFLOW Type - Read-only display */}
          {skill.type === 'WORKFLOW' && (
            <div>
              <label className="block text-xs text-neutral-400 mb-2 font-medium">
                Workflow Definition <span className="text-neutral-600">(read-only)</span>
              </label>
              <pre className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 text-xs text-neutral-400 font-mono overflow-x-auto">
                {JSON.stringify(definition, null, 2)}
              </pre>
              <p className="text-[10px] text-neutral-600 mt-1.5">
                Workflow definitions cannot be edited here. Delete and recreate the skill to change the workflow.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1a1a1a] flex justify-end gap-3 bg-[#050505]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#1a1a1a] text-neutral-300 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2 font-medium text-sm transition-all disabled:from-neutral-700 disabled:to-neutral-700 disabled:text-neutral-400 ${
              skill.type === 'COMMAND' ? 'bg-gradient-to-r from-[#00aaff] to-[#0088cc] hover:from-[#0088cc] hover:to-[#00aaff] text-black shadow-[0_0_15px_rgba(0,170,255,0.2)]' :
              skill.type === 'PROMPT' ? 'bg-gradient-to-r from-[#aa00ff] to-[#8800cc] hover:from-[#8800cc] hover:to-[#aa00ff] text-white shadow-[0_0_15px_rgba(170,0,255,0.2)]' :
              'bg-gradient-to-r from-[#ffaa00] to-[#cc8800] hover:from-[#cc8800] hover:to-[#ffaa00] text-black shadow-[0_0_15px_rgba(255,170,0,0.2)]'
            }`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
