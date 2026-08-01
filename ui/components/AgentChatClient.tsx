'use client';

import { useState, useEffect, useCallback } from 'react';
import { Skill, getSkills } from '@/lib/api';
import ChatView from './ChatView';
import SkillsSidebar from './SkillsSidebar';
import ChatSessionsSidebar from './ChatSessionsSidebar';

interface AgentChatClientProps {
  agentId: string;
  initialSkill?: string | null;
}

type SidebarTab = 'history' | 'skills';

export default function AgentChatClient({ agentId, initialSkill }: AgentChatClientProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(initialSkill ?? null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>('history');

  const fetchSkills = async () => {
    try {
      const data = await getSkills(agentId);
      setSkills(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch skills:', err);
      setError('Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, [agentId]);

  const handleSelectSkill = (skillName: string | null) => {
    setSelectedSkill(skillName);
  };

  const handleSelectSession = useCallback((sessionId: string | null) => {
    setCurrentSessionId(sessionId);
  }, []);

  const handleNewChat = useCallback(() => {
    // Setting to null will cause ChatView to generate a new session ID
    setCurrentSessionId(null);
  }, []);

  const handleSessionChange = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  return (
    <div className="flex h-full w-full min-h-0">
      {/* Combined Sidebar */}
      <div className="w-56 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col flex-shrink-0 min-h-0">
        {/* Tab Toggle */}
        <div className="px-3 py-3 border-b border-[#1a1a1a] flex-shrink-0">
          <div className="flex bg-[#111] border border-[#1f1f1f] p-0.5">
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-[#1a1a1a] text-[#00fff2] shadow-[0_0_10px_rgba(0,255,242,0.15)]'
                  : 'text-[#666] hover:text-[#aaa]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History
            </button>
            <button
              onClick={() => setActiveTab('skills')}
              className={`flex-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'skills'
                  ? 'bg-[#1a1a1a] text-[#ff00ea] shadow-[0_0_10px_rgba(255,0,234,0.15)]'
                  : 'text-[#666] hover:text-[#aaa]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Skills
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'history' ? (
            <ChatSessionsSidebar
              agentId={agentId}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
            />
          ) : (
            <SkillsSidebar
              agentId={agentId}
              skills={skills}
              loading={loading}
              error={error}
              selectedSkill={selectedSkill}
              onSelectSkill={handleSelectSkill}
              onRefresh={fetchSkills}
            />
          )}
        </div>
      </div>

      {/* Chat View */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <ChatView
          agentId={agentId}
          selectedSkill={selectedSkill}
          onSelectSkill={handleSelectSkill}
          externalSkills={skills.filter(s => s.configured && s.enabled && !s.hidden)}
          sessionId={currentSessionId}
          onSessionChange={handleSessionChange}
        />
      </div>
    </div>
  );
}
