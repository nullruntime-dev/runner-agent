import prisma from './db';

export interface Agent {
  id: string;
  name: string;
  url: string;
  token: string;
  status?: 'online' | 'offline' | 'unknown';
  createdAt?: Date;
}

export async function getAgents(): Promise<Agent[]> {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return agents;
}

export async function getAgent(id: string): Promise<Agent | null> {
  const agent = await prisma.agent.findUnique({
    where: { id },
  });
  return agent;
}

export async function addAgent(agent: { name: string; url: string; token: string }): Promise<Agent> {
  const newAgent = await prisma.agent.create({
    data: {
      name: agent.name,
      url: agent.url,
      token: agent.token,
    },
  });
  return newAgent;
}

export async function removeAgent(id: string): Promise<void> {
  await prisma.agent.delete({
    where: { id },
  });
}

export async function updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | null> {
  const agent = await prisma.agent.update({
    where: { id },
    data: updates,
  });
  return agent;
}

export async function checkAgentHealth(agent: Agent): Promise<boolean> {
  try {
    const response = await fetch(`${agent.url}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Sync executions from an agent to local database
export async function syncAgentExecutions(agent: Agent): Promise<number> {
  try {
    const response = await fetch(`${agent.url}/executions?limit=100`, {
      headers: { Authorization: `Bearer ${agent.token}` },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return 0;

    const executions = await response.json();
    let synced = 0;

    for (const exec of executions) {
      await prisma.execution.upsert({
        where: { id: exec.id },
        create: {
          id: exec.id,
          agentId: agent.id,
          name: exec.name,
          status: exec.status,
          shell: exec.shell,
          workingDir: exec.workingDir,
          exitCode: exec.exitCode,
          error: exec.error,
          startedAt: exec.startedAt ? new Date(exec.startedAt) : null,
          completedAt: exec.completedAt ? new Date(exec.completedAt) : null,
          createdAt: new Date(exec.createdAt),
        },
        update: {
          name: exec.name,
          status: exec.status,
          exitCode: exec.exitCode,
          error: exec.error,
          startedAt: exec.startedAt ? new Date(exec.startedAt) : null,
          completedAt: exec.completedAt ? new Date(exec.completedAt) : null,
          syncedAt: new Date(),
        },
      });
      synced++;
    }

    return synced;
  } catch (error) {
    console.error(`Failed to sync executions from ${agent.name}:`, error);
    return 0;
  }
}

// Sync full execution details including steps
export async function syncExecutionDetails(agent: Agent, executionId: string): Promise<boolean> {
  try {
    const response = await fetch(`${agent.url}/execution/${executionId}`, {
      headers: { Authorization: `Bearer ${agent.token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return false;

    const exec = await response.json();

    // Update execution
    await prisma.execution.upsert({
      where: { id: exec.id },
      create: {
        id: exec.id,
        agentId: agent.id,
        name: exec.name,
        status: exec.status,
        shell: exec.shell,
        workingDir: exec.workingDir,
        exitCode: exec.exitCode,
        error: exec.error,
        startedAt: exec.startedAt ? new Date(exec.startedAt) : null,
        completedAt: exec.completedAt ? new Date(exec.completedAt) : null,
        createdAt: new Date(exec.createdAt),
      },
      update: {
        name: exec.name,
        status: exec.status,
        exitCode: exec.exitCode,
        error: exec.error,
        startedAt: exec.startedAt ? new Date(exec.startedAt) : null,
        completedAt: exec.completedAt ? new Date(exec.completedAt) : null,
        syncedAt: new Date(),
      },
    });

    // Sync steps
    if (exec.steps && exec.steps.length > 0) {
      // Delete existing steps and recreate
      await prisma.step.deleteMany({
        where: { executionId: exec.id },
      });

      for (const step of exec.steps) {
        await prisma.step.create({
          data: {
            executionId: exec.id,
            stepIndex: step.stepIndex,
            name: step.name,
            run: step.run,
            status: step.status,
            exitCode: step.exitCode,
            output: step.output,
            error: step.error,
            continueOnError: step.continueOnError || false,
            startedAt: step.startedAt ? new Date(step.startedAt) : null,
            completedAt: step.completedAt ? new Date(step.completedAt) : null,
          },
        });
      }
    }

    return true;
  } catch (error) {
    console.error(`Failed to sync execution ${executionId}:`, error);
    return false;
  }
}

// Store log lines from SSE stream
export async function storeLogLine(executionId: string, logLine: {
  stepName: string;
  line: string;
  stream?: string;
  createdAt: string;
}): Promise<void> {
  await prisma.logLine.create({
    data: {
      executionId,
      stepName: logLine.stepName,
      line: logLine.line,
      stream: logLine.stream || 'stdout',
      createdAt: new Date(logLine.createdAt),
    },
  });
}

// Get stored log lines for an execution
export async function getStoredLogs(executionId: string): Promise<{
  id: number;
  stepName: string;
  line: string;
  stream: string;
  createdAt: Date;
}[]> {
  return prisma.logLine.findMany({
    where: { executionId },
    orderBy: { createdAt: 'asc' },
  });
}
