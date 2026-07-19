import { InfoBox } from '../components';

export default function SecurityPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Security</h1>
      <p className="text-[#888] mb-8">
        Security considerations and best practices for GRIPHOOK deployments.
      </p>

      <InfoBox type="warning" title="Security notice">
        GRIPHOOK executes arbitrary shell commands on the host it runs on. Only deploy in trusted
        environments, protect your API tokens, and isolate the agent from the public internet. Use
        network isolation, firewall rules, and a reverse proxy with TLS in production.
      </InfoBox>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Authentication</h2>
      <ul className="space-y-3 text-[#888]">
        <li className="flex items-start gap-3">
          <span className="text-[#00ff66] mt-1">✓</span>
          <span>All agent endpoints (except <code className="text-[#00fff2]">/health</code>, the H2 console, and OAuth callbacks) require Bearer token auth via <code>ApiKeyFilter</code>.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#00ff66] mt-1">✓</span>
          <span>The UI proxies per-agent requests to the right agent with the right token (see <code>ui/lib/proxy.ts</code>).</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#00ff66] mt-1">✓</span>
          <span>For SSE (chat stream, log stream) where the browser EventSource can&apos;t set <code>Authorization</code>, you can also pass <code>?token=...</code> as a query string.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#00ff66] mt-1">✓</span>
          <span>JSON database exports strip agent tokens so backups are safe to share.</span>
        </li>
      </ul>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Token best practices</h2>
      <ul className="space-y-3 text-[#888]">
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span>Use strong, randomly generated tokens (32+ characters). The setup wizard has a one-click generator.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span>Use different tokens for each agent.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span>Rotate tokens periodically and after personnel changes.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span>Never commit tokens. Both <code>../settings.json</code> and <code>ui/data/agents.json</code> are gitignored for this reason.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span>The default token is <code className="text-[#00fff2]">1234</code> (dev only) — the API will refuse to start in production with the default; always set <code>AGENT_TOKEN</code> in env.</span>
        </li>
      </ul>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Generate a secure token</h2>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4">
        <pre className="text-sm text-[#ccc] font-mono overflow-x-auto">
{`# Linux / macOS
openssl rand -hex 32

# Or using /dev/urandom
head -c 32 /dev/urandom | base64

# Python
python3 -c "import secrets; print(secrets.token_hex(32))"

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`}
        </pre>
      </div>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Network security</h2>
      <ul className="space-y-3 text-[#888]">
        <li className="flex items-start gap-3">
          <span className="text-[#00ff66] mt-1">✓</span>
          <span>Use HTTPS in production. Terminate TLS at a load balancer or reverse proxy (nginx, Caddy, Traefik).</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#00ff66] mt-1">✓</span>
          <span>Restrict network access to trusted IPs via firewall rules.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#00ff66] mt-1">✓</span>
          <span>Deploy agents in private networks. Never expose port 8090 to the internet.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#00ff66] mt-1">✓</span>
          <span>For remote access, use a zero-trust tunnel: Cloudflare Zero Trust, Tailscale, or Twingate.</span>
        </li>
      </ul>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Execution security</h2>
      <ul className="space-y-3 text-[#888]">
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span>Run agents with minimal privileges (a dedicated <code>griphook</code> user, not root).</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span>Use containers or VMs to isolate execution environments.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span>Set per-step <code>timeout</code> and execution <code>timeout</code> to prevent runaway processes.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span>Constrain <code>AGENT_WORKING_DIR</code> and <code>AGENT_DEFAULT_SHELL</code> to limit the blast radius of any single command.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span>Audit <code>journalctl -u griphook-agent</code> regularly. All command executions appear in the agent logs.</span>
        </li>
      </ul>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Database &amp; secrets</h2>
      <ul className="space-y-3 text-[#888]">
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span><code>ui/data/runner.db</code> contains agent tokens in plaintext. Restrict file permissions: <code>chmod 600 ui/data/runner.db</code>.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span>The agent H2 DB at <code>./agent-data.mv.db</code> contains Gmail OAuth tokens (<code>gmail_tokens</code> table). Same: restrict permissions.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-[#ff6600] mt-1">!</span>
          <span>When exporting via JSON, tokens are stripped — but the SQLite export (<em>Download .db</em>) contains everything. Treat it as a secret.</span>
        </li>
      </ul>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">nginx with TLS (example)</h2>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4">
        <pre className="text-sm text-[#ccc] font-mono overflow-x-auto">
{`server {
    listen 443 ssl;
    server_name agent.example.com;

    ssl_certificate     /etc/letsencrypt/live/agent.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/agent.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # SSE: keep the connection open
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
}`}
        </pre>
      </div>
    </div>
  );
}
