import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface ImportAgent {
  id: string;
  name: string;
  url: string;
  token?: string;
  createdAt: string;
  updatedAt: string;
}

interface ImportExecution {
  id: string;
  agentId: string;
  name: string;
  status: string;
  shell: string | null;
  workingDir: string | null;
  exitCode: number | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

interface ImportStep {
  id: number;
  executionId: string;
  stepIndex: number;
  name: string;
  run: string;
  status: string | null;
  exitCode: number | null;
  output: string | null;
  error: string | null;
  continueOnError: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

interface ImportLogLine {
  id: number;
  executionId: string;
  stepName: string;
  line: string;
  stream: string;
  createdAt: string;
}

interface ImportPayload {
  version?: number;
  data: {
    agents: ImportAgent[];
    executions: ImportExecution[];
    steps: ImportStep[];
    logLines: ImportLogLine[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ImportPayload;

    if (!body || !body.data || !Array.isArray(body.data.agents)) {
      return NextResponse.json(
        { error: 'Invalid file format. Expected a JSON export with { data: { agents, executions, steps, logLines } }.' },
        { status: 400 }
      );
    }

    const { agents = [], executions = [], steps = [], logLines = [] } = body.data;

    // Wipe and re-insert in FK-safe order.
    // Using a transaction so partial imports can't leave the DB in a broken state.
    const result = await prisma.$transaction(async (tx) => {
      await tx.logLine.deleteMany();
      await tx.step.deleteMany();
      await tx.execution.deleteMany();
      await tx.agent.deleteMany();

      let agentsImported = 0;
      for (const a of agents) {
        await tx.agent.create({
          data: {
            id: a.id,
            name: a.name,
            url: a.url,
            // Tokens are stripped from exports; allow user to leave blank to keep DB-only
            token: a.token ?? '',
            createdAt: new Date(a.createdAt),
            updatedAt: new Date(a.updatedAt),
          },
        });
        agentsImported++;
      }

      let executionsImported = 0;
      for (const e of executions) {
        await tx.execution.create({
          data: {
            id: e.id,
            agentId: e.agentId,
            name: e.name,
            status: e.status,
            shell: e.shell,
            workingDir: e.workingDir,
            exitCode: e.exitCode,
            error: e.error,
            startedAt: e.startedAt ? new Date(e.startedAt) : null,
            completedAt: e.completedAt ? new Date(e.completedAt) : null,
            createdAt: new Date(e.createdAt),
            updatedAt: new Date(e.updatedAt),
            syncedAt: new Date(e.syncedAt),
          },
        });
        executionsImported++;
      }

      let stepsImported = 0;
      for (const s of steps) {
        await tx.step.create({
          data: {
            id: s.id,
            executionId: s.executionId,
            stepIndex: s.stepIndex,
            name: s.name,
            run: s.run,
            status: s.status,
            exitCode: s.exitCode,
            output: s.output,
            error: s.error,
            continueOnError: s.continueOnError ?? false,
            startedAt: s.startedAt ? new Date(s.startedAt) : null,
            completedAt: s.completedAt ? new Date(s.completedAt) : null,
          },
        });
        stepsImported++;
      }

      let logsImported = 0;
      for (const l of logLines) {
        await tx.logLine.create({
          data: {
            id: l.id,
            executionId: l.executionId,
            stepName: l.stepName,
            line: l.line,
            stream: l.stream,
            createdAt: new Date(l.createdAt),
          },
        });
        logsImported++;
      }

      return { agentsImported, executionsImported, stepsImported, logsImported };
    });

    return NextResponse.json({
      success: true,
      imported: result,
      message: `Imported ${result.agentsImported} agents, ${result.executionsImported} executions, ${result.stepsImported} steps, ${result.logsImported} log lines. Note: agent tokens were stripped from the export — re-enter them in Manage Agents if needed.`,
    });
  } catch (error) {
    console.error('Database import failed:', error);
    return NextResponse.json(
      { error: 'Database import failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
