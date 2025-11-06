/**
 * GitLab Issues Tools
 *
 * Progressive tool loading: These functions are only loaded when needed,
 * reducing context window usage.
 */

import { callMCPTool } from "../callMCPTool.js";
import type {
  GitLabIssue,
  CreateIssueInput,
  ListIssuesInput,
} from "../types.js";

/**
 * Create a new issue in a GitLab project
 *
 * @example
 * ```typescript
 * const issue = await createIssue({
 *   projectId: '123',
 *   title: 'Bug: Application crashes on startup',
 *   description: 'Steps to reproduce...',
 *   labels: ['bug', 'priority::high']
 * });
 * console.log(`Created issue: ${issue.web_url}`);
 * ```
 */
export async function createIssue(
  input: CreateIssueInput
): Promise<GitLabIssue> {
  return callMCPTool<GitLabIssue>("create_issue", {
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    assignees: input.assignees,
    labels: input.labels,
    milestone: input.milestone,
    dueDate: input.dueDate,
  });
}

/**
 * List issues with filtering
 *
 * Data filtering: Process large issue lists in the execution environment,
 * returning only summarized or filtered results to the model.
 *
 * @example
 * ```typescript
 * // Get all open bugs assigned to current user
 * const issues = await listIssues({
 *   projectId: '123',
 *   state: 'opened',
 *   labels: ['bug'],
 *   scope: 'assigned_to_me'
 * });
 *
 * // Filter in execution environment - doesn't pass all data through model
 * const highPriorityIssues = issues.filter(issue =>
 *   issue.labels?.includes('priority::high')
 * );
 * ```
 */
export async function listIssues(
  input: ListIssuesInput
): Promise<GitLabIssue[]> {
  return callMCPTool<GitLabIssue[]>("list_issues", input);
}

/**
 * Get details of a specific issue
 */
export async function getIssue(
  projectId: string,
  issueIid: string
): Promise<GitLabIssue> {
  return callMCPTool<GitLabIssue>("get_issue", {
    projectId,
    issueIid,
  });
}

/**
 * Update an existing issue
 */
export async function updateIssue(
  projectId: string,
  issueIid: string,
  updates: Partial<CreateIssueInput>
): Promise<GitLabIssue> {
  return callMCPTool<GitLabIssue>("update_issue", {
    projectId,
    issueIid,
    ...updates,
  });
}

/**
 * Delete an issue
 */
export async function deleteIssue(
  projectId: string,
  issueIid: string
): Promise<void> {
  return callMCPTool<void>("delete_issue", {
    projectId,
    issueIid,
  });
}

/**
 * Create a note/comment on an issue
 */
export async function createIssueNote(
  projectId: string,
  issueIid: string,
  body: string
): Promise<any> {
  return callMCPTool("create_issue_note", {
    projectId,
    issueIid,
    body,
  });
}

/**
 * Get my assigned issues
 *
 * @example
 * ```typescript
 * const myIssues = await getMyIssues('opened');
 * console.log(`You have ${myIssues.length} open issues assigned`);
 * ```
 */
export async function getMyIssues(
  state: "opened" | "closed" | "all" = "opened"
): Promise<GitLabIssue[]> {
  return callMCPTool<GitLabIssue[]>("my_issues", { state });
}
