import React from 'react';
import { Box, Text } from 'ink';
import { colors, icons } from '../utils/colors.js';
import type { SkillsResponse, CustomSkill } from '../api/types.js';

interface SkillsListProps {
  skills: SkillsResponse | null;
  customSkills?: CustomSkill[];
}

export function SkillsList({ skills, customSkills }: SkillsListProps) {
  const hasSkills = (skills && skills.length > 0) || (customSkills && customSkills.length > 0);

  if (!hasSkills) {
    return (
      <Box marginY={1}>
        <Text>{colors.textDim('No skills data available')}</Text>
      </Box>
    );
  }

  // Filter out hidden skills
  const visibleSkills = skills?.filter(s => !s.hidden) ?? [];
  const visibleCustom = customSkills?.filter(s => !s.hidden) ?? [];

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Built-in Skills */}
      {visibleSkills.length > 0 && (
        <>
          <Box marginBottom={1}>
            <Text>{colors.accent('BUILT-IN SKILLS')}</Text>
            <Text>{colors.textDim(` (${visibleSkills.length})`)}</Text>
          </Box>

          {visibleSkills.map(skill => {
            const statusIcon = skill.enabled && skill.configured
              ? colors.success(icons.success)
              : skill.enabled
                ? colors.warning('◐')
                : colors.textDim(icons.pending);
            const statusText = skill.enabled && skill.configured
              ? 'ready'
              : skill.enabled
                ? 'not configured'
                : 'disabled';

            return (
              <Box key={skill.name}>
                <Text>{statusIcon} </Text>
                <Box width={16}>
                  <Text color={skill.enabled ? undefined : 'gray'}>{skill.displayName || skill.name}</Text>
                </Box>
                <Text color={skill.configured ? 'green' : (skill.enabled ? 'yellow' : 'gray')}>
                  {statusText}
                </Text>
              </Box>
            );
          })}
        </>
      )}

      {/* Custom Skills */}
      {visibleCustom.length > 0 && (
        <>
          <Text> </Text>
          <Box marginBottom={1}>
            <Text>{colors.accent('CUSTOM SKILLS')}</Text>
            <Text>{colors.textDim(` (${visibleCustom.length})`)}</Text>
          </Box>

          {visibleCustom.map(skill => {
            const statusIcon = skill.enabled
              ? colors.success(icons.success)
              : colors.textDim(icons.pending);

            return (
              <Box key={skill.name}>
                <Text>{statusIcon} </Text>
                <Box width={24}>
                  <Text color={skill.enabled ? undefined : 'gray'}>{skill.displayName || skill.name}</Text>
                </Box>
                <Text color="gray">{skill.type}</Text>
              </Box>
            );
          })}
        </>
      )}

      <Text> </Text>
      <Text color="gray">Press Esc to return to chat.</Text>
    </Box>
  );
}
