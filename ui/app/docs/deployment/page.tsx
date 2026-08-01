import { CodeBlock, InfoBox } from '../components';

export default function DeploymentPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Deployment</h1>
      <p className="text-[#888] mb-8">
        Three production paths: Docker Compose (agent + UI together), standalone JAR + Node, or
        systemd for the JAR.
      </p>

      <h2 className="text-xl font-bold text-white mb-4">Docker Compose (recommended)</h2>
      <p className="text-[#888] mb-4">
        Two compose files ship in the repo:
      </p>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-4">
        <li><code className="text-[#00fff2]">docker-compose.prod.yml</code> — pulls pre-built images <code>nullruntimedev/griphook-agent</code> and <code>nullruntimedev/griphook-ui</code>.</li>
        <li><code className="text-[#00fff2]">docker-compose.local.yml</code> — builds from source for local dev.</li>
      </ul>

      <h3 className="text-base font-medium text-[#ccc] mb-3">Production (pre-built images)</h3>
      <CodeBlock language="bash">
{`git clone https://github.com/nullruntime-dev/runner-agent.git
cd runner-agent
cp .env.example .env
nano .env     # Set AGENT_TOKEN, GOOGLE_AI_API_KEY (if using Gemini), etc.

docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml down`}
      </CodeBlock>

      <h3 className="text-base font-medium text-[#ccc] mb-3 mt-6">Local development (build from source)</h3>
      <CodeBlock language="bash">
{`docker compose -f docker-compose.local.yml up --build -d
# rebuild after code changes:
docker compose -f docker-compose.local.yml up --build -d`}
      </CodeBlock>

      <h3 className="text-base font-medium text-[#ccc] mb-3 mt-6">Services</h3>
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
              <td className="py-3 px-4"><code>nullruntimedev/griphook-agent</code></td>
              <td className="py-3 px-4">Spring Boot backend, PostgreSQL (shared <code>postgres</code> service)</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4"><code className="text-[#00fff2]">ui</code></td>
              <td className="py-3 px-4">3000</td>
              <td className="py-3 px-4"><code>nullruntimedev/griphook-ui</code></td>
              <td className="py-3 px-4">Next.js 16 standalone build, SQLite at <code>/app/data/runner.db</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <InfoBox type="info" title="Database init in Docker">
        The UI container&apos;s <code>docker-entrypoint.sh</code> runs <code>sqlite3 $DB_PATH &lt; migration.sql</code> on
        first start to create the schema. Don&apos;t run <code>npx prisma migrate dev</code> against the running
        container — apply migrations in the build step instead.
      </InfoBox>

      {/* Standalone JAR */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">Standalone JAR</h2>
      <p className="text-[#888] mb-4">Best for installing the agent as a host service. Requires Java 21+.</p>

      <h3 className="text-base font-medium text-[#ccc] mb-3">Build</h3>
      <CodeBlock language="bash">
{`./gradlew bootJar
# Built JAR: build/libs/runner-agent-0.1.0-SNAPSHOT.jar`}
      </CodeBlock>

      <h3 className="text-base font-medium text-[#ccc] mb-3 mt-6">Run</h3>
      <CodeBlock language="bash">
{`# Minimal
AGENT_TOKEN=your-strong-token \\
java -jar build/libs/runner-agent-0.1.0-SNAPSHOT.jar

# Full options
SERVER_PORT=8090 \\
AGENT_TOKEN=your-strong-token \\
GOOGLE_AI_API_KEY=your-google-ai-key \\
AGENT_ADK_PROVIDER=gemini \\
AGENT_WORKING_DIR=/opt/workspace \\
AGENT_DEFAULT_SHELL=/bin/bash \\
AGENT_MAX_CONCURRENT=10 \\
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/runner \\
SPRING_DATASOURCE_USERNAME=runner \\
SPRING_DATASOURCE_PASSWORD=runner \\
java -jar build/libs/runner-agent-0.1.0-SNAPSHOT.jar`}
      </CodeBlock>

      <h3 className="text-base font-medium text-[#ccc] mb-3 mt-6">Install Java 21</h3>
      <CodeBlock language="bash">
{`# Ubuntu / Debian
sudo apt update && sudo apt install -y openjdk-21-jre-headless

# RHEL / CentOS / Fedora
sudo dnf install -y java-21-openjdk-headless

# Arch
sudo pacman -S jre21-openjdk-headless

# macOS
brew install openjdk@21`}
      </CodeBlock>

      {/* systemd */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">systemd service (agent)</h2>

      <h3 className="text-base font-medium text-[#ccc] mb-3">Install the agent</h3>
      <CodeBlock language="bash">
{`sudo mkdir -p /opt/griphook-agent
sudo cp build/libs/runner-agent-0.1.0-SNAPSHOT.jar /opt/griphook-agent/griphook-agent.jar
sudo useradd -r -s /bin/false griphook
sudo chown -R griphook:griphook /opt/griphook-agent`}
      </CodeBlock>

      <h3 className="text-base font-medium text-[#ccc] mb-3 mt-6">Unit file</h3>
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
Environment=AGENT_TOKEN=your-strong-token
Environment=GOOGLE_AI_API_KEY=your-google-ai-key
Environment=AGENT_WORKING_DIR=/opt/griphook-agent/workspace
Environment=SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/runner
Environment=SPRING_DATASOURCE_USERNAME=runner
Environment=SPRING_DATASOURCE_PASSWORD=runner

[Install]
WantedBy=multi-user.target`}
      </CodeBlock>

      <h3 className="text-base font-medium text-[#ccc] mb-3 mt-6">Enable and start</h3>
      <CodeBlock language="bash">
{`sudo systemctl daemon-reload
sudo systemctl enable griphook-agent
sudo systemctl start griphook-agent

sudo systemctl status griphook-agent
sudo journalctl -u griphook-agent -f`}
      </CodeBlock>

      {/* UI Deployment */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">UI deployment (Next.js)</h2>
      <p className="text-[#888] mb-4">Run the Next.js UI as its own service if you&apos;re not using the UI container.</p>

      <h3 className="text-base font-medium text-[#ccc] mb-3">Build</h3>
      <CodeBlock language="bash">
{`cd ui
npm install
npx prisma generate       # required before build
npm run build
npm start                 # production server on PORT (default 3000)`}
      </CodeBlock>

      <h3 className="text-base font-medium text-[#ccc] mb-3 mt-6">UI systemd unit</h3>
      <CodeBlock language="ini">
{`# /etc/systemd/system/griphook-ui.service
[Unit]
Description=GRIPHOOK UI
After=network.target

[Service]
Type=simple
User=griphook
WorkingDirectory=/opt/griphook-ui
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target`}
      </CodeBlock>

      {/* Reverse proxy */}
      <h2 className="text-xl font-bold text-white mt-12 mb-4">Reverse proxy (nginx)</h2>
      <CodeBlock language="nginx">
{`server {
    listen 443 ssl http2;
    server_name griphook.example.com;

    ssl_certificate     /etc/letsencrypt/live/griphook.example.com/fullchain.pem;
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

    # Direct agent access (optional)
    location /agent/ {
        proxy_pass http://localhost:8090/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SSE streaming — keep buffers off and timeouts long
    location ~ ^/(api/)?agent/.*(stream|logs)$ {
        proxy_pass http://localhost:8090;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        chunked_transfer_encoding off;
    }
}`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-12 mb-4">Health checks</h2>
      <CodeBlock language="bash">
{`# Agent
curl http://localhost:8090/health
# {"status":"ok","version":"0.1.0-SNAPSHOT"}

# UI
curl -I http://localhost:3000/

# Docker
docker compose -f docker-compose.prod.yml ps`}
      </CodeBlock>

      <h2 className="text-xl font-bold text-white mt-12 mb-4">Persistent volumes</h2>
      <p className="text-[#888] mb-4">
        The Postgres database (in <code>docker-compose.postgres.yml</code>) and the UI&apos;s SQLite cache need persistent volumes:
      </p>
      <CodeBlock language="bash">
{`# Bring up the standalone Postgres (one-time, or after down -v)
docker compose -f docker-compose.postgres.yml up -d

# Then bring up the agents + UI
docker compose -f docker-compose.local.yml up -d --build`}
      </CodeBlock>
    </div>
  );
}
