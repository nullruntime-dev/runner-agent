import React from 'react';
import { Box, Text } from 'ink';
import { colors, icons } from '../utils/colors.js';
import type { HealthResponse, SkillsResponse } from '../api/types.js';

interface HeaderProps {
  health: HealthResponse | null;
  skills: SkillsResponse | null;
  connected: boolean;
  url: string;
}

export function Header({ health, skills, connected, url }: HeaderProps) {
  // Count skills - skills is now an array
  const skillList = skills ?? [];
  const enabledSkills = skillList.filter(s => s.enabled && !s.hidden);
  const configuredSkills = enabledSkills.filter(s => s.configured);
  const enabledCount = enabledSkills.length;
  const configuredCount = configuredSkills.length;
  const totalCount = skillList.filter(s => !s.hidden).length;

  const statusIcon = connected ? colors.success(icons.connected) : colors.error(icons.disconnected);
  const agentName = health?.agentName ?? 'unknown';
  const provider = health?.provider ?? 'unknown';
  const model = health?.model ?? 'unknown';
  const shell = health?.defaultShell ?? '/bin/sh';
  const cwd = health?.workingDir ?? '/tmp';

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Logo line */}
      <Box>
        <Text>{colors.primary(icons.logo)} </Text>
        <Text bold>{colors.primary('GRIPHOOK')} </Text>
        <Text>{colors.textMuted('cli')}</Text>
      </Box>

      {/* Tagline */}
      <Box>
        <Text>{colors.textDim('agent control center · v0.1.0')}</Text>
      </Box>

      <Text> </Text>

      {/* Status line 1: agent + provider */}
      <Box>
        <Text>{colors.textDim('agent   ')}</Text>
        <Text>{statusIcon} </Text>
        <Text>{colors.text(agentName)} </Text>
        <Text>{colors.textMuted(url)}</Text>
        <Text>    </Text>
        <Text>{colors.textDim('provider ')}</Text>
        <Text>{colors.accent(provider)}</Text>
        <Text>{colors.textDim(' · ')}</Text>
        <Text>{colors.text(model)}</Text>
      </Box>

      {/* Status line 2: shell + skills */}
      <Box>
        <Text>{colors.textDim('shell   ')}</Text>
        <Text>{colors.text(shell)}</Text>
        <Text>    </Text>
        <Text>{colors.textDim('cwd  ')}</Text>
        <Text>{colors.text(cwd)}</Text>
        <Text>              </Text>
        <Text>{colors.textDim('skills   ')}</Text>
        <Text>{colors.text(`${enabledCount}/${totalCount} enabled`)}</Text>
        <Text>{colors.textDim(' · ')}</Text>
        <Text>{colors.success(`${configuredCount} ready`)}</Text>
        <Text>{colors.textDim(' / ')}</Text>
        <Text>{colors.warning(`${enabledCount - configuredCount} need setup`)}</Text>
      </Box>

      <Text> </Text>

      {/* Help hint */}
      <Box>
        <Text>{colors.textDim('type ')}</Text>
        <Text>{colors.accent('/help')}</Text>
        <Text>{colors.textDim(' for the command reference, or just ask the agent in plain English.')}</Text>
      </Box>
    </Box>
  );
}
