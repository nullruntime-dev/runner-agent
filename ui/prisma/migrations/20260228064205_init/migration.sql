-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "shell" TEXT,
    "workingDir" TEXT,
    "exitCode" INTEGER,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Execution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Step" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "executionId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "run" TEXT NOT NULL,
    "status" TEXT,
    "exitCode" INTEGER,
    "output" TEXT,
    "error" TEXT,
    "continueOnError" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "Step_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "executionId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "stream" TEXT NOT NULL DEFAULT 'stdout',
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "LogLine_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Execution_agentId_idx" ON "Execution"("agentId");

-- CreateIndex
CREATE INDEX "Execution_status_idx" ON "Execution"("status");

-- CreateIndex
CREATE INDEX "Execution_createdAt_idx" ON "Execution"("createdAt");

-- CreateIndex
CREATE INDEX "Step_executionId_idx" ON "Step"("executionId");

-- CreateIndex
CREATE INDEX "LogLine_executionId_idx" ON "LogLine"("executionId");

-- CreateIndex
CREATE INDEX "LogLine_createdAt_idx" ON "LogLine"("createdAt");
