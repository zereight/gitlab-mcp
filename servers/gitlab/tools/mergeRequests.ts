/**
 * GitLab Merge Requests Tools
 *
 * Control flow: Compose these functions with native TypeScript
 * loops, conditionals, and error handling.
 */

import { callMCPTool } from "../callMCPTool.js";
import type {
  GitLabMergeRequest,
  GitLabDiff,
  CreateMergeRequestInput,
  GetMergeRequestInput,
  UpdateMergeRequestInput,
  MergeMergeRequestInput,
  CreateMergeRequestThreadInput,
} from "../types.js";

/**
 * Create a new merge request
 *
 * @example
 * ```typescript
 * const mr = await createMergeRequest({
 *   projectId: '123',
 *   sourceBranch: 'feature-branch',
 *   targetBranch: 'main',
 *   title: 'Add new feature',
 *   description: 'This PR adds...',
 *   removeSourceBranch: true
 * });
 * console.log(`Created MR: ${mr.web_url}`);
 * ```
 */
export async function createMergeRequest(
  input: CreateMergeRequestInput
): Promise<GitLabMergeRequest> {
  return callMCPTool<GitLabMergeRequest>("create_merge_request", {
    projectId: input.projectId,
    sourceBranch: input.sourceBranch,
    targetBranch: input.targetBranch,
    title: input.title,
    description: input.description,
    assignees: input.assignees,
    reviewers: input.reviewers,
    labels: input.labels,
    removeSourceBranch: input.removeSourceBranch,
  });
}

/**
 * Get merge request details
 *
 * Either mergeRequestIid or branchName must be provided
 */
export async function getMergeRequest(
  input: GetMergeRequestInput
): Promise<GitLabMergeRequest> {
  return callMCPTool<GitLabMergeRequest>("get_merge_request", input);
}

/**
 * List merge requests with filtering
 *
 * @example
 * ```typescript
 * // State persistence: Store MR list for later use
 * const openMRs = await listMergeRequests({
 *   projectId: '123',
 *   state: 'opened'
 * });
 *
 * // Process with control flow
 * for (const mr of openMRs) {
 *   if (mr.merge_status === 'can_be_merged') {
 *     console.log(`Ready to merge: ${mr.title}`);
 *   }
 * }
 * ```
 */
export async function listMergeRequests(input: {
  projectId?: string;
  state?: "opened" | "closed" | "merged" | "all";
  labels?: string[];
  scope?: string;
  perPage?: number;
  page?: number;
}): Promise<GitLabMergeRequest[]> {
  return callMCPTool<GitLabMergeRequest[]>("list_merge_requests", input);
}

/**
 * Update a merge request
 */
export async function updateMergeRequest(
  input: UpdateMergeRequestInput
): Promise<GitLabMergeRequest> {
  return callMCPTool<GitLabMergeRequest>("update_merge_request", input);
}

/**
 * Merge a merge request
 *
 * @example
 * ```typescript
 * try {
 *   await mergeMergeRequest({
 *     projectId: '123',
 *     mergeRequestIid: '456',
 *     squash: true,
 *     removeSourceBranch: true
 *   });
 *   console.log('MR merged successfully');
 * } catch (error) {
 *   console.error('Failed to merge:', error);
 * }
 * ```
 */
export async function mergeMergeRequest(
  input: MergeMergeRequestInput
): Promise<GitLabMergeRequest> {
  return callMCPTool<GitLabMergeRequest>("merge_merge_request", input);
}

/**
 * Get merge request diffs/changes
 *
 * Data filtering: Process diffs in execution environment,
 * extract only relevant information before returning to model.
 */
export async function getMergeRequestDiffs(
  projectId: string,
  mergeRequestIid?: string,
  branchName?: string
): Promise<GitLabDiff[]> {
  return callMCPTool<GitLabDiff[]>("get_merge_request_diffs", {
    projectId,
    mergeRequestIid,
    branchName,
  });
}

/**
 * List merge request diffs with pagination
 */
export async function listMergeRequestDiffs(
  projectId: string,
  mergeRequestIid?: string,
  branchName?: string,
  page?: number,
  perPage?: number
): Promise<GitLabDiff[]> {
  return callMCPTool<GitLabDiff[]>("list_merge_request_diffs", {
    projectId,
    mergeRequestIid,
    branchName,
    page,
    perPage,
  });
}

/**
 * Create a new thread/discussion on a merge request
 */
export async function createMergeRequestThread(
  input: CreateMergeRequestThreadInput
): Promise<any> {
  return callMCPTool("create_merge_request_thread", input);
}

/**
 * List discussions on a merge request
 */
export async function getMergeRequestDiscussions(
  projectId: string,
  mergeRequestIid: string
): Promise<any[]> {
  return callMCPTool<any[]>("mr_discussions", {
    projectId,
    mergeRequestIid,
  });
}

/**
 * Create a note in a merge request thread
 */
export async function createMergeRequestNote(
  projectId: string,
  mergeRequestIid: string,
  discussionId: string,
  body: string
): Promise<any> {
  return callMCPTool("create_merge_request_note", {
    projectId,
    mergeRequestIid,
    discussionId,
    body,
  });
}
