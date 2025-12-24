import type { CategorizedPRs, PullRequest } from '../types';

interface Block {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: Array<{
    type: string;
    text?: string;
    url?: string;
  }>;
  accessory?: {
    type: string;
    text?: {
      type: string;
      text: string;
      emoji?: boolean;
    };
    url?: string;
  };
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ago`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }
  return 'just now';
}

function formatPRItem(pr: PullRequest): string {
  const timeAgo = getTimeAgo(pr.created_at);
  return `<${pr.html_url}|#${pr.number}> ${pr.title}\n      _by ${pr.user.login} \u2022 ${timeAgo}_`;
}

function createSection(emoji: string, title: string, prs: PullRequest[]): Block[] {
  if (prs.length === 0) {
    return [];
  }

  const blocks: Block[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${title}* (${prs.length})`,
      },
    },
  ];

  const prList = prs.map(formatPRItem).join('\n\n');

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: prList,
    },
  });

  blocks.push({
    type: 'divider' as const,
  } as Block);

  return blocks;
}

export function formatPRStatusMessage(
  categorized: CategorizedPRs,
  teamName?: string
): { blocks: Block[]; response_type: string } {
  const totalPRs =
    new Set([
      ...categorized.hasComments.map(p => p.number),
      ...categorized.noReviewers.map(p => p.number),
      ...categorized.failing.map(p => p.number),
      ...categorized.mergeable.map(p => p.number),
    ]).size;

  const teamLabel = teamName ? ` for team *${teamName}*` : '';

  const blocks: Block[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'PR Status Report',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Found *${totalPRs}* open PRs${teamLabel}`,
      },
    },
    {
      type: 'divider' as const,
    } as Block,
    ...createSection('\uD83D\uDCAC', 'Has Comments (Not Draft)', categorized.hasComments),
    ...createSection('\uD83D\uDC40', 'Needs Reviewers (Not Draft)', categorized.noReviewers),
    ...createSection('\uD83D\uDD34', 'Failing Checks', categorized.failing),
    ...createSection('\uD83D\uDFE2', 'Ready to Merge', categorized.mergeable),
  ];

  // If no PRs in any category
  if (totalPRs === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '_No open PRs found for the specified authors._',
      },
    });
  }

  return {
    blocks,
    response_type: 'in_channel',
  };
}

export function formatErrorMessage(error: string): { blocks: Block[]; response_type: string } {
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\u274C *Error:* ${error}`,
        },
      },
    ],
    response_type: 'ephemeral',
  };
}

export function formatHelpMessage(availableTeams: string[]): { blocks: Block[]; response_type: string } {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'PR Status Bot Help',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Usage:*\n`/pr-status` - Show all team members\' PRs\n`/pr-status [team]` - Show specific team\'s PRs\n`/pr-status help` - Show this help message',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Available Teams:*\n${availableTeams.map(t => `\u2022 ${t}`).join('\n')}`,
        },
      },
    ],
    response_type: 'ephemeral',
  };
}
