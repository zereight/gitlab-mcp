// Issue-related API functions for GitLab MCP

import fetch from 'node-fetch';
import { GITLAB_API_URL, DEFAULT_FETCH_CONFIG } from '../config/gitlab.js';
import { handleGitLabError } from '../utils/index.js';
import { GitLabIssue, GitLabIssueSchema, CreateIssueOptions, UpdateIssueOptions } from '../schemas/index.js';

/**
 * Create a new issue in a GitLab project
 */
export async function createIssue(
  projectId: string,
  options: Omit<CreateIssueOptions, 'project_id'>
): Promise<GitLabIssue> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/issues`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify(options),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueSchema.parse(data);
}

/**
 * Get a specific issue by its IID
 */
export async function getIssue(
  projectId: string,
  issueIid: number
): Promise<GitLabIssue> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`
  );

  const response = await fetch(url.toString(), DEFAULT_FETCH_CONFIG);

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueSchema.parse(data);
}

/**
 * Update an existing issue
 */
export async function updateIssue(
  projectId: string,
  issueIid: number,
  options: Omit<UpdateIssueOptions, 'project_id' | 'issue_iid'>
): Promise<GitLabIssue> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`
  );

  const response = await fetch(url.toString(), {
    ...DEFAULT_FETCH_CONFIG,
    method: "PUT",
    body: JSON.stringify(options),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueSchema.parse(data);
}