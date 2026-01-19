import { z } from "zod";
import { flexibleBoolean } from "../utils";
import { PaginationOptionsSchema } from "../shared";

// READ-ONLY OPERATION SCHEMAS

// Response schemas (read-only)
export const GitLabSearchResponseSchema = z.object({
  data: z.array(z.unknown()),
  total_count: z.number(),
});

export const GitLabReferenceSchema = z.object({
  type: z.string(),
  name: z.string(),
  path: z.string(),
  location: z.string(),
});

export const GitLabCompareResultSchema = z.object({
  commit: z.object({
    id: z.string(),
    short_id: z.string(),
    title: z.string(),
    author_name: z.string(),
    author_email: z.string(),
    authored_date: z.string(),
    committer_name: z.string(),
    committer_email: z.string(),
    committed_date: z.string(),
    message: z.string(),
  }),
  commits: z.array(z.unknown()),
  diffs: z.array(z.unknown()),
});

// ============================================================================
// CONSOLIDATED CQRS SCHEMAS (Issue #16)
// ============================================================================

// browse_projects: Consolidates search_repositories, list_projects, get_project (3 → 1)
export const BrowseProjectsSchema = z
  .object({
    action: z
      .enum(["search", "list", "get"])
      .describe(
        "Operation to perform: search=find projects by criteria, list=browse accessible projects, get=retrieve specific project details."
      ),

    // For "get" action - project identifier
    project_id: z.coerce
      .string()
      .optional()
      .describe(
        'Project identifier for "get" action. Numeric ID or URL-encoded path (e.g., "42" or "gitlab-org%2Fgitlab").'
      ),

    // For "search" action
    q: z
      .string()
      .optional()
      .describe(
        'Search query for "search" action. Searches project names, paths, descriptions. Supports operators: topic:name.'
      ),
    with_programming_language: z
      .string()
      .optional()
      .describe(
        'Filter by programming language (e.g., "javascript", "python"). Works with search and list actions.'
      ),

    // For "list" action - scope selector
    group_id: z.coerce
      .string()
      .optional()
      .describe(
        'For "list" action: Group ID to list projects within. If omitted, lists YOUR accessible projects.'
      ),

    // Common filters
    visibility: z
      .enum(["public", "internal", "private"])
      .optional()
      .describe("Filter by visibility: public, internal, or private."),
    archived: flexibleBoolean
      .optional()
      .describe("Filter by archive status. true=archived only, false=active only."),
    owned: flexibleBoolean.optional().describe("Show only projects you own (not just member of)."),
    starred: flexibleBoolean.optional().describe("Show only starred/favorited projects."),
    membership: flexibleBoolean
      .optional()
      .describe("Show only projects where you have membership."),
    search: z
      .string()
      .optional()
      .describe("Text search in project name/description for list action."),
    simple: flexibleBoolean
      .optional()
      .default(true)
      .describe("Return minimal fields for faster response. Default: true."),
    order_by: z
      .enum(["id", "name", "path", "created_at", "updated_at", "last_activity_at", "similarity"])
      .optional()
      .describe("Sort field for results."),
    sort: z.enum(["asc", "desc"]).optional().describe("Sort direction: asc or desc."),

    // For "get" action - additional options
    statistics: flexibleBoolean
      .optional()
      .describe('Include repository statistics (for "get" action).'),
    license: flexibleBoolean.optional().describe('Include license information (for "get" action).'),

    // Group-specific options for "list" with group_id
    include_subgroups: flexibleBoolean
      .optional()
      .describe("Include projects from subgroups (requires group_id)."),
    with_shared: flexibleBoolean
      .optional()
      .describe("Include shared projects (requires group_id)."),
  })
  .merge(PaginationOptionsSchema);

// browse_namespaces: Consolidates list_namespaces, get_namespace, verify_namespace (3 → 1)
export const BrowseNamespacesSchema = z
  .object({
    action: z
      .enum(["list", "get", "verify"])
      .describe("Operation: list=browse namespaces, get=retrieve details, verify=check existence."),

    // For "get" and "verify" actions
    namespace_id: z.coerce
      .string()
      .optional()
      .describe('Namespace ID or path for "get"/"verify" actions.'),

    // For "list" action
    search: z.string().optional().describe('Search namespaces by name/path (for "list" action).'),
    owned_only: flexibleBoolean.optional().describe("Show only namespaces you own."),
    top_level_only: flexibleBoolean.optional().describe("Show only root-level namespaces."),
    with_statistics: flexibleBoolean.optional().describe("Include storage/count statistics."),
    min_access_level: z
      .number()
      .optional()
      .describe(
        "Minimum access level: 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner."
      ),
  })
  .merge(PaginationOptionsSchema);

// browse_commits: Consolidates list_commits, get_commit, get_commit_diff (3 → 1)
export const BrowseCommitsSchema = z
  .object({
    action: z
      .enum(["list", "get", "diff"])
      .describe("Operation: list=browse history, get=commit details, diff=code changes."),

    project_id: z.coerce
      .string()
      .describe("Project ID or URL-encoded path (required for all actions)."),

    // For "get" and "diff" actions
    sha: z
      .string()
      .optional()
      .describe('Commit SHA for "get"/"diff" actions. Can be full SHA, short hash, or ref name.'),

    // For "list" action
    ref_name: z
      .string()
      .optional()
      .describe('Branch/tag name for "list" action. Defaults to default branch.'),
    since: z.string().optional().describe("Start date filter (ISO 8601 format)."),
    until: z.string().optional().describe("End date filter (ISO 8601 format)."),
    path: z.string().optional().describe("Filter commits affecting this file/directory path."),
    author: z.string().optional().describe("Filter by author name or email."),
    all: flexibleBoolean.optional().describe("Include commits from all branches."),
    first_parent: flexibleBoolean.optional().describe("Follow only first parent (linear history)."),
    order: z.enum(["default", "topo"]).optional().describe("Commit ordering: default or topo."),

    // For "get" action
    stats: flexibleBoolean
      .optional()
      .describe('Include file change statistics (for "get" action).'),
    with_stats: flexibleBoolean
      .optional()
      .describe('Include stats for each commit (for "list" action).'),
    trailers: flexibleBoolean.optional().describe("Include Git trailers (Signed-off-by, etc.)."),

    // For "diff" action
    unidiff: flexibleBoolean.optional().describe('Return unified diff format (for "diff" action).'),
  })
  .merge(PaginationOptionsSchema);

// browse_events: Consolidates list_events, get_project_events (2 → 1)
export const BrowseEventsSchema = z
  .object({
    action: z
      .enum(["user", "project"])
      .describe(
        "Scope: user=your activity across all projects, project=specific project activity."
      ),

    // For "project" action
    project_id: z.coerce
      .string()
      .optional()
      .describe('Project ID (required for "project" action).'),

    // Common filters
    target_type: z
      .enum(["issue", "milestone", "merge_request", "note", "project", "snippet", "user"])
      .optional()
      .describe("Filter by target type."),
    event_action: z
      .enum([
        "created",
        "updated",
        "closed",
        "reopened",
        "pushed",
        "commented",
        "merged",
        "joined",
        "left",
        "destroyed",
        "expired",
      ])
      .optional()
      .describe("Filter by event action."),
    before: z.string().optional().describe("Show events before this date (YYYY-MM-DD)."),
    after: z.string().optional().describe("Show events after this date (YYYY-MM-DD)."),
    sort: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Sort order: asc=oldest first, desc=newest first."),
  })
  .merge(PaginationOptionsSchema);

// ============================================================================
// KEPT AS-IS SCHEMAS (not consolidated)
// ============================================================================

// Get Users Schema (kept as-is - complex smart search)
export const GetUsersSchema = z
  .object({
    username: z.string().optional().describe("Exact username to search for. Case-sensitive."),
    public_email: z.string().optional().describe("Find user by exact public email address."),
    search: z.string().optional().describe("Partial text search across name, username, and email."),
    active: flexibleBoolean
      .optional()
      .describe("Filter for active (true) or inactive (false) users."),
    external: flexibleBoolean.optional().describe("Filter for external users with limited access."),
    blocked: flexibleBoolean.optional().describe("Filter for blocked users."),
    humans: flexibleBoolean.optional().describe("Filter for human users only (exclude bots)."),
    created_after: z
      .string()
      .optional()
      .describe("Filter users created after this date (ISO 8601)."),
    created_before: z
      .string()
      .optional()
      .describe("Filter users created before this date (ISO 8601)."),
    exclude_active: flexibleBoolean.optional().describe("Exclude active users."),
    exclude_external: flexibleBoolean.optional().describe("Exclude external users."),
    exclude_humans: flexibleBoolean.optional().describe("Exclude human users."),
    exclude_internal: flexibleBoolean.optional().describe("Exclude internal system users."),
    without_project_bots: flexibleBoolean.optional().describe("Exclude project bot users."),
    smart_search: flexibleBoolean
      .optional()
      .describe(
        "Enable smart search with auto-detection and transliteration. Auto-enabled for search parameter."
      ),
  })
  .merge(PaginationOptionsSchema);

// List Project Members (kept as-is - different scope)
export const ListProjectMembersSchema = z
  .object({
    project_id: z.coerce.string().describe("Project ID or URL-encoded path."),
    query: z.string().optional().describe("Search members by name or username."),
    user_ids: z.array(z.string()).optional().describe("Filter to specific user IDs."),
  })
  .merge(PaginationOptionsSchema);

// List Group Iterations (kept as-is - Premium feature)
export const ListGroupIterationsSchema = z
  .object({
    group_id: z.coerce.string().describe("Group ID or URL-encoded path."),
    state: z
      .enum(["opened", "upcoming", "current", "closed", "all"])
      .optional()
      .describe("Filter by iteration state."),
    search: z.string().optional().describe("Search iterations by title."),
    include_ancestors: flexibleBoolean
      .optional()
      .describe("Include iterations from parent groups."),
  })
  .merge(PaginationOptionsSchema);

// Download Attachment (kept as-is - binary operation)
export const DownloadAttachmentSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path."),
  secret: z.string().describe("Security token from the attachment URL."),
  filename: z.string().describe("Original filename of the attachment."),
});

// Todos (read-only listing)
export const ListTodosSchema = z
  .object({
    state: z
      .enum(["pending", "done"])
      .optional()
      .describe("Filter todos by state: pending=active, done=completed."),
    action: z
      .enum([
        "assigned",
        "mentioned",
        "build_failed",
        "marked",
        "approval_required",
        "unmergeable",
        "directly_addressed",
        "merge_train_removed",
        "review_requested",
        "member_access_requested",
        "review_submitted",
      ])
      .optional()
      .describe("Filter by action type."),
    type: z
      .enum([
        "Issue",
        "MergeRequest",
        "Commit",
        "Epic",
        "DesignManagement::Design",
        "AlertManagement::Alert",
      ])
      .optional()
      .describe("Filter by target type."),
    project_id: z.number().optional().describe("Filter by project ID."),
    group_id: z.number().optional().describe("Filter by group ID."),
    author_id: z.number().optional().describe("Filter by author ID."),
  })
  .merge(PaginationOptionsSchema);

// ============================================================================
// DEPRECATED SCHEMAS (kept for backward compatibility during transition)
// These will be removed in a future version - use consolidated schemas instead
// ============================================================================

// @deprecated Use BrowseProjectsSchema with action: "search"
export const SearchRepositoriesSchema = z
  .object({
    q: z
      .string()
      .min(1)
      .optional()
      .describe("Search query for project names, paths, or descriptions."),
    with_programming_language: z.string().optional().describe("Filter by programming language."),
    order_by: z
      .enum(["id", "name", "path", "created_at", "updated_at", "star_count", "last_activity_at"])
      .optional(),
    sort: z.enum(["asc", "desc"]).optional(),
  })
  .merge(PaginationOptionsSchema)
  .refine(data => data.q ?? data.with_programming_language, {
    message: "Either q or with_programming_language must be provided",
  });

// @deprecated Use BrowseProjectsSchema with action: "list"
export const ListProjectsSchema = z
  .object({
    group_id: z.coerce.string().optional(),
    archived: flexibleBoolean.optional(),
    visibility: z.enum(["public", "internal", "private"]).optional(),
    order_by: z
      .enum([
        "id",
        "name",
        "path",
        "created_at",
        "updated_at",
        "last_activity_at",
        "similarity",
        "repository_size",
        "storage_size",
        "packages_size",
        "wiki_size",
      ])
      .optional()
      .default("created_at"),
    sort: z.enum(["asc", "desc"]).optional().default("desc"),
    search: z.string().optional(),
    simple: flexibleBoolean.optional().default(true),
    owned: flexibleBoolean.optional(),
    starred: flexibleBoolean.optional(),
    min_access_level: z.number().optional(),
    with_custom_attributes: flexibleBoolean.optional(),
    active: flexibleBoolean.optional(),
    imported: flexibleBoolean.optional(),
    membership: flexibleBoolean.optional(),
    statistics: flexibleBoolean.optional(),
    with_programming_language: z.string().optional(),
    wiki_checksum_failed: flexibleBoolean.optional(),
    repository_checksum_failed: flexibleBoolean.optional(),
    id_after: z.number().optional(),
    id_before: z.number().optional(),
    last_activity_after: z.string().optional(),
    last_activity_before: z.string().optional(),
    marked_for_deletion_on: z.string().optional(),
    repository_storage: z.string().optional(),
    include_subgroups: flexibleBoolean.optional(),
    with_shared: flexibleBoolean.optional(),
    with_security_reports: flexibleBoolean.optional(),
    topic: z.string().optional(),
    with_issues_enabled: flexibleBoolean.optional(),
    with_merge_requests_enabled: flexibleBoolean.optional(),
  })
  .merge(PaginationOptionsSchema);

// @deprecated Use BrowseProjectsSchema with action: "get"
export const GetProjectSchema = z.object({
  project_id: z.coerce.string().optional(),
  namespace: z.coerce.string().optional(),
  statistics: flexibleBoolean.optional(),
  license: flexibleBoolean.optional(),
  with_custom_attributes: flexibleBoolean.optional(),
});

// @deprecated Use BrowseNamespacesSchema with action: "list"
export const ListNamespacesSchema = z
  .object({
    search: z.string().optional(),
    owned_only: flexibleBoolean.optional(),
    top_level_only: flexibleBoolean.optional(),
    with_statistics: flexibleBoolean.optional(),
    min_access_level: z.number().optional(),
  })
  .merge(PaginationOptionsSchema);

// @deprecated Use BrowseNamespacesSchema with action: "get"
export const GetNamespaceSchema = z.object({
  namespace_id: z.coerce.string().refine(val => val && val !== "undefined" && val !== "null", {
    message: "namespace_id is required and cannot be empty",
  }),
});

// @deprecated Use BrowseNamespacesSchema with action: "verify"
export const VerifyNamespaceSchema = z.object({
  namespace: z.string(),
});

// @deprecated Use BrowseCommitsSchema with action: "list"
export const ListCommitsSchema = z
  .object({
    project_id: z.coerce.string(),
    ref_name: z.string().optional(),
    since: z.string().optional(),
    until: z.string().optional(),
    path: z.string().optional(),
    author: z.string().optional(),
    all: flexibleBoolean.optional(),
    with_stats: flexibleBoolean.optional(),
    first_parent: flexibleBoolean.optional(),
    order: z.enum(["default", "topo"]).optional(),
    trailers: flexibleBoolean.optional(),
  })
  .merge(PaginationOptionsSchema);

// @deprecated Use BrowseCommitsSchema with action: "get"
export const GetCommitSchema = z.object({
  project_id: z.coerce.string(),
  commit_sha: z.string(),
  stats: flexibleBoolean.optional(),
});

// @deprecated Use BrowseCommitsSchema with action: "diff"
export const GetCommitDiffSchema = z.object({
  project_id: z.coerce.string(),
  commit_sha: z.string(),
  unidiff: flexibleBoolean.optional(),
});

// @deprecated Use BrowseEventsSchema with action: "user"
export const ListEventsSchema = z
  .object({
    action: z
      .enum([
        "created",
        "updated",
        "closed",
        "reopened",
        "pushed",
        "commented",
        "merged",
        "joined",
        "left",
        "destroyed",
        "expired",
      ])
      .optional(),
    target_type: z
      .enum(["issue", "milestone", "merge_request", "note", "project", "snippet", "user"])
      .optional(),
    before: z.string().optional(),
    after: z.string().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
  })
  .merge(PaginationOptionsSchema);

// @deprecated Use BrowseEventsSchema with action: "project"
export const GetProjectEventsSchema = z
  .object({
    project_id: z.coerce.string(),
    action: z
      .enum([
        "created",
        "updated",
        "closed",
        "reopened",
        "pushed",
        "commented",
        "merged",
        "joined",
        "left",
        "destroyed",
        "expired",
      ])
      .optional(),
    target_type: z
      .enum(["issue", "milestone", "merge_request", "note", "project", "snippet", "user"])
      .optional(),
    before: z.string().optional(),
    after: z.string().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
  })
  .merge(PaginationOptionsSchema);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type GitLabSearchResponse = z.infer<typeof GitLabSearchResponseSchema>;
export type GitLabReference = z.infer<typeof GitLabReferenceSchema>;
export type GitLabCompareResult = z.infer<typeof GitLabCompareResultSchema>;

// Consolidated types
export type BrowseProjectsOptions = z.infer<typeof BrowseProjectsSchema>;
export type BrowseNamespacesOptions = z.infer<typeof BrowseNamespacesSchema>;
export type BrowseCommitsOptions = z.infer<typeof BrowseCommitsSchema>;
export type BrowseEventsOptions = z.infer<typeof BrowseEventsSchema>;

// Kept as-is types
export type GetUsersOptions = z.infer<typeof GetUsersSchema>;
export type ListProjectMembersOptions = z.infer<typeof ListProjectMembersSchema>;
export type ListGroupIterationsOptions = z.infer<typeof ListGroupIterationsSchema>;
export type DownloadAttachmentOptions = z.infer<typeof DownloadAttachmentSchema>;
export type ListTodosOptions = z.infer<typeof ListTodosSchema>;

// Deprecated types (kept for backward compatibility)
export type SearchRepositoriesOptions = z.infer<typeof SearchRepositoriesSchema>;
export type ListNamespacesOptions = z.infer<typeof ListNamespacesSchema>;
export type GetNamespaceOptions = z.infer<typeof GetNamespaceSchema>;
export type VerifyNamespaceOptions = z.infer<typeof VerifyNamespaceSchema>;
export type GetProjectOptions = z.infer<typeof GetProjectSchema>;
export type ListProjectsOptions = z.infer<typeof ListProjectsSchema>;
export type ListCommitsOptions = z.infer<typeof ListCommitsSchema>;
export type GetCommitOptions = z.infer<typeof GetCommitSchema>;
export type GetCommitDiffOptions = z.infer<typeof GetCommitDiffSchema>;
export type ListEventsOptions = z.infer<typeof ListEventsSchema>;
export type GetProjectEventsOptions = z.infer<typeof GetProjectEventsSchema>;
