'use client';

import { useState, useEffect } from 'react';
import { Skill, GmailAuthStatus, getGmailAuthStatus, getGmailAuthUrl, revokeGmailAuth } from '@/lib/api';

interface SkillConfigModalProps {
  skill: Skill;
  agentId: string;
  onClose: () => void;
  onSave: (config: Record<string, string>, enabled: boolean) => void;
  onDeactivate?: () => void;
  saving: boolean;
}

export default function SkillConfigModal({
  skill,
  agentId,
  onClose,
  onSave,
  onDeactivate,
  saving,
}: SkillConfigModalProps) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(skill.enabled);
  const [deactivating, setDeactivating] = useState(false);
  const [gmailAuthStatus, setGmailAuthStatus] = useState<GmailAuthStatus | null>(null);
  const [gmailAuthLoading, setGmailAuthLoading] = useState(false);
  const [gmailAuthError, setGmailAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (skill.name === 'gmail-api') {
      fetchGmailAuthStatus();
    }
  }, [skill.name, agentId]);

  const fetchGmailAuthStatus = async () => {
    try {
      const status = await getGmailAuthStatus(agentId);
      setGmailAuthStatus(status);
    } catch (err) {
      console.error('Failed to fetch Gmail auth status:', err);
    }
  };

  const handleGmailAuthorize = async () => {
    setGmailAuthLoading(true);
    setGmailAuthError(null);
    try {
      const data = await getGmailAuthUrl(agentId);
      window.open(data.authUrl, '_blank', 'width=600,height=700');
      const pollInterval = setInterval(async () => {
        try {
          const status = await getGmailAuthStatus(agentId);
          setGmailAuthStatus(status);
          if (status.authorized) {
            clearInterval(pollInterval);
            setGmailAuthLoading(false);
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 2000);
      setTimeout(() => {
        clearInterval(pollInterval);
        setGmailAuthLoading(false);
      }, 300000);
    } catch (err) {
      setGmailAuthError(err instanceof Error ? err.message : 'Failed to start OAuth');
      setGmailAuthLoading(false);
    }
  };

  const handleGmailRevoke = async () => {
    if (!confirm('Are you sure you want to revoke Gmail authorization?')) return;
    try {
      await revokeGmailAuth(agentId);
      setGmailAuthStatus({ configured: gmailAuthStatus?.configured ?? false, authorized: false, email: '', ready: false });
    } catch (err) {
      console.error('Failed to revoke Gmail auth:', err);
    }
  };

  const handleDeactivate = () => {
    if (confirm(`Are you sure you want to deactivate ${skill.displayName}? This will remove all credentials.`)) {
      setDeactivating(true);
      onDeactivate?.();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const field of skill.configFields) {
      if (field.required && !config[field.name]?.trim()) {
        alert(`${field.label} is required`);
        return;
      }
    }
    onSave(config, enabled);
  };

  const handleFieldChange = (name: string, value: string) => {
    setConfig((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-[#00fff2] via-[#ff00ea] to-[#00fff2]" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#00fff2]/20 to-[#ff00ea]/20 border border-[#00fff2]/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#00fff2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">{skill.displayName}</h2>
              <p className="text-xs text-neutral-500">Configuration</p>
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

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-neutral-400">{skill.description}</p>

            {/* Slack Setup Instructions */}
            {skill.name === 'slack' && (
              <div className="bg-[#111] border border-[#1a1a1a]  p-4 text-xs">
                <p className="text-[#9900ff] font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z"/></svg>
                  Slack App Setup (Socket Mode)
                </p>
                <ol className="text-neutral-500 space-y-2 list-decimal list-inside">
                  <li>Create app at <span className="text-[#00fff2]">api.slack.com/apps</span></li>
                  <li>Enable <span className="text-white">Socket Mode</span> → Get App Token</li>
                  <li>Add scopes: <code className="bg-[#0a0a0a] px-1.5 py-0.5  text-[#00fff2]">chat:write</code>, <code className="bg-[#0a0a0a] px-1.5 py-0.5  text-[#00fff2]">app_mentions:read</code></li>
                  <li>Install to workspace → Copy Bot Token</li>
                </ol>
                <p className="text-[#00ff66] mt-3 flex items-center gap-1.5">
                  <span className="w-2 h-2  bg-[#00ff66]" />
                  No public URL needed!
                </p>
              </div>
            )}

            {/* Gmail SMTP Setup */}
            {skill.name === 'gmail' && (
              <div className="bg-[#111] border border-[#1a1a1a]  p-4 text-xs">
                <p className="text-[#ff0044] font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Gmail App Password Setup
                </p>
                <ol className="text-neutral-500 space-y-2 list-decimal list-inside">
                  <li>Go to <span className="text-[#00fff2]">myaccount.google.com</span></li>
                  <li>Security → Enable 2-Step Verification</li>
                  <li>App passwords → Create for &quot;Mail&quot;</li>
                  <li>Copy the 16-character password</li>
                </ol>
                <p className="text-[#ff6600] mt-3">Note: Regular password won&apos;t work</p>
              </div>
            )}

            {/* Gmail API OAuth Setup */}
            {skill.name === 'gmail-api' && (
              <div className="space-y-4">
                <div className="bg-[#111] border border-[#1a1a1a]  p-4 text-xs">
                  <p className="text-[#00fff2] font-medium mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/></svg>
                    Google Cloud OAuth Setup
                  </p>
                  <ol className="text-neutral-500 space-y-2 list-decimal list-inside">
                    <li>Go to <span className="text-[#00fff2]">console.cloud.google.com</span></li>
                    <li>Enable the <span className="text-white">Gmail API</span></li>
                    <li>Create OAuth 2.0 Client ID (Web application)</li>
                    <li>Add redirect URI: <code className="bg-[#0a0a0a] px-1.5 py-0.5  text-[#ff00ea] break-all">http://localhost:8090/agent/gmail/auth/callback</code></li>
                  </ol>
                </div>

                {/* OAuth Status */}
                {gmailAuthStatus && (
                  <div className={` p-4 text-xs border ${
                    gmailAuthStatus.authorized
                      ? 'bg-[#00ff66]/10 border-[#00ff66]/30'
                      : 'bg-[#111] border-[#1a1a1a]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3  ${
                          gmailAuthStatus.authorized
                            ? 'bg-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.5)]'
                            : 'bg-neutral-600'
                        }`} />
                        <div>
                          <p className="text-white font-medium">Authorization Status</p>
                          {gmailAuthStatus.authorized ? (
                            <p className="text-[#00ff66]">Connected as {gmailAuthStatus.email}</p>
                          ) : gmailAuthStatus.configured ? (
                            <p className="text-[#ff6600]">Configured but not authorized</p>
                          ) : (
                            <p className="text-neutral-500">Save credentials first</p>
                          )}
                        </div>
                      </div>
                      {gmailAuthStatus.authorized && (
                        <button
                          type="button"
                          onClick={handleGmailRevoke}
                          className="text-[#ff0044] hover:text-[#ff3366] text-xs"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {gmailAuthError && (
                  <div className="bg-[#ff0044]/10 border border-[#ff0044]/30  p-3 text-xs text-[#ff0044]">
                    {gmailAuthError}
                  </div>
                )}

                {gmailAuthStatus?.configured && !gmailAuthStatus.authorized && (
                  <button
                    type="button"
                    onClick={handleGmailAuthorize}
                    disabled={gmailAuthLoading}
                    className="w-full bg-gradient-to-r from-[#00fff2] to-[#00cccc] hover:from-[#00cccc] hover:to-[#00fff2] disabled:from-neutral-700 disabled:to-neutral-700 text-black font-medium py-3 px-4  text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,255,242,0.3)]"
                  >
                    {gmailAuthLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Waiting for authorization...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        </svg>
                        Authorize with Google
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* SMTP Setup */}
            {skill.name === 'smtp' && (
              <div className="bg-[#111] border border-[#1a1a1a]  p-4 text-xs">
                <p className="text-[#ff6600] font-medium mb-3">Common SMTP Providers</p>
                <div className="text-neutral-500 space-y-1.5">
                  <div><span className="text-white">SendGrid:</span> smtp.sendgrid.net:587</div>
                  <div><span className="text-white">Mailgun:</span> smtp.mailgun.org:587</div>
                  <div><span className="text-white">AWS SES:</span> email-smtp.region.amazonaws.com:587</div>
                </div>
              </div>
            )}

            {/* Config Fields */}
            {skill.configFields.map((field) => (
              <div key={field.name}>
                <label className="block text-xs text-neutral-400 mb-2 font-medium">
                  {field.label}
                  {field.required && <span className="text-[#ff0044] ml-1">*</span>}
                </label>
                {field.type === 'select' ? (
                  <select
                    value={config[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="w-full bg-[#111] border border-[#1a1a1a]  px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-[#00fff2] transition-colors"
                  >
                    <option value="">Select...</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={config[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-[#111] border border-[#1a1a1a]  px-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-[#00fff2] transition-colors"
                  />
                )}
                {field.description && (
                  <p className="text-[10px] text-neutral-600 mt-1.5">{field.description}</p>
                )}
              </div>
            ))}

            {/* Enable Toggle */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`relative w-12 h-6  transition-colors ${
                  enabled ? 'bg-[#00fff2]' : 'bg-[#1a1a1a]'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4  bg-white transition-transform ${
                  enabled ? 'left-7' : 'left-1'
                }`} />
              </button>
              <span className="text-sm text-neutral-300">Enable this skill</span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#1a1a1a] flex justify-between bg-[#050505]">
            {skill.configured && onDeactivate ? (
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivating || saving}
                className="px-4 py-2 bg-[#ff0044]/10 hover:bg-[#ff0044]/20 border border-[#ff0044]/30  text-[#ff0044] text-sm transition-colors disabled:opacity-50"
              >
                {deactivating ? 'Deactivating...' : 'Deactivate'}
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#1a1a1a]  text-neutral-300 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-gradient-to-r from-[#00fff2] to-[#00cccc] hover:from-[#00cccc] hover:to-[#00fff2]  text-black font-medium text-sm transition-all disabled:from-neutral-700 disabled:to-neutral-700 disabled:text-neutral-400 shadow-[0_0_15px_rgba(0,255,242,0.2)]"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
