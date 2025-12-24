import { Octokit } from '@octokit/rest';
import { categorizePRs, type PRDetails, type CategorizedPRs } from './categorization.js';

// Re-export types for consumers
export type { CategorizedPRs };
export type PullRequest = PRDetails;

// =============================================================================
// GITHUB CLIENT
// =============================================================================

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

// =============================================================================
// GRAPHQL QUERY FOR UNRESOLVED COMMENTS
// =============================================================================

const UNRESOLVED_COMMENTS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes {
            isResolved
          }
        }
      }
    }
  }
`;

interface GraphQLResponse {
  repository: {
    pullRequest: {
      reviewThreads: {
        nodes: Array<{ isResolved: boolean }>;
      };
    };
  };
}

async function hasUnresolvedThreads(
  client: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<boolean> {
  try {
    const response = await client.graphql<GraphQLResponse>(UNRESOLVED_COMMENTS_QUERY, {
      owner,
      repo,
      number: prNumber,
    });

    const threads = response.repository.pullRequest.reviewThreads.nodes;
    return threads.some(thread => !thread.isResolved);
  } catch {
    // Fallback: assume no unresolved comments if GraphQL fails
    return false;
  }
}

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchPRDetails(
  client: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRDetails> {
  // Fetch PR details
  const { data: pr } = await client.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  // Fetch reviews to check for approvals and change requests
  const { data: reviews } = await client.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
  });

  // Check for unresolved comment threads (GraphQL)
  const hasUnresolvedComments = await hasUnresolvedThreads(client, owner, repo, prNumber);

  // Also consider CHANGES_REQUESTED as unresolved feedback
  const hasChangesRequested = reviews.some(r => r.state === 'CHANGES_REQUESTED');

  // Fetch CI status using Actions API (works with fine-grained PATs)
  let hasCIFailure: boolean | null = null;
  let hasCIPassing: boolean | null = null;

  try {
    const { data: runs } = await client.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      branch: pr.head.ref,
      per_page: 10,
    });

    // Filter to runs for this specific commit
    const commitRuns = runs.workflow_runs.filter(r => r.head_sha === pr.head.sha);
    const completedRuns = commitRuns.filter(r => r.status === 'completed');

    if (completedRuns.length > 0) {
      hasCIFailure = completedRuns.some(r => r.conclusion === 'failure');
      hasCIPassing = completedRuns.every(r => r.conclusion === 'success');
    }
  } catch (error) {
    // Token may not have actions:read permission - leave as null
    if (!(error instanceof Error && 'status' in error && error.status === 403)) {
      throw error;
    }
  }

  // Analyze reviews
  const hasApprovedReview = reviews.some(r => r.state === 'APPROVED');

  return {
    number: pr.number,
    title: pr.title,
    html_url: pr.html_url,
    author: pr.user?.login ?? 'unknown',
    draft: pr.draft ?? false,
    createdAt: pr.created_at,

    hasUnresolvedComments: hasUnresolvedComments || hasChangesRequested,
    hasRequestedReviewers: (pr.requested_reviewers?.length ?? 0) > 0,
    hasApprovedReview,

    hasCIFailure,
    hasCIPassing,

    isMergeable: pr.mergeable === true,
    mergeableState: pr.mergeable_state,
  };
}

async function fetchPRsForAuthors(authors: string[]): Promise<PRDetails[]> {
  const client = getOctokit();
  const { owner, repo } = getRepoInfo();

  const { data: allPRs } = await client.pulls.list({
    owner,
    repo,
    state: 'open',
    per_page: 100,
  });

  const authorSet = new Set(authors.map(a => a.toLowerCase()));
  const filtered = allPRs.filter(pr =>
    pr.user && authorSet.has(pr.user.login.toLowerCase())
  );

  return Promise.all(
    filtered.map(pr => fetchPRDetails(client, owner, repo, pr.number))
  );
}

// =============================================================================
// PUBLIC API
// =============================================================================

export async function getPRStatus(authors: string[]): Promise<CategorizedPRs> {
  const prs = await fetchPRsForAuthors(authors);
  return categorizePRs(prs);
}
