import { Octokit } from '@octokit/rest';
import type { CategorizedPRs, PullRequest } from '../types';

let octokit: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is not set');
    }
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

function getRepoInfo(): { owner: string; repo: string } {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    throw new Error('GITHUB_OWNER and GITHUB_REPO environment variables must be set');
  }

  return { owner, repo };
}

export async function fetchPRsForAuthors(authors: string[]): Promise<PullRequest[]> {
  const client = getOctokit();
  const { owner, repo } = getRepoInfo();

  const { data: allPRs } = await client.pulls.list({
    owner,
    repo,
    state: 'open',
    per_page: 100,
  });

  const authorSet = new Set(authors.map(a => a.toLowerCase()));

  const filteredPRs = allPRs.filter(pr =>
    pr.user && authorSet.has(pr.user.login.toLowerCase())
  );

  // Fetch additional details for each PR
  const detailedPRs = await Promise.all(
    filteredPRs.map(async (pr) => {
      const { data: detailed } = await client.pulls.get({
        owner,
        repo,
        pull_number: pr.number,
      });

      return {
        number: detailed.number,
        title: detailed.title,
        html_url: detailed.html_url,
        user: {
          login: detailed.user?.login ?? 'unknown',
          avatar_url: detailed.user?.avatar_url ?? '',
        },
        draft: detailed.draft ?? false,
        created_at: detailed.created_at,
        updated_at: detailed.updated_at,
        comments: detailed.comments,
        review_comments: detailed.review_comments,
        requested_reviewers: (detailed.requested_reviewers ?? []).map(r => ({
          login: 'login' in r ? r.login : '',
        })),
        mergeable: detailed.mergeable,
        mergeable_state: detailed.mergeable_state,
        head: {
          sha: detailed.head.sha,
        },
      } satisfies PullRequest;
    })
  );

  return detailedPRs;
}

async function hasFailingChecks(sha: string): Promise<boolean> {
  const client = getOctokit();
  const { owner, repo } = getRepoInfo();

  const { data } = await client.checks.listForRef({
    owner,
    repo,
    ref: sha,
  });

  return data.check_runs.some(
    check => check.status === 'completed' && check.conclusion === 'failure'
  );
}

export async function categorizePRs(prs: PullRequest[]): Promise<CategorizedPRs> {
  const result: CategorizedPRs = {
    hasComments: [],
    noReviewers: [],
    failing: [],
    mergeable: [],
  };

  // Check failing status for all PRs in parallel
  const failingStatuses = await Promise.all(
    prs.map(pr => hasFailingChecks(pr.head.sha))
  );

  for (const [index, pr] of prs.entries()) {
    const isFailing = failingStatuses[index] ?? false;

    // Skip drafts for most categories
    if (!pr.draft) {
      // Has comments and not in draft
      if (pr.comments > 0 || pr.review_comments > 0) {
        result.hasComments.push(pr);
      }

      // No reviewers and not in draft
      if (pr.requested_reviewers.length === 0) {
        result.noReviewers.push(pr);
      }
    }

    // Failing PRs (including drafts)
    if (isFailing) {
      result.failing.push(pr);
    }

    // Mergeable PRs
    if (pr.mergeable === true && pr.mergeable_state === 'clean') {
      result.mergeable.push(pr);
    }
  }

  return result;
}

export async function getPRStatus(authors: string[]): Promise<CategorizedPRs> {
  const prs = await fetchPRsForAuthors(authors);
  return categorizePRs(prs);
}
