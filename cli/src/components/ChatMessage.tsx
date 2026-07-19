import React from 'react';
import { Box, Text } from 'ink';
import { colors, icons } from '../utils/colors.js';
import { renderMarkdown } from '../utils/markdown.js';
import type { ChatMessage as ChatMessageType } from '../api/types.js';

interface ChatMessageProps {
  message: ChatMessageType;
  model?: string;
}

export function ChatMessage({ message, model }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <Box marginY={1}>
        <Text>{colors.accent(icons.arrow)} </Text>
        <Text wrap="wrap">{message.content}</Text>
      </Box>
    );
  }

  // Agent message - render markdown
  const rendered = renderMarkdown(message.content);

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Agent header */}
      <Box>
        <Text>{colors.primary(icons.logo)} </Text>
        <Text bold color="magenta">griphook </Text>
        <Text color="gray">{model ?? 'agent'}</Text>
      </Box>

      {/* Message content */}
      <Box marginLeft={3} flexDirection="column">
        <Text wrap="wrap">{rendered}</Text>
      </Box>
    </Box>
  );
}

// Streaming message (partial content)
interface StreamingMessageProps {
  content: string;
  model?: string;
}

export function StreamingMessage({ content, model }: StreamingMessageProps) {
  if (!content) return null;

  // Don't render markdown during streaming - too expensive
  // Just show raw text with cursor
  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text>{colors.primary(icons.logo)} </Text>
        <Text bold color="magenta">griphook </Text>
        <Text color="gray">{model ?? 'agent'}</Text>
      </Box>
      <Box marginLeft={3} flexDirection="column">
        <Text wrap="wrap">{content}<Text color="cyan">▌</Text></Text>
      </Box>
    </Box>
  );
}
