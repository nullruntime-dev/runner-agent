import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { useConfig } from './hooks/useConfig.js';
import { useHealth } from './hooks/useHealth.js';
import { useChat } from './hooks/useChat.js';
import { Header } from './components/Header.js';
import { ChatMessage, StreamingMessage } from './components/ChatMessage.js';
import { ToolCall } from './components/ToolCall.js';
import { Input } from './components/Input.js';
import { StatusBar } from './components/StatusBar.js';
import { CommandMenu, getFilteredCommands, type SlashCommand } from './components/CommandMenu.js';
import { HelpView } from './components/HelpView.js';
import { SkillsList } from './components/SkillsList.js';
import { colors } from './utils/colors.js';

interface AppProps {
  url?: string;
  token?: string;
  sessionId?: string;
  continueSession?: boolean;
  message?: string;
  noStream?: boolean;
}

type ViewMode = 'chat' | 'help' | 'skills' | 'status' | 'executions' | 'sessions' | 'schedules' | 'config';

export function App({ url, token, sessionId, continueSession, message }: AppProps) {
  const { exit } = useApp();

  // Config & API client
  const { config, client } = useConfig({
    url,
    token,
    lastSessionId: sessionId,
  });

  // Resolve session ID
  const resolvedSessionId = sessionId ?? (continueSession ? config.lastSessionId : undefined);

  // Health check
  const { health, skills, connected, refresh } = useHealth(client);

  // Chat state
  const {
    messages,
    streamingContent,
    currentToolCall,
    isStreaming,
    isConnecting,
    error,
    sendMessage,
    clearMessages,
    newSession,
    cancelStream,
  } = useChat(client, resolvedSessionId);

  // Input state
  const [inputValue, setInputValue] = useState(message ?? '');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [menuIndex, setMenuIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');

  // Data state for views
  const [executions, setExecutions] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [customSkills, setCustomSkills] = useState<any[]>([]);

  // Check if showing command menu
  const showCommandMenu = inputValue.startsWith('/') && !isStreaming;

  // Define slash commands
  const slashCommands: SlashCommand[] = useMemo(() => [
    {
      name: 'help',
      description: 'Show the command reference',
      action: () => {
        setViewMode('help');
        setInputValue('');
      },
    },
    {
      name: 'clear',
      description: 'Clear the screen',
      action: () => {
        clearMessages();
        setViewMode('chat');
        setInputValue('');
      },
    },
    {
      name: 'new',
      description: 'Start new session',
      action: () => {
        newSession();
        setViewMode('chat');
        setInputValue('');
      },
    },
    {
      name: 'skills',
      description: 'List skills & status',
      action: async () => {
        try {
          const data = await client.listCustomSkills();
          setCustomSkills(data);
        } catch (e) {
          setCustomSkills([]);
        }
        setViewMode('skills');
        setInputValue('');
      },
    },
    {
      name: 'status',
      description: 'Show connection status',
      action: () => {
        refresh();
        setViewMode('status');
        setInputValue('');
      },
    },
    {
      name: 'sessions',
      description: 'List chat sessions',
      action: async () => {
        try {
          const data = await client.listSessions();
          setSessions(data);
          setViewMode('sessions');
        } catch (e) {}
        setInputValue('');
      },
    },
    {
      name: 'executions',
      description: 'List recent executions',
      action: async () => {
        try {
          const data = await client.listExecutions();
          setExecutions(data);
          setViewMode('executions');
        } catch (e) {}
        setInputValue('');
      },
    },
    {
      name: 'schedules',
      description: 'List scheduled tasks',
      action: async () => {
        try {
          const data = await client.listSchedules();
          setSchedules(data);
          setViewMode('schedules');
        } catch (e) {}
        setInputValue('');
      },
    },
    {
      name: 'config',
      description: 'Show AI configuration',
      action: async () => {
        try {
          const data = await client.getAIConfig();
          setAiConfig(data);
          setViewMode('config');
        } catch (e) {}
        setInputValue('');
      },
    },
    {
      name: 'exit',
      description: 'End the session',
      action: () => {
        exit();
      },
    },
  ], [clearMessages, newSession, refresh, exit, client]);

  const filteredCommands = useMemo(
    () => getFilteredCommands(slashCommands, inputValue),
    [slashCommands, inputValue]
  );

  // Handle keyboard input
  useInput((input, key) => {
    // Escape cancels stream or closes menu/view
    if (key.escape) {
      if (isStreaming) {
        cancelStream();
      } else if (viewMode !== 'chat') {
        setViewMode('chat');
      } else if (showCommandMenu) {
        setInputValue('');
      }
      return;
    }

    // Arrow navigation in command menu
    if (showCommandMenu && filteredCommands.length > 0) {
      if (key.upArrow) {
        setMenuIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setMenuIndex(prev => Math.min(filteredCommands.length - 1, prev + 1));
        return;
      }
      // Tab completes the command
      if (key.tab) {
        const selected = filteredCommands[menuIndex];
        if (selected) {
          setInputValue('/' + selected.name);
        }
        return;
      }
    }

    // History navigation when not in command menu
    if (!showCommandMenu && !isStreaming) {
      if (key.upArrow && history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInputValue(history[history.length - 1 - newIndex] ?? '');
        return;
      }
      if (key.downArrow) {
        if (historyIndex <= 0) {
          setHistoryIndex(-1);
          setInputValue('');
        } else {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInputValue(history[history.length - 1 - newIndex] ?? '');
        }
        return;
      }
    }
  });

  // Handle input change
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    // Reset menu index when filter changes
    if (value.startsWith('/')) {
      setMenuIndex(0);
    }
  }, []);

  // Handle input submission
  const handleSubmit = useCallback((value: string) => {
    if (!value.trim()) return;

    // If showing command menu and user presses enter, execute selected command
    if (showCommandMenu && filteredCommands.length > 0) {
      const selected = filteredCommands[menuIndex];
      if (selected) {
        selected.action();
        return;
      }
    }

    // Handle typed slash commands
    if (value.startsWith('/')) {
      const [cmd, ...args] = value.slice(1).split(' ');
      const cmdLower = cmd.toLowerCase();

      // Find matching command
      const command = slashCommands.find(c => c.name === cmdLower);
      if (command) {
        command.action();
        return;
      }

      // Handle commands with arguments
      switch (cmdLower) {
        case 'exec':
          // Direct command execution
          if (args.length > 0) {
            sendMessage(`Execute this command: ${args.join(' ')}`);
            setInputValue('');
          }
          return;

        case 'logs':
          // Stream logs for execution ID
          if (args[0]) {
            // TODO: implement log streaming view
            setInputValue('');
          }
          return;

        case 'cancel':
          // Cancel execution
          if (args[0]) {
            client.cancelExecution(args[0]).catch(() => {});
            setInputValue('');
          }
          return;

        default:
          // Unknown command - send to agent anyway
          break;
      }
    }

    // Return to chat view if in another view
    if (viewMode !== 'chat') {
      setViewMode('chat');
    }

    // Add to history
    setHistory(prev => [...prev, value]);
    setHistoryIndex(-1);

    // Send message
    sendMessage(value);
    setInputValue('');
  }, [showCommandMenu, filteredCommands, menuIndex, slashCommands, sendMessage, client, viewMode]);

  // Render status view
  const renderStatusView = () => (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text>{colors.accent('CONNECTION STATUS')}</Text>
      </Box>
      <Box>
        <Box width={16}><Text color="gray">Status:</Text></Box>
        <Text color={connected ? 'green' : 'red'}>{connected ? 'Connected' : 'Disconnected'}</Text>
      </Box>
      <Box>
        <Box width={16}><Text color="gray">URL:</Text></Box>
        <Text>{config.url}</Text>
      </Box>
      <Box>
        <Box width={16}><Text color="gray">Agent:</Text></Box>
        <Text>{health?.agentName ?? 'unknown'}</Text>
      </Box>
      <Box>
        <Box width={16}><Text color="gray">Provider:</Text></Box>
        <Text>{health?.provider ?? 'unknown'}</Text>
      </Box>
      <Box>
        <Box width={16}><Text color="gray">Model:</Text></Box>
        <Text>{health?.model ?? 'unknown'}</Text>
      </Box>
      <Box>
        <Box width={16}><Text color="gray">Shell:</Text></Box>
        <Text>{health?.defaultShell ?? 'unknown'}</Text>
      </Box>
      <Box>
        <Box width={16}><Text color="gray">Working Dir:</Text></Box>
        <Text>{health?.workingDir ?? 'unknown'}</Text>
      </Box>
      <Text> </Text>
      <Text color="gray">Press Esc to return to chat.</Text>
    </Box>
  );

  // Render executions view
  const renderExecutionsView = () => (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text>{colors.accent('RECENT EXECUTIONS')}</Text>
      </Box>
      {executions.length === 0 ? (
        <Text color="gray">No executions found.</Text>
      ) : (
        executions.slice(0, 10).map((exec: any) => (
          <Box key={exec.id}>
            <Box width={10}><Text color="gray">{exec.id?.slice(0, 8)}</Text></Box>
            <Box width={12}>
              <Text color={exec.status === 'SUCCESS' ? 'green' : exec.status === 'FAILED' ? 'red' : 'yellow'}>
                {exec.status}
              </Text>
            </Box>
            <Text>{exec.name || exec.command || '(unnamed)'}</Text>
          </Box>
        ))
      )}
      <Text> </Text>
      <Text color="gray">Press Esc to return to chat.</Text>
    </Box>
  );

  // Render sessions view
  const renderSessionsView = () => (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text>{colors.accent('CHAT SESSIONS')}</Text>
      </Box>
      {sessions.length === 0 ? (
        <Text color="gray">No sessions found.</Text>
      ) : (
        sessions.slice(0, 10).map((sess: any) => (
          <Box key={sess.id}>
            <Box width={38}><Text color="cyan">{sess.id}</Text></Box>
            <Box width={8}><Text color="gray">{sess.messageCount ?? 0} msgs</Text></Box>
            <Text color="gray">{sess.updatedAt ? new Date(sess.updatedAt).toLocaleDateString() : ''}</Text>
          </Box>
        ))
      )}
      <Text> </Text>
      <Text color="gray">Press Esc to return to chat.</Text>
    </Box>
  );

  // Render schedules view
  const renderSchedulesView = () => (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text>{colors.accent('SCHEDULED TASKS')}</Text>
      </Box>
      {schedules.length === 0 ? (
        <Text color="gray">No schedules found.</Text>
      ) : (
        schedules.map((sched: any) => (
          <Box key={sched.id}>
            <Box width={3}>
              <Text color={sched.enabled ? 'green' : 'gray'}>{sched.enabled ? '●' : '○'}</Text>
            </Box>
            <Box width={20}><Text>{sched.name}</Text></Box>
            <Box width={10}><Text color="gray">{sched.type}</Text></Box>
            <Text color="gray">{sched.expression}</Text>
          </Box>
        ))
      )}
      <Text> </Text>
      <Text color="gray">Press Esc to return to chat.</Text>
    </Box>
  );

  // Render AI config view
  const renderConfigView = () => (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text>{colors.accent('AI CONFIGURATION')}</Text>
      </Box>
      {!aiConfig ? (
        <Text color="gray">Loading...</Text>
      ) : (
        <>
          <Box>
            <Box width={16}><Text color="gray">Provider:</Text></Box>
            <Text>{aiConfig.provider ?? 'unknown'}</Text>
          </Box>
          <Box>
            <Box width={16}><Text color="gray">Model:</Text></Box>
            <Text>{aiConfig.model ?? 'unknown'}</Text>
          </Box>
          {aiConfig.temperature !== undefined && (
            <Box>
              <Box width={16}><Text color="gray">Temperature:</Text></Box>
              <Text>{aiConfig.temperature}</Text>
            </Box>
          )}
          {aiConfig.maxTokens !== undefined && (
            <Box>
              <Box width={16}><Text color="gray">Max Tokens:</Text></Box>
              <Text>{aiConfig.maxTokens}</Text>
            </Box>
          )}
        </>
      )}
      <Text> </Text>
      <Text color="gray">Press Esc to return to chat.</Text>
    </Box>
  );

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Header
        health={health}
        skills={skills}
        connected={connected}
        url={config.url}
      />

      {/* Main content area */}
      <Box flexDirection="column" flexGrow={1}>
        {viewMode === 'help' && <HelpView />}
        {viewMode === 'skills' && <SkillsList skills={skills} customSkills={customSkills} />}
        {viewMode === 'status' && renderStatusView()}
        {viewMode === 'executions' && renderExecutionsView()}
        {viewMode === 'sessions' && renderSessionsView()}
        {viewMode === 'schedules' && renderSchedulesView()}
        {viewMode === 'config' && renderConfigView()}

        {viewMode === 'chat' && (
          <>
            {/* Chat messages */}
            {messages.map(msg => (
              <ChatMessage
                key={msg.id}
                message={msg}
                model={health?.model}
              />
            ))}

            {/* Streaming content */}
            {streamingContent && (
              <StreamingMessage
                content={streamingContent}
                model={health?.model}
              />
            )}

            {/* Active tool call */}
            {currentToolCall && (
              <ToolCall
                toolCall={currentToolCall}
                agentName={health?.agentName}
              />
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <Box marginY={1}>
            <Text>{colors.error(`Error: ${error}`)}</Text>
          </Box>
        )}
      </Box>

      {/* Command menu (shown above input when typing /) */}
      {showCommandMenu && (
        <CommandMenu
          commands={slashCommands}
          filter={inputValue}
          selectedIndex={menuIndex}
          onSelect={(cmd) => cmd.action()}
        />
      )}

      {/* Input */}
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        disabled={isStreaming}
        processing={isConnecting}
      />

      {/* Status bar */}
      <StatusBar
        health={health}
        skills={skills}
        connected={connected}
        url={config.url}
      />
    </Box>
  );
}
