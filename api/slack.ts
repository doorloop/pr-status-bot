import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Octokit } from '@octokit/rest';
import { createHmac, timingSafeEqual } from 'crypto';

// ============ Types ============

interface PullRequest {
  number: number;
  title: string;
  html_url: string;
  user: { login: string; avatar_url: string };
  draft: boolean;
  created_at: string;
  updated_at: string;
  comments: number;
  review_comments: number;
  requested_reviewers: Array<{ login: string }>;
  mergeable: boolean | null;
  mergeable_state: string;
  head: { sha: string };
}

interface CategorizedPRs {
  hasComments: PullRequest[];
  noReviewers: PullRequest[];
  failing: PullRequest[];
  mergeable: PullRequest[];
}

interface Teams {
  [teamName: string]: string[];
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
}

// ============ Teams Service ============

function getTeams(): Teams {
  const teamNames = process.env.TEAM_NAMES;
  if (!teamNames) throw new Error('TEAM_NAMES environment variable is not set');

  const teams: Teams = {};
  const names = teamNames.split(',').map(n => n.trim()).filter(Boolean);

  for (const name of names) {
    const envKey = `TEAM_${name.toUpperCase()}`;
    const members = process.env[envKey];
    teams[name] = members ? members.split(',').map(m => m.trim()).filter(Boolean) : [];
  }
  return teams;
}

function getTeamMembers(teamName: string): string[] {
  const teams = getTeams();
  const team = Object.entries(teams).find(([name]) => name.toLowerCase() === teamName.toLowerCase());
  if (!team) throw new Error(`Team "${teamName}" not found. Available: ${Object.keys(teams).join(', ')}`);
  return team[1];
}

function getAllMembers(): string[] {
  const teams = getTeams();
  const all = new Set<string>();
  for (const members of Object.values(teams)) members.forEach(m => all.add(m));
  return Array.from(all);
}

function getAvailableTeams(): string[] {
  return Object.keys(getTeams());
}

// ============ GitHub Service ============

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not set');
  return new Octokit({ auth: token });
}

function getRepoInfo(): { owner: string; repo: string } {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!owner || !repo) throw new Error('GITHUB_OWNER and GITHUB_REPO must be set');
  return { owner, repo };
}

async function fetchPRsForAuthors(authors: string[]): Promise<PullRequest[]> {
  const client = getOctokit();
  const { owner, repo } = getRepoInfo();
  const { data: allPRs } = await client.pulls.list({ owner, repo, state: 'open', per_page: 100 });

  const authorSet = new Set(authors.map(a => a.toLowerCase()));
  const filtered = allPRs.filter(pr => pr.user && authorSet.has(pr.user.login.toLowerCase()));

  return Promise.all(filtered.map(async (pr) => {
    const { data: d } = await client.pulls.get({ owner, repo, pull_number: pr.number });
    return {
      number: d.number,
      title: d.title,
      html_url: d.html_url,
      user: { login: d.user?.login ?? 'unknown', avatar_url: d.user?.avatar_url ?? '' },
      draft: d.draft ?? false,
      created_at: d.created_at,
      updated_at: d.updated_at,
      comments: d.comments,
      review_comments: d.review_comments,
      requested_reviewers: (d.requested_reviewers ?? []).map(r => ({ login: 'login' in r ? r.login : '' })),
      mergeable: d.mergeable,
      mergeable_state: d.mergeable_state,
      head: { sha: d.head.sha },
    };
  }));
}

async function hasFailingChecks(sha: string): Promise<boolean> {
  const client = getOctokit();
  const { owner, repo } = getRepoInfo();
  const { data } = await client.checks.listForRef({ owner, repo, ref: sha });
  return data.check_runs.some(c => c.status === 'completed' && c.conclusion === 'failure');
}

async function categorizePRs(prs: PullRequest[]): Promise<CategorizedPRs> {
  const result: CategorizedPRs = { hasComments: [], noReviewers: [], failing: [], mergeable: [] };
  const failingStatuses = await Promise.all(prs.map(pr => hasFailingChecks(pr.head.sha)));

  for (const [i, pr] of prs.entries()) {
    const isFailing = failingStatuses[i] ?? false;
    if (!pr.draft) {
      if (pr.comments > 0 || pr.review_comments > 0) result.hasComments.push(pr);
      if (pr.requested_reviewers.length === 0) result.noReviewers.push(pr);
    }
    if (isFailing) result.failing.push(pr);
    if (pr.mergeable === true && pr.mergeable_state === 'clean') result.mergeable.push(pr);
  }
  return result;
}

// ============ Slack Formatting ============

function getTimeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'just now';
}

function formatPRItem(pr: PullRequest): string {
  return `<${pr.html_url}|#${pr.number}> ${pr.title}\n      _by ${pr.user.login} • ${getTimeAgo(pr.created_at)}_`;
}

function createSection(emoji: string, title: string, prs: PullRequest[]): SlackBlock[] {
  if (prs.length === 0) return [];
  return [
    { type: 'section', text: { type: 'mrkdwn', text: `${emoji} *${title}* (${prs.length})` } },
    { type: 'section', text: { type: 'mrkdwn', text: prs.map(formatPRItem).join('\n\n') } },
    { type: 'divider' },
  ];
}

function formatPRStatusMessage(categorized: CategorizedPRs, teamName?: string) {
  const allNums = new Set([
    ...categorized.hasComments.map(p => p.number),
    ...categorized.noReviewers.map(p => p.number),
    ...categorized.failing.map(p => p.number),
    ...categorized.mergeable.map(p => p.number),
  ]);
  const teamLabel = teamName ? ` for team *${teamName}*` : '';

  const blocks: SlackBlock[] = [
    { type: 'header', text: { type: 'plain_text', text: 'PR Status Report', emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `Found *${allNums.size}* open PRs${teamLabel}` } },
    { type: 'divider' },
    ...createSection('💬', 'Has Comments (Not Draft)', categorized.hasComments),
    ...createSection('👀', 'Needs Reviewers (Not Draft)', categorized.noReviewers),
    ...createSection('🔴', 'Failing Checks', categorized.failing),
    ...createSection('🟢', 'Ready to Merge', categorized.mergeable),
  ];

  if (allNums.size === 0) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '_No open PRs found._' } });
  }

  return { blocks, response_type: 'in_channel' };
}

function formatErrorMessage(error: string) {
  return {
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `❌ *Error:* ${error}` } }],
    response_type: 'ephemeral',
  };
}

function formatHelpMessage(teams: string[]) {
  return {
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'PR Status Bot Help', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: '*Usage:*\n`/pr-status` - All PRs\n`/pr-status [team]` - Team PRs\n`/pr-status help` - Help' } },
      { type: 'section', text: { type: 'mrkdwn', text: `*Teams:* ${teams.join(', ')}` } },
    ],
    response_type: 'ephemeral',
  };
}

// ============ Signature Verification ============

function verifySlackSignature(signingSecret: string, timestamp: string, body: string, signature: string): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false;

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + createHmac('sha256', signingSecret).update(sigBasestring).digest('hex');

  try {
    return timingSafeEqual(new Uint8Array(Buffer.from(mySignature)), new Uint8Array(Buffer.from(signature)));
  } catch {
    return false;
  }
}

// ============ Main Handler ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get raw body for signature verification
  const rawBody = typeof req.body === 'string' ? req.body : new URLSearchParams(req.body).toString();

  // Verify Slack signature
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('SLACK_SIGNING_SECRET not set');
    return res.status(500).json({ error: 'Server config error' });
  }

  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const signature = req.headers['x-slack-signature'] as string;

  if (!timestamp || !signature) {
    return res.status(401).json({ error: 'Missing signature headers' });
  }

  if (!verifySlackSignature(signingSecret, timestamp, rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse body
  const body = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body;
  const text = (body.text || '').trim().toLowerCase();
  const responseUrl = body.response_url;

  // Help command - respond immediately
  if (text === 'help') {
    return res.json(formatHelpMessage(getAvailableTeams()));
  }

  // Acknowledge immediately, process async
  res.json({ response_type: 'ephemeral', text: 'Fetching PR status... ⏳' });

  // Process in background
  (async () => {
    try {
      let authors: string[];
      let teamName: string | undefined;

      if (text === '' || text === 'all') {
        authors = getAllMembers();
      } else {
        try {
          authors = getTeamMembers(text);
          teamName = text;
        } catch {
          await fetch(responseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formatErrorMessage(`Unknown team "${text}". Available: ${getAvailableTeams().join(', ')}`)),
          });
          return;
        }
      }

      if (authors.length === 0) {
        await fetch(responseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formatErrorMessage('No team members configured.')),
        });
        return;
      }

      const prs = await fetchPRsForAuthors(authors);
      const categorized = await categorizePRs(prs);

      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formatPRStatusMessage(categorized, teamName)),
      });
    } catch (error) {
      console.error('Error:', error);
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formatErrorMessage(error instanceof Error ? error.message : 'Unexpected error')),
      });
    }
  })();
}
