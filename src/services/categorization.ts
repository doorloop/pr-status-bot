// =============================================================================
// CATEGORIZATION - Pure functions for PR categorization
// =============================================================================

export interface PRDetails {
  // Basic info
  number: number;
  title: string;
  html_url: string;
  author: string;
  draft: boolean;
  createdAt: string;

  // Review state
  hasUnresolvedComments: boolean;
  hasRequestedReviewers: boolean;
  hasApprovedReview: boolean;

  // CI state (null = unknown/no permission)
  hasCIFailure: boolean | null;
  hasCIPassing: boolean | null;

  // Merge state
  isMergeable: boolean;
  mergeableState: string;
}

export interface CategorizedPRs {
  hasComments: PRDetails[];
  noReviewers: PRDetails[];
  failing: PRDetails[];
  mergeable: PRDetails[];
}

// =============================================================================
// CATEGORY PREDICATES
// Each predicate answers: "Does this PR belong in category X?"
// =============================================================================

/**
 * Category 1: Has Unresolved Comments
 * - PR is NOT a draft
 * - PR has unresolved review comments or change requests
 */
export function belongsToHasComments(pr: PRDetails): boolean {
  const isNotDraft = !pr.draft;
  const hasUnresolvedFeedback = pr.hasUnresolvedComments;

  return isNotDraft && hasUnresolvedFeedback;
}

/**
 * Category 2: Needs Reviewers 
 * - PR is NOT a draft
 * - PR has NO requested reviewers
 * - PR has NOT been reviewed yet (no approvals or feedback)
 */
export function belongsToNoReviewers(pr: PRDetails): boolean {
  const isNotDraft = !pr.draft;
  const hasNoRequestedReviewers = !pr.hasRequestedReviewers;
  const hasNoReviewActivity = !pr.hasUnresolvedComments && !pr.hasApprovedReview;

  return isNotDraft && hasNoRequestedReviewers && hasNoReviewActivity;
}

/**
 * Category 3: Failing
 * - PR has at least one failing CI check
 */
export function belongsToFailing(pr: PRDetails): boolean {
  return pr.hasCIFailure === true;
}

/**
 * Category 4: Mergeable
 * - PR is approved
 * - PR has no failing CI (either passing or no CI)
 * - PR has no merge conflicts (mergeable_state is 'clean')
 */
export function belongsToMergeable(pr: PRDetails): boolean {
  const isApproved = pr.hasApprovedReview;
  const hasNoFailingCI = pr.hasCIFailure !== true;
  const hasNoConflicts = pr.mergeableState === 'clean';

  return isApproved && hasNoFailingCI && hasNoConflicts;
}

// =============================================================================
// MAIN CATEGORIZATION
// =============================================================================

export function categorizePRs(prs: PRDetails[]): CategorizedPRs {
  const result: CategorizedPRs = {
    hasComments: [],
    noReviewers: [],
    failing: [],
    mergeable: [],
  };

  for (const pr of prs) {
    if (belongsToHasComments(pr)) {
      result.hasComments.push(pr);
    }

    if (belongsToNoReviewers(pr)) {
      result.noReviewers.push(pr);
    }

    if (belongsToFailing(pr)) {
      result.failing.push(pr);
    }

    if (belongsToMergeable(pr)) {
      result.mergeable.push(pr);
    }
  }

  return result;
}
