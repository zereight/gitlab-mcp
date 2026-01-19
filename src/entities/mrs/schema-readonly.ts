import { z } from "zod";
import { flexibleBoolean } from "../utils";
import { PaginationOptionsSchema, ProjectParamsSchema } from "../shared";

// ============================================================================
// browse_merge_requests - CQRS Query Tool (discriminated union)
// Actions: list, get, diffs, compare
// ============================================================================

const BrowseMRsBaseSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
});

// List merge requests action
// Note: project_id is optional here (unlike other actions) to support cross-project MR search.
// When omitted, GitLab returns MRs across all accessible projects.
const BrowseMRsListSchema = z
  .object({
    action: z.literal("list"),
    project_id: z.coerce
      .string()
      .optional()
      .describe("Project ID or URL-encoded path. Optional for cross-project search."),
    state: z
      .enum(["opened", "closed", "locked", "merged", "all"])
      .optional()
      .describe("MR state filter: opened, closed, merged, locked, or all."),
    order_by: z
      .enum(["created_at", "updated_at", "title", "priority"])
      .optional()
      .describe("Sort field: created_at, updated_at, title, or priority."),
    sort: z.enum(["asc", "desc"]).optional().describe("Sort direction: asc or desc."),
    milestone: z.string().optional().describe('Filter by milestone title. Use "None" or "Any".'),
    view: z.enum(["simple", "full"]).optional().describe("Response detail level: simple or full."),
    labels: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe("Filter by labels. Single string, comma-separated, or array."),
    with_labels_details: flexibleBoolean
      .optional()
      .describe("Return full label objects with colors and descriptions."),
    with_merge_status_recheck: flexibleBoolean
      .optional()
      .describe("Trigger async recheck of merge status."),
    created_after: z
      .string()
      .optional()
      .describe("Filter MRs created after this date/time (ISO 8601)."),
    created_before: z
      .string()
      .optional()
      .describe("Filter MRs created before this date/time (ISO 8601)."),
    updated_after: z
      .string()
      .optional()
      .describe("Filter MRs modified after this date/time (ISO 8601)."),
    updated_before: z
      .string()
      .optional()
      .describe("Filter MRs modified before this date/time (ISO 8601)."),
    scope: z
      .enum(["created_by_me", "assigned_to_me", "all"])
      .optional()
      .describe("Filter scope: created_by_me, assigned_to_me, or all."),
    author_id: z.number().optional().describe("Filter by author's numeric user ID."),
    author_username: z.string().optional().describe("Filter by author's username."),
    assignee_id: z.number().optional().describe("Filter by assignee's numeric user ID."),
    assignee_username: z.string().optional().describe("Filter by assignee's username."),
    my_reaction_emoji: z.string().optional().describe("Filter MRs you've reacted to with emoji."),
    source_branch: z.string().optional().describe("Filter by source branch name."),
    target_branch: z.string().optional().describe("Filter by target branch name."),
    search: z.string().optional().describe("Text search in MR title and/or description."),
    in: z
      .enum(["title", "description", "title,description"])
      .optional()
      .describe("Search scope: title, description, or both."),
    wip: z.enum(["yes", "no"]).optional().describe("Draft/WIP filter: yes or no."),
    not: z
      .object({
        labels: z.union([z.string(), z.array(z.string())]).optional(),
        milestone: z.string().optional(),
        author_id: z.number().optional(),
        author_username: z.string().optional(),
        assignee_id: z.number().optional(),
        assignee_username: z.string().optional(),
        my_reaction_emoji: z.string().optional(),
      })
      .optional()
      .describe("Exclusion filters."),
    environment: z.string().optional().describe("Filter by deployment environment name."),
    deployed_before: z.string().optional().describe("Filter MRs deployed before date/time."),
    deployed_after: z.string().optional().describe("Filter MRs deployed after date/time."),
    approved_by_ids: z.array(z.string()).optional().describe("Filter MRs approved by user IDs."),
    approved_by_usernames: z
      .array(z.string())
      .optional()
      .describe("Filter MRs approved by usernames."),
    reviewer_id: z.number().optional().describe("Filter MRs where user ID is a reviewer."),
    reviewer_username: z.string().optional().describe("Filter MRs where username is a reviewer."),
    with_api_entity_associations: flexibleBoolean
      .optional()
      .describe("Include extra API associations like head_pipeline."),
    min_access_level: z.number().optional().describe("Minimum access level filter (10-50)."),
  })
  .merge(PaginationOptionsSchema);

// Get single merge request action
const BrowseMRsGetSchema = BrowseMRsBaseSchema.extend({
  action: z.literal("get"),
  merge_request_iid: z.coerce
    .string()
    .optional()
    .describe("Internal MR ID unique to project (e.g., 42 for MR !42)."),
  branch_name: z.string().optional().describe("Find MR by its source branch name."),
  include_diverged_commits_count: flexibleBoolean
    .optional()
    .describe("Include count of commits the source branch is behind target."),
  include_rebase_in_progress: flexibleBoolean
    .optional()
    .describe("Check if MR is currently being rebased."),
}).refine(data => data.merge_request_iid ?? data.branch_name, {
  message: "Either merge_request_iid or branch_name must be provided",
});

// Get merge request diffs action
const BrowseMRsDiffsSchema = BrowseMRsBaseSchema.extend({
  action: z.literal("diffs"),
  merge_request_iid: z.coerce.string().describe("Internal MR ID unique to project."),
  include_diverged_commits_count: flexibleBoolean
    .optional()
    .describe("Include count of commits the source branch is behind target."),
  include_rebase_in_progress: flexibleBoolean
    .optional()
    .describe("Check if MR is currently being rebased."),
  page: z.number().optional().describe("Page number for pagination."),
  per_page: z.number().optional().describe("Number of items per page."),
});

// Compare branches/commits action
const BrowseMRsCompareSchema = BrowseMRsBaseSchema.extend({
  action: z.literal("compare"),
  from: z.string().describe("Source reference: branch name or commit SHA."),
  to: z.string().describe("Target reference: branch name or commit SHA."),
  straight: flexibleBoolean
    .optional()
    .describe("true=straight diff, false=three-way diff from common ancestor."),
});

export const BrowseMergeRequestsSchema = z.discriminatedUnion("action", [
  BrowseMRsListSchema,
  BrowseMRsGetSchema,
  BrowseMRsDiffsSchema,
  BrowseMRsCompareSchema,
]);

// ============================================================================
// browse_mr_discussions - CQRS Query Tool (discriminated union)
// Actions: list, drafts, draft
// ============================================================================

const BrowseDiscussionsBaseSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  merge_request_iid: z.coerce.string().describe("Internal MR ID unique to project."),
});

// List discussions action
const BrowseDiscussionsListSchema = BrowseDiscussionsBaseSchema.extend({
  action: z.literal("list"),
}).merge(PaginationOptionsSchema);

// List draft notes action
const BrowseDiscussionsDraftsSchema = BrowseDiscussionsBaseSchema.extend({
  action: z.literal("drafts"),
});

// Get single draft note action
const BrowseDiscussionsDraftSchema = BrowseDiscussionsBaseSchema.extend({
  action: z.literal("draft"),
  draft_note_id: z.coerce.string().describe("Unique identifier of the draft note."),
});

export const BrowseMrDiscussionsSchema = z.discriminatedUnion("action", [
  BrowseDiscussionsListSchema,
  BrowseDiscussionsDraftsSchema,
  BrowseDiscussionsDraftSchema,
]);

// ============================================================================
// Legacy schemas (kept for backward compatibility during transition)
// ============================================================================

// Get branch diffs (read-only) - legacy
export const GetBranchDiffsSchema = ProjectParamsSchema.extend({
  from: z.string().describe("Source reference: branch name or commit SHA."),
  to: z.string().describe("Target reference: branch name or commit SHA."),
  straight: flexibleBoolean
    .optional()
    .describe("true=straight diff, false=three-way diff from common ancestor."),
});

// Merge request operations (read-only) - legacy
export const GetMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().optional().describe("Internal MR ID unique to project."),
  branch_name: z.string().optional().describe("Find MR by its source branch name."),
  include_diverged_commits_count: z
    .boolean()
    .optional()
    .describe("Include count of commits the source branch is behind target."),
  include_rebase_in_progress: z
    .boolean()
    .optional()
    .describe("Check if MR is currently being rebased."),
}).refine(data => data.merge_request_iid ?? data.branch_name, {
  message: "Either merge_request_iid or branch_name must be provided",
});

// Base schema for MR operations with just project and IID (no refinements)
const BaseMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("Internal MR ID unique to project."),
  include_diverged_commits_count: z
    .boolean()
    .optional()
    .describe("Include count of commits the source branch is behind target."),
  include_rebase_in_progress: z
    .boolean()
    .optional()
    .describe("Check if MR is currently being rebased."),
});

export const GetMergeRequestDiffsSchema = BaseMergeRequestSchema.extend({
  page: z.number().optional(),
  per_page: z.number().optional(),
});

export const ListMergeRequestDiffsSchema = BaseMergeRequestSchema.extend({
  page: z.number().optional(),
  per_page: z.number().optional(),
});

// List merge request discussions (read-only) - legacy
export const ListMergeRequestDiscussionsSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("Internal MR ID unique to project."),
}).merge(PaginationOptionsSchema);

// Draft notes (read-only) - legacy
export const GetDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("Internal MR ID unique to project."),
  draft_note_id: z.coerce.string().describe("Unique identifier of the draft note."),
});

export const ListDraftNotesSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("Internal MR ID unique to project."),
});

// List merge requests (read-only) - legacy
export const ListMergeRequestsSchema = z
  .object({
    project_id: z.coerce
      .string()
      .optional()
      .describe("Project ID or URL-encoded path. Optional for cross-project search."),
    state: z.enum(["opened", "closed", "locked", "merged", "all"]).optional(),
    order_by: z.enum(["created_at", "updated_at", "title", "priority"]).optional(),
    sort: z.enum(["asc", "desc"]).optional(),
    milestone: z.string().optional(),
    view: z.enum(["simple", "full"]).optional(),
    labels: z.union([z.string(), z.array(z.string())]).optional(),
    with_labels_details: flexibleBoolean.optional(),
    with_merge_status_recheck: flexibleBoolean.optional(),
    created_after: z.string().optional(),
    created_before: z.string().optional(),
    updated_after: z.string().optional(),
    updated_before: z.string().optional(),
    scope: z.enum(["created_by_me", "assigned_to_me", "all"]).optional(),
    author_id: z.number().optional(),
    author_username: z.string().optional(),
    assignee_id: z.number().optional(),
    assignee_username: z.string().optional(),
    my_reaction_emoji: z.string().optional(),
    source_branch: z.string().optional(),
    target_branch: z.string().optional(),
    search: z.string().optional(),
    in: z.enum(["title", "description", "title,description"]).optional(),
    wip: z.enum(["yes", "no"]).optional(),
    not: z
      .object({
        labels: z.union([z.string(), z.array(z.string())]).optional(),
        milestone: z.string().optional(),
        author_id: z.number().optional(),
        author_username: z.string().optional(),
        assignee_id: z.number().optional(),
        assignee_username: z.string().optional(),
        my_reaction_emoji: z.string().optional(),
      })
      .optional(),
    environment: z.string().optional(),
    deployed_before: z.string().optional(),
    deployed_after: z.string().optional(),
    approved_by_ids: z.array(z.string()).optional(),
    approved_by_usernames: z.array(z.string()).optional(),
    reviewer_id: z.number().optional(),
    reviewer_username: z.string().optional(),
    with_api_entity_associations: flexibleBoolean.optional(),
    min_access_level: z.number().optional(),
  })
  .merge(PaginationOptionsSchema);

// Export type definitions
export type BrowseMergeRequestsInput = z.infer<typeof BrowseMergeRequestsSchema>;
export type BrowseMrDiscussionsInput = z.infer<typeof BrowseMrDiscussionsSchema>;
export type GetBranchDiffsOptions = z.infer<typeof GetBranchDiffsSchema>;
export type GetMergeRequestOptions = z.infer<typeof GetMergeRequestSchema>;
export type GetMergeRequestDiffsOptions = z.infer<typeof GetMergeRequestDiffsSchema>;
export type ListMergeRequestDiffsOptions = z.infer<typeof ListMergeRequestDiffsSchema>;
export type ListMergeRequestDiscussionsOptions = z.infer<typeof ListMergeRequestDiscussionsSchema>;
export type GetDraftNoteOptions = z.infer<typeof GetDraftNoteSchema>;
export type ListDraftNotesOptions = z.infer<typeof ListDraftNotesSchema>;
export type ListMergeRequestsOptions = z.infer<typeof ListMergeRequestsSchema>;
