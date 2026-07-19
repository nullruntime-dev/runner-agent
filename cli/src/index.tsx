#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { App } from './app.js';
import { getConfig } from './config/config.js';
import { ApiClient } from './api/client.js';
import { renderMarkdown } from './utils/markdown.js';
import chalk from 'chalk';

const program = new Command();

// One-shot mode: simple text output (no Ink, works without TTY)
async function oneShot(message: string, url: string, token: string) {
  const client = new ApiClient({ baseUrl: url, token });

  console.log(chalk.cyan('›') + ' ' + message);
  console.log();
  console.log(chalk.magenta('[G]') + chalk.bold.magenta(' griphook'));
  process.stdout.write(chalk.gray('   thinking'));

  const sessionId = `oneshot-${Date.now()}`;
  let content = '';
  let dotCount = 0;

  return new Promise<void>((resolve) => {
    client.chatStream(
      message,
      sessionId,
      (event) => {
        if (event.type === 'content') {
          content += event.data;
          // Animate dots while streaming
          dotCount++;
          const dots = '.'.repeat((dotCount % 3) + 1);
          process.stdout.write(`\r${chalk.gray('   thinking' + dots.padEnd(3))}`);
        } else if (event.type === 'function_call') {
          // Clear thinking line, show tool
          process.stdout.write('\r\x1b[K');
          console.log(chalk.yellow('   ▸ ' + (event.toolName ?? 'tool') + '...'));
          process.stdout.write(chalk.gray('   thinking'));
        } else if (event.type === 'function_response') {
          process.stdout.write('\r\x1b[K');
          console.log(chalk.green('   ✓ ' + (event.toolName ?? 'tool')));
          process.stdout.write(chalk.gray('   thinking'));
        } else if (event.type === 'done') {
          // Clear thinking line and render formatted output
          process.stdout.write('\r\x1b[K');
          if (content) {
            console.log(renderMarkdown(content));
          }
          console.log();
          resolve();
        }
      },
      (error) => {
        process.stdout.write('\r\x1b[K');
        console.error(chalk.red('Error: ' + error.message));
        process.exit(1);
      },
    );
  });
}

program
  .name('griphook')
  .description('Rich terminal UI for runner-agent')
  .version('0.1.0')
  .option('-u, --url <url>', 'Server URL (env: GRIPHOOK_URL)')
  .option('-t, --token <token>', 'Auth token (env: AGENT_TOKEN)')
  .option('-s, --session <id>', 'Resume session')
  .option('-c, --continue', 'Continue last session')
  .option('--no-stream', 'Disable streaming')
  .option('--simple', 'Use simple text mode (no TUI)')
  .argument('[message]', 'Message to send (one-shot mode)')
  .action(async (message, options) => {
    const config = getConfig();

    const url = options.url ?? config.url;
    const token = options.token ?? config.token;
    const sessionId = options.session;
    const continueSession = options.continue;
    const noStream = options.noStream ?? false;

    // One-shot mode: send message and exit (simple text output)
    // Use simple mode if: message provided without session flags, or --simple, or no TTY
    const isTTY = process.stdin.isTTY && process.stdout.isTTY;
    const useSimple = options.simple || (!isTTY && message);

    if (message && useSimple) {
      await oneShot(message, url, token);
      process.exit(0);
    }

    // Interactive TUI mode
    if (!isTTY) {
      console.error(chalk.red('Interactive mode requires a TTY. Use --simple or provide a message.'));
      process.exit(1);
    }

    render(
      <App
        url={url}
        token={token}
        sessionId={sessionId}
        continueSession={continueSession}
        message={message}
        noStream={noStream}
      />,
    );
  });

program.parse();
