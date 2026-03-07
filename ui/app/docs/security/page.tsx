import { InfoBox } from '../components';

export default function SecurityPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Security</h1>
      <p className="text-neutral-400 mb-8">
        Security considerations and best practices for Runner Agent deployments.
      </p>

      <InfoBox type="warning" title="Security Notice">
        Runner Agent executes arbitrary shell commands on target servers. Only deploy in trusted
        environments and protect your API tokens. Use network isolation and firewall rules.
      </InfoBox>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Authentication</h2>
      <ul className="space-y-3 text-neutral-400">
        <li className="flex items-start gap-3">
          <span className="text-green-500 mt-1">&#10003;</span>
          <span>All endpoints (except /health) require Bearer token authentication</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-green-500 mt-1">&#10003;</span>
          <span>Tokens are verified on every request by the ApiKeyFilter</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-green-500 mt-1">&#10003;</span>
          <span>Agent tokens are stored securely in the Control Center database</span>
        </li>
      </ul>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Network Security</h2>
      <ul className="space-y-3 text-neutral-400">
        <li className="flex items-start gap-3">
          <span className="text-green-500 mt-1">&#10003;</span>
          <span>Use HTTPS in production environments (terminate SSL at load balancer or reverse proxy)</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-green-500 mt-1">&#10003;</span>
          <span>Restrict network access to trusted IPs using firewall rules</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-green-500 mt-1">&#10003;</span>
          <span>Deploy agents in private networks, not exposed to the internet</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-green-500 mt-1">&#10003;</span>
          <span>Use VPN or SSH tunnels for remote access</span>
        </li>
      </ul>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Token Best Practices</h2>
      <ul className="space-y-3 text-neutral-400">
        <li className="flex items-start gap-3">
          <span className="text-amber-500 mt-1">!</span>
          <span>Use strong, randomly generated tokens (32+ characters)</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-amber-500 mt-1">!</span>
          <span>Use different tokens for each agent</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-amber-500 mt-1">!</span>
          <span>Rotate tokens periodically</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-amber-500 mt-1">!</span>
          <span>Never commit tokens to version control</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-amber-500 mt-1">!</span>
          <span>Use environment variables or secrets management</span>
        </li>
      </ul>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Generate Secure Token</h2>
      <div className="bg-neutral-900 border border-neutral-800 p-4">
        <pre className="text-sm text-neutral-300 font-mono overflow-x-auto">
{`# Linux/macOS
openssl rand -hex 32

# Or using /dev/urandom
head -c 32 /dev/urandom | base64

# Python
python3 -c "import secrets; print(secrets.token_hex(32))"`}
        </pre>
      </div>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Execution Security</h2>
      <ul className="space-y-3 text-neutral-400">
        <li className="flex items-start gap-3">
          <span className="text-amber-500 mt-1">!</span>
          <span>Run agents with minimal privileges (non-root user)</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-amber-500 mt-1">!</span>
          <span>Use containers or VMs to isolate execution environments</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-amber-500 mt-1">!</span>
          <span>Set appropriate timeouts to prevent runaway processes</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="text-amber-500 mt-1">!</span>
          <span>Limit what commands can be executed via the working directory and shell settings</span>
        </li>
      </ul>

      <h2 className="text-xl font-bold text-white mt-10 mb-4">nginx Reverse Proxy with SSL</h2>
      <div className="bg-neutral-900 border border-neutral-800 p-4">
        <pre className="text-sm text-neutral-300 font-mono overflow-x-auto">
{`server {
    listen 443 ssl;
    server_name agent.example.com;

    ssl_certificate /etc/letsencrypt/live/agent.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/agent.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # For SSE streaming
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
}`}
        </pre>
      </div>
    </div>
  );
}
