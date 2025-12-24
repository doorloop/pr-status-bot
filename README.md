# PR Status Bot

<img src="assets/bot-icon.png" alt="PR Status Bot" width="128" />

A Slack bot that shows your team's open PRs categorized by status.

## Categories

| Category | Description |
|----------|-------------|
| **Has Comments** | PRs with unresolved review comments or change requests |
| **Needs Reviewers** | PRs without reviewers or review activity |
| **Failing Checks** | PRs with failing CI |
| **Ready to Merge** | Approved PRs with passing CI and no conflicts |

Draft PRs are excluded from all categories.

---

## Deployment

### 1. Create a GitHub Fine-Grained PAT

1. Go to [GitHub Tokens](https://github.com/settings/tokens?type=beta)
2. Click **Generate new token**
3. Configure:
   - **Name**: `pr-status-bot`
   - **Resource owner**: Your organization
   - **Repository access**: Select your target repository
   - **Repository permissions**:
     - `Actions`: Read-only
     - `Pull requests`: Read-only
   - **Organization permissions**:
     - `Members`: Read-only
4. Click **Generate token** and copy it

### 2. Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **Create New App** → **From manifest**
3. Select your workspace
4. Paste the contents of [`manifest.json`](manifest.json)
5. Click **Create**
6. Go to **Install App** → **Install to Workspace**
7. Copy the **Bot Token** (`xoxb-...`) and **Signing Secret**

### 3. Deploy to Vercel

1. Fork this repo to your GitHub
2. Go to [Vercel](https://vercel.com) → **Add New Project**
3. Import your repository
4. Add environment variables:

| Variable | Value |
|----------|-------|
| `SLACK_BOT_TOKEN` | `xoxb-...` from Slack |
| `SLACK_SIGNING_SECRET` | From Slack Basic Information |
| `GITHUB_TOKEN` | Your fine-grained PAT |
| `GITHUB_OWNER` | Organization name |
| `GITHUB_REPO` | Repository name |

5. Click **Deploy**

### 4. Update Slack App URL

Replace `YOUR_APP` in the Slack manifest with your Vercel URL:
- **Slash Commands** → `/prs` → Request URL
- **Interactivity** → Request URL

### 5. Disable Vercel Authentication

1. Vercel → Project → **Settings** → **Deployment Protection**
2. Set **Vercel Authentication** to **Disabled**

---

## Usage

```
/prs              # Show all team PRs
/prs backend      # Show backend team PRs only
/prs help         # Show available teams
```

---

## Local Development

```bash
cp .env.example .env  # Fill in values
bun install
bun run dev           # Starts server with ngrok tunnel
```
