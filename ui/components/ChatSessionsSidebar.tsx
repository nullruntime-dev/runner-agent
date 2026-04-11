'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChatSession, getChatSessions, deleteChatSession } from '@/lib/api';

interface ChatSessionsSidebarProps {
  agentId: string;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  onNewChat: () => void;
}

export default function ChatSessionsSidebar({
  agentId,
  currentSessionId,
  onSelectSession,
  onNewChat,
}: ChatSessionsSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await getChatSessions(agentId);
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchSessions();
    // Refresh every 30 seconds
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingId) return;

    setDeletingId(sessionId);
    try {
      const result = await deleteChatSession(agentId, sessionId);
      if (result.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          onNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (isYesterday) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const truncateTitle = (title: string | null, maxLength: number = 30) => {
    if (!title) return 'New conversation';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  return (
    <div className="flex flex-col h-full">
      {/* New Chat button */}
      <div className="p-3 border-b border-[#1a1a1a]">
        <button
          onClick={onNewChat}
          className="w-full px-3 py-2 bg-gradient-to-r from-[#00fff2] to-[#00cccc] hover:from-[#00cccc] hover:to-[#00fff2] text-black text-xs font-medium transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,242,0.2)]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center">
            <div className="flex justify-center items-center gap-2 text-[#666]">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-xs">Loading...</span>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-[#666]">No previous chats</p>
          </div>
        ) : (
          <div className="py-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group relative px-3 py-2.5 cursor-pointer transition-colors ${
                  currentSessionId === session.id
                    ? 'bg-[#1a1a1a] border-l-2 border-[#00fff2]'
                    : 'hover:bg-[#111] border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${
                      currentSessionId === session.id ? 'text-white' : 'text-[#aaa]'
                    }`}>
                      {truncateTitle(session.title)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-[#555]">
                        {formatDate(session.updatedAt)}
                      </span>
                      {session.messageCount > 0 && (
                        <span className="text-[10px] text-[#444]">
                          {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(session.id, e)}
                    disabled={deletingId === session.id}
                    className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      deletingId === session.id
                        ? 'text-[#444]'
                        : 'text-[#666] hover:text-[#ff4444]'
                    }`}
                    title="Delete chat"
                  >
                    {deletingId === session.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refresh button */}
      <div className="p-3 border-t border-[#1a1a1a]">
        <button
          onClick={fetchSessions}
          disabled={loading}
          className="w-full px-3 py-1.5 text-xs text-[#666] hover:text-[#aaa] hover:bg-[#111] transition-colors flex items-center justify-center gap-2"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
    </div>
  );
}
