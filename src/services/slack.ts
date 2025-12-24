import type { CategorizedPRs, PullRequest } from './github.js';
import type { Block, KnownBlock } from '@slack/types';

function getTimeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'just now';
}

function formatPRItem(pr: PullRequest): string {
  return `<${pr.html_url}|#${pr.number}> ${pr.title}\n      _by ${pr.author} • ${getTimeAgo(pr.createdAt)}_`;
}

function createSection(emoji: string, title: string, prs: PullRequest[]): (Block | KnownBlock)[] {
  if (prs.length === 0) return [];
  return [
    { type: 'section', text: { type: 'mrkdwn', text: `${emoji} *${title}* (${prs.length})` } },
    { type: 'section', text: { type: 'mrkdwn', text: prs.map(formatPRItem).join('\n\n') } },
    { type: 'divider' },
  ];
}

export function formatPRStatusBlocks(categorized: CategorizedPRs, teamName?: string): (Block | KnownBlock)[] {
  const allNums = new Set([
    ...categorized.hasComments.map(p => p.number),
    ...categorized.noReviewers.map(p => p.number),
    ...categorized.failing.map(p => p.number),
    ...categorized.mergeable.map(p => p.number),
  ]);
  const teamLabel = teamName ? ` for team *${teamName}*` : '';

  const blocks: (Block | KnownBlock)[] = [
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

  return blocks;
}

export function formatErrorBlocks(error: string): (Block | KnownBlock)[] {
  return [{ type: 'section', text: { type: 'mrkdwn', text: `❌ *Error:* ${error}` } }];
}

export function formatHelpBlocks(teams: string[]): (Block | KnownBlock)[] {
  return [
    { type: 'header', text: { type: 'plain_text', text: 'PR Status Bot Help', emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: '*Usage:*\n`/pr-status` - All PRs\n`/pr-status [team]` - Team PRs\n`/pr-status help` - Help' } },
    { type: 'section', text: { type: 'mrkdwn', text: `*Teams:* ${teams.join(', ')}` } },
  ];
}
