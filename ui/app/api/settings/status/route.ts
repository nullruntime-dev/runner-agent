import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), '..', 'settings.json');

export async function GET() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const config = JSON.parse(data);
    return NextResponse.json({
      setupComplete: config.setupComplete === true,
      hasApiKey: !!config.googleAiApiKey,
      hasToken: !!config.agentToken,
    });
  } catch {
    // File doesn't exist = first time setup
    return NextResponse.json({
      setupComplete: false,
      hasApiKey: false,
      hasToken: false,
    });
  }
}
