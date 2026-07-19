import chalk from 'chalk';

// Theme colors
export const colors = {
  // Primary
  primary: chalk.hex('#8B5CF6'),      // Purple
  secondary: chalk.hex('#6366F1'),    // Indigo
  accent: chalk.hex('#22D3EE'),       // Cyan

  // Status
  success: chalk.hex('#22C55E'),      // Green
  error: chalk.hex('#EF4444'),        // Red
  warning: chalk.hex('#F59E0B'),      // Amber
  info: chalk.hex('#3B82F6'),         // Blue

  // Text
  text: chalk.hex('#E5E7EB'),         // Light gray
  textMuted: chalk.hex('#9CA3AF'),    // Gray
  textDim: chalk.hex('#6B7280'),      // Dark gray

  // Borders
  border: chalk.hex('#374151'),       // Gray border
  borderFocus: chalk.hex('#8B5CF6'),  // Purple border

  // Backgrounds (for contrast text)
  bgPrimary: chalk.bgHex('#8B5CF6'),
  bgError: chalk.bgHex('#EF4444'),
  bgSuccess: chalk.bgHex('#22C55E'),
};

// Box drawing characters
export const box = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  teeRight: '├',
  teeLeft: '┤',
};

// Icons
export const icons = {
  logo: '[G]',
  connected: '●',
  disconnected: '○',
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  pending: '◌',
  running: '▸',
  arrow: '›',
  enter: '⏎',
  tab: '⇥',
  escape: 'esc',
};
