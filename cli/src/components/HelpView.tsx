import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../utils/colors.js';

export function HelpView() {
  const commands = [
    { name: '/help', desc: 'Show this help' },
    { name: '/clear', desc: 'Clear chat history' },
    { name: '/new', desc: 'Start new session' },
    { name: '/sessions', desc: 'List chat sessions' },
    { name: '/skills', desc: 'List skills & status' },
    { name: '/status', desc: 'Show connection status' },
    { name: '/exec CMD', desc: 'Run command directly' },
    { name: '/logs ID', desc: 'Stream execution logs' },
    { name: '/cancel ID', desc: 'Cancel execution' },
    { name: '/exit', desc: 'Exit griphook' },
  ];

  const shortcuts = [
    { key: '/', desc: 'Show commands menu' },
    { key: '↑ ↓', desc: 'Navigate history / menu' },
    { key: 'Tab', desc: 'Complete command' },
    { key: 'Enter', desc: 'Send message / select' },
    { key: 'Esc', desc: 'Cancel stream / close menu' },
  ];

  return (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text>{colors.accent('COMMAND REFERENCE')}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>{colors.textMuted('Commands:')}</Text>
      </Box>
      {commands.map(cmd => (
        <Box key={cmd.name}>
          <Box width={16}>
            <Text color="cyan">{cmd.name}</Text>
          </Box>
          <Text color="gray">{cmd.desc}</Text>
        </Box>
      ))}

      <Text> </Text>

      <Box marginBottom={1}>
        <Text>{colors.textMuted('Shortcuts:')}</Text>
      </Box>
      {shortcuts.map(s => (
        <Box key={s.key}>
          <Box width={16}>
            <Text color="yellow">{s.key}</Text>
          </Box>
          <Text color="gray">{s.desc}</Text>
        </Box>
      ))}

      <Text> </Text>
      <Text color="gray">Type a message to chat with the agent, or use commands above.</Text>
    </Box>
  );
}
