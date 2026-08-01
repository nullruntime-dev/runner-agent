'use client';

import { useState, useEffect } from 'react';
import {
  CustomSkill,
  CustomSkillType,
  createCustomSkill,
  updateCustomSkill,
} from '@/lib/api';

interface CustomSkillEditorProps {
  // Omit `skill` for create mode; pass it for edit mode.
  skill?: CustomSkill;
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

interface WorkflowDefinition {
  steps?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const TYPE_OPTIONS: { value: CustomSkillType; label: string; description: string }[] = [
  { value: 'COMMAND', label: 'Command', description: 'Run a list of shell commands.' },
  { value: 'PROMPT', label: 'Prompt', description: 'Inject a system prompt + personality into the agent.' },
  { value: 'WORKFLOW', label: 'Workflow', description: 'Multi-step sequence of commands and skills with branching.' },
];

const DEFAULT_DEFINITION: Record<CustomSkillType, object> = {
  COMMAND: { commands: [''], workingDir: '', shell: '', timeout: 300 },
  PROMPT: { systemPrompt: '', personality: '', outputFormat: '' },
  WORKFLOW: { steps: [{ name: 'step-1', type: 'command', command: 'echo hello' }] },
};

export default function CustomSkillEditor({
  skill,
  agentId,
  onClose,
  onSaved,
}: CustomSkillEditorProps) {
  const isEdit = !!skill;
  const fixedType = skill?.type;

  const [name, setName] = useState(skill?.name || '');
  const [type, setType] = useState<CustomSkillType>(fixedType || 'COMMAND');
  const [displayName, setDisplayName] = useState(skill?.displayName || '');
  const [description, setDescription] = useState(skill?.description || '');
  const [definition, setDefinition] = useState<PromptDefinition | CommandDefinition | WorkflowDefinition>(
    DEFAULT_DEFINITION.COMMAND,
  );
  const [workflowJson, setWorkflowJson] = useState<string>(''); // for WORKFLOW raw editing
  const [workflowJsonError, setWorkflowJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing definition (edit mode) or default for chosen type (create mode)
  useEffect(() => {
    if (skill) {
      try {
        const parsed = JSON.parse(skill.definitionJson);
        setDefinition(parsed);
        if (skill.type === 'WORKFLOW') {
          setWorkflowJson(JSON.stringify(parsed, null, 2));
        }
      } catch {
        setDefinition(DEFAULT_DEFINITION[skill.type]);
        if (skill.type === 'WORKFLOW') {
          setWorkflowJson(skill.definitionJson);
        }
      }
      return;
    }
    // create mode &mdash; reset definition when type changes
    setDefinition(DEFAULT_DEFINITION[type]);
    if (type === 'WORKFLOW') {
      setWorkflowJson(JSON.stringify(DEFAULT_DEFINITION.WORKFLOW, null, 2));
    }
  }, [skill, type]);

  const updateDefinitionField = (field: string, value: string | string[] | number) => {
    setDefinition((prev) => ({ ...prev, [field]: value }));
  };

  const buildDefinitionJson = (): string | null => {
    if (type === 'WORKFLOW') {
      // Validate raw JSON
      try {
        const parsed = JSON.parse(workflowJson);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.steps)) {
          setWorkflowJsonError('Workflow JSON must be an object with a "steps" array.');
          return null;
        }
        setWorkflowJsonError(null);
        return JSON.stringify(parsed);
      } catch (e) {
        setWorkflowJsonError(`Invalid JSON: ${(e as Error).message}`);
        return null;
      }
    }
    // COMMAND: commands stored as array; edit via textarea (one per line)
    if (type === 'COMMAND') {
      const cmdDef = definition as CommandDefinition;
      const commands = (cmdDef.commands || []).filter((c) => c !== undefined);
      return JSON.stringify({
        commands,
        workingDir: cmdDef.workingDir || '',
        shell: cmdDef.shell || '',
        timeout: cmdDef.timeout ?? 300,
      });
    }
    // PROMPT
    const pDef = definition as PromptDefinition;
    return JSON.stringify({
      systemPrompt: pDef.systemPrompt || '',
      personality: pDef.personality || '',
      outputFormat: pDef.outputFormat || '',
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // Client-side validation
    if (!isEdit) {
      if (!KEBAB_CASE.test(name)) {
        setError('Skill name must be kebab-case (e.g., "deploy-prod").');
        setSaving(false);
        return;
      }
      if (!displayName.trim()) {
        setError('Display name is required.');
        setSaving(false);
        return;
      }
    }
    if (!description.trim()) {
      setError('Description is required.');
      setSaving(false);
      return;
    }

    const definitionJson = buildDefinitionJson();
    if (!definitionJson) {
      setSaving(false);
      return;
    }

    // Backend per-type validation: COMMAND requires commands[0], PROMPT requires systemPrompt, WORKFLOW requires steps
    if (type === 'COMMAND') {
      const cmds = (definition as CommandDefinition).commands || [];
      if (!cmds.length || cmds.every((c) => !c || !c.trim())) {
        setError('COMMAND skill requires at least one command.');
        setSaving(false);
        return;
      }
    }
    if (type === 'PROMPT') {
      if (!(definition as PromptDefinition).systemPrompt?.trim()) {
        setError('PROMPT skill requires a systemPrompt.');
        setSaving(false);
        return;
      }
    }

    try {
      const result = isEdit
        ? await updateCustomSkill(agentId, skill!.name, {
            displayName,
            description,
            definitionJson,
          })
        : await createCustomSkill(agentId, {
            name,
            displayName,
            description,
            type,
            definitionJson,
            icon: 'custom',
          });

      if (result.success) {
        onSaved();
      } else {
        setError(result.error || 'Failed to save skill');
      }
    } catch (err) {
      setError('Failed to save skill');
    }

    setSaving(false);
  };

  const accent = type === 'COMMAND' ? '#00aaff' :
                 type === 'PROMPT' ? '#aa00ff' :
                 '#ffaa00';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Gradient top border */}
        <div
          className="h-1"
          style={{
            background: `linear-gradient(90deg, ${accent}, ${accent}cc, ${accent})`,
          }}
        />

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center"
              style={{
                backgroundColor: `${accent}20`,
                border: `1px solid ${accent}30`,
              }}
            >
              {type === 'COMMAND' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: accent }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ) : type === 'PROMPT' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: accent }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: accent }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {isEdit ? `Edit ${skill!.type.toLowerCase()} skill` : 'Create Custom Skill'}
              </h2>
              <p className="text-xs text-neutral-500">
                {isEdit ? skill!.name : 'New skill — pick a type and fill the fields'}
              </p>
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

          {/* Create-mode: Name + Type */}
          {!isEdit && (
            <>
              <div>
                <label className="block text-xs text-neutral-400 mb-2 font-medium">
                  Skill Name <span className="text-[#ff0044]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#00fff2] transition-colors font-mono"
                  placeholder="deploy-prod"
                />
                <p className="text-[10px] text-neutral-600 mt-1.5">
                  Kebab-case. Used as the API identifier; cannot be changed later.
                </p>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-2 font-medium">
                  Type <span className="text-[#ff0044]">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={`p-3 border text-left transition-all ${
                        type === opt.value
                          ? 'bg-[#111] border-[#00fff2]'
                          : 'bg-[#0a0a0a] border-[#1a1a1a] hover:border-[#2a2a2a]'
                      }`}
                    >
                      <div className="text-sm font-medium text-white">{opt.label}</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">{opt.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Basic Info */}
          <div>
            <label className="block text-xs text-neutral-400 mb-2 font-medium">
              Display Name <span className="text-[#ff0044]">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#00fff2] transition-colors"
              placeholder="Deploy Prod"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-2 font-medium">
              Description <span className="text-[#ff0044]">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#00fff2] transition-colors"
              placeholder="What this skill does, shown to the agent"
            />
          </div>

          {/* PROMPT Type Fields */}
          {type === 'PROMPT' && (
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
                  Main instruction guiding the AI&apos;s behavior when this skill is activated.
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
          {type === 'COMMAND' && (
            <>
              <div>
                <label className="block text-xs text-neutral-400 mb-2 font-medium">
                  Commands <span className="text-[#ff0044]">*</span>
                </label>
                <textarea
                  value={((definition as CommandDefinition).commands || []).join('\n')}
                  onChange={(e) =>
                    updateDefinitionField(
                      'commands',
                      e.target.value.split('\n'),
                    )
                  }
                  rows={6}
                  className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#00aaff] transition-colors resize-none font-mono"
                  placeholder={`echo "step 1"\ndocker compose up -d\ncurl http://example.com/health`}
                />
                <p className="text-[10px] text-neutral-600 mt-1.5">
                  One command per line. <code className="text-[#00aaff]">{'${input}'}</code> is
                  replaced with the run-skill input; <code className="text-[#00aaff]">{'${paramName}'}</code>{' '}
                  with the matching <code>params</code> entry.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-2 font-medium">Working Dir</label>
                  <input
                    type="text"
                    value={(definition as CommandDefinition).workingDir || ''}
                    onChange={(e) => updateDefinitionField('workingDir', e.target.value)}
                    className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#00aaff] transition-colors font-mono"
                    placeholder="/tmp"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-2 font-medium">Shell</label>
                  <input
                    type="text"
                    value={(definition as CommandDefinition).shell || ''}
                    onChange={(e) => updateDefinitionField('shell', e.target.value)}
                    className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#00aaff] transition-colors font-mono"
                    placeholder="/bin/sh"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-2 font-medium">Timeout (s)</label>
                  <input
                    type="number"
                    value={(definition as CommandDefinition).timeout ?? 300}
                    onChange={(e) => updateDefinitionField('timeout', parseInt(e.target.value) || 300)}
                    className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#00aaff] transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {/* WORKFLOW Type - editable JSON */}
          {type === 'WORKFLOW' && (
            <div>
              <label className="block text-xs text-neutral-400 mb-2 font-medium">
                Workflow Definition (JSON) <span className="text-[#ff0044]">*</span>
              </label>
              <textarea
                value={workflowJson}
                onChange={(e) => setWorkflowJson(e.target.value)}
                rows={14}
                className="w-full bg-[#111] border border-[#1a1a1a] px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#ffaa00] transition-colors resize-y font-mono"
                spellCheck={false}
                placeholder='{ "steps": [{ "name": "step-1", "type": "command", "command": "echo hello" }] }'
              />
              {workflowJsonError && (
                <p className="text-[10px] text-[#ff0044] mt-1.5">{workflowJsonError}</p>
              )}
              <p className="text-[10px] text-neutral-600 mt-1.5">
                Must be an object with a <code className="text-[#ffaa00]">steps</code> array. Each
                step: <code className="text-[#ffaa00]">{`{ name, type: "command"|"skill", command|skill, params?, onSuccess?, onFailure? }`}</code>.
                Use <code className="text-[#ffaa00]">onFailure: &quot;abort&quot;</code> or{' '}
                <code className="text-[#ffaa00]">&quot;goto:label&quot;</code> for branching.
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
            className="px-5 py-2 font-medium text-sm transition-all disabled:opacity-50"
            style={{
              background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
              color: type === 'COMMAND' || type === 'WORKFLOW' ? '#000' : '#fff',
              boxShadow: `0 0 15px ${accent}33`,
            }}
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Skill'}
          </button>
        </div>
      </div>
    </div>
  );
}