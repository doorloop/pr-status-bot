# PR Status Bot

<img src="assets/bot-icon.png" alt="PR Status Bot" width="128" />

A Slack bot that shows your team's open PRs categorized by status.

## Categories

| Category | Description |
|----------|-------------|
| 💬 **Has Comments** | PRs with unresolved review comments or change requests |
| 👀 **Needs Reviewers** | PRs without reviewers or review activity |
| 🔴 **Failing Checks** | PRs with failing CI |
| 🟢 **Ready to Merge** | Approved PRs with passing CI and no conflicts |

Draft PRs are excluded from all categories.

---

## Deployment Guide

### 1. Create a GitHub Fine-Grained Personal Access Token

1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens?type=beta)
2. Click **Generate new token**
3. Configure:
   - **Name**: `pr-status-bot`
   - **Expiration**: Choose as needed
   - **Repository access**: Select your target repository
   - **Permissions**:
     - `Actions`: Read-only
     - `Pull requests`: Read-only
     - `Metadata`: Read-only (auto-selected)
4. Click **Generate token** and copy it

### 2. Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **Create New App** → **From manifest**
3. Select your workspace
4. Paste this manifest (update the URL after Vercel deployment):

```json
{
  "_metadata": { "major_version": 1, "minor_version": 1 },
  "display_information": { "name": "PR Status Bot" },
  "features": {
    "bot_user": { "display_name": "PR Status Bot", "always_online": true },
    "slash_commands": [{
      "command": "/prs",
      "description": "Check PR status for your team",
      "usage_hint": "[team_name] or 'help'",
      "url": "https://YOUR_APP.vercel.app/api/slack/events"
    }]
  },
  "oauth_config": {
    "scopes": { "bot": ["chat:write", "commands"] }
  },
  "settings": {
    "event_subscriptions": {
      "request_url": "https://YOUR_APP.vercel.app/api/slack/events"
    },
    "interactivity": {
      "is_enabled": true,
      "request_url": "https://YOUR_APP.vercel.app/api/slack/events"
    },
    "org_deploy_enabled": false,
    "socket_mode_enabled": false
  }
}
```

5. Click **Create**
6. Go to **Install App** → **Install to Workspace**
7. Note down:
   - **Bot Token** (`xoxb-...`) from OAuth & Permissions
   - **Signing Secret** from Basic Information

### 3. Deploy to Vercel

1. Fork or push this repo to your GitHub
2. Go to [Vercel](https://vercel.com) → **Add New Project**
3. Import your repository
4. Add environment variables:

| Variable | Value |
|----------|-------|
| `SLACK_BOT_TOKEN` | `xoxb-...` from Slack |
| `SLACK_SIGNING_SECRET` | From Slack Basic Information |
| `GITHUB_TOKEN` | Your fine-grained PAT |
| `GITHUB_OWNER` | Organization name (e.g., `myorg`) |
| `GITHUB_REPO` | Repository name (e.g., `myrepo`) |

5. Click **Deploy**
6. Copy your deployment URL (e.g., `https://pr-status-bot-xxx.vercel.app`)

### 4. Update Slack App URLs

1. Go back to your [Slack App](https://api.slack.com/apps)
2. Update these URLs with your Vercel deployment URL:
   - **Slash Commands** → Edit `/prs` → Request URL
   - **Event Subscriptions** → Request URL
   - **Interactivity & Shortcuts** → Request URL

All URLs should be: `https://YOUR_APP.vercel.app/api/slack/events`

### 5. Disable Vercel Authentication (Important!)

1. Go to Vercel → Your Project → **Settings** → **Deployment Protection**
2. Set **Vercel Authentication** to **Disabled** (or add bypass for Slack)

---

## Usage

```
/prs              # Show all team PRs
/prs backend      # Show backend team PRs only
/prs help         # Show help
```

---

## Team Configuration

Teams are fetched automatically from your GitHub organization. The bot lists all org teams and their members.

**Required token permissions:**
- `Organization: Read-only` (to list teams)
- `Organization / Members: Read-only` (to list team members)

---

## Local Development

1. Copy `.env.example` to `.env` and fill in values
2. Get an [ngrok auth token](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Run:

```bash
bun install
bun run dev
```

This starts a local server with ngrok tunnel for Slack webhook testing.
