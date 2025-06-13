// Merge Request API functions for GitLab MCP
import fetch from 'node-fetch';
import * as z from 'zod';
import { 
  GITLAB_API_URL, 
  DEFAULT_FETCH_CONFIG 
} from '../config/gitlab.js';
import { 
  handleGitLabError, 
  validateGitLabToken,
  fetchAllPages
} from '../utils/index.js';
import {
  GitLabMergeRequestSchema,
  OptimizedGitLabMergeRequestSchema,
  streamlineMergeRequest,
  GitLabDiscussionSchema,
  OptimizedGitLabDiscussionSchema,
  streamlineDiscussion,
  GitLabDiscussionNoteSchema,
  PaginatedDiscussionResponseSchema,
  GetMergeRequestSchema,
  ListMergeRequestDiscussionsSchema,
  CreateMergeRequestNoteSchema,
  UpdateMergeRequestSchema,
  type GitLabMergeRequest,
  type OptimizedGitLabMergeRequest,
  type GitLabDiscussion,
  type OptimizedGitLabDiscussion,
  type GitLabDiscussionNote,
  type PaginatedDiscussionResponse
} from '../schemas/index.js';

/**
 * Get merge request details by IID or branch name
 * (for get_merge_request tool)
 */
export async function getMergeRequest(
  projectId: string,
  mergeRequestIid?: number,
  branchName?: string
): Promise<OptimizedGitLabMergeRequest> {
  validateGitLabToken();
  projectId = decodeURIComponent(projectId);

  let url: string;
  if (mergeRequestIid) {
    url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}`;
  } else if (branchName) {
    url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/merge_requests?source_branch=${encodeURIComponent(branchName)}&state=opened`;
  } else {
    throw new Error("Either mergeRequestIid or branchName must be provided");
  }

  const response = await fetch(url, DEFAULT_FETCH_CONFIG);
  await handleGitLabError(response);
  const data = await response.json();

  if (branchName) {
    if (Array.isArray(data) && data.length > 0) {
      const fullMR = GitLabMergeRequestSchema.parse(data[0]);
      return streamlineMergeRequest(fullMR);
    } else {
      throw new Error(`No open merge request found for branch: ${branchName}`);
    }
  }

  const fullMR = GitLabMergeRequestSchema.parse(data);
  return streamlineMergeRequest(fullMR);
}

/**
 * List unresolved diff discussions for a merge request with pagination
 * (for mr_discussions tool)
 */
export async function listMergeRequestDiscussions(
  projectId: string,
  mergeRequestIid: number,
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedDiscussionResponse> {
  validateGitLabToken();
  projectId = decodeURIComponent(projectId);
  
  // Validate parameters
  const validPage = Math.max(page, 1);
  const validPerPage = Math.min(Math.max(perPage, 1), 50); // Cap at 50 for token efficiency

  const baseUrl = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/discussions`;
  
  // Fetch ALL discussions (single API call)
  const allDiscussions = await fetchAllPages(
    baseUrl,
    (data) => z.array(GitLabDiscussionSchema).parse(data),
    50 // Reasonable limit for discussions (50 pages * 100 per page = 5000 discussions max)
  );
  
  // Filter for unresolved diff discussions
  const allUnresolvedDiscussions = allDiscussions.filter(discussion => {
    const hasUnresolvedDiffNotes = discussion.notes?.some(note => 
      note.type === 'DiffNote' && 
      note.resolvable === true && 
      note.resolved === false
    );
    return hasUnresolvedDiffNotes;
  });

  // Calculate pagination
  const totalUnresolved = allUnresolvedDiscussions.length;
  const totalPages = Math.ceil(totalUnresolved / validPerPage);
  const startIndex = (validPage - 1) * validPerPage;
  const endIndex = startIndex + validPerPage;
  
  // Get discussions for current page
  const pageDiscussions = allUnresolvedDiscussions
    .slice(startIndex, endIndex)
    .map(discussion => streamlineDiscussion(discussion));

  return {
    total_unresolved: totalUnresolved,
    total_pages: totalPages,
    current_page: validPage,
    per_page: validPerPage,
    discussions: pageDiscussions,
  };
}

/**
 * Create a reply note to an existing merge request thread
 * (for create_merge_request_note tool)
 */
export async function createMergeRequestNote(
  projectId: string,
  mergeRequestIid: number,
  discussionId: string,
  body: string,
  createdAt?: string
): Promise<GitLabDiscussionNote> {
  validateGitLabToken();
  projectId = decodeURIComponent(projectId);

  const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/discussions/${discussionId}/notes`;

  const requestBody: any = { body };
  if (createdAt) {
    requestBody.created_at = createdAt;
  }

  const response = await fetch(url, {
    ...DEFAULT_FETCH_CONFIG,
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionNoteSchema.parse(data);
}

/**
 * Update a merge request (including adding labels)
 * (for update_merge_request tool)
 */
export async function updateMergeRequest(
  projectId: string,
  options: Omit<
    z.infer<typeof UpdateMergeRequestSchema>,
    "project_id" | "merge_request_iid" | "source_branch"
  >,
  mergeRequestIid?: number,
  branchName?: string
): Promise<OptimizedGitLabMergeRequest> {
  validateGitLabToken();
  projectId = decodeURIComponent(projectId);

  let finalMergeRequestIid = mergeRequestIid;
  
  // If no IID provided but branch name is provided, get the MR IID
  if (!finalMergeRequestIid && branchName) {
    const mr = await getMergeRequest(projectId, undefined, branchName);
    finalMergeRequestIid = mr.iid;
  }

  if (!finalMergeRequestIid) {
    throw new Error("Either mergeRequestIid or branchName must be provided");
  }

  const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/merge_requests/${finalMergeRequestIid}`;

  const response = await fetch(url, {
    ...DEFAULT_FETCH_CONFIG,
    method: "PUT",
    body: JSON.stringify(options),
  });

  await handleGitLabError(response);
  const data = await response.json();
  const fullMR = GitLabMergeRequestSchema.parse(data);
  return streamlineMergeRequest(fullMR);
} 