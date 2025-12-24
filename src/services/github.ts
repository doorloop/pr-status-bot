import { Octokit } from '@octokit/rest';

export interface PullRequest {
  number: number;
  title: string;
  html_url: string;
  user: { login: string };
  draft: boolean;
  created_at: string;
  comments: number;
  review_comments: number;
  requested_reviewers: Array<{ login: string }>;
  mergeable: boolean | null;
  mergeable_state: string;
  head: { sha: string };
}

export interface CategorizedPRs {
  hasComments: PullRequest[];
  noReviewers: PullRequest[];
  failing: PullRequest[];
  mergeable: PullRequest[];
}

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
      user: { login: d.user?.login ?? 'unknown' },
      draft: d.draft ?? false,
      created_at: d.created_at,
      comments: d.comments,
      review_comments: d.review_comments,
      requested_reviewers: (d.requested_reviewers ?? []).map(r => ({ login: 'login' in r ? r.login : '' })),
      mergeable: d.mergeable,
      mergeable_state: d.mergeable_state,
      head: { sha: d.head.sha },
    };
  }));
}

async function hasFailingChecks(sha: string): Promise<boolean | null> {
  const client = getOctokit();
  const { owner, repo } = getRepoInfo();
  try {
    const { data } = await client.checks.listForRef({ owner, repo, ref: sha });
    return data.check_runs.some(c => c.status === 'completed' && c.conclusion === 'failure');
  } catch (error) {
    // Token may not have checks:read permission - return null to indicate unknown
    if (error instanceof Error && 'status' in error && error.status === 403) {
      return null;
    }
    throw error;
  }
}

async function categorizePRs(prs: PullRequest[]): Promise<CategorizedPRs> {
  const result: CategorizedPRs = { hasComments: [], noReviewers: [], failing: [], mergeable: [] };
  const failingStatuses = await Promise.all(prs.map(pr => hasFailingChecks(pr.head.sha)));

  for (const [i, pr] of prs.entries()) {
    const isFailing = failingStatuses[i]; // null = unknown, true = failing, false = passing
    if (!pr.draft) {
      if (pr.comments > 0 || pr.review_comments > 0) result.hasComments.push(pr);
      if (pr.requested_reviewers.length === 0) result.noReviewers.push(pr);
    }
    if (isFailing === true) result.failing.push(pr);
    if (pr.mergeable === true && pr.mergeable_state === 'clean' && isFailing === false) result.mergeable.push(pr);
  }
  return result;
}

export async function getPRStatus(authors: string[]): Promise<CategorizedPRs> {
  const prs = await fetchPRsForAuthors(authors);
  return categorizePRs(prs);
}
