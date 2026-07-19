import React from 'react';
import { Box, Text } from 'ink';
import { colors, icons } from '../utils/colors.js';
import type { HealthResponse, SkillsResponse } from '../api/types.js';

interface StatusBarProps {
  health: HealthResponse | null;
  skills: SkillsResponse | null;
  connected: boolean;
  url: string;
}

export function StatusBar({ health, skills, connected, url }: StatusBarProps) {
  const agentName = health?.agentName ?? 'unknown';
  const model = health?.model ?? 'unknown';
  const cwd = health?.workingDir ?? '/tmp';

  // Parse URL for display
  let host = 'localhost:8090';
  try {
    const parsed = new URL(url);
    host = parsed.host;
  } catch {
    // ignore
  }

  // Skill counts
  const healthChecks = skills?.healthChecks ?? {};
  const okCount = Object.values(healthChecks).filter(h => h.healthy).length;
  const failedCount = Object.values(healthChecks).filter(h => !h.healthy).length;

  const statusIcon = connected ? colors.success(icons.connected) : colors.error(icons.disconnected);

  return (
    <Box marginTop={1}>
      <Text>{statusIcon} </Text>
      <Text>{colors.text(agentName)}</Text>
      <Text>{colors.textDim('@')}</Text>
      <Text>{colors.text(host)}</Text>
      <Text>{colors.textDim(' · ')}</Text>
      <Text>{colors.textMuted(cwd)}</Text>
      <Box flexGrow={1} />
      <Text>{colors.success(`${icons.success} ${okCount}`)}</Text>
      <Text>  </Text>
      <Text>{colors.error(`${icons.error} ${failedCount}`)}</Text>
      <Text>{colors.textDim(' · ')}</Text>
      <Text>{colors.accent(model)}</Text>
    </Box>
  );
}
