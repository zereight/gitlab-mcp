import { z } from 'zod';
import { flexibleBoolean } from '../utils';
import { PaginationOptionsSchema } from '../shared';

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

// Get Users Schema (read-only)
export const GetUsersSchema = z
  .object({
    username: z
      .string()
      .optional()
      .describe(
        'Exact GitLab username to search for. Use when you know the exact username. Case-sensitive.',
      ),
    public_email: z
      .string()
      .optional()
      .describe(
        'Find user by their public email address. Email must match exactly. Use when searching by email rather than username.',
      ),
    search: z
      .string()
      .optional()
      .describe(
        'Partial text search across user name, username, and public email. Use for fuzzy searching when exact match is unknown.',
      ),
    active: flexibleBoolean
      .optional()
      .describe(
        'Filter for active users (true) or inactive users (false). Active users can log in and access resources.',
      ),
    external: flexibleBoolean
      .optional()
      .describe(
        'Filter for external users who have limited access. External users cannot see internal projects.',
      ),
    blocked: flexibleBoolean
      .optional()
      .describe(
        'Filter for blocked users who cannot log in or access any resources. Useful for security audits.',
      ),
    humans: flexibleBoolean
      .optional()
      .describe(
        'Filter for human users only, excluding bot accounts and internal system users. Use to get real team members.',
      ),
    created_after: z
      .string()
      .optional()
      .describe(
        'Filter users created after this date/time. Format: YYYY-MM-DDTHH:mm:ssZ (ISO 8601). Example: 2024-01-01T00:00:00Z',
      ),
    created_before: z
      .string()
      .optional()
      .describe(
        'Filter users created before this date/time. Format: YYYY-MM-DDTHH:mm:ssZ (ISO 8601). Example: 2024-12-31T23:59:59Z',
      ),
    exclude_active: flexibleBoolean
      .optional()
      .describe('Exclude active users from results, showing only inactive/deactivated users.'),
    exclude_external: flexibleBoolean
      .optional()
      .describe('Exclude external users, showing only internal users with full access rights.'),
    exclude_humans: flexibleBoolean
      .optional()
      .describe('Exclude human users, showing only bot accounts and internal system users.'),
    exclude_internal: flexibleBoolean
      .optional()
      .describe('Exclude internal system users, showing only regular users and bot accounts.'),
    without_project_bots: flexibleBoolean
      .optional()
      .describe(
        'Exclude project bot users that are automatically created for project integrations.',
      ),
    smart_search: flexibleBoolean
      .optional()
      .describe(
        'Override smart search behavior. AUTO-ENABLED for "search" parameter (detects emails/usernames/names with automatic transliteration and fallback). Set to false to disable auto-smart search for "search" queries. Set to true to force smart search for "username"/"public_email" queries. When enabled: 1) Email patterns use exact email search, 2) Username patterns use exact username search, 3) Name patterns use fuzzy search, 4) Non-Latin text is automatically transliterated to Latin.',
      ),
  })
  .merge(PaginationOptionsSchema);

// Search repositories (read-only)
export const SearchRepositoriesSchema = z
  .object({
    q: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Search query for project names, paths, or descriptions. Supports operators: user:username (filter by owner), topic:name (filter by topic). Use simple text for basic search.',
      ),
    with_programming_language: z
      .string()
      .optional()
      .describe(
        'Filter projects by programming language (e.g., "javascript", "python", "go"). More efficient than using language: operator in q parameter.',
      ),
    order_by: z
      .enum(['id', 'name', 'path', 'created_at', 'updated_at', 'star_count', 'last_activity_at'])
      .optional()
      .describe(
        'Sort projects by: id, name, path, created_at, updated_at, star_count, last_activity_at',
      ),
    sort: z
      .enum(['asc', 'desc'])
      .optional()
      .describe('Sort direction: asc for ascending, desc for descending (default)'),
  })
  .merge(PaginationOptionsSchema)
  .refine((data) => data.q ?? data.with_programming_language, {
    message: 'Either q or with_programming_language must be provided',
  });

// Namespace operations (read-only)
export const ListNamespacesSchema = z
  .object({
    search: z
      .string()
      .optional()
      .describe(
        'Search namespaces (groups and user namespaces) by name or path. Returns partial matches. Use to find groups when exact path unknown.',
      ),
    owned_only: flexibleBoolean
      .optional()
      .describe(
        'Show only namespaces where current user is owner. Useful for finding your own groups/projects.',
      ),
    top_level_only: flexibleBoolean
      .optional()
      .describe(
        'Show only root-level namespaces, excluding subgroups. Use to find main organizational groups.',
      ),
    with_statistics: flexibleBoolean
      .optional()
      .describe(
        'Include storage usage, repository count, and other statistics. May slow response for large result sets.',
      ),
    min_access_level: z
      .number()
      .optional()
      .describe(
        'Minimum access level required. 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner.',
      ),
  })
  .merge(PaginationOptionsSchema);

export const GetNamespaceSchema = z.object({
  namespace_id: z.coerce
    .string()
    .refine((val) => val && val !== 'undefined' && val !== 'null', {
      message: 'namespace_id is required and cannot be empty',
    })
    .describe(
      'Namespace identifier: numeric ID or URL-encoded path (e.g., "gitlab-org" or "gitlab-org%2Fgitlab"). Required field.',
    ),
});

export const VerifyNamespaceSchema = z.object({
  namespace: z
    .string()
    .describe(
      'Namespace path to verify existence and access. Can be group path (gitlab-org) or full project path (gitlab-org/gitlab).',
    ),
});

// Project operations (read-only)
export const GetProjectSchema = z.object({
  project_id: z.coerce
    .string()
    .describe(
      'Project identifier: numeric ID or URL-encoded path (e.g., "42" or "gitlab-org%2Fgitlab"). Path separator "/" must be encoded as %2F.',
    ),
  statistics: flexibleBoolean
    .optional()
    .describe(
      'Include repository size, commit count, storage usage, and other metrics. Adds processing overhead.',
    ),
  license: flexibleBoolean
    .optional()
    .describe(
      'Include detected license information from LICENSE file. Shows license type and permissions.',
    ),
  with_custom_attributes: flexibleBoolean
    .optional()
    .describe(
      'Include user-defined custom attributes. Requires admin access. Used for custom metadata.',
    ),
});

// Unified projects schema - handles both user projects and group projects based on group_id presence
export const ListProjectsSchema = z
  .object({
    // SCOPE SELECTOR - determines API endpoint and parameter validation
    group_id: z.coerce
      .string()
      .optional()
      .describe(
        'Group identifier: numeric ID or URL-encoded path (e.g., "28" or "gitlab-org" or "mngmnt%2Fapps"). If provided, lists projects within this group. If omitted, lists YOUR accessible projects across all GitLab.',
      ),

    // SHARED PARAMETERS - work with both user and group scopes
    archived: flexibleBoolean
      .optional()
      .describe(
        'Filter by archive status. true=archived projects only, false=active projects only, omit=both.',
      ),
    visibility: z
      .enum(['public', 'internal', 'private'])
      .optional()
      .describe(
        'Filter by visibility level. public=anyone can see, internal=logged-in users, private=members only.',
      ),
    order_by: z
      .enum([
        'id',
        'name',
        'path',
        'created_at',
        'updated_at',
        'last_activity_at',
        'similarity',
        'repository_size',
        'storage_size',
        'packages_size',
        'wiki_size',
      ])
      .optional()
      .default('created_at')
      .describe(
        'Sort field for results. Options: id, name, path, created_at, updated_at, last_activity_at (recent activity), similarity (search relevance), size metrics.',
      ),
    sort: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe(
        'Sort direction: asc=ascending (oldest/smallest/A-Z first), desc=descending (newest/largest/Z-A first). Default: desc.',
      ),
    search: z
      .string()
      .optional()
      .describe(
        'Search projects by name or description. Partial matches supported. Case-insensitive.',
      ),
    simple: flexibleBoolean
      .optional()
      .default(true)
      .describe(
        'Return minimal project info for faster response. true=basic fields only, false=full details. Default: true.',
      ),
    owned: flexibleBoolean
      .optional()
      .describe(
        'Show only projects where you are the owner, not just a member. Useful for finding your personal projects.',
      ),
    starred: flexibleBoolean
      .optional()
      .describe(
        "Show only projects you've starred (favorited). Useful for finding frequently used projects.",
      ),
    min_access_level: z
      .number()
      .optional()
      .describe(
        'Minimum access level required. 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner.',
      ),
    with_custom_attributes: flexibleBoolean
      .optional()
      .describe(
        'Include user-defined custom attributes. Requires admin access. Used for custom metadata.',
      ),

    // USER-ONLY PARAMETERS - only valid when group_id is NOT provided
    active: flexibleBoolean
      .optional()
      .describe(
        'Filter for active projects (true) or archived projects (false). Active projects are not archived and can be actively developed. USER SCOPE ONLY: Not valid with group_id.',
      ),
    imported: flexibleBoolean
      .optional()
      .describe(
        'Show only projects you imported from GitHub, Bitbucket, or other external systems. USER SCOPE ONLY: Not valid with group_id.',
      ),
    membership: flexibleBoolean
      .optional()
      .describe(
        "Show only projects where you have membership (any access level). Excludes public projects you can see but aren't member of. USER SCOPE ONLY: Not valid with group_id.",
      ),
    statistics: flexibleBoolean
      .optional()
      .describe(
        'Include repository size, commit count, storage usage, and other metrics. Adds processing overhead. USER SCOPE ONLY: Not valid with group_id.',
      ),
    with_programming_language: z
      .string()
      .optional()
      .describe(
        'Filter projects by primary programming language (e.g., "JavaScript", "Python", "Go"). Case-sensitive. USER SCOPE ONLY: Not valid with group_id.',
      ),
    wiki_checksum_failed: flexibleBoolean
      .optional()
      .describe(
        'Find projects with wiki integrity issues. Used for maintenance and troubleshooting. USER SCOPE ONLY: Not valid with group_id.',
      ),
    repository_checksum_failed: flexibleBoolean
      .optional()
      .describe(
        'Find projects with repository integrity issues. Used for maintenance and troubleshooting. USER SCOPE ONLY: Not valid with group_id.',
      ),
    id_after: z
      .number()
      .optional()
      .describe(
        'Pagination cursor: show projects with ID > specified value. Used for efficient pagination. USER SCOPE ONLY: Not valid with group_id.',
      ),
    id_before: z
      .number()
      .optional()
      .describe(
        'Pagination cursor: show projects with ID < specified value. Used for reverse pagination. USER SCOPE ONLY: Not valid with group_id.',
      ),
    last_activity_after: z
      .string()
      .optional()
      .describe(
        'Show projects with recent activity after this date/time. Format: YYYY-MM-DDTHH:mm:ssZ (ISO 8601). USER SCOPE ONLY: Not valid with group_id.',
      ),
    last_activity_before: z
      .string()
      .optional()
      .describe(
        'Show projects with last activity before this date/time. Format: YYYY-MM-DDTHH:mm:ssZ (ISO 8601). USER SCOPE ONLY: Not valid with group_id.',
      ),
    marked_for_deletion_on: z
      .string()
      .optional()
      .describe(
        'Show projects scheduled for deletion on specific date. Format: YYYY-MM-DD. Requires GitLab Premium/Ultimate. USER SCOPE ONLY: Not valid with group_id.',
      ),
    repository_storage: z
      .string()
      .optional()
      .describe(
        'Filter by storage shard name (for multi-shard GitLab installations). Admin use only. USER SCOPE ONLY: Not valid with group_id.',
      ),

    // GROUP-ONLY PARAMETERS - only valid when group_id IS provided
    include_subgroups: flexibleBoolean
      .optional()
      .describe(
        'Include projects from child groups/subgroups. Use to search entire group hierarchy. GROUP SCOPE ONLY: Requires group_id.',
      ),
    with_shared: flexibleBoolean
      .optional()
      .describe(
        'Include projects shared with this group from other groups. Shows collaborative projects. GROUP SCOPE ONLY: Requires group_id.',
      ),
    with_security_reports: flexibleBoolean
      .optional()
      .describe(
        'Filter projects with security scanning results (SAST, DAST, dependency scanning). Premium/Ultimate feature. GROUP SCOPE ONLY: Requires group_id.',
      ),
    topic: z
      .string()
      .optional()
      .describe(
        'Return projects matching a topic. Use to find projects with specific tags or themes. GROUP SCOPE ONLY: Requires group_id.',
      ),
    with_issues_enabled: flexibleBoolean
      .optional()
      .describe(
        'Show only projects with issues/tickets feature enabled. Use to find projects accepting bug reports. GROUP SCOPE ONLY: Requires group_id.',
      ),
    with_merge_requests_enabled: flexibleBoolean
      .optional()
      .describe(
        'Show only projects accepting merge requests. Use to find projects open to contributions. GROUP SCOPE ONLY: Requires group_id.',
      ),
  })
  .merge(PaginationOptionsSchema);

export const ListProjectMembersSchema = z
  .object({
    project_id: z.coerce
      .string()
      .describe(
        'Project identifier: numeric ID or URL-encoded path (e.g., "42" or "gitlab-org%2Fgitlab"). Path separator "/" must be encoded as %2F.',
      ),
    query: z
      .string()
      .optional()
      .describe('Search project members by name or username. Partial matches supported.'),
    user_ids: z
      .array(z.string())
      .optional()
      .describe(
        'Filter to specific user IDs. Pass array of numeric user IDs to get specific members.',
      ),
  })
  .merge(PaginationOptionsSchema);

// Commits (read-only)
export const ListCommitsSchema = z
  .object({
    project_id: z.coerce
      .string()
      .describe(
        'Project identifier: numeric ID or URL-encoded path (e.g., "42" or "gitlab-org%2Fgitlab"). Path separator "/" must be encoded as %2F.',
      ),
    ref_name: z
      .string()
      .optional()
      .describe('Branch or tag name to get commits from. Defaults to default branch if omitted.'),
    since: z
      .string()
      .optional()
      .describe(
        'Start date for commit history. Format: YYYY-MM-DDTHH:mm:ssZ (ISO 8601). Example: 2024-01-01T00:00:00Z',
      ),
    until: z
      .string()
      .optional()
      .describe(
        'End date for commit history. Format: YYYY-MM-DDTHH:mm:ssZ (ISO 8601). Example: 2024-12-31T23:59:59Z',
      ),
    path: z
      .string()
      .optional()
      .describe(
        'Filter commits affecting this file or directory path. Use to see history of specific files.',
      ),
    author: z
      .string()
      .optional()
      .describe('Filter commits by author name or email. Partial matches supported.'),
    all: flexibleBoolean
      .optional()
      .describe(
        'Include commits from all branches, not just the specified ref. Shows complete project history.',
      ),
    with_stats: flexibleBoolean
      .optional()
      .describe(
        'Include additions/deletions count and changed files list for each commit. Adds processing overhead.',
      ),
    first_parent: flexibleBoolean
      .optional()
      .describe(
        'Simplify merge history by following only first parent. Useful for linear history view.',
      ),
    order: z
      .enum(['default', 'topo'])
      .optional()
      .describe(
        'Commit ordering: default=chronological, topo=topological (respects branch structure).',
      ),
    trailers: flexibleBoolean
      .optional()
      .describe(
        'Include Git trailers (Signed-off-by, Co-authored-by, etc.) parsed from commit messages.',
      ),
  })
  .merge(PaginationOptionsSchema);

export const GetCommitSchema = z.object({
  project_id: z.coerce
    .string()
    .describe(
      'Project identifier: numeric ID or URL-encoded path (e.g., "42" or "gitlab-org%2Fgitlab"). Path separator "/" must be encoded as %2F.',
    ),
  commit_sha: z
    .string()
    .describe(
      'Commit SHA hash (40 chars), short hash (7+ chars), or branch/tag name. Example: abc123def or main.',
    ),
  stats: flexibleBoolean
    .optional()
    .describe('Include file changes statistics: additions, deletions, total changes per file.'),
});

export const GetCommitDiffSchema = z.object({
  project_id: z.coerce
    .string()
    .describe(
      'Project identifier: numeric ID or URL-encoded path (e.g., "42" or "gitlab-org%2Fgitlab"). Path separator "/" must be encoded as %2F.',
    ),
  commit_sha: z
    .string()
    .describe(
      'Commit SHA hash (40 chars), short hash (7+ chars), or branch/tag name. Example: abc123def or main.',
    ),
  unidiff: flexibleBoolean
    .optional()
    .describe('Return diff in unified format (like git diff output). Useful for patch generation.'),
});

// Group iterations (read-only)
export const ListGroupIterationsSchema = z
  .object({
    group_id: z.coerce
      .string()
      .describe(
        'Group identifier: numeric ID or URL-encoded path (e.g., "gitlab-org" or "gitlab-org%2Fsubgroup").',
      ),
    state: z
      .enum(['opened', 'upcoming', 'current', 'closed', 'all'])
      .optional()
      .describe(
        'Filter iterations by state: opened=active, upcoming=future, current=in progress, closed=completed, all=everything.',
      ),
    search: z
      .string()
      .optional()
      .describe('Search iterations by title. Partial text matches supported. Case-insensitive.'),
    include_ancestors: flexibleBoolean
      .optional()
      .describe(
        'Include iterations from parent/ancestor groups in hierarchy. Shows inherited iterations.',
      ),
  })
  .merge(PaginationOptionsSchema);

// Download attachments (read-only)
export const DownloadAttachmentSchema = z.object({
  project_id: z.coerce
    .string()
    .describe(
      'Project identifier: numeric ID or URL-encoded path (e.g., "42" or "gitlab-org%2Fgitlab"). Path separator "/" must be encoded as %2F.',
    ),
  secret: z
    .string()
    .describe(
      'Security token from the uploaded file URL. Found in GitLab attachment URLs after /uploads/.',
    ),
  filename: z
    .string()
    .describe('Original filename of the attachment. Must match the uploaded filename exactly.'),
});

// Events (read-only)
export const ListEventsSchema = z
  .object({
    action: z
      .enum([
        'created',
        'updated',
        'closed',
        'reopened',
        'pushed',
        'commented',
        'merged',
        'joined',
        'left',
        'destroyed',
        'expired',
      ])
      .optional()
      .describe(
        'Filter by event action: created/updated/closed/reopened (issues/MRs), pushed (commits), commented (notes), merged (MRs), joined/left (members), destroyed/expired (misc).',
      ),
    target_type: z
      .enum(['issue', 'milestone', 'merge_request', 'note', 'project', 'snippet', 'user'])
      .optional()
      .describe(
        'Filter by what the event affected: issue, milestone, merge_request, note (comment), project, snippet, user.',
      ),
    before: z
      .string()
      .optional()
      .describe(
        'Show events before this date. Format: YYYY-MM-DD. Example: 2024-12-31 for events before end of 2024.',
      ),
    after: z
      .string()
      .optional()
      .describe(
        'Show events after this date. Format: YYYY-MM-DD. Example: 2024-01-01 for events from 2024 onwards.',
      ),
    sort: z
      .enum(['asc', 'desc'])
      .optional()
      .describe(
        'Sort order for events: asc=oldest first (chronological), desc=newest first (reverse chronological).',
      ),
  })
  .merge(PaginationOptionsSchema);

export const GetProjectEventsSchema = z
  .object({
    project_id: z.coerce
      .string()
      .describe(
        'Project identifier: numeric ID or URL-encoded path (e.g., "42" or "gitlab-org%2Fgitlab"). Path separator "/" must be encoded as %2F.',
      ),
    action: z
      .enum([
        'created',
        'updated',
        'closed',
        'reopened',
        'pushed',
        'commented',
        'merged',
        'joined',
        'left',
        'destroyed',
        'expired',
      ])
      .optional()
      .describe(
        'Filter by event action: created/updated/closed/reopened (issues/MRs), pushed (commits), commented (notes), merged (MRs), joined/left (members), destroyed/expired (misc).',
      ),
    target_type: z
      .enum(['issue', 'milestone', 'merge_request', 'note', 'project', 'snippet', 'user'])
      .optional()
      .describe(
        'Filter by what the event affected: issue, milestone, merge_request, note (comment), project, snippet, user.',
      ),
    before: z
      .string()
      .optional()
      .describe(
        'Show events before this date. Format: YYYY-MM-DD. Example: 2024-12-31 for events before end of 2024.',
      ),
    after: z
      .string()
      .optional()
      .describe(
        'Show events after this date. Format: YYYY-MM-DD. Example: 2024-01-01 for events from 2024 onwards.',
      ),
    sort: z
      .enum(['asc', 'desc'])
      .optional()
      .describe(
        'Sort order for events: asc=oldest first (chronological), desc=newest first (reverse chronological).',
      ),
  })
  .merge(PaginationOptionsSchema);

// Export type definitions
export type GitLabSearchResponse = z.infer<typeof GitLabSearchResponseSchema>;
export type GitLabReference = z.infer<typeof GitLabReferenceSchema>;
export type GitLabCompareResult = z.infer<typeof GitLabCompareResultSchema>;
export type GetUsersOptions = z.infer<typeof GetUsersSchema>;
export type SearchRepositoriesOptions = z.infer<typeof SearchRepositoriesSchema>;
export type ListNamespacesOptions = z.infer<typeof ListNamespacesSchema>;
export type GetNamespaceOptions = z.infer<typeof GetNamespaceSchema>;
export type VerifyNamespaceOptions = z.infer<typeof VerifyNamespaceSchema>;
export type GetProjectOptions = z.infer<typeof GetProjectSchema>;
export type ListProjectsOptions = z.infer<typeof ListProjectsSchema>;
export type ListProjectMembersOptions = z.infer<typeof ListProjectMembersSchema>;
export type ListCommitsOptions = z.infer<typeof ListCommitsSchema>;
export type GetCommitOptions = z.infer<typeof GetCommitSchema>;
export type GetCommitDiffOptions = z.infer<typeof GetCommitDiffSchema>;
export type ListGroupIterationsOptions = z.infer<typeof ListGroupIterationsSchema>;
export type DownloadAttachmentOptions = z.infer<typeof DownloadAttachmentSchema>;
export type ListEventsOptions = z.infer<typeof ListEventsSchema>;
export type GetProjectEventsOptions = z.infer<typeof GetProjectEventsSchema>;
