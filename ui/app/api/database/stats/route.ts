import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const [agents, executions, steps, logLines] = await Promise.all([
      prisma.agent.count(),
      prisma.execution.count(),
      prisma.step.count(),
      prisma.logLine.count(),
    ]);

    return NextResponse.json({
      counts: { agents, executions, steps, logLines },
    });
  } catch (error) {
    console.error('Database stats failed:', error);
    return NextResponse.json(
      { error: 'Failed to read database stats' },
      { status: 500 }
    );
  }
}
