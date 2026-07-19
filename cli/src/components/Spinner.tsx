import React from 'react';
import { Text } from 'ink';
import InkSpinner from 'ink-spinner';
import { colors } from '../utils/colors.js';

interface SpinnerProps {
  label?: string;
}

export function Spinner({ label }: SpinnerProps) {
  return (
    <Text>
      <Text color="cyan">
        <InkSpinner type="dots" />
      </Text>
      {label && <Text> {colors.textMuted(label)}</Text>}
    </Text>
  );
}
