# GRIPHOOK Demo Script
### Teleprompter Text for POC Presentation

---

## OPENING (30 seconds)

**[ENERGETIC, CONFIDENT]**

Hey everyone!

Today I'm going to show you something that's going to change how you think about deployment automation.

It's called GRIPHOOK — an AI-powered deployment agent that turns natural language into automated workflows.

No more YAML hell. No more scripting headaches. Just tell it what you want, and watch it happen.

Let me show you.

---

## THE PROBLEM (45 seconds)

**[RELATABLE, UNDERSTANDING TONE]**

We've all been there.

You need to set up a deployment pipeline. You open your CI/CD tool and suddenly you're drowning in configuration files, environment variables, secret management, and documentation that's somehow always outdated.

Or you need to run a quick command across multiple servers. Simple, right? Except now you're SSH-ing into five different machines, copying scripts, hoping you didn't miss anything.

And what about scheduled tasks? "Just add a cron job" they say. Two hours later, you're debugging why your cron expression isn't firing at 2 AM on the third Tuesday of every month.

**[PAUSE]**

What if there was a better way?

---

## INTRODUCING GRIPHOOK (60 seconds)

**[EXCITED, BUILDING MOMENTUM]**

This is GRIPHOOK.

**[SHOW UI DASHBOARD]**

At its core, GRIPHOOK is an AI-powered agent that understands what you want to do — in plain English — and executes it.

Want to deploy your app? Just say: *"Deploy the latest version to production with zero downtime."*

Need to check logs across multiple servers? Ask: *"Show me all error logs from the last hour."*

Want to set up automated backups? Tell it: *"Run database backups every night at 3 AM and notify me on Slack when done."*

The AI understands context, remembers your infrastructure, and executes with precision.

But here's what makes it different from other automation tools:

**[PAUSE FOR EMPHASIS]**

It's not just running commands. It's thinking. It can chain together complex workflows, handle errors gracefully, and even suggest improvements.

Let me show you how easy it is to get started.

---

## LIVE INSTALLATION DEMO (2-3 minutes)

**[CONFIDENT, WALKING THROUGH STEPS]**

Installation takes literally 30 seconds.

One command:

```
curl -fsSL https://griphook.dev/install.sh | bash
```

**[RUN COMMAND, SHOW BANNER]**

Look at this — we get four installation options:

**Option 1: Docker Compose** — This is the recommended path. Everything runs in containers. Zero dependencies to manage. Perfect for production.

**Option 2: Standalone JAR** — If you prefer running directly on the host. Great for existing Java infrastructure.

**Option 3: Build from Source** — For the developers who want to customize or contribute.

**Option 4: Ubuntu Sandbox** — This is cool. It spins up an isolated Ubuntu container with full systemd support. Perfect for testing without touching your system.

Let's go with Docker Compose.

**[SELECT OPTION 1]**

Watch what happens...

It detects my OS automatically — I'm on Ubuntu.
It checks if Docker is installed... installs it if needed.
Downloads the configuration...
Pulls the images...

And now it's asking me to configure essentials:

**[SHOW CONFIGURATION PROMPTS]**

First, my Google AI API Key. This powers the intelligent chat features. You can get one free from Google AI Studio.

**[PASTE KEY]**

Agent Token — I'll let it auto-generate a secure one. This secures all API communications.

**[PRESS ENTER]**

Server port — 8090 is the default. Works for me.

**[PRESS ENTER]**

And... done!

**[SHOW COMPLETION MESSAGE]**

That's it. GRIPHOOK is installed and ready to go.

---

## FIRST TIME SETUP WIZARD (1 minute)

**[SMOOTH TRANSITION]**

Now when I open the UI for the first time...

**[OPEN BROWSER TO localhost:3000]**

Look at this — a guided setup wizard appears automatically for new users.

**[SHOW WIZARD]**

Step by step, it walks you through:
- Confirming your AI configuration
- Setting up security
- Connecting your first agent

No documentation required. No guessing. Just follow the steps.

**[CLICK THROUGH WIZARD]**

And boom — we're in the control center.

---

## CONTROL CENTER TOUR (1-2 minutes)

**[SHOW DASHBOARD]**

This is your command center.

On the left, you see your connected agents. Each agent can run tasks, execute commands, and report back.

These cards show real-time status — running executions, successes, failures — everything at a glance.

**[POINT TO SKILLS SECTION]**

Down here we have Skills. These are the superpowers of your agent:

- **Slack Integration** — Send and receive messages programmatically
- **Gmail & SMTP** — Email notifications, automated reports
- **Scheduled Tasks** — The autopilot feature I'll show you in a moment

Let me show you the AI chat.

---

## AI CHAT DEMO (2 minutes)

**[OPEN CHAT]**

This is where the magic happens.

**[TYPE IN CHAT]**

*"What's the current status of my agents?"*

**[SHOW RESPONSE]**

See? It understands context. It knows I have one agent connected, it's online, running on port 8090.

Let's try something more interesting.

**[TYPE]**

*"Create a scheduled task that checks disk usage every hour and alerts me on Slack if it goes above 80%."*

**[SHOW AI RESPONSE]**

Watch — the AI doesn't just acknowledge the request. It:
1. Creates the scheduled task
2. Sets up the cron expression
3. Configures the Slack notification
4. Confirms everything is active

**[SHOW SCHEDULES LIST]**

And there it is in our Autopilot section — running every hour, ready to alert.

No YAML. No cron syntax headaches. Just natural language.

---

## SKILLS CONFIGURATION (1 minute)

**[CLICK ON SKILLS]**

Configuring skills is just as easy.

Let's set up Slack.

**[CLICK CONFIGURE ON SLACK]**

I paste in my Bot Token... Signing Secret... maybe my default channel...

**[SAVE]**

Done. Now I can say things like:

*"Send a message to #deployments saying 'Version 2.1.4 deployed successfully'"*

And it just works.

**[TYPE AND SHOW IT WORKING]**

Same with Gmail, SMTP, or any custom skills you want to create.

---

## AUTOPILOT / SCHEDULED TASKS (1 minute)

**[SHOW SCHEDULES SECTION]**

This Autopilot feature is a game-changer.

You can schedule:
- **Daily tasks** — *"Every day at 9 AM, generate a summary of yesterday's deployments"*
- **Weekly reports** — *"Every Monday, email me the uptime statistics"*
- **Interval checks** — *"Every 5 minutes, ping the health endpoints"*
- **Or full cron expressions** for power users

**[SHOW A SCHEDULE RUNNING]**

You can run any schedule manually with one click, toggle it on/off, or delete it.

And here's the key part — these tasks can use AI prompts. So you're not just running static commands. The AI can analyze, summarize, and make decisions.

---

## CUSTOM SKILLS (45 seconds)

**[SHOW CUSTOM SKILLS]**

But what if you need something we haven't built in?

Custom Skills.

**[CLICK ADD SKILL]**

You can create three types:

1. **Command Skills** — Run any shell command
2. **Prompt Skills** — Define an AI prompt that executes
3. **Workflow Skills** — Chain multiple steps together

For example, I could create a "Deploy to Staging" skill that:
- Pulls the latest code
- Runs tests
- Builds the container
- Deploys to staging
- Notifies the team

All triggered with a simple: *"Run deploy to staging"*

---

## SECURITY & SETTINGS (30 seconds)

**[OPEN SETTINGS PAGE]**

Security is built in from day one.

Every API call requires authentication.
Tokens are generated securely.
You can rotate them anytime from this Settings page.

And all configuration lives in one place — no hunting through config files.

---

## CLOSING (45 seconds)

**[SINCERE, DIRECT]**

That's GRIPHOOK.

An AI-powered deployment agent that:

- Installs in 30 seconds
- Guides you through setup automatically
- Turns natural language into automated workflows
- Schedules and monitors tasks on autopilot
- Integrates with Slack, email, and custom tools
- And runs anywhere — Docker, standalone, or in an isolated sandbox

This is the future of deployment automation. Not more YAML. Not more scripting. Just tell it what you want.

**[PAUSE]**

The code is open source. The installation is free. And we're just getting started.

Questions?

---

## BACKUP TALKING POINTS

### If asked about scaling:
> "Each GRIPHOOK agent is lightweight — about 512MB of memory. You can run multiple agents across your infrastructure and manage them all from one control center."

### If asked about security:
> "All communication is authenticated with Bearer tokens. We support environment isolation, and the sandbox mode lets you test everything in a completely isolated container."

### If asked about AI models:
> "We're powered by Google's Gemini AI — specifically gemini-2.0-flash for speed. But the architecture is model-agnostic. We're looking at supporting multiple providers."

### If asked about pricing:
> "GRIPHOOK itself is open source and free. The only cost is your Google AI API usage, which has a generous free tier for most use cases."

### If asked about enterprise features:
> "We're building toward multi-tenant support, RBAC, audit logging, and SSO. Happy to discuss what your team needs."

---

## QUICK DEMO COMMANDS

For quick reference during live demo:

```bash
# Installation
curl -fsSL https://griphook.dev/install.sh | bash

# Start services (Docker)
cd /opt/griphook && sudo docker compose up -d

# Start services (svcify)
sudo svcify start griphook griphook-ui

# Check health
curl http://localhost:8090/health

# View logs
sudo docker compose logs -f
# or
sudo svcify logs griphook
```

**Chat prompts to try:**
- "What agents are connected?"
- "Create a daily backup task at 3 AM"
- "Send a Slack message to #general saying hello"
- "Check disk usage on all servers"
- "Show me the last 5 executions"

---

*Total runtime: 10-12 minutes*
*Recommended pace: Conversational, not rushed*
*Key moments to pause: After problem statement, after AI chat demo, before closing*
