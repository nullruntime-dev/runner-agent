import Link from 'next/link';
import { CodeBlock, Endpoint, InfoBox } from '../components';

export default function CliExecutorPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">CLI Executor</h1>
      <p className="text-[#888] mb-8">
        <code className="text-[#00fff2]">cli-executor</code> is a standalone Spring Boot 4.1.0
        (Java 21) microservice that accepts a list of shell command strings over HTTP and runs
        them synchronously via <code>/bin/sh -c</code>. It is a sibling package to the{' '}
        runner-agent backend &mdash; deploy it on remote servers where the agent cannot reach the
        host directly (e.g. containers without <code>host.docker.internal</code>), then have the
        agent call it over HTTP.
      </p>

      <InfoBox type="warning" title="Command injection is the feature">
        <code>POST /executor/run</code> runs arbitrary shell. There is no allowlist, no
        working-dir isolation, no timeout, no cancellation. Guard the service at the network
        layer (firewall, private network, VPN) and use a strong <code>SPRING_APPLICATION_TOKEN</code>.
        Do not expose port 8010 to the public internet.
      </InfoBox>

      {/* What it is */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">What it is</h2>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>Single Spring Boot app &mdash; no database, no external dependencies</li>
        <li>One endpoint: <code className="text-[#00fff2]">POST /executor/run</code> + a health check</li>
        <li>Token-authenticated (shared secret in request body, checked against <code>token.token</code> property)</li>
        <li>Synchronous: blocks the request thread until the process exits; stdout + stderr are merged and returned as the response body</li>
        <li>Runs on port <code className="text-[#00fff2]">8010</code> by default</li>
      </ul>

      {/* Install */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Install &amp; run</h2>
      <p className="text-[#888] mb-4">
        Build from source with the Gradle wrapper. Java 21 required.
      </p>
      <CodeBlock language="bash">
{`# From the cli-executor/ directory
cd cli-executor

# Run directly (port 8010)
SPRING_APPLICATION_TOKEN=change-me ./gradlew bootRun

# Build an executable JAR
./gradlew bootJar
java -jar build/libs/cli-executor-*.jar

# Build an OCI image (needs Docker daemon)
./gradlew bootBuildImage
docker run --rm -p 8010:8010 \\
  -e SPRING_APPLICATION_TOKEN=change-me \\
  cli-executor:0.0.1-SNAPSHOT`}
      </CodeBlock>

      <InfoBox type="info" title="No env vars required to start">
        If <code>SPRING_APPLICATION_TOKEN</code> is unset, it defaults to{' '}
        <code>1234</code>. The service starts fine with no other config &mdash; no database, no
        broker, no volumes. Override the port with <code>--server.port=8010</code> or{' '}
        <code>SERVER_PORT=8010</code>.
      </InfoBox>

      {/* Configuration */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Configuration</h2>
      <p className="text-[#888] mb-4">
        All config lives in <code>cli-executor/src/main/resources/application.yaml</code> and can
        be overridden with environment variables or command-line flags.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left py-3 px-4 text-[#888]">Property</th>
              <th className="text-left py-3 px-4 text-[#888]">Env var</th>
              <th className="text-left py-3 px-4 text-[#888]">Default</th>
              <th className="text-left py-3 px-4 text-[#888]">Description</th>
            </tr>
          </thead>
          <tbody className="text-[#ccc]">
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#00fff2]">token.token</td>
              <td className="py-3 px-4 font-mono text-[#ff6600]">SPRING_APPLICATION_TOKEN</td>
              <td className="py-3 px-4 text-[#888]">1234</td>
              <td className="py-3 px-4 text-[#888]">Shared secret. Must match the <code>token</code> field in every request body.</td>
            </tr>
            <tr className="border-b border-[#1a1a1a]">
              <td className="py-3 px-4 font-mono text-[#00fff2]">server.port</td>
              <td className="py-3 px-4 font-mono text-[#ff6600]">SERVER_PORT</td>
              <td className="py-3 px-4 text-[#888]">8010</td>
              <td className="py-3 px-4 text-[#888]">HTTP listen port. Distinct from runner-agent (8009/8090) and UI (3000).</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* API */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">API</h2>

      <Endpoint method="GET" path="/executor/health" auth={false}>
        Liveness probe. Returns the literal string <code>OK</code> (not JSON).
        <CodeBlock language="bash" className="mt-4">
{`curl http://localhost:8010/executor/health
# OK`}
        </CodeBlock>
      </Endpoint>

      <Endpoint method="POST" path="/executor/run" auth={true}>
        Run a command. Auth is a <code>token</code> field in the JSON body, not a header.
        <div className="overflow-x-auto mt-4 mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a1a1a]">
                <th className="text-left py-2 px-4 text-[#888]">Field</th>
                <th className="text-left py-2 px-4 text-[#888]">Type</th>
                <th className="text-left py-2 px-4 text-[#888]">Description</th>
              </tr>
            </thead>
            <tbody className="text-[#ccc]">
              <tr className="border-b border-[#1a1a1a]">
                <td className="py-2 px-4 font-mono text-[#00fff2]">commands</td>
                <td className="py-2 px-4 text-[#888]">string[]</td>
                <td className="py-2 px-4 text-[#888]">First element is the shell command (may contain pipes, redirects, metachars). Remaining elements are positional args exposed as <code>$@</code> (<code>$1</code>, <code>$2</code>, &hellip;).</td>
              </tr>
              <tr className="border-b border-[#1a1a1a]">
                <td className="py-2 px-4 font-mono text-[#00fff2]">token</td>
                <td className="py-2 px-4 text-[#888]">string</td>
                <td className="py-2 px-4 text-[#888]">Must match <code>token.token</code>. <code>IllegalArgumentException</code> (&ldquo;Invalid token&rdquo;) if mismatched.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <CodeBlock language="bash" className="mt-2">
{`curl -X POST http://localhost:8010/executor/run \\
  -H 'content-type: application/json' \\
  -d '{
    "commands": ["echo \\"hello $1\\" \\"$@\\"", "world"],
    "token": "change-me"
  }'
# hello world world`}
        </CodeBlock>
        <p className="text-[#888] mt-4">
          Returns the merged <code>stdout</code>+<code>stderr</code> as plain text. A non-zero
          exit code returns HTTP 500 with an <code>RuntimeException</code> message.
        </p>
      </Endpoint>

      <InfoBox type="tip" title="Arg passing quirk">
        When args are present, <code>ExecutorService</code> builds{' '}
        <code>sh -c &quot;&lt;cmd&gt; \&quot;$@\&quot;&quot; sh arg1 arg2 &hellip;</code>.{' '}
        <code>$0</code> is <code>sh</code>, <code>$1</code> is <code>arg1</code>, etc. Inside{' '}
        <code>cmd</code>, <code>$@</code> resolves to the full arg list. Re-test commands that
        use <code>$1</code>/<code>$@</code> or args containing single quotes if you touch the
        executor.
      </InfoBox>

      {/* Connecting from runner-agent */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Connect from runner-agent</h2>
      <p className="text-[#888] mb-4">
        runner-agent reaches cli-executor through a <strong className="text-white">custom
        COMMAND skill</strong>. The skill&apos;s command array runs locally via{' '}
        <code>StepRunner</code> (ProcessBuilder), so it can <code>curl</code> the remote
        executor. This is the same path the built-in <code>execute_commands</code> tool uses;
        the only difference is the command is a <code>curl</code> call instead of a local shell
        command.
      </p>

      <h3 className="text-lg font-semibold text-white mt-6 mb-3">1. Deploy cli-executor on the target server</h3>
      <CodeBlock language="bash">
{`# On the remote server
git clone <your-repo> runner-agent
cd runner-agent/cli-executor
./gradlew bootJar
SPRING_APPLICATION_TOKEN=$(openssl rand -hex 24) \\
  java -jar build/libs/cli-executor-*.jar
# Note the generated token &mdash; you will paste it into the runner-agent skill.`}
      </CodeBlock>

      <h3 className="text-lg font-semibold text-white mt-6 mb-3">2. Verify reachability from the agent</h3>
      <CodeBlock language="bash">
{`# From the runner-agent container/host
curl http://<executor-host>:8010/executor/health
# OK`}
      </CodeBlock>
      <InfoBox type="info" title="Container-to-container networking">
        If runner-agent and cli-executor run on the same Docker host, put them on the same
        Compose network and call the executor by service name (e.g.{' '}
        <code>http://cli-executor:8010</code>). On Linux, <code>host.docker.internal</code>{' '}
        needs <code>extra_hosts: [&quot;host.docker.internal:host-gateway&quot;]</code> on the
        agent service; if that does not resolve, use the container name on a shared bridge
        network instead.
      </InfoBox>

      <h3 className="text-lg font-semibold text-white mt-6 mb-3">3. Create the COMMAND skill in the UI</h3>
      <p className="text-[#888] mb-4">
        Open the runner-agent UI &rarr; Skills &rarr; Add Custom Skill. Pick type{' '}
        <code className="text-[#00fff2]">COMMAND</code>. The skill body is a shell one-liner that
        calls the executor and forwards its output. Whatever the skill prints to stdout becomes
        the model-visible result.
      </p>
      <CodeBlock language="bash">
{`# Skill command (single line; \\ for wrapping only)
curl -s -X POST http://<executor-host>:8010/executor/run \\
  -H 'content-type: application/json' \\
  -d "{\"commands\": $1, \"token\": \"<your-executor-token>\"}"`}
      </CodeBlock>
      <p className="text-[#888] mt-4 mb-4">
        Here <code>$1</code> is the skill&apos;s first positional argument &mdash; a JSON array
        of command strings. The model supplies it when invoking the skill, e.g.{' '}
        <code>[&quot;uptime&quot;]</code> or <code>[&quot;ls -la /var/log&quot;]</code>.
      </p>

      <h3 className="text-lg font-semibold text-white mt-6 mb-3">4. (Optional) Make it an ADK tool</h3>
      <p className="text-[#888] mb-4">
        If you want the agent to call the executor autonomously instead of through a manual
        skill invocation, register a thin tool in{' '}
        <code>AgentService</code> that wraps the same <code>curl</code>. The existing{' '}
        <code className="text-[#00fff2]">HostExecTool</code> (SSH-based) is a template &mdash;
        swap the SSH call for an HTTP <code>POST /executor/run</code> and return the stdout
        string in a <code>Map&lt;String,Object&gt;</code> with a <code>success</code> boolean.
        See <Link href="/docs/configuration" className="text-[#00fff2] hover:underline">Configuration</Link>{' '}
        for the tool registration pattern.
      </p>

      {/* Security */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Security notes</h2>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li><strong className="text-white">Token is a shared secret.</strong> Both sides must agree. Rotate by changing <code>SPRING_APPLICATION_TOKEN</code> and the skill body together.</li>
        <li><strong className="text-white">No TLS.</strong> The token travels in cleartext in the POST body. Put a reverse proxy (nginx/caddy) in front for TLS, or run on a private network/VPN.</li>
        <li><strong className="text-white">No allowlist.</strong> Any shell command is allowed &mdash; including <code>rm -rf /</code>. Guard at the network layer, not at the application layer.</li>
        <li><strong className="text-white">No timeout.</strong> A hung command holds the HTTP connection open. If you need a timeout, wrap the <code>curl</code> with <code>timeout 60 curl &hellip;</code> in the skill body.</li>
        <li><strong className="text-white">No persistence.</strong> cli-executor keeps no state between requests. runner-agent is responsible for logging, history, and retries.</li>
      </ul>

      {/* Troubleshooting */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Troubleshooting</h2>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li><code className="text-[#00fff2]">Invalid token</code> &mdash; request <code>token</code> field does not match <code>SPRING_APPLICATION_TOKEN</code>. Check for trailing whitespace or shell-quoting issues in the skill body.</li>
        <li><code className="text-[#00fff2]">Connection refused</code> &mdash; cli-executor not running, or wrong host/port. Hit <code>/executor/health</code> from the agent host first.</li>
        <li><code className="text-[#00fff2]">500 + RuntimeException</code> &mdash; the command exited non-zero. The merged stdout/stderr is in the response; check it for the actual error.</li>
        <li><code className="text-[#00fff2]">$1</code> empty &mdash; the skill was invoked without arguments, or the JSON array was not passed as the first positional arg.</li>
      </ul>

      {/* Next steps */}
      <h2 className="text-xl font-bold text-white mb-4 mt-12">Next steps</h2>
      <ul className="list-disc list-inside text-[#888] space-y-2 mb-6">
        <li>Custom skills &amp; tools &mdash; <Link href="/docs/configuration" className="text-[#00fff2] hover:underline">Configuration</Link></li>
        <li>Agent API surface &mdash; <Link href="/docs/api" className="text-[#00fff2] hover:underline">API Reference</Link></li>
        <li>Hardening &mdash; <Link href="/docs/security" className="text-[#00fff2] hover:underline">Security</Link></li>
      </ul>
    </div>
  );
}