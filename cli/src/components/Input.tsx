import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { Spinner } from './Spinner.js';
import { colors, icons } from '../utils/colors.js';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  processing?: boolean;
  placeholder?: string;
}

export function Input({
  value,
  onChange,
  onSubmit,
  disabled,
  processing,
  placeholder,
}: InputProps) {
  const getDisabledContent = () => {
    if (processing) {
      return <Spinner label="thinking..." />;
    }
    return <Spinner label="streaming response..." />;
  };

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Input line */}
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text>{colors.accent(icons.arrow)} </Text>
        {disabled ? (
          getDisabledContent()
        ) : (
          <TextInput
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            placeholder={placeholder ?? 'ask the agent, or type a command... ( /help )'}
          />
        )}
        <Box flexGrow={1} />
        <Text>{colors.textDim(`${icons.enter} run`)}</Text>
      </Box>

      {/* Hints line */}
      <Box paddingX={1}>
        <Box marginRight={2}>
          <Text color="gray">[</Text>
          <Text color="cyan">/</Text>
          <Text color="gray">] commands</Text>
        </Box>
        <Box marginRight={2}>
          <Text color="gray">[</Text>
          <Text color="yellow">↑</Text>
          <Text color="gray">] [</Text>
          <Text color="yellow">↓</Text>
          <Text color="gray">] history</Text>
        </Box>
        <Box marginRight={2}>
          <Text color="gray">[</Text>
          <Text color="yellow">Tab</Text>
          <Text color="gray">] complete</Text>
        </Box>
        <Box marginRight={2}>
          <Text color="gray">[</Text>
          <Text color="yellow">esc</Text>
          <Text color="gray">] skip stream</Text>
        </Box>
      </Box>
    </Box>
  );
}
