'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SetupWizardProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'api-key' | 'token' | 'agent' | 'complete';

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [apiKey, setApiKey] = useState('');
  const [token, setToken] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Agent form state
  const [agentName, setAgentName] = useState('Local Agent');
  const [agentUrl, setAgentUrl] = useState('http://localhost:8090');
  const [agentToken, setAgentToken] = useState('');

  const generateToken = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const newToken = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    setToken(newToken);
    setAgentToken(newToken); // Also set for agent connection
  };

  const steps: { id: Step; label: string }[] = [
    { id: 'welcome', label: 'Welcome' },
    { id: 'api-key', label: 'AI Setup' },
    { id: 'token', label: 'Security' },
    { id: 'agent', label: 'Connect Agent' },
    { id: 'complete', label: 'Done' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const handleSaveSettings = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleAiApiKey: apiKey,
          agentToken: token,
          agentAdkModel: 'gemini-2.0-flash',
          agentAdkEnabled: true,
          serverPort: '8090',
          agentWorkingDir: '/tmp',
          agentDefaultShell: '/bin/bash',
          agentMaxConcurrent: '5',
          setupComplete: true,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save settings');
      }

      setCurrentStep('agent');
    } catch {
      setError('Failed to save settings. Please try again.');
    }

    setSaving(false);
  };

  const handleAddAgent = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentName,
          url: agentUrl,
          token: agentToken || token,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add agent');
      }

      setCurrentStep('complete');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add agent. Please try again.';
      setError(message);
    }

    setSaving(false);
  };

  const handleComplete = async () => {
    // Mark setup as complete
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupComplete: true }),
    });
    onComplete();
    router.refresh();
  };

  const handleSkipAgent = () => {
    setCurrentStep('complete');
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                  ${index < currentStepIndex ? 'bg-[#00fff2] text-black' : ''}
                  ${index === currentStepIndex ? 'bg-[#00fff2] text-black ring-4 ring-[#00fff2]/20' : ''}
                  ${index > currentStepIndex ? 'bg-[#1a1a1a] text-[#666]' : ''}
                `}>
                  {index < currentStepIndex ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 sm:w-24 h-0.5 mx-2 ${index < currentStepIndex ? 'bg-[#00fff2]' : 'bg-[#1a1a1a]'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((step) => (
              <span key={step.id} className="text-xs text-[#666] w-8 text-center">{step.label}</span>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-8">
          {/* Welcome Step */}
          {currentStep === 'welcome' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-[#111] border border-[#333] flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl font-bold text-[#00fff2]">G</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">Welcome to GRIPHOOK</h1>
              <p className="text-neutral-400 mb-8 max-w-md mx-auto">
                Get set up in just a few steps. Configure AI capabilities,
                security settings, and connect your first agent.
              </p>
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <button
                  onClick={() => setCurrentStep('api-key')}
                  className="w-full py-3 bg-[#00fff2] text-black font-semibold hover:bg-[#00fff2]/90 transition-colors"
                >
                  Get Started
                </button>
                <button
                  onClick={handleComplete}
                  className="w-full py-3 border border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
                >
                  Skip Setup
                </button>
              </div>
            </div>
          )}

          {/* API Key Step */}
          {currentStep === 'api-key' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#00fff2]/10 border border-[#00fff2]/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#00fff2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">AI Configuration</h2>
                  <p className="text-sm text-neutral-500">Connect to Google Gemini AI</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Google AI API Key <span className="text-[#ff0044]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AIza..."
                      className="w-full bg-[#111] border border-[#333] px-4 py-3 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors pr-12"
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
                  <p className="text-xs text-neutral-500 mt-2">
                    Get your free API key at{' '}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00fff2] hover:underline"
                    >
                      aistudio.google.com/apikey
                    </a>
                  </p>
                </div>

                <div className="bg-[#111] border border-[#1a1a1a] p-4 mt-6">
                  <h3 className="text-sm font-medium text-white mb-2">Why do I need this?</h3>
                  <p className="text-xs text-neutral-400">
                    GRIPHOOK uses Google Gemini AI to power intelligent chat features,
                    skill automation, and natural language task execution. The API key
                    enables these AI capabilities.
                  </p>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setCurrentStep('welcome')}
                  className="px-6 py-2.5 border border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep('token')}
                  disabled={!apiKey.trim()}
                  className="px-6 py-2.5 bg-[#00fff2] text-black font-medium hover:bg-[#00fff2]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Token Step */}
          {currentStep === 'token' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#ff6600]/10 border border-[#ff6600]/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#ff6600]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Security</h2>
                  <p className="text-sm text-neutral-500">Set up your agent authentication token</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Agent Token <span className="text-[#ff0044]">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={token}
                        onChange={(e) => {
                          setToken(e.target.value);
                          setAgentToken(e.target.value);
                        }}
                        placeholder="Enter or generate a secure token"
                        className="w-full bg-[#111] border border-[#333] px-4 py-3 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors font-mono text-sm pr-12"
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
                      className="px-4 py-3 bg-[#111] border border-[#333] text-neutral-300 hover:text-white hover:border-[#00fff2] transition-colors whitespace-nowrap"
                    >
                      Generate
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    This token authenticates API requests between the UI and backend agent
                  </p>
                </div>

                {error && (
                  <div className="p-4 bg-[#ff0044]/10 border border-[#ff0044]/30 text-[#ff0044] text-sm">
                    {error}
                  </div>
                )}

                <div className="bg-[#111] border border-[#1a1a1a] p-4 mt-6">
                  <h3 className="text-sm font-medium text-white mb-2">Security Tip</h3>
                  <p className="text-xs text-neutral-400">
                    Click the Generate button to create a secure random token. Keep this token safe -
                    you will need it to connect agents to the control center.
                  </p>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setCurrentStep('api-key')}
                  className="px-6 py-2.5 border border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={!token.trim() || saving}
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
                    'Save & Continue'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Agent Step */}
          {currentStep === 'agent' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#aa00ff]/10 border border-[#aa00ff]/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#aa00ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Connect Your First Agent</h2>
                  <p className="text-sm text-neutral-500">Add a backend agent to start running tasks</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="My Agent"
                    className="w-full bg-[#111] border border-[#333] px-4 py-3 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Agent URL
                  </label>
                  <input
                    type="text"
                    value={agentUrl}
                    onChange={(e) => setAgentUrl(e.target.value)}
                    placeholder="http://localhost:8090"
                    className="w-full bg-[#111] border border-[#333] px-4 py-3 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Agent Token
                  </label>
                  <input
                    type="text"
                    value={agentToken}
                    onChange={(e) => setAgentToken(e.target.value)}
                    placeholder="Same as security token"
                    className="w-full bg-[#111] border border-[#333] px-4 py-3 text-white placeholder-neutral-600 focus:border-[#00fff2] focus:outline-none transition-colors font-mono text-sm"
                  />
                  <p className="text-xs text-neutral-500 mt-2">
                    Use the same token you configured in the security step
                  </p>
                </div>

                {error && (
                  <div className="p-4 bg-[#ff0044]/10 border border-[#ff0044]/30 text-[#ff0044] text-sm">
                    {error}
                  </div>
                )}

                <div className="bg-[#111] border border-[#1a1a1a] p-4 mt-6">
                  <h3 className="text-sm font-medium text-white mb-2">Is your backend running?</h3>
                  <p className="text-xs text-neutral-400">
                    Make sure the GRIPHOOK backend is running at the URL specified above.
                    You can start it with: <code className="text-[#00fff2] bg-black/50 px-1 py-0.5">./gradlew bootRun</code>
                  </p>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  onClick={handleSkipAgent}
                  className="px-6 py-2.5 border border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
                >
                  Skip for Now
                </button>
                <button
                  onClick={handleAddAgent}
                  disabled={!agentName.trim() || !agentUrl.trim() || saving}
                  className="px-6 py-2.5 bg-[#00fff2] text-black font-medium hover:bg-[#00fff2]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Connecting...
                    </>
                  ) : (
                    'Connect Agent'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {currentStep === 'complete' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center mx-auto mb-6 rounded-full">
                <svg className="w-10 h-10 text-[#00ff66]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">You're All Set!</h1>
              <p className="text-neutral-400 mb-8 max-w-md mx-auto">
                GRIPHOOK is configured and ready to use. Start chatting with the AI,
                configure skills, or run your first execution.
              </p>

              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
                <div className="bg-[#111] border border-[#1a1a1a] p-4 text-center">
                  <svg className="w-6 h-6 text-[#00fff2] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="text-xs text-neutral-400">AI Chat</p>
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] p-4 text-center">
                  <svg className="w-6 h-6 text-[#ff6600] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="text-xs text-neutral-400">Skills</p>
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] p-4 text-center">
                  <svg className="w-6 h-6 text-[#aa00ff] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-neutral-400">Autopilot</p>
                </div>
              </div>

              <button
                onClick={handleComplete}
                className="px-8 py-3 bg-[#00fff2] text-black font-semibold hover:bg-[#00fff2]/90 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
