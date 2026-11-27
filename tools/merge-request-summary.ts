// Pure helpers for the get_merge_request summaries (include_summaries) and the
// approve/unapprove/approval state results. The functions that call GitLab
// stay in index.ts.

import {
  GitLabMergeRequestApprovalsResponseSchema,
  GitLabMergeRequestApprovalStateSchema,
  type GitLabApprovalUser,
  type GitLabDeployment,
  type GitLabMergeRequest,
  type GitLabMergeRequestApprovalState,
} from "../schemas.js";

export const MERGE_REQUEST_DEPLOYMENT_SUMMARY_LIMIT = 10;

export type GitLabMergeRequestDeploymentSummaryRecord = {
  id: string;
  status: string;
  ref?: string;
  sha: string;
  created_at: string;
  updated_at?: string;
  finished_at?: string | null;
  web_url?: string;
  environment?: {
    id?: string;
    name: string;
    slug?: string;
    external_url?: string | null;
    state?: string;
    tier?: string;
  };
  deployable?: {
    id?: string;
    name?: string;
    status?: string;
    stage?: string;
    web_url?: string;
    pipeline?: {
      id?: string;
      status?: string;
      ref?: string;
      sha?: string;
      web_url?: string;
    };
  } | null;
};

export type GitLabMergeRequestWithDeploymentSummary = GitLabMergeRequest & {
  deployment_summary: {
    lookup_sha: string | null;
    sort: "created_at_desc";
    limit: number;
    total_count: number;
    returned_count: number;
    records: GitLabMergeRequestDeploymentSummaryRecord[];
    unavailable_reason?: string;
  };
  commit_addition_summary: {
    target_branch: string;
    source_commits_count: number | null;
    merge_method: string | null;
    merge_commit_count: number | null;
    summary: string | null;
    unavailable_reason?: string;
  };
  approval_summary: {
    approved: boolean | null;
    user_has_approved: boolean | null;
    user_can_approve: boolean | null;
    approved_by: GitLabApprovalUser[];
    approved_by_usernames: string[];
    rules_count: number | null;
    source_endpoint: "approval_state" | "approvals" | null;
    unavailable_reason?: string;
  };
};

export function toMergeRequestDeploymentSummaryRecord(
  deployment: GitLabDeployment
): GitLabMergeRequestDeploymentSummaryRecord {
  return {
    id: deployment.id,
    status: deployment.status,
    ref: deployment.ref,
    sha: deployment.sha,
    created_at: deployment.created_at,
    updated_at: deployment.updated_at,
    finished_at: deployment.finished_at,
    web_url: deployment.web_url,
    environment: deployment.environment
      ? {
          id: deployment.environment.id,
          name: deployment.environment.name,
          slug: deployment.environment.slug,
          external_url: deployment.environment.external_url,
          state: deployment.environment.state,
          tier: deployment.environment.tier,
        }
      : undefined,
    deployable:
      deployment.deployable === null
        ? null
        : deployment.deployable
          ? {
              id: deployment.deployable.id,
              name: deployment.deployable.name,
              status: deployment.deployable.status,
              stage: deployment.deployable.stage,
              web_url: deployment.deployable.web_url,
              pipeline: deployment.deployable.pipeline
                ? {
                    id: deployment.deployable.pipeline.id,
                    status: deployment.deployable.pipeline.status,
                    ref: deployment.deployable.pipeline.ref,
                    sha: deployment.deployable.pipeline.sha,
                    web_url: deployment.deployable.pipeline.web_url,
                  }
                : undefined,
            }
          : undefined,
  };
}

export function sortDeploymentsByCreatedAtDesc(
  deployments: GitLabDeployment[]
): GitLabDeployment[] {
  return [...deployments].sort((a, b) => {
    const aTime = Date.parse(a.created_at);
    const bTime = Date.parse(b.created_at);

    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return b.created_at.localeCompare(a.created_at);
    }

    return bTime - aTime;
  });
}

/**
 * Parse the response from POST /approve and POST /unapprove endpoints.
 * These endpoints return the approvals format (approved_by contains nested
 * { user: {...} } objects), which must be converted to the flat format
 * used by GitLabMergeRequestApprovalStateSchema.
 */
export function parseApprovalsResponse(responseJson: unknown): GitLabMergeRequestApprovalState {
  const parsedApprovals = GitLabMergeRequestApprovalsResponseSchema.parse(responseJson);
  const approvedByUsers = getUniqueApprovalUsers(
    (parsedApprovals.approved_by || []).map(approvedByEntry => approvedByEntry.user)
  );
  const approvedByUsernames = approvedByUsers.map(user => user.username);

  return GitLabMergeRequestApprovalStateSchema.parse({
    approved: parsedApprovals.approved,
    user_has_approved: parsedApprovals.user_has_approved,
    user_can_approve: parsedApprovals.user_can_approve,
    approved_by: approvedByUsers,
    approved_by_usernames: approvedByUsernames,
    source_endpoint: "approvals",
  });
}

export function getUniqueApprovalUsers(users: GitLabApprovalUser[]): GitLabApprovalUser[] {
  const uniqueUsers = new Map<string, GitLabApprovalUser>();

  for (const user of users) {
    if (!uniqueUsers.has(user.id)) {
      uniqueUsers.set(user.id, user);
    }
  }

  return [...uniqueUsers.values()];
}

export function inferMergeRequestApproved(
  rules: GitLabMergeRequestApprovalState["rules"]
): boolean | null {
  if (!rules || rules.length === 0) {
    return null;
  }

  if (rules.some(rule => typeof rule.approved !== "boolean")) {
    return null;
  }

  return rules.every(rule => rule.approved === true);
}
