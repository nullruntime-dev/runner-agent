'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SetupWizard from '@/components/SetupWizard';
import SkillsManagement from '@/components/SkillsManagement';
import DatabaseManagement from '@/components/DatabaseManagement';
import { getAgents, getAIConfig, updateAIConfig, AIProviderConfig } from '@/lib/api';

interface EnvConfig {
  googleAiApiKey: string;
  agentToken: string;
  agentAdkEnabled: boolean;
  serverPort: string;
  agentWorkingDir: string;
  agentDefaultShell: string;
  agentMaxConcurrent: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<EnvConfig>({
    googleAiApiKey: '',
    agentToken: '',
    agentAdkEnabled: true,
    serverPort: '8090',
    agentWorkingDir: '/tmp',
    agentDefaultShell: '/bin/bash',
    agentMaxConcurrent: '5',
  });
  // AI config from backend (dynamic, no restart needed)
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({
    provider: 'gemini',
    geminiModel: 'gemini-2.0-flash',
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    ollamaModel: 'llama3.1:8b',
  });
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAiConfig, setSavingAiConfig] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Load env config
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
        }

        // Load AI config from backend via first agent
        const agents = await getAgents();
        if (agents.length > 0) {
          const firstAgent = agents[0];
          setAgentId(firstAgent.id);
          try {
            const aiCfg = await getAIConfig(firstAgent.id);
            setAiConfig(aiCfg);
          } catch {
            // Agent may not support AI config endpoint yet
          }
        }
      } catch {
        // Ignore fetch errors
      }
      setLoading(false);
    };
    loadConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // Ignore fetch errors
    }
  };

  const handleSaveAiConfig = async () => {
    if (!agentId) {
      setMessage({ type: 'error', text: 'No agent configured. Add an agent first.' });
      return;
    }
    setSavingAiConfig(true);
    setMessage(null);

    try {
      const result = await updateAIConfig(agentId, aiConfig);
      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'AI configuration updated. Changes take effect immediately.' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save AI configuration' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to communicate with agent' });
    }

    setSavingAiConfig(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved. Restart the backend service for changes to take effect.' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    }

    setSaving(false);
  };

  const generateToken = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    setConfig({ ...config, agentToken: token });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-[#00fff2] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-neutral-400">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
          <p className="text-neutral-500">Configure your GRIPHOOK instance</p>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-[#00fff2]/5 border border-[#00fff2]/20 flex items-start gap-3">
          <svg className="w-5 h-5 text-[#00fff2] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-[#00fff2] font-medium">Configuration Types</p>
            <p className="text-xs text-neutral-400 mt-1">
              <span className="text-[#00ff66]">AI Configuration</span> changes apply immediately.
              Other settings are saved to <code className="text-[#00fff2] bg-black/50 px-1 py-0.5">.env</code> and require <strong className="text-white">backend restart</strong>.
            </p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 border ${
            message.type === 'success'
              ? 'bg-[#00ff66]/10 border-[#00ff66]/30 text-[#00ff66]'
              : 'bg-[#ff0044]/10 border-[#ff0044]/30 text-[#ff0044]'
          }`}>
            {message.text}
          </div>
        )}

        <div className="space-y-8">
          {/* AI Configuration (Dynamic - No Restart Needed) */}
          <section className="border border-[#1a1a1a] bg-[#0f0f0f]">
            <div className="px-6 py-4 border-b border-[#1a1a1a]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#00fff2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Configuration
                <span className="text-[10px] px-1.5 py-0.5 bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30 ml-2">
                  LIVE
                </span>
              </h2>
              <p className="text-sm text-neutral-500 mt-1">Configure AI provider and model for chat capabilities. Changes take effect immediately.</p>
            </div>
            <div className="p-6 space-y-4">
              {!agentId && (
                <div className="p-3 bg-[#ff6600]/10 border border-[#ff6600]/30 text-sm text-[#ff6600]">
                  No agent configured. Add an agent first to configure AI settings.
                </div>
              )}

              {agentId && (
                <>
                  {/* AI Provider */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                      AI Provider
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAiConfig({ ...aiConfig, provider: 'gemini' })}
                        className={`flex-1 px-4 py-3 border transition-colors ${
                          aiConfig.provider === 'gemini'
                            ? 'border-[#00fff2] bg-[#00fff2]/10 text-[#00fff2]'
                            : 'border-[#333] text-neutral-400 hover:border-neutral-500'
                        }`}
                      >
                        <div className="font-medium">Google Gemini</div>
                        <div className="text-xs opacity-70 mt-1">Cloud-based, requires API key</div>
                      </button>
                      <button
                        onClick={() => setAiConfig({ ...aiConfig, provider: 'ollama' })}
                        className={`flex-1 px-4 py-3 border transition-colors ${
                          aiConfig.provider === 'ollama'
                            ? 'border-[#00fff2] bg-[#00fff2]/10 text-[#00fff2]'
                            : 'border-[#333] text-neutral-400 hover:border-neutral-500'
                        }`}
                      >
                        <div className="font-medium">Ollama</div>
                        <div className="text-xs opacity-70 mt-1">Local models, runs on your machine</div>
                      </button>
                    </div>
                  </div>

                  {/* Gemini Configuration */}
                  {aiConfig.provider === 'gemini' && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Gemini Model
                      </label>
                      <select
                        value={aiConfig.geminiModel}
                        onChange={(e) => setAiConfig({ ...aiConfig, geminiModel: e.target.value })}
                        className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white focus:border-[#00fff2] focus:outline-none transition-colors"
                      >
                        <option value="gemini-2.0-flash">gemini-2.0-flash (Recommended)</option>
                        <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                        <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
                      </select>
                    </div>
                  )}

                  {/* Ollama Configuration */}
                  {aiConfig.provider === 'ollama' && (
                    <>
                      {/* Ollama Base URL */}
                      <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-2">
                          Ollama Server URL
                        </label>
                        <input
                          type="text"
                          value={aiConfig.ollamaBaseUrl}
                          onChange={(e) => setAiConfig({ ...aiConfig, ollamaBaseUrl: e.target.value })}
                          placeholder="http://127.0.0.1:11434"
                          className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors font-mono text-sm"
                        />
                        <p className="text-xs text-neutral-500 mt-2">
                          Default: http://127.0.0.1:11434. Make sure Ollama is running with <code className="text-[#00fff2]">ollama serve</code>
                        </p>
                      </div>

                      {/* Ollama Model */}
                      <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-2">
                          Ollama Model
                        </label>
                        <input
                          type="text"
                          value={aiConfig.ollamaModel}
                          onChange={(e) => setAiConfig({ ...aiConfig, ollamaModel: e.target.value })}
                          placeholder="llama3.1:8b"
                          className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors font-mono"
                        />
                        <p className="text-xs text-neutral-500 mt-2">
                          Models with tool support: <span className="text-neutral-400">llama3.1, mistral, qwen3, mixtral</span>.
                          Pull with <code className="text-[#00fff2]">ollama pull MODEL</code>
                        </p>
                      </div>

                      {/* Ollama Info Banner */}
                      <div className="p-3 bg-[#ff6600]/10 border border-[#ff6600]/30 text-sm">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-[#ff6600] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div className="text-[#ff6600]">
                            <strong>Tool support required:</strong> Use models that support function calling.
                            Check with <code className="bg-black/30 px-1">ollama show MODEL</code> — look for &quot;tools&quot; in capabilities.
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Save AI Config Button */}
                  <div className="pt-4 border-t border-[#1a1a1a]">
                    <button
                      onClick={handleSaveAiConfig}
                      disabled={savingAiConfig}
                      className="px-4 py-2 bg-[#00fff2] text-black font-medium hover:bg-[#00fff2]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {savingAiConfig ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Applying...
                        </>
                      ) : (
                        'Apply AI Configuration'
                      )}
                    </button>
                    <p className="text-xs text-neutral-500 mt-2">
                      Changes apply immediately to the next chat request. No restart required.
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* API Key (requires restart) */}
          <section className="border border-[#1a1a1a] bg-[#0f0f0f]">
            <div className="px-6 py-4 border-b border-[#1a1a1a]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#00fff2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                API Keys
              </h2>
              <p className="text-sm text-neutral-500 mt-1">Manage API keys. Requires backend restart to take effect.</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Google AI API Key */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Google AI API Key <span className="text-[#ff0044]">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={config.googleAiApiKey}
                      onChange={(e) => setConfig({ ...config, googleAiApiKey: e.target.value })}
                      placeholder="Enter your Google AI API key"
                      className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                    >
                      {showApiKey ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  Get your API key at{' '}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[#00fff2] hover:underline">
                    aistudio.google.com/apikey
                  </a>
                </p>
              </div>

              {/* AI Enabled */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-neutral-300">
                    Enable AI Chat
                  </label>
                  <p className="text-xs text-neutral-500">Turn AI chat capabilities on or off (requires restart)</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, agentAdkEnabled: !config.agentAdkEnabled })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    config.agentAdkEnabled ? 'bg-[#00fff2]' : 'bg-[#333]'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.agentAdkEnabled ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="border border-[#1a1a1a] bg-[#0f0f0f]">
            <div className="px-6 py-4 border-b border-[#1a1a1a]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#ff6600]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Security
              </h2>
              <p className="text-sm text-neutral-500 mt-1">API authentication settings</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Agent Token */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Agent Token <span className="text-[#ff0044]">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={config.agentToken}
                      onChange={(e) => setConfig({ ...config, agentToken: e.target.value })}
                      placeholder="Enter or generate a secure token"
                      className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                    >
                      {showToken ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={generateToken}
                    className="px-4 py-2.5 bg-[#111] border border-[#333] text-neutral-300 hover:text-white hover:border-[#00fff2] transition-colors"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  This token is used to authenticate API requests to the agent
                </p>
              </div>
            </div>
          </section>

          {/* Server Settings */}
          <section className="border border-[#1a1a1a] bg-[#0f0f0f]">
            <div className="px-6 py-4 border-b border-[#1a1a1a]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#aa00ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
                Server Settings
              </h2>
              <p className="text-sm text-neutral-500 mt-1">Configure server behavior</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Server Port
                </label>
                <input
                  type="text"
                  value={config.serverPort}
                  onChange={(e) => setConfig({ ...config, serverPort: e.target.value })}
                  className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white focus:border-[#00fff2] focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Max Concurrent Executions
                </label>
                <input
                  type="text"
                  value={config.agentMaxConcurrent}
                  onChange={(e) => setConfig({ ...config, agentMaxConcurrent: e.target.value })}
                  className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white focus:border-[#00fff2] focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Working Directory
                </label>
                <input
                  type="text"
                  value={config.agentWorkingDir}
                  onChange={(e) => setConfig({ ...config, agentWorkingDir: e.target.value })}
                  className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white font-mono text-sm focus:border-[#00fff2] focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Default Shell
                </label>
                <input
                  type="text"
                  value={config.agentDefaultShell}
                  onChange={(e) => setConfig({ ...config, agentDefaultShell: e.target.value })}
                  className="w-full bg-[#111] border border-[#333] px-4 py-2.5 text-white font-mono text-sm focus:border-[#00fff2] focus:outline-none transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Skills Management */}
          <section className="border border-[#1a1a1a] bg-[#0f0f0f]">
            <div className="px-6 py-4 border-b border-[#1a1a1a]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#00fff2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Skills Management
              </h2>
              <p className="text-sm text-neutral-500 mt-1">Configure built-in and custom skills, manage visibility</p>
            </div>
            <div className="p-6">
              <SkillsManagement />
            </div>
          </section>

          {/* Database Management */}
          <section className="border border-[#1a1a1a] bg-[#0f0f0f]">
            <div className="px-6 py-4 border-b border-[#1a1a1a]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#aa00ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                Database
              </h2>
              <p className="text-sm text-neutral-500 mt-1">Export or restore the UI&apos;s local database (registered agents, executions, steps, log lines)</p>
            </div>
            <div className="p-6">
              <DatabaseManagement />
            </div>
          </section>

          {/* Setup Wizard */}
          <section className="border border-[#1a1a1a] bg-[#0f0f0f]">
            <div className="px-6 py-4 border-b border-[#1a1a1a]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#00ff66]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Setup Wizard
              </h2>
              <p className="text-sm text-neutral-500 mt-1">Run the guided setup wizard again</p>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-neutral-400">
                  Need to reconfigure GRIPHOOK? Run the setup wizard to walk through all settings step by step.
                </p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="px-4 py-2 border border-[#00fff2] text-[#00fff2] hover:bg-[#00fff2]/10 transition-colors whitespace-nowrap"
                >
                  Run Setup Wizard
                </button>
              </div>
              <div className="pt-4 border-t border-[#1a1a1a] flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-400">Reset setup status</p>
                  <p className="text-xs text-neutral-600">This will show the wizard on the home page for new users</p>
                </div>
                <button
                  onClick={async () => {
                    await fetch('/api/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ setupComplete: false }),
                    });
                    setMessage({ type: 'success', text: 'Setup status reset. The wizard will appear on the home page.' });
                  }}
                  className="px-4 py-2 border border-[#ff6600] text-[#ff6600] hover:bg-[#ff6600]/10 transition-colors whitespace-nowrap text-sm"
                >
                  Reset Setup
                </button>
              </div>
            </div>
          </section>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Link
              href="/"
              className="px-6 py-2.5 border border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-[#00fff2] text-black font-medium hover:bg-[#00fff2]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </div>
      </main>

      {/* Setup Wizard Modal */}
      {showWizard && (
        <SetupWizard
          onComplete={() => {
            setShowWizard(false);
            fetchConfig();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
