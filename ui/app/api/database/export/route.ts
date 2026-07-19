import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';

const DB_PATH = path.join(process.cwd(), 'data', 'runner.db');

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get('format') ?? 'json';

  try {
    if (format === 'sqlite') {
      const buf = await readFile(DB_PATH);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'application/x-sqlite3',
          'Content-Disposition': `attachment; filename="griphook-db-${timestamp()}.db"`,
          'Content-Length': String(buf.byteLength),
          'Cache-Control': 'no-store',
        },
      });
    }

    // Default: JSON dump
    const [agents, executions, steps, logLines] = await Promise.all([
      prisma.agent.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.execution.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.step.findMany({ orderBy: { id: 'asc' } }),
      prisma.logLine.findMany({ orderBy: { id: 'asc' } }),
    ]);

    // Strip tokens from export — they are secrets
    const safeAgents = agents.map(({ token: _token, ...rest }) => ({ ...rest, token: '' }));

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      counts: {
        agents: agents.length,
        executions: executions.length,
        steps: steps.length,
        logLines: logLines.length,
      },
      data: {
        agents: safeAgents,
        executions,
        steps,
        logLines,
      },
    };

    const json = JSON.stringify(payload, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="griphook-db-${timestamp()}.json"`,
        'Content-Length': String(Buffer.byteLength(json, 'utf-8')),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Database export failed:', error);
    return NextResponse.json(
      { error: 'Database export failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
