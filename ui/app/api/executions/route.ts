import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agentId = searchParams.get('agentId');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const executions = await prisma.execution.findMany({
      where: {
        ...(agentId && { agentId }),
        ...(status && { status }),
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Format response
    const formatted = executions.map((exec) => ({
      id: exec.id,
      name: exec.name,
      status: exec.status,
      shell: exec.shell,
      workingDir: exec.workingDir,
      exitCode: exec.exitCode,
      error: exec.error,
      startedAt: exec.startedAt?.toISOString() || null,
      completedAt: exec.completedAt?.toISOString() || null,
      createdAt: exec.createdAt.toISOString(),
      agentId: exec.agent.id,
      agentName: exec.agent.name,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Failed to fetch executions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch executions' },
      { status: 500 }
    );
  }
}
