import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../utils/colors.js';

export interface SlashCommand {
  name: string;
  description: string;
  action: () => void;
}

interface CommandMenuProps {
  commands: SlashCommand[];
  filter: string;
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
}

export function CommandMenu({ commands, filter, selectedIndex }: CommandMenuProps) {
  // Filter commands based on input after "/"
  const filterText = filter.startsWith('/') ? filter.slice(1).toLowerCase() : '';
  const filtered = commands.filter(cmd =>
    cmd.name.toLowerCase().includes(filterText)
  );

  if (filtered.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text>{colors.accent('SLASH COMMANDS')}</Text>
        <Text>{colors.textDim(' (in session)')}</Text>
      </Box>

      {filtered.map((cmd, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Box key={cmd.name}>
            <Box width={16}>
              <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                {isSelected ? ' ' : ' '}/{cmd.name}
              </Text>
            </Box>
            <Text color={isSelected ? 'cyan' : 'gray'}>
              {cmd.description}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

export function getFilteredCommands(commands: SlashCommand[], filter: string): SlashCommand[] {
  const filterText = filter.startsWith('/') ? filter.slice(1).toLowerCase() : '';
  return commands.filter(cmd =>
    cmd.name.toLowerCase().includes(filterText)
  );
}
