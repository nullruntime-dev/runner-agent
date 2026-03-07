import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

const JAR_PATHS = [
  // Look in multiple possible locations
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
        {
          error: 'JAR file not found',
          message: 'The runner-agent.jar file has not been built yet. Run ./gradlew bootJar in the agent directory first, or place the JAR in ui/downloads/runner-agent.jar',
          searchedPaths: JAR_PATHS,
        },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(jarPath);
    const stats = await stat(jarPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/java-archive',
        'Content-Disposition': 'attachment; filename="runner-agent.jar"',
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Failed to serve JAR file:', error);
    return NextResponse.json(
      { error: 'Failed to serve JAR file' },
      { status: 500 }
    );
  }
}

// HEAD request to check if file exists and get size
export async function HEAD() {
  try {
    const jarPath = await findJarFile();

    if (!jarPath) {
      return new NextResponse(null, { status: 404 });
    }

    const stats = await stat(jarPath);

    return new NextResponse(null, {
      headers: {
        'Content-Type': 'application/java-archive',
        'Content-Length': stats.size.toString(),
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
