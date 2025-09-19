import { z } from "zod";
import { flexibleBoolean } from "../utils";
import { PaginationOptionsSchema, ProjectParamsSchema } from "../shared";

// READ-ONLY MERGE REQUEST OPERATION SCHEMAS

// Get branch diffs (read-only)
export const GetBranchDiffsSchema = ProjectParamsSchema.extend({
  from: z
    .string()
    .describe(
      'Source reference for comparison: branch name or commit SHA. Example: "feature-branch" or "abc123def".'
    ),
  to: z
    .string()
    .describe(
      'Target reference for comparison: branch name or commit SHA. Example: "main" or "def456ghi".'
    ),
  straight: flexibleBoolean
    .optional()
    .describe(
      "Comparison type: true=straight diff between refs, false=three-way diff from common ancestor (merge-base)."
    ),
});

// Merge request operations (read-only)
export const GetMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce
    .string()
    .optional()
    .describe(
      "Internal MR ID unique to project. Incremental number like !42. Preferred over global ID."
    ),
  branch_name: z
    .string()
    .optional()
    .describe(
      'Find MR by its source branch name. Alternative to using IID. Example: "feature-login".'
    ),
  include_diverged_commits_count: z
    .boolean()
    .optional()
    .describe(
      "Include count of commits the source branch is behind target. Shows if rebase needed."
    ),
  include_rebase_in_progress: z
    .boolean()
    .optional()
    .describe("Check if MR is currently being rebased. Useful for showing rebase status in UI."),
}).refine(data => data.merge_request_iid ?? data.branch_name, {
  message: "Either merge_request_iid or branch_name must be provided",
});

// Base schema for MR operations with just project and IID (no refinements)
const BaseMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce
    .string()
    .describe("Internal MR ID unique to project. Example: 42 for MR !42."),
  include_diverged_commits_count: z
    .boolean()
    .optional()
    .describe(
      "Include count of commits the source branch is behind target. Shows if rebase needed."
    ),
  include_rebase_in_progress: z
    .boolean()
    .optional()
    .describe("Check if MR is currently being rebased. Useful for showing rebase status in UI."),
});

export const GetMergeRequestDiffsSchema = BaseMergeRequestSchema.extend({
  page: z.number().optional(),
  per_page: z.number().optional(),
});

export const ListMergeRequestDiffsSchema = BaseMergeRequestSchema.extend({
  page: z.number().optional(),
  per_page: z.number().optional(),
});

// List merge request discussions (read-only)
export const ListMergeRequestDiscussionsSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce
    .string()
    .describe("Internal MR ID unique to project. Example: 42 for MR !42."),
}).merge(PaginationOptionsSchema);

// Draft notes (read-only)
export const GetDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce
    .string()
    .describe("Internal MR ID unique to project. Example: 42 for MR !42."),
  draft_note_id: z.coerce
    .string()
    .describe(
      "Unique identifier of the draft note/comment. Draft notes are unpublished review comments."
    ),
});

export const ListDraftNotesSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce
    .string()
    .describe("Internal MR ID unique to project. Example: 42 for MR !42."),
});

// List merge requests (read-only)
export const ListMergeRequestsSchema = z
  .object({
    project_id: z.coerce
      .string()
      .optional()
      .describe(
        "Project identifier for filtering. Use numeric ID or URL-encoded path. Optional for cross-project search."
      ),
    state: z
      .enum(["opened", "closed", "locked", "merged", "all"])
      .optional()
      .describe(
        "MR state filter: opened=active, closed=rejected, merged=accepted, locked=read-only, all=everything."
      ),
    order_by: z
      .enum(["created_at", "updated_at", "title", "priority"])
      .optional()
      .describe(
        "Sort field: created_at=creation date, updated_at=last modification, title=alphabetical, priority=importance level."
      ),
    sort: z
      .enum(["asc", "desc"])
      .optional()
      .describe(
        "Sort direction: asc=ascending (oldest/A-Z first), desc=descending (newest/Z-A first)."
      ),
    milestone: z
      .string()
      .optional()
      .describe('Filter by milestone title. Use "None" for no milestone, "Any" for any milestone.'),
    view: z
      .enum(["simple", "full"])
      .optional()
      .describe(
        "Response detail level: simple=basic fields only for performance, full=complete MR details."
      ),
    labels: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe(
        'Filter by labels. Pass single label, comma-separated string, or array. Example: "bug,priority::high".'
      ),
    with_labels_details: flexibleBoolean
      .optional()
      .describe("Return full label objects with colors and descriptions instead of just names."),
    with_merge_status_recheck: flexibleBoolean
      .optional()
      .describe(
        "Trigger async recheck of merge status for all results. Updates can_be_merged field accuracy."
      ),
    created_after: z
      .string()
      .optional()
      .describe(
        "Filter MRs created after this date/time. Format: YYYY-MM-DDTHH:mm:ssZ (ISO 8601)."
      ),
    created_before: z
      .string()
      .optional()
      .describe(
        "Filter MRs created before this date/time. Format: YYYY-MM-DDTHH:mm:ssZ (ISO 8601)."
      ),
    updated_after: z
      .string()
      .optional()
      .describe(
        "Filter MRs modified after this date/time. Format: YYYY-MM-DDTHH:mm:ssZ (ISO 8601)."
      ),
    updated_before: z
      .string()
      .optional()
      .describe(
        "Filter MRs modified before this date/time. Format: YYYY-MM-DDTHH:mm:ssZ (ISO 8601)."
      ),
    scope: z
      .enum(["created_by_me", "assigned_to_me", "all"])
      .optional()
      .describe(
        "Filter scope: created_by_me=you authored, assigned_to_me=you're assignee, all=no filter."
      ),
    author_id: z
      .number()
      .optional()
      .describe("Filter by author's numeric user ID. Use to find MRs from specific user."),
    author_username: z
      .string()
      .optional()
      .describe('Filter by author\'s username. Alternative to author_id. Example: "johndoe".'),
    assignee_id: z
      .number()
      .optional()
      .describe("Filter by assignee's numeric user ID. Find MRs assigned to specific user."),
    assignee_username: z
      .string()
      .optional()
      .describe(
        'Filter by assignee\'s username. Alternative to assignee_id. Use "None" for unassigned.'
      ),
    my_reaction_emoji: z
      .string()
      .optional()
      .describe(
        'Filter MRs you\'ve reacted to with specific emoji. Example: "thumbsup" or "heart".'
      ),
    source_branch: z
      .string()
      .optional()
      .describe("Filter by source branch name. Find MRs from specific feature branch."),
    target_branch: z
      .string()
      .optional()
      .describe(
        'Filter by target branch name. Usually "main" or "master". Find MRs targeting specific branch.'
      ),
    search: z
      .string()
      .optional()
      .describe(
        "Text search in MR title and/or description. Partial matches supported. Case-insensitive."
      ),
    in: z
      .enum(["title", "description", "title,description"])
      .optional()
      .describe(
        "Search scope: title=title only, description=body only, title,description=both (default)."
      ),
    wip: z
      .enum(["yes", "no"])
      .optional()
      .describe(
        'Draft/WIP filter: yes=draft MRs only, no=ready MRs only. Draft MRs start with "Draft:" or "WIP:".'
      ),
    not: z
      .object({
        labels: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe("Exclude MRs with these labels. Inverse filter for labels."),
        milestone: z
          .string()
          .optional()
          .describe('Exclude MRs with this milestone. Use for "not in milestone X" queries.'),
        author_id: z
          .number()
          .optional()
          .describe("Exclude MRs created by this user ID. Find MRs NOT from specific author."),
        author_username: z
          .string()
          .optional()
          .describe("Exclude MRs created by this username. Alternative to not.author_id."),
        assignee_id: z
          .number()
          .optional()
          .describe(
            "Exclude MRs assigned to this user ID. Find unassigned or differently assigned MRs."
          ),
        assignee_username: z
          .string()
          .optional()
          .describe("Exclude MRs assigned to this username. Alternative to not.assignee_id."),
        my_reaction_emoji: z
          .string()
          .optional()
          .describe("Exclude MRs you've reacted to with this emoji. Inverse of my_reaction_emoji."),
      })
      .optional(),
    environment: z
      .string()
      .optional()
      .describe(
        'Filter by deployment environment name. Example: "production", "staging". Requires deployments.'
      ),
    deployed_before: z
      .string()
      .optional()
      .describe(
        "Filter MRs deployed before this date/time. Format: YYYY-MM-DDTHH:mm:ssZ (ISO 8601)."
      ),
    deployed_after: z
      .string()
      .optional()
      .describe(
        "Filter MRs deployed after this date/time. Format: YYYY-MM-DDTHH:mm:ssZ (ISO 8601)."
      ),
    approved_by_ids: z
      .array(z.string())
      .optional()
      .describe(
        "Filter MRs approved by ALL specified user IDs. Pass array of IDs. Requires all approvals."
      ),
    approved_by_usernames: z
      .array(z.string())
      .optional()
      .describe(
        "Filter MRs approved by ALL specified usernames. Pass array. Alternative to approved_by_ids."
      ),
    reviewer_id: z
      .number()
      .optional()
      .describe(
        "Filter MRs where this user ID is a reviewer. Different from assignee - reviewers provide feedback."
      ),
    reviewer_username: z
      .string()
      .optional()
      .describe("Filter MRs where this username is a reviewer. Alternative to reviewer_id."),
    with_api_entity_associations: flexibleBoolean
      .optional()
      .describe(
        "Include extra API associations like head_pipeline. Adds more data but slower response."
      ),
    min_access_level: z
      .number()
      .optional()
      .describe(
        "Minimum access level filter. 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner."
      ),
  })
  .merge(PaginationOptionsSchema);

// Export type definitions
export type GetBranchDiffsOptions = z.infer<typeof GetBranchDiffsSchema>;
export type GetMergeRequestOptions = z.infer<typeof GetMergeRequestSchema>;
export type GetMergeRequestDiffsOptions = z.infer<typeof GetMergeRequestDiffsSchema>;
export type ListMergeRequestDiffsOptions = z.infer<typeof ListMergeRequestDiffsSchema>;
export type ListMergeRequestDiscussionsOptions = z.infer<typeof ListMergeRequestDiscussionsSchema>;
export type GetDraftNoteOptions = z.infer<typeof GetDraftNoteSchema>;
export type ListDraftNotesOptions = z.infer<typeof ListDraftNotesSchema>;
export type ListMergeRequestsOptions = z.infer<typeof ListMergeRequestsSchema>;
