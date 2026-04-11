'use client';

import { useState, useEffect, useCallback } from 'react';
import { Skill, getSkills } from '@/lib/api';
import ChatView from './ChatView';
import SkillsSidebar from './SkillsSidebar';
import ChatSessionsSidebar from './ChatSessionsSidebar';

interface AgentChatClientProps {
  agentId: string;
}

export default function AgentChatClient({ agentId }: AgentChatClientProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

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
      {/* Chat Sessions Sidebar */}
      <div className="w-56 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col flex-shrink-0 min-h-0">
        <div className="px-4 py-3 border-b border-[#1a1a1a] flex-shrink-0">
          <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">History</h2>
        </div>
        <div className="flex-1 min-h-0">
          <ChatSessionsSidebar
            agentId={agentId}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
          />
        </div>
      </div>

      {/* Skills Sidebar */}
      <div className="w-56 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col flex-shrink-0 min-h-0">
        <div className="px-4 py-3 border-b border-[#1a1a1a] flex-shrink-0">
          <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Skills</h2>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <SkillsSidebar
            agentId={agentId}
            skills={skills}
            loading={loading}
            error={error}
            selectedSkill={selectedSkill}
            onSelectSkill={handleSelectSkill}
            onRefresh={fetchSkills}
          />
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
