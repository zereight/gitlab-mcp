import { z } from "zod";
import { flexibleBoolean } from "../utils";
import { PaginationOptionsSchema } from "../shared";

// ============================================================================
// READ-ONLY RESPONSE SCHEMAS
// ============================================================================

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
// CONSOLIDATED CQRS SCHEMAS WITH DISCRIMINATED UNIONS (Issue #16)
// ============================================================================

// Common options shared across project actions
const CommonProjectOptions = {
  visibility: z
    .enum(["public", "internal", "private"])
    .optional()
    .describe("Filter by visibility: public, internal, or private."),
  archived: flexibleBoolean
    .optional()
    .describe("Filter by archive status. true=archived only, false=active only."),
  order_by: z
    .enum(["id", "name", "path", "created_at", "updated_at", "last_activity_at", "similarity"])
    .optional()
    .describe("Sort field for results."),
  sort: z.enum(["asc", "desc"]).optional().describe("Sort direction: asc or desc."),
};

// browse_projects: Discriminated union for search/list/get actions
// Note: 'q' is for action:search (global search API), 'search' is for action:list (project listing filter)
const SearchProjectsAction = z
  .object({
    action: z.literal("search").describe("Find projects by search criteria."),
    q: z
      .string()
      .optional()
      .describe(
        "Global search query (for 'search' action). Searches project names, paths, descriptions. Supports operators: topic:name."
      ),
    with_programming_language: z
      .string()
      .optional()
      .describe('Filter by programming language (e.g., "javascript", "python").'),
    ...CommonProjectOptions,
  })
  .merge(PaginationOptionsSchema);

const ListProjectsAction = z
  .object({
    action: z.literal("list").describe("Browse accessible projects."),
    group_id: z.coerce
      .string()
      .optional()
      .describe("Group ID to list projects within. If omitted, lists YOUR accessible projects."),
    search: z
      .string()
      .optional()
      .describe("Text filter for 'list' action (filters results by name/description)."),
    owned: flexibleBoolean.optional().describe("Show only projects you own (not just member of)."),
    starred: flexibleBoolean.optional().describe("Show only starred/favorited projects."),
    membership: flexibleBoolean
      .optional()
      .describe("Show only projects where you have membership."),
    simple: flexibleBoolean
      .optional()
      .default(true)
      .describe("Return minimal fields for faster response. Default: true."),
    with_programming_language: z
      .string()
      .optional()
      .describe('Filter by programming language (e.g., "javascript", "python").'),
    include_subgroups: flexibleBoolean
      .optional()
      .describe("Include projects from subgroups (requires group_id)."),
    with_shared: flexibleBoolean
      .optional()
      .describe("Include shared projects (requires group_id)."),
    ...CommonProjectOptions,
  })
  .merge(PaginationOptionsSchema);

const GetProjectAction = z.object({
  action: z.literal("get").describe("Retrieve specific project details."),
  project_id: z.coerce
    .string()
    .describe(
      'Project identifier (required). Numeric ID or URL-encoded path (e.g., "42" or "gitlab-org%2Fgitlab").'
    ),
  statistics: flexibleBoolean.optional().describe("Include repository statistics."),
  license: flexibleBoolean.optional().describe("Include license information."),
});

export const BrowseProjectsSchema = z
  .discriminatedUnion("action", [SearchProjectsAction, ListProjectsAction, GetProjectAction])
  .describe(
    "PROJECT BROWSING: Use 'search' to find projects by criteria, 'list' to browse accessible projects, 'get' to retrieve specific project details."
  );

// browse_namespaces: Discriminated union for list/get/verify actions
const ListNamespacesAction = z
  .object({
    action: z.literal("list").describe("Browse namespaces (groups and user namespaces)."),
    search: z.string().optional().describe("Search namespaces by name/path."),
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

const GetNamespaceAction = z.object({
  action: z.literal("get").describe("Retrieve specific namespace details."),
  namespace_id: z.coerce.string().describe("Namespace ID or path (required). Cannot be empty."),
});

const VerifyNamespaceAction = z.object({
  action: z.literal("verify").describe("Check if namespace exists and is accessible."),
  namespace_id: z.coerce.string().describe("Namespace path to verify (required)."),
});

export const BrowseNamespacesSchema = z
  .discriminatedUnion("action", [ListNamespacesAction, GetNamespaceAction, VerifyNamespaceAction])
  .describe(
    "NAMESPACE BROWSING: Use 'list' to browse namespaces, 'get' to retrieve details, 'verify' to check existence."
  );

// browse_commits: Discriminated union for list/get/diff actions
const ListCommitsAction = z
  .object({
    action: z.literal("list").describe("Browse commit history."),
    project_id: z.coerce.string().describe("Project ID or URL-encoded path (required)."),
    ref_name: z.string().optional().describe("Branch/tag name. Defaults to default branch."),
    since: z.string().optional().describe("Start date filter (ISO 8601 format)."),
    until: z.string().optional().describe("End date filter (ISO 8601 format)."),
    path: z.string().optional().describe("Filter commits affecting this file/directory path."),
    author: z.string().optional().describe("Filter by author name or email."),
    all: flexibleBoolean.optional().describe("Include commits from all branches."),
    first_parent: flexibleBoolean.optional().describe("Follow only first parent (linear history)."),
    order: z.enum(["default", "topo"]).optional().describe("Commit ordering: default or topo."),
    with_stats: flexibleBoolean.optional().describe("Include stats for each commit."),
    trailers: flexibleBoolean.optional().describe("Include Git trailers (Signed-off-by, etc.)."),
  })
  .merge(PaginationOptionsSchema);

const GetCommitAction = z.object({
  action: z.literal("get").describe("Retrieve specific commit details."),
  project_id: z.coerce.string().describe("Project ID or URL-encoded path (required)."),
  sha: z.string().describe("Commit SHA (required). Can be full SHA, short hash, or ref name."),
  stats: flexibleBoolean.optional().describe("Include file change statistics."),
});

const DiffCommitAction = z.object({
  action: z.literal("diff").describe("Get code changes from a commit."),
  project_id: z.coerce.string().describe("Project ID or URL-encoded path (required)."),
  sha: z.string().describe("Commit SHA (required). Can be full SHA, short hash, or ref name."),
  unidiff: flexibleBoolean.optional().describe("Return unified diff format."),
});

export const BrowseCommitsSchema = z
  .discriminatedUnion("action", [ListCommitsAction, GetCommitAction, DiffCommitAction])
  .describe(
    "COMMIT BROWSING: Use 'list' to browse history, 'get' for commit details, 'diff' for code changes."
  );

// browse_events: Discriminated union for user/project scopes
const CommonEventOptions = {
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
};

const UserEventsAction = z
  .object({
    action: z.literal("user").describe("Your activity across all projects."),
    ...CommonEventOptions,
  })
  .merge(PaginationOptionsSchema);

const ProjectEventsAction = z
  .object({
    action: z.literal("project").describe("Activity within a specific project."),
    project_id: z.coerce.string().describe("Project ID (required for project events)."),
    ...CommonEventOptions,
  })
  .merge(PaginationOptionsSchema);

export const BrowseEventsSchema = z
  .discriminatedUnion("action", [UserEventsAction, ProjectEventsAction])
  .describe(
    "EVENT BROWSING: Use 'user' for your activity across all projects, 'project' for specific project activity."
  );

// ============================================================================
// KEPT AS-IS SCHEMAS (not consolidated - have unique purposes)
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
