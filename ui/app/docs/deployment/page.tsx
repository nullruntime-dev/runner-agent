import Link from 'next/link';
import { CodeBlock } from '../components';

export default function DeploymentPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Deployment</h1>
      <p className="text-neutral-400 mb-8">
        Deploy Runner Agent in production environments.
      </p>

      {/* Agent Download Section */}
      <h2 className="text-xl font-bold text-white mb-4">Agent: Download JAR</h2>
      <p className="text-neutral-400 mb-4">
        Download the pre-built JAR file and run it directly with Java 21+.
      </p>

      <div className="bg-neutral-900 border border-neutral-800 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-white">runner-agent.jar</div>
            <div className="text-xs text-neutral-500 mt-1">Requires Java 21 or higher</div>
          </div>
          <Link
            href="/api/download/agent"
            className="h-10 px-6 bg-white hover:bg-neutral-200 text-neutral-900 text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            DOWNLOAD JAR
          </Link>
        </div>
        <div className="text-xs text-neutral-600">
          Verify: <code className="text-neutral-500">curl -s /api/download/agent/checksum</code>
        </div>
      </div>

      <CodeBlock language="bash">
{`# Download
curl -o runner-agent.jar http://control-center:3000/api/download/agent

# Run
AGENT_TOKEN=your-secret-token java -jar runner-agent.jar

# Run with options
AGENT_TOKEN=your-secret-token java -jar runner-agent.jar \\
  --server.port=8090 \\
  --agent.working-dir=/opt/workspace`}
      </CodeBlock>

      <h3 className="text-md font-medium text-neutral-200 mb-3 mt-6">Install Java 21</h3>
      <CodeBlock language="bash">
{`# Ubuntu/Debian
sudo apt update && sudo apt install -y openjdk-21-jre-headless

# RHEL/CentOS/Fedora
sudo dnf install -y java-21-openjdk-headless

# Arch Linux
sudo pacman -S jre21-openjdk-headless

# macOS
brew install openjdk@21`}
      </CodeBlock>

      {/* Agent systemd */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">Agent: systemd Service</h2>
      <CodeBlock language="bash">
{`# Download and install
sudo mkdir -p /opt/runner-agent
cd /opt/runner-agent
sudo curl -o runner-agent.jar http://control-center:3000/api/download/agent

# Create user
sudo useradd -r -s /bin/false runner
sudo chown -R runner:runner /opt/runner-agent`}
      </CodeBlock>

      <CodeBlock language="ini" className="mt-4">
{`# /etc/systemd/system/runner-agent.service
[Unit]
Description=Runner Agent
After=network.target

[Service]
Type=simple
User=runner
WorkingDirectory=/opt/runner-agent
ExecStart=/usr/bin/java -jar runner-agent.jar
Restart=always
RestartSec=5
Environment=AGENT_TOKEN=your-secret-token

[Install]
WantedBy=multi-user.target`}
      </CodeBlock>

      <CodeBlock language="bash" className="mt-4">
{`sudo systemctl daemon-reload
sudo systemctl enable runner-agent
sudo systemctl start runner-agent`}
      </CodeBlock>

      {/* Agent Docker */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">Agent: Docker</h2>
      <CodeBlock language="bash">
{`docker run -d \\
  --name runner-agent \\
  -e AGENT_TOKEN=your-secret-token \\
  -p 8090:8090 \\
  -v /opt/agent-data:/app \\
  runner-agent`}
      </CodeBlock>

      {/* Control Center Docker */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">Control Center: Docker</h2>
      <CodeBlock language="dockerfile">
{`FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "server.js"]`}
      </CodeBlock>

      <CodeBlock language="bash" className="mt-4">
{`docker build -t runner-control-center .

docker run -d \\
  --name control-center \\
  -p 3000:3000 \\
  -v /opt/runner-data:/app/data \\
  runner-control-center`}
      </CodeBlock>

      {/* Control Center systemd */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">Control Center: systemd</h2>
      <CodeBlock language="ini">
{`# /etc/systemd/system/runner-control-center.service
[Unit]
Description=Runner Agent Control Center
After=network.target

[Service]
Type=simple
User=runner
WorkingDirectory=/opt/runner-ui
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target`}
      </CodeBlock>

      <CodeBlock language="bash" className="mt-4">
{`# Build and deploy
npm run build
sudo cp -r .next/standalone /opt/runner-ui
sudo cp -r .next/static /opt/runner-ui/.next/static
sudo cp -r public /opt/runner-ui/public
sudo mkdir -p /opt/runner-ui/data

sudo systemctl daemon-reload
sudo systemctl enable runner-control-center
sudo systemctl start runner-control-center`}
      </CodeBlock>
    </div>
  );
}
