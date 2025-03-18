import { z } from "zod";

// Base schemas for common types
export const GitLabAuthorSchema = z.object({
  name: z.string(),
  email: z.string(),
  date: z.string(),
});

// Namespace related schemas
export const GitLabNamespaceSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  kind: z.enum(["user", "group"]),
  full_path: z.string(),
  parent_id: z.number().nullable(),
  avatar_url: z.string().nullable(),
  web_url: z.string(),
  members_count_with_descendants: z.number().optional(),
  billable_members_count: z.number().optional(),
  max_seats_used: z.number().optional(),
  seats_in_use: z.number().optional(),
  plan: z.string().optional(),
  end_date: z.string().nullable().optional(),
  trial_ends_on: z.string().nullable().optional(),
  trial: z.boolean().optional(),
  root_repository_size: z.number().optional(),
  projects_count: z.number().optional(),
});

export const GitLabNamespaceExistsResponseSchema = z.object({
  exists: z.boolean(),
  suggests: z.array(z.string()).optional(),
});

// Repository related schemas
export const GitLabOwnerSchema = z.object({
  username: z.string(), // Changed from login to match GitLab API
  id: z.number(),
  avatar_url: z.string(),
  web_url: z.string(), // Changed from html_url to match GitLab API
  name: z.string(), // Added as GitLab includes full name
  state: z.string(), // Added as GitLab includes user state
});

export const GitLabRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  path_with_namespace: z.string(),
  visibility: z.string().optional(),
  owner: GitLabOwnerSchema.optional(),
  web_url: z.string().optional(),
  description: z.string().nullable(),
  fork: z.boolean().optional(),
  ssh_url_to_repo: z.string().optional(),
  http_url_to_repo: z.string().optional(),
  created_at: z.string().optional(),
  last_activity_at: z.string().optional(),
  default_branch: z.string().optional(),
  namespace: z.object({
    id: z.number(),
    name: z.string(),
    path: z.string(),
    kind: z.string(),
    full_path: z.string(),
    avatar_url: z.string().nullable().optional(),
    web_url: z.string().optional(),
  }).optional(),
  readme_url: z.string().optional().nullable(),
  topics: z.array(z.string()).optional(),
  tag_list: z.array(z.string()).optional(), // deprecated but still present
  open_issues_count: z.number().optional(),
  archived: z.boolean().optional(),
  forks_count: z.number().optional(),
  star_count: z.number().optional(),
  permissions: z.object({
    project_access: z.object({
      access_level: z.number(),
      notification_level: z.number().optional(),
    }).optional().nullable(),
    group_access: z.object({
      access_level: z.number(),
      notification_level: z.number().optional(),
    }).optional().nullable(),
  }).optional(),
  container_registry_enabled: z.boolean().optional(),
  container_registry_access_level: z.string().optional(),
  issues_enabled: z.boolean().optional(),
  merge_requests_enabled: z.boolean().optional(),
  wiki_enabled: z.boolean().optional(),
  jobs_enabled: z.boolean().optional(),
  snippets_enabled: z.boolean().optional(),
  can_create_merge_request_in: z.boolean().optional(),
  resolve_outdated_diff_discussions: z.boolean().optional(),
  shared_runners_enabled: z.boolean().optional(),
  shared_with_groups: z.array(z.object({
    group_id: z.number(),
    group_name: z.string(),
    group_full_path: z.string(),
    group_access_level: z.number(),
  })).optional(),
});

// Project schema (extended from repository schema)
export const GitLabProjectSchema = GitLabRepositorySchema;

// File content schemas
export const GitLabFileContentSchema = z.object({
  file_name: z.string(), // Changed from name to match GitLab API
  file_path: z.string(), // Changed from path to match GitLab API
  size: z.number(),
  encoding: z.string(),
  content: z.string(),
  content_sha256: z.string(), // Changed from sha to match GitLab API
  ref: z.string(), // Added as GitLab requires branch reference
  blob_id: z.string(), // Added to match GitLab API
  commit_id: z.string(), // ID of the current file version
  last_commit_id: z.string(), // Added to match GitLab API
  execute_filemode: z.boolean().optional(), // Added to match GitLab API
});

export const GitLabDirectoryContentSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.string(),
  mode: z.string(),
  id: z.string(), // Changed from sha to match GitLab API
  web_url: z.string(), // Changed from html_url to match GitLab API
});

export const GitLabContentSchema = z.union([
  GitLabFileContentSchema,
  z.array(GitLabDirectoryContentSchema),
]);

// Operation schemas
export const FileOperationSchema = z.object({
  path: z.string(),
  content: z.string(),
});

// Tree and commit schemas
export const GitLabTreeEntrySchema = z.object({
  id: z.string(), // Changed from sha to match GitLab API
  name: z.string(),
  type: z.enum(["blob", "tree"]),
  path: z.string(),
  mode: z.string(),
});

export const GitLabTreeSchema = z.object({
  id: z.string(), // Changed from sha to match GitLab API
  tree: z.array(GitLabTreeEntrySchema),
});

export const GitLabCommitSchema = z.object({
  id: z.string(), // Changed from sha to match GitLab API
  short_id: z.string(), // Added to match GitLab API
  title: z.string(), // Changed from message to match GitLab API
  author_name: z.string(),
  author_email: z.string(),
  authored_date: z.string(),
  committer_name: z.string(),
  committer_email: z.string(),
  committed_date: z.string(),
  web_url: z.string(), // Changed from html_url to match GitLab API
  parent_ids: z.array(z.string()), // Changed from parents to match GitLab API
});

// Reference schema
export const GitLabReferenceSchema = z.object({
  name: z.string(), // Changed from ref to match GitLab API
  commit: z.object({
    id: z.string(), // Changed from sha to match GitLab API
    web_url: z.string(), // Changed from url to match GitLab API
  }),
});

// Input schemas for operations
export const CreateRepositoryOptionsSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  visibility: z.enum(["private", "internal", "public"]).optional(), // Changed from private to match GitLab API
  initialize_with_readme: z.boolean().optional(), // Changed from auto_init to match GitLab API
});

export const CreateIssueOptionsSchema = z.object({
  title: z.string(),
  description: z.string().optional(), // Changed from body to match GitLab API
  assignee_ids: z.array(z.number()).optional(), // Changed from assignees to match GitLab API
  milestone_id: z.number().optional(), // Changed from milestone to match GitLab API
  labels: z.array(z.string()).optional(),
});

export const CreateMergeRequestOptionsSchema = z.object({
  // Changed from CreatePullRequestOptionsSchema
  title: z.string(),
  description: z.string().optional(), // Changed from body to match GitLab API
  source_branch: z.string(), // Changed from head to match GitLab API
  target_branch: z.string(), // Changed from base to match GitLab API
  allow_collaboration: z.boolean().optional(), // Changed from maintainer_can_modify to match GitLab API
  draft: z.boolean().optional(),
});

export const CreateBranchOptionsSchema = z.object({
  name: z.string(), // Changed from ref to match GitLab API
  ref: z.string(), // The source branch/commit for the new branch
});

// Response schemas for operations
export const GitLabCreateUpdateFileResponseSchema = z.object({
  file_path: z.string(),
  branch: z.string(),
  commit_id: z.string().optional(), // Optional since it's not always returned by the API
  content: GitLabFileContentSchema.optional(),
});

export const GitLabSearchResponseSchema = z.object({
  count: z.number().optional(),
  total_pages: z.number().optional(),
  current_page: z.number().optional(),
  items: z.array(GitLabRepositorySchema),
});

// Issue related schemas
export const GitLabLabelSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  text_color: z.string(),
  description: z.string().nullable(),
  description_html: z.string().nullable(),
  open_issues_count: z.number().optional(),
  closed_issues_count: z.number().optional(),
  open_merge_requests_count: z.number().optional(),
  subscribed: z.boolean().optional(),
  priority: z.number().nullable().optional(),
  is_project_label: z.boolean().optional(),
});

export const GitLabUserSchema = z.object({
  username: z.string(), // Changed from login to match GitLab API
  id: z.number(),
  name: z.string(),
  avatar_url: z.string(),
  web_url: z.string(), // Changed from html_url to match GitLab API
});

export const GitLabMilestoneSchema = z.object({
  id: z.number(),
  iid: z.number(), // Added to match GitLab API
  title: z.string(),
  description: z.string(),
  state: z.string(),
  web_url: z.string(), // Changed from html_url to match GitLab API
});

export const GitLabIssueSchema = z.object({
  id: z.number(),
  iid: z.number(), // Added to match GitLab API
  project_id: z.number(), // Added to match GitLab API
  title: z.string(),
  description: z.string(), // Changed from body to match GitLab API
  state: z.string(),
  author: GitLabUserSchema,
  assignees: z.array(GitLabUserSchema),
  labels: z.array(GitLabLabelSchema).or(z.array(z.string())), // Support both label objects and strings
  milestone: GitLabMilestoneSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  web_url: z.string(), // Changed from html_url to match GitLab API
  references: z.object({
    short: z.string(),
    relative: z.string(),
    full: z.string(),
  }).optional(),
  time_stats: z.object({
    time_estimate: z.number(),
    total_time_spent: z.number(),
    human_time_estimate: z.string().nullable(),
    human_total_time_spent: z.string().nullable(),
  }).optional(),
  confidential: z.boolean().optional(),
  due_date: z.string().nullable().optional(),
  discussion_locked: z.boolean().nullable().optional(),
  weight: z.number().nullable().optional(),
});

// NEW SCHEMA: For issue with link details (used in listing issue links)
export const GitLabIssueWithLinkDetailsSchema = GitLabIssueSchema.extend({
  issue_link_id: z.number(),
  link_type: z.enum(['relates_to', 'blocks', 'is_blocked_by']),
  link_created_at: z.string(),
  link_updated_at: z.string(),
});

// Fork related schemas
export const GitLabForkParentSchema = z.object({
  name: z.string(),
  path_with_namespace: z.string(), // Changed from full_name to match GitLab API
  owner: z.object({
    username: z.string(), // Changed from login to match GitLab API
    id: z.number(),
    avatar_url: z.string(),
  }).optional(), // Made optional to handle cases where GitLab API doesn't include it
  web_url: z.string(), // Changed from html_url to match GitLab API
});

export const GitLabForkSchema = GitLabRepositorySchema.extend({
  forked_from_project: GitLabForkParentSchema.optional(), // Made optional to handle cases where GitLab API doesn't include it
});

// Merge Request related schemas (equivalent to Pull Request)
export const GitLabMergeRequestDiffRefSchema = z.object({
  base_sha: z.string(),
  head_sha: z.string(),
  start_sha: z.string(),
});

export const GitLabMergeRequestSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  state: z.string(),
  merged: z.boolean().optional(),
  draft: z.boolean().optional(),
  author: GitLabUserSchema,
  assignees: z.array(GitLabUserSchema).optional(),
  source_branch: z.string(),
  target_branch: z.string(),
  diff_refs: GitLabMergeRequestDiffRefSchema.optional(),
  web_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  merged_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  merge_commit_sha: z.string().nullable(),
  detailed_merge_status: z.string().optional(),
  merge_status: z.string().optional(),
  merge_error: z.string().nullable().optional(),
  work_in_progress: z.boolean().optional(),
  blocking_discussions_resolved: z.boolean().optional(),
  should_remove_source_branch: z.boolean().nullable().optional(),
  force_remove_source_branch: z.boolean().optional(),
  allow_collaboration: z.boolean().optional(),
  allow_maintainer_to_push: z.boolean().optional(),
  changes_count: z.string().optional(),
  merge_when_pipeline_succeeds: z.boolean().optional(),
  squash: z.boolean().optional(),
  labels: z.array(z.string()).optional(),
});

// API Operation Parameter Schemas
const ProjectParamsSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"), // Changed from owner/repo to match GitLab API
});

export const CreateOrUpdateFileSchema = ProjectParamsSchema.extend({
  file_path: z.string().describe("Path where to create/update the file"),
  content: z.string().describe("Content of the file"),
  commit_message: z.string().describe("Commit message"),
  branch: z.string().describe("Branch to create/update the file in"),
  previous_path: z
    .string()
    .optional()
    .describe("Path of the file to move/rename"),
  last_commit_id: z
    .string()
    .optional()
    .describe("Last known file commit ID"),
  commit_id: z
    .string()
    .optional()
    .describe("Current file commit ID (for update operations)"),
});

export const SearchRepositoriesSchema = z.object({
  search: z.string().describe("Search query"), // Changed from query to match GitLab API
  page: z
    .number()
    .optional()
    .describe("Page number for pagination (default: 1)"),
  per_page: z
    .number()
    .optional()
    .describe("Number of results per page (default: 20)"),
});

export const CreateRepositorySchema = z.object({
  name: z.string().describe("Repository name"),
  description: z.string().optional().describe("Repository description"),
  visibility: z
    .enum(["private", "internal", "public"])
    .optional()
    .describe("Repository visibility level"),
  initialize_with_readme: z
    .boolean()
    .optional()
    .describe("Initialize with README.md"),
});

export const GetFileContentsSchema = ProjectParamsSchema.extend({
  file_path: z.string().describe("Path to the file or directory"),
  ref: z.string().optional().describe("Branch/tag/commit to get contents from"),
});

export const PushFilesSchema = ProjectParamsSchema.extend({
  branch: z.string().describe("Branch to push to"),
  files: z
    .array(
      z.object({
        file_path: z.string().describe("Path where to create the file"),
        content: z.string().describe("Content of the file"),
      })
    )
    .describe("Array of files to push"),
  commit_message: z.string().describe("Commit message"),
});

export const CreateIssueSchema = ProjectParamsSchema.extend({
  title: z.string().describe("Issue title"),
  description: z.string().optional().describe("Issue description"),
  assignee_ids: z
    .array(z.number())
    .optional()
    .describe("Array of user IDs to assign"),
  labels: z.array(z.string()).optional().describe("Array of label names"),
  milestone_id: z.number().optional().describe("Milestone ID to assign"),
});

export const CreateMergeRequestSchema = ProjectParamsSchema.extend({
  title: z.string().describe("Merge request title"),
  description: z.string().optional().describe("Merge request description"),
  source_branch: z.string().describe("Branch containing changes"),
  target_branch: z.string().describe("Branch to merge into"),
  draft: z.boolean().optional().describe("Create as draft merge request"),
  allow_collaboration: z
    .boolean()
    .optional()
    .describe("Allow commits from upstream members"),
});

export const ForkRepositorySchema = ProjectParamsSchema.extend({
  namespace: z.string().optional().describe("Namespace to fork to (full path)"),
});

export const CreateBranchSchema = ProjectParamsSchema.extend({
  branch: z.string().describe("Name for the new branch"),
  ref: z.string().optional().describe("Source branch/commit for new branch"),
});

export const GitLabMergeRequestDiffSchema = z.object({
  old_path: z.string(),
  new_path: z.string(),
  a_mode: z.string(),
  b_mode: z.string(),
  diff: z.string(),
  new_file: z.boolean(),
  renamed_file: z.boolean(),
  deleted_file: z.boolean(),
});

export const GetMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z
    .number()
    .describe("The internal ID of the merge request"),
});

export const UpdateMergeRequestSchema = GetMergeRequestSchema.extend({
  title: z.string().optional().describe("The title of the merge request"),
  description: z
    .string()
    .optional()
    .describe("The description of the merge request"),
  target_branch: z.string().optional().describe("The target branch"),
  assignee_ids: z
    .array(z.number())
    .optional()
    .describe("The ID of the users to assign the MR to"),
  labels: z.array(z.string()).optional().describe("Labels for the MR"),
  state_event: z
    .enum(["close", "reopen"])
    .optional()
    .describe("New state (close/reopen) for the MR"),
  remove_source_branch: z
    .boolean()
    .optional()
    .describe("Flag indicating if the source branch should be removed"),
  squash: z
    .boolean()
    .optional()
    .describe("Squash commits into a single commit when merging"),
  draft: z.boolean().optional().describe("Work in progress merge request"),
});

export const GetMergeRequestDiffsSchema = GetMergeRequestSchema.extend({
  view: z.enum(["inline", "parallel"]).optional().describe("Diff view type"),
});

export const CreateNoteSchema = z.object({
  project_id: z.string().describe("Project ID or namespace/project_path"),
  noteable_type: z
    .enum(["issue", "merge_request"])
    .describe("Type of noteable (issue or merge_request)"),
  noteable_iid: z.number().describe("IID of the issue or merge request"),
  body: z.string().describe("Note content"),
});

// Issues API operation schemas
export const ListIssuesSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  assignee_id: z.number().optional().describe("Return issues assigned to the given user ID"),
  assignee_username: z.string().optional().describe("Return issues assigned to the given username"),
  author_id: z.number().optional().describe("Return issues created by the given user ID"),
  author_username: z.string().optional().describe("Return issues created by the given username"),
  confidential: z.boolean().optional().describe("Filter confidential or public issues"),
  created_after: z.string().optional().describe("Return issues created after the given time"),
  created_before: z.string().optional().describe("Return issues created before the given time"),
  due_date: z.string().optional().describe("Return issues that have the due date"),
  label_name: z.array(z.string()).optional().describe("Array of label names"),
  milestone: z.string().optional().describe("Milestone title"),
  scope: z.enum(['created-by-me', 'assigned-to-me', 'all']).optional().describe("Return issues from a specific scope"),
  search: z.string().optional().describe("Search for specific terms"),
  state: z.enum(['opened', 'closed', 'all']).optional().describe("Return issues with a specific state"),
  updated_after: z.string().optional().describe("Return issues updated after the given time"),
  updated_before: z.string().optional().describe("Return issues updated before the given time"),
  with_labels_details: z.boolean().optional().describe("Return more details for each label"),
  page: z.number().optional().describe("Page number for pagination"),
  per_page: z.number().optional().describe("Number of items per page"),
});

export const GetIssueSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.number().describe("The internal ID of the project issue"),
});

export const UpdateIssueSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.number().describe("The internal ID of the project issue"),
  title: z.string().optional().describe("The title of the issue"),
  description: z.string().optional().describe("The description of the issue"),
  assignee_ids: z.array(z.number()).optional().describe("Array of user IDs to assign issue to"),
  confidential: z.boolean().optional().describe("Set the issue to be confidential"),
  discussion_locked: z.boolean().optional().describe("Flag to lock discussions"),
  due_date: z.string().optional().describe("Date the issue is due (YYYY-MM-DD)"),
  labels: z.array(z.string()).optional().describe("Array of label names"),
  milestone_id: z.number().optional().describe("Milestone ID to assign"),
  state_event: z.enum(['close', 'reopen']).optional().describe("Update issue state (close/reopen)"),
  weight: z.number().optional().describe("Weight of the issue (0-9)"),
});

export const DeleteIssueSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.number().describe("The internal ID of the project issue"),
});

// Issue links related schemas
export const GitLabIssueLinkSchema = z.object({
  source_issue: GitLabIssueSchema,
  target_issue: GitLabIssueSchema,
  link_type: z.enum(['relates_to', 'blocks', 'is_blocked_by']),
});

export const ListIssueLinksSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.number().describe("The internal ID of a project's issue"),
});

export const GetIssueLinkSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.number().describe("The internal ID of a project's issue"),
  issue_link_id: z.number().describe("ID of an issue relationship"),
});

export const CreateIssueLinkSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.number().describe("The internal ID of a project's issue"),
  target_project_id: z.string().describe("The ID or URL-encoded path of a target project"),
  target_issue_iid: z.number().describe("The internal ID of a target project's issue"),
  link_type: z.enum(['relates_to', 'blocks', 'is_blocked_by']).optional().describe("The type of the relation, defaults to relates_to"),
});

export const DeleteIssueLinkSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.number().describe("The internal ID of a project's issue"),
  issue_link_id: z.number().describe("The ID of an issue relationship"),
});

// Namespace API operation schemas
export const ListNamespacesSchema = z.object({
  search: z.string().optional().describe("Search term for namespaces"),
  page: z.number().optional().describe("Page number for pagination"),
  per_page: z.number().optional().describe("Number of items per page"),
  owned: z.boolean().optional().describe("Filter for namespaces owned by current user"),
});

export const GetNamespaceSchema = z.object({
  namespace_id: z.string().describe("Namespace ID or full path"),
});

export const VerifyNamespaceSchema = z.object({
  path: z.string().describe("Namespace path to verify"),
});

// Project API operation schemas
export const GetProjectSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
});

export const ListProjectsSchema = z.object({
  search: z.string().optional().describe("Search term for projects"),
  page: z.number().optional().describe("Page number for pagination"),
  per_page: z.number().optional().describe("Number of items per page"),
  owned: z.boolean().optional().describe("Filter for projects owned by current user"),
  membership: z.boolean().optional().describe("Filter for projects where current user is a member"),
  simple: z.boolean().optional().describe("Return only limited fields"),
  archived: z.boolean().optional().describe("Filter for archived projects"),
  visibility: z.enum(["public", "internal", "private"]).optional().describe("Filter by project visibility"),
  order_by: z.enum(["id", "name", "path", "created_at", "updated_at", "last_activity_at"]).optional().describe("Return projects ordered by field"),
  sort: z.enum(["asc", "desc"]).optional().describe("Return projects sorted in ascending or descending order"),
  with_issues_enabled: z.boolean().optional().describe("Filter projects with issues feature enabled"),
  with_merge_requests_enabled: z.boolean().optional().describe("Filter projects with merge requests feature enabled"),
  min_access_level: z.number().optional().describe("Filter by minimum access level"),
});

// Label operation schemas
export const ListLabelsSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  with_counts: z.boolean().optional().describe("Whether or not to include issue and merge request counts"),
  include_ancestor_groups: z.boolean().optional().describe("Include ancestor groups"),
  search: z.string().optional().describe("Keyword to filter labels by"),
});

export const GetLabelSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  label_id: z.union([z.number(), z.string()]).describe("The ID or title of a project's label"),
  include_ancestor_groups: z.boolean().optional().describe("Include ancestor groups"),
});

export const CreateLabelSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  name: z.string().describe("The name of the label"),
  color: z.string().describe("The color of the label given in 6-digit hex notation with leading '#' sign"),
  description: z.string().optional().describe("The description of the label"),
  priority: z.number().nullable().optional().describe("The priority of the label"),
});

export const UpdateLabelSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  label_id: z.union([z.number(), z.string()]).describe("The ID or title of a project's label"),
  new_name: z.string().optional().describe("The new name of the label"),
  color: z.string().optional().describe("The color of the label given in 6-digit hex notation with leading '#' sign"),
  description: z.string().optional().describe("The new description of the label"),
  priority: z.number().nullable().optional().describe("The new priority of the label"),
});

export const DeleteLabelSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  label_id: z.union([z.number(), z.string()]).describe("The ID or title of a project's label"),
});

// Export types
export type GitLabAuthor = z.infer<typeof GitLabAuthorSchema>;
export type GitLabFork = z.infer<typeof GitLabForkSchema>;
export type GitLabIssue = z.infer<typeof GitLabIssueSchema>;
export type GitLabIssueWithLinkDetails = z.infer<typeof GitLabIssueWithLinkDetailsSchema>;
export type GitLabMergeRequest = z.infer<typeof GitLabMergeRequestSchema>;
export type GitLabRepository = z.infer<typeof GitLabRepositorySchema>;
export type GitLabFileContent = z.infer<typeof GitLabFileContentSchema>;
export type GitLabDirectoryContent = z.infer<typeof GitLabDirectoryContentSchema>;
export type GitLabContent = z.infer<typeof GitLabContentSchema>;
export type FileOperation = z.infer<typeof FileOperationSchema>;
export type GitLabTree = z.infer<typeof GitLabTreeSchema>;
export type GitLabCommit = z.infer<typeof GitLabCommitSchema>;
export type GitLabReference = z.infer<typeof GitLabReferenceSchema>;
export type CreateRepositoryOptions = z.infer<typeof CreateRepositoryOptionsSchema>;
export type CreateIssueOptions = z.infer<typeof CreateIssueOptionsSchema>;
export type CreateMergeRequestOptions = z.infer<typeof CreateMergeRequestOptionsSchema>;
export type CreateBranchOptions = z.infer<typeof CreateBranchOptionsSchema>;
export type GitLabCreateUpdateFileResponse = z.infer<typeof GitLabCreateUpdateFileResponseSchema>;
export type GitLabSearchResponse = z.infer<typeof GitLabSearchResponseSchema>;
export type GitLabMergeRequestDiff = z.infer<typeof GitLabMergeRequestDiffSchema>;
export type CreateNoteOptions = z.infer<typeof CreateNoteSchema>;
export type GitLabIssueLink = z.infer<typeof GitLabIssueLinkSchema>;
export type GitLabNamespace = z.infer<typeof GitLabNamespaceSchema>;
export type GitLabNamespaceExistsResponse = z.infer<typeof GitLabNamespaceExistsResponseSchema>;
export type GitLabProject = z.infer<typeof GitLabProjectSchema>;
export type GitLabLabel = z.infer<typeof GitLabLabelSchema>;
