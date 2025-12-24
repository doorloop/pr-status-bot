export interface PullRequest {
  number: number;
  title: string;
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  draft: boolean;
  created_at: string;
  updated_at: string;
  comments: number;
  review_comments: number;
  requested_reviewers: Array<{ login: string }>;
  mergeable: boolean | null;
  mergeable_state: string;
  head: {
    sha: string;
  };
}

export interface CategorizedPRs {
  hasComments: PullRequest[];
  noReviewers: PullRequest[];
  failing: PullRequest[];
  mergeable: PullRequest[];
}

export interface Teams {
  [teamName: string]: string[];
}

export interface SlackSlashCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

export interface CheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
}

export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  SLACK_SIGNING_SECRET: string;
  TEAM_NAMES: string;
  [key: `TEAM_${string}`]: string | undefined;
}
