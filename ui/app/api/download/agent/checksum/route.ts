import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';

const JAR_PATHS = [
  path.join(process.cwd(), 'downloads', 'runner-agent.jar'),
  path.join(process.cwd(), '..', 'build', 'libs', 'runner-agent.jar'),
  path.join(process.cwd(), '..', 'build', 'libs', 'agent-0.1.0-SNAPSHOT.jar'),
];

async function findJarFile(): Promise<string | null> {
  for (const jarPath of JAR_PATHS) {
    try {
      await stat(jarPath);
      return jarPath;
    } catch {
      // File doesn't exist, try next path
    }
  }
  return null;
}

export async function GET() {
  try {
    const jarPath = await findJarFile();

    if (!jarPath) {
      return NextResponse.json(
        { error: 'JAR file not found' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(jarPath);
    const stats = await stat(jarPath);

    // Calculate checksums
    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
    const md5 = createHash('md5').update(fileBuffer).digest('hex');

    return NextResponse.json({
      filename: 'runner-agent.jar',
      size: stats.size,
      sizeFormatted: formatBytes(stats.size),
      modified: stats.mtime.toISOString(),
      checksums: {
        sha256,
        md5,
      },
      verification: {
        sha256: `echo "${sha256}  runner-agent.jar" | sha256sum -c`,
        md5: `echo "${md5}  runner-agent.jar" | md5sum -c`,
      },
    });
  } catch (error) {
    console.error('Failed to calculate checksum:', error);
    return NextResponse.json(
      { error: 'Failed to calculate checksum' },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
