import { CodeBlock } from '../components';

export default function DeploymentPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Deployment</h1>
      <p className="text-[#888] mb-8">
        Deploy GRIPHOOK in production environments using Docker Compose, standalone JAR, or systemd services.
      </p>

      {/* Docker Compose Production */}
      <h2 className="text-xl font-bold text-white mb-4">Docker Compose (Recommended)</h2>
      <p className="text-[#888] mb-4">
        The easiest way to deploy both the agent and UI together.
      </p>

      <h3 className="text-md font-medium text-[#ccc] mb-3">Production (pre-built images)</h3>
      <CodeBlock language="bash">
{`# Clone the repository
git clone https://github.com/nullruntime-dev/runner-agent.git
cd runner-agent

# Configure environment
cp .env.example .env
nano .env  # Set AGENT_TOKEN, GOOGLE_AI_API_KEY, and other options

# Deploy with pre-built images
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop services
docker compose -f docker-compose.prod.yml down`}
      </CodeBlock>

      <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">Local Development (build from source)</h3>
      <CodeBlock language="bash">
{`# Build and run locally
docker compose -f docker-compose.local.yml up --build -d

# Rebuild after code changes
docker compose -f docker-compose.local.yml up --build -d`}
      </CodeBlock>

      <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">Docker Compose Services</h3>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left py-3 px-4 text-[#888]">Service</th>
              <th className="text-left py-3 px-4 text-[#888]">Port</th>
              <th className="text-left py-3 px-4 text-[#888]">Image</th>
              <th className="text-left py-3 px-4 text-[#888]">Description</th>
            </tr>
          </thead>
          <tbody className="text-[#ccc]">
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4"><code className="text-[#00fff2]">agent</code></td>
              <td className="py-3 px-4">8090</td>
              <td className="py-3 px-4"><code>nullruntimedev/griphook/agent</code></td>
              <td className="py-3 px-4">Backend API + AI agent (Spring Boot)</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4"><code className="text-[#00fff2]">ui</code></td>
              <td className="py-3 px-4">3000</td>
              <td className="py-3 px-4"><code>nullruntimedev/griphook/ui</code></td>
              <td className="py-3 px-4">Frontend dashboard (Next.js)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Standalone JAR */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">Standalone JAR</h2>
      <p className="text-[#888] mb-4">
        Build and run the backend as a standalone JAR file. Requires Java 21+.
      </p>

      <h3 className="text-md font-medium text-[#ccc] mb-3">Build the JAR</h3>
      <CodeBlock language="bash">
{`# Clone and build
git clone https://github.com/nullruntime-dev/runner-agent.git
cd runner-agent
./gradlew bootJar

# JAR is created at:
# build/libs/runner-agent-0.1.0-SNAPSHOT.jar`}
      </CodeBlock>

      <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">Run the JAR</h3>
      <CodeBlock language="bash">
{`# Basic run
AGENT_TOKEN=your-secret-token \\
GOOGLE_AI_API_KEY=your-google-ai-key \\
java -jar build/libs/runner-agent-0.1.0-SNAPSHOT.jar

# With custom options
java -jar build/libs/runner-agent-0.1.0-SNAPSHOT.jar \\
  --server.port=8090 \\
  --agent.working-dir=/opt/workspace \\
  --agent.default-shell=/bin/bash`}
      </CodeBlock>

      <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">Install Java 21</h3>
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

      {/* systemd Service */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">systemd Service</h2>
      <p className="text-[#888] mb-4">
        Run the agent as a systemd service for automatic startup and restart.
      </p>

      <h3 className="text-md font-medium text-[#ccc] mb-3">Install the agent</h3>
      <CodeBlock language="bash">
{`# Create directory and copy JAR
sudo mkdir -p /opt/griphook-agent
sudo cp build/libs/runner-agent-0.1.0-SNAPSHOT.jar /opt/griphook-agent/griphook-agent.jar

# Create service user
sudo useradd -r -s /bin/false griphook
sudo chown -R griphook:griphook /opt/griphook-agent`}
      </CodeBlock>

      <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">Create systemd unit file</h3>
      <CodeBlock language="ini">
{`# /etc/systemd/system/griphook-agent.service
[Unit]
Description=GRIPHOOK Agent
After=network.target

[Service]
Type=simple
User=griphook
WorkingDirectory=/opt/griphook-agent
ExecStart=/usr/bin/java -Xmx512m -jar griphook-agent.jar
Restart=always
RestartSec=5
Environment=AGENT_TOKEN=your-secret-token
Environment=GOOGLE_AI_API_KEY=your-google-ai-key
Environment=AGENT_WORKING_DIR=/opt/griphook-agent/workspace

[Install]
WantedBy=multi-user.target`}
      </CodeBlock>

      <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">Enable and start</h3>
      <CodeBlock language="bash">
{`sudo systemctl daemon-reload
sudo systemctl enable griphook-agent
sudo systemctl start griphook-agent

# Check status
sudo systemctl status griphook-agent

# View logs
sudo journalctl -u griphook-agent -f`}
      </CodeBlock>

      {/* UI Deployment */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">UI Deployment (Next.js)</h2>
      <p className="text-[#888] mb-4">
        Deploy the UI separately if not using Docker Compose.
      </p>

      <h3 className="text-md font-medium text-[#ccc] mb-3">Build for production</h3>
      <CodeBlock language="bash">
{`cd ui
npm install
npm run build

# Start production server
npm run start`}
      </CodeBlock>

      <h3 className="text-md font-medium text-[#ccc] mb-3 mt-6">UI systemd service</h3>
      <CodeBlock language="ini">
{`# /etc/systemd/system/griphook-ui.service
[Unit]
Description=GRIPHOOK UI
After=network.target

[Service]
Type=simple
User=griphook
WorkingDirectory=/opt/griphook-ui
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target`}
      </CodeBlock>

      {/* Reverse Proxy */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">Reverse Proxy (nginx)</h2>
      <p className="text-[#888] mb-4">
        Example nginx configuration for production with SSL.
      </p>
      <CodeBlock language="nginx">
{`server {
    listen 443 ssl http2;
    server_name griphook.example.com;

    ssl_certificate /etc/letsencrypt/live/griphook.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/griphook.example.com/privkey.pem;

    # UI (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Agent API
    location /api/agent/ {
        proxy_pass http://localhost:8090/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SSE streaming (logs)
    location /api/agent/executions/ {
        proxy_pass http://localhost:8090/executions/;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }
}`}
      </CodeBlock>

      {/* Health Checks */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">Health Checks</h2>
      <CodeBlock language="bash">
{`# Agent health
curl http://localhost:8090/health
# {"status":"ok","version":"0.1.0"}

# Docker Compose health (built-in)
docker compose -f docker-compose.prod.yml ps`}
      </CodeBlock>
    </div>
  );
}
