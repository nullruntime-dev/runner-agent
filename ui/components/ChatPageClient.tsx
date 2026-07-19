'use client';

import { useState, useCallback } from 'react';
import ChatView from './ChatView';
import AgentSkills from './AgentSkills';
import ChatSessionsSidebar from './ChatSessionsSidebar';

interface Agent {
  id: string;
  name: string;
  url: string;
  status: 'online' | 'offline';
}

interface ChatPageClientProps {
  agents: Agent[];
}

type SidebarTab = 'history' | 'skills';

export default function ChatPageClient({ agents }: ChatPageClientProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>('history');

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const handleSelectSession = useCallback((sessionId: string | null) => {
    setCurrentSessionId(sessionId);
  }, []);

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
  }, []);

  const handleSessionChange = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  return (
    <div className="flex h-full bg-[#050505]">
      {/* Agent Sidebar */}
      <div className="w-72 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col flex-shrink-0 h-full">
        {/* Agents Section */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-gradient-to-b from-[#00fff2] to-[#ff00ea]" />
            <h2 className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">
              Agents
            </h2>
          </div>
          <div className="space-y-1">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`w-full px-3 py-2.5 text-left transition-all ${
                  selectedAgentId === agent.id
                    ? 'bg-[#111] border border-[#2a2a2a] shadow-[0_0_20px_rgba(0,255,242,0.1)]'
                    : 'hover:bg-[#111] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5  ${
                    agent.status === 'online'
                      ? 'bg-[#00ff66] shadow-[0_0_8px_rgba(0,255,102,0.5)]'
                      : 'bg-[#ff0044]'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#ccc] truncate font-medium">{agent.name}</div>
                    <div className="text-[10px] text-[#444] truncate">{agent.url}</div>
                  </div>
                  {selectedAgentId === agent.id && (
                    <svg className="w-4 h-4 text-[#00fff2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* History / Skills Toggle */}
        {selectedAgentId && (
          <div className="flex-1 flex flex-col min-h-0 border-t border-[#1a1a1a] mt-2">
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
            <div className="flex-1 overflow-y-auto min-h-0">
              {activeTab === 'history' ? (
                <ChatSessionsSidebar
                  agentId={selectedAgentId}
                  currentSessionId={currentSessionId}
                  onSelectSession={handleSelectSession}
                  onNewChat={handleNewChat}
                />
              ) : (
                <AgentSkills agentId={selectedAgentId} isOnline={true} />
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#1a1a1a]">
          <div className="flex items-center justify-between text-[10px] text-[#444]">
            <span>v0.1.0</span>
            <a href="/docs" className="hover:text-[#00fff2] transition-colors">Documentation</a>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedAgent ? (
          <>
            {/* Agent Header Bar */}
            <div className="bg-[#0a0a0a] border-b border-[#1a1a1a] px-4 py-2.5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5  ${
                  selectedAgent.status === 'online'
                    ? 'bg-[#00ff66] shadow-[0_0_8px_rgba(0,255,102,0.5)]'
                    : 'bg-[#ff0044]'
                }`} />
                <span className="text-sm font-medium text-white">{selectedAgent.name}</span>
                <span className="text-[10px] text-[#444] bg-[#111] px-2 py-0.5">
                  {selectedAgent.url}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-1 ${
                  selectedAgent.status === 'online'
                    ? 'bg-[#00ff66]/10 text-[#00ff66]'
                    : 'bg-[#ff0044]/10 text-[#ff0044]'
                }`}>
                  {selectedAgent.status === 'online' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            {/* Chat View */}
            <div className="flex-1 overflow-hidden">
              <ChatView
                key={selectedAgentId}
                agentId={selectedAgentId}
                sessionId={currentSessionId}
                onSessionChange={handleSessionChange}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#2a2a2a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-[#888] text-sm">Select an agent to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
