import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';
import type { ToolCall as ToolCallType } from '../api/types.js';

interface ToolCallProps {
  toolCall: ToolCallType;
  agentName?: string;
}

export function ToolCall({ toolCall, agentName }: ToolCallProps) {
  const { name, output, exitCode, status } = toolCall;

  const statusIcon = status === 'running' ? '▸' : (exitCode === 0 ? '✓' : '✗');
  const statusColor = status === 'running' ? 'yellow' : (exitCode === 0 ? 'green' : 'red');

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Header */}
      <Box>
        <Text color="gray">╭─ </Text>
        <Text color={statusColor}>{statusIcon} </Text>
        <Text color="cyan" bold>{name}</Text>
        {agentName && <Text color="gray">  agent: {agentName}</Text>}
        <Text color="gray"> ─╮</Text>
      </Box>

      {/* Output */}
      {output && (
        <Box paddingLeft={1} flexDirection="column">
          <Text color="gray">│ </Text>
          <Text wrap="wrap">{output.slice(0, 500)}</Text>
          {output.length > 500 && <Text color="gray">... (truncated)</Text>}
        </Box>
      )}

      {/* Running indicator */}
      {status === 'running' && !output && (
        <Box paddingLeft={1}>
          <Text color="gray">│ </Text>
          <Spinner label="executing..." />
        </Box>
      )}

      {/* Footer */}
      <Box>
        <Text color="gray">╰─ </Text>
        {status === 'running' ? (
          <Spinner />
        ) : (
          <Text color={statusColor}>{statusIcon} exit {exitCode ?? '?'}</Text>
        )}
        <Text color="gray"> ─╯</Text>
      </Box>
    </Box>
  );
}
