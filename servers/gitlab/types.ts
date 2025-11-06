/**
 * TypeScript type definitions for GitLab MCP tools
 *
 * These types enable type-safe code execution with MCP,
 * providing IntelliSense and compile-time validation.
 */

// ============================================================================
// Core GitLab Types
// ============================================================================

export interface GitLabIssue {
  id: string;
  iid: string;
  project_id: string;
  title: string;
  description: string;
  state: "opened" | "closed";
  created_at: string;
  updated_at: string;
  closed_at?: string;
  author: GitLabUser;
  assignees?: GitLabUser[];
  labels?: string[];
  web_url: string;
}

export interface GitLabMergeRequest {
  id: string;
  iid: string;
  project_id: string;
  title: string;
  description: string;
  state: "opened" | "closed" | "merged" | "locked";
  created_at: string;
  updated_at: string;
  merged_at?: string;
  author: GitLabUser;
  assignees?: GitLabUser[];
  reviewers?: GitLabUser[];
  source_branch: string;
  target_branch: string;
  web_url: string;
  sha?: string;
  merge_status?: string;
}

export interface GitLabUser {
  id: string;
  name: string;
  username: string;
  avatar_url?: string;
  email?: string;
}

export interface GitLabProject {
  id: string;
  name: string;
  description: string;
  path: string;
  path_with_namespace: string;
  web_url: string;
  default_branch: string;
  visibility: "private" | "internal" | "public";
  created_at: string;
}

export interface GitLabBranch {
  name: string;
  commit: GitLabCommit;
  merged: boolean;
  protected: boolean;
  default: boolean;
  web_url: string;
}

export interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committer_email: string;
  committed_date: string;
  web_url: string;
  parent_ids?: string[];
}

export interface GitLabDiff {
  old_path: string;
  new_path: string;
  a_mode: string;
  b_mode: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
  diff: string;
}

export interface GitLabContent {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  content_sha256: string;
  ref: string;
  blob_id: string;
  commit_id: string;
  last_commit_id: string;
}

export interface GitLabPipeline {
  id: string;
  project_id: string;
  sha: string;
  ref: string;
  status: string;
  source?: string;
  created_at: string;
  updated_at: string;
  web_url: string;
}

export interface GitLabDiscussion {
  id: string;
  individual_note: boolean;
  notes: GitLabNote[];
}

export interface GitLabNote {
  id: string;
  type?: string;
  body: string;
  author: GitLabUser;
  created_at: string;
  updated_at: string;
  system: boolean;
  noteable_id: string;
  noteable_type: string;
  resolvable?: boolean;
  resolved?: boolean;
}

// ============================================================================
// Input Types for Tools
// ============================================================================

export interface CreateIssueInput {
  projectId: string;
  title: string;
  description?: string;
  assignees?: string[];
  labels?: string[];
  milestone?: string;
  dueDate?: string;
}

export interface CreateMergeRequestInput {
  projectId: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description?: string;
  assignees?: string[];
  reviewers?: string[];
  labels?: string[];
  removeSourceBranch?: boolean;
}

export interface GetFileContentsInput {
  projectId: string;
  filePath: string;
  ref?: string;
}

export interface CreateOrUpdateFileInput {
  projectId: string;
  filePath: string;
  content: string;
  branch: string;
  commitMessage: string;
  encoding?: string;
  authorEmail?: string;
  authorName?: string;
}

export interface PushFilesInput {
  projectId: string;
  branch: string;
  commitMessage: string;
  actions: FileAction[];
}

export interface FileAction {
  action: "create" | "update" | "delete" | "move";
  file_path: string;
  content?: string;
  previous_path?: string;
  encoding?: string;
}

export interface CreateBranchInput {
  projectId: string;
  branchName: string;
  ref: string;
}

export interface GetMergeRequestInput {
  projectId: string;
  mergeRequestIid?: string;
  branchName?: string;
}

export interface UpdateMergeRequestInput {
  projectId: string;
  mergeRequestIid: string;
  title?: string;
  description?: string;
  targetBranch?: string;
  state?: "opened" | "closed";
  labels?: string[];
}

export interface MergeMergeRequestInput {
  projectId: string;
  mergeRequestIid: string;
  mergeCommitMessage?: string;
  squash?: boolean;
  removeSourceBranch?: boolean;
}

export interface SearchRepositoriesInput {
  query: string;
  visibility?: "private" | "internal" | "public";
  orderBy?: "id" | "name" | "path" | "created_at" | "updated_at" | "last_activity_at";
  sort?: "asc" | "desc";
  perPage?: number;
  page?: number;
}

export interface ListIssuesInput {
  projectId?: string;
  state?: "opened" | "closed" | "all";
  labels?: string[];
  assignee?: string;
  scope?: "created_by_me" | "assigned_to_me" | "all";
  perPage?: number;
  page?: number;
}

export interface GetBranchDiffsInput {
  projectId: string;
  from: string;
  to: string;
}

export interface CreateNoteInput {
  projectId: string;
  issueIid?: string;
  mergeRequestIid?: string;
  body: string;
}

export interface CreateMergeRequestThreadInput {
  projectId: string;
  mergeRequestIid: string;
  body: string;
  position?: {
    base_sha: string;
    start_sha: string;
    head_sha: string;
    position_type: "text" | "image";
    new_path?: string;
    old_path?: string;
    new_line?: number;
    old_line?: number;
  };
}
