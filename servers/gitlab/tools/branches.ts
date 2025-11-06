/**
 * GitLab Branches & Commits Tools
 */

import { callMCPTool } from "../callMCPTool.js";
import type {
  GitLabBranch,
  GitLabCommit,
  GitLabDiff,
  CreateBranchInput,
  GetBranchDiffsInput,
} from "../types.js";

/**
 * Create a new branch
 *
 * @example
 * ```typescript
 * const branch = await createBranch({
 *   projectId: '123',
 *   branchName: 'feature/new-feature',
 *   ref: 'main'
 * });
 * console.log(`Created branch: ${branch.name}`);
 * ```
 */
export async function createBranch(
  input: CreateBranchInput
): Promise<GitLabBranch> {
  return callMCPTool<GitLabBranch>("create_branch", input);
}

/**
 * Get differences between two branches or commits
 *
 * Data filtering: Process diffs in execution environment
 *
 * @example
 * ```typescript
 * const diffs = await getBranchDiffs({
 *   projectId: '123',
 *   from: 'main',
 *   to: 'feature-branch'
 * });
 *
 * // Analyze changes locally without passing all diff data through model
 * const stats = {
 *   filesChanged: diffs.length,
 *   additions: 0,
 *   deletions: 0
 * };
 *
 * for (const diff of diffs) {
 *   const lines = diff.diff.split('\n');
 *   stats.additions += lines.filter(l => l.startsWith('+')).length;
 *   stats.deletions += lines.filter(l => l.startsWith('-')).length;
 * }
 *
 * console.log(`Changes: ${stats.filesChanged} files, +${stats.additions}/-${stats.deletions}`);
 * ```
 */
export async function getBranchDiffs(
  input: GetBranchDiffsInput
): Promise<GitLabDiff[]> {
  return callMCPTool<GitLabDiff[]>("get_branch_diffs", input);
}

/**
 * List commits in a repository
 */
export async function listCommits(input: {
  projectId: string;
  ref?: string;
  since?: string;
  until?: string;
  path?: string;
  author?: string;
  perPage?: number;
  page?: number;
}): Promise<GitLabCommit[]> {
  return callMCPTool<GitLabCommit[]>("list_commits", input);
}

/**
 * Get details of a specific commit
 */
export async function getCommit(
  projectId: string,
  sha: string
): Promise<GitLabCommit> {
  return callMCPTool<GitLabCommit>("get_commit", {
    projectId,
    sha,
  });
}

/**
 * Get commit diff/changes
 */
export async function getCommitDiff(
  projectId: string,
  sha: string
): Promise<GitLabDiff[]> {
  return callMCPTool<GitLabDiff[]>("get_commit_diff", {
    projectId,
    sha,
  });
}
