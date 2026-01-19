import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

// ============================================================================
// browse_merge_requests - CQRS Query Tool (discriminated union schema)
// Actions: list, get, diffs, compare
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const projectIdField = requiredId.describe("Project ID or URL-encoded path");
const mergeRequestIidField = requiredId.describe("Internal MR ID unique to project");

// --- Shared optional fields for get/diffs actions ---
const includeDivergedCommitsCountField = flexibleBoolean
  .optional()
  .describe("Include count of commits the source branch is behind target");
const includeRebaseInProgressField = flexibleBoolean
  .optional()
  .describe("Check if MR is currently being rebased");

// --- Shared not filter schema for list action ---
const NotFilterSchema = z
  .object({
    labels: z.union([z.string(), z.array(z.string())]).optional(),
    milestone: z.string().optional(),
    author_id: z.number().optional(),
    author_username: z.string().optional(),
    assignee_id: z.number().optional(),
    assignee_username: z.string().optional(),
    my_reaction_emoji: z.string().optional(),
  })
  .describe("Exclusion filters");

// --- Action: list ---
// Note: .passthrough() preserves unknown fields for superRefine validation
const ListMergeRequestsSchema = z
  .object({
    action: z.literal("list").describe("List merge requests with filtering"),
    project_id: z.coerce
      .string()
      .optional()
      .describe("Project ID or URL-encoded path. Optional for cross-project search."),
    state: z
      .enum(["opened", "closed", "locked", "merged", "all"])
      .optional()
      .describe("MR state filter"),
    order_by: z
      .enum(["created_at", "updated_at", "title", "priority"])
      .optional()
      .describe("Sort field"),
    sort: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    milestone: z.string().optional().describe('Filter by milestone title. Use "None" or "Any".'),
    view: z.enum(["simple", "full"]).optional().describe("Response detail level"),
    labels: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe("Filter by labels"),
    with_labels_details: flexibleBoolean.optional().describe("Return full label objects"),
    with_merge_status_recheck: flexibleBoolean
      .optional()
      .describe("Trigger async recheck of merge status"),
    created_after: z.string().optional().describe("Filter MRs created after (ISO 8601)"),
    created_before: z.string().optional().describe("Filter MRs created before (ISO 8601)"),
    updated_after: z.string().optional().describe("Filter MRs modified after (ISO 8601)"),
    updated_before: z.string().optional().describe("Filter MRs modified before (ISO 8601)"),
    scope: z.enum(["created_by_me", "assigned_to_me", "all"]).optional().describe("Filter scope"),
    author_id: z.number().optional().describe("Filter by author's user ID"),
    author_username: z.string().optional().describe("Filter by author's username"),
    assignee_id: z.number().optional().describe("Filter by assignee's user ID"),
    assignee_username: z.string().optional().describe("Filter by assignee's username"),
    my_reaction_emoji: z.string().optional().describe("Filter MRs you've reacted to"),
    source_branch: z.string().optional().describe("Filter by source branch"),
    target_branch: z.string().optional().describe("Filter by target branch"),
    search: z.string().optional().describe("Text search in title/description"),
    in: z.enum(["title", "description", "title,description"]).optional().describe("Search scope"),
    wip: z.enum(["yes", "no"]).optional().describe("Draft/WIP filter"),
    not: NotFilterSchema.optional(),
    environment: z.string().optional().describe("Filter by deployment environment"),
    deployed_before: z.string().optional().describe("Filter MRs deployed before"),
    deployed_after: z.string().optional().describe("Filter MRs deployed after"),
    approved_by_ids: z.array(z.string()).optional().describe("Filter MRs approved by user IDs"),
    approved_by_usernames: z
      .array(z.string())
      .optional()
      .describe("Filter MRs approved by usernames"),
    reviewer_id: z.number().optional().describe("Filter by reviewer user ID"),
    reviewer_username: z.string().optional().describe("Filter by reviewer username"),
    with_api_entity_associations: flexibleBoolean
      .optional()
      .describe("Include extra API associations"),
    min_access_level: z.number().optional().describe("Minimum access level filter (10-50)"),
    per_page: z.number().optional().describe("Number of items per page"),
    page: z.number().optional().describe("Page number"),
  })
  .passthrough();

// --- Action: get ---
// Note: .passthrough() preserves unknown fields for superRefine validation
const GetMergeRequestByIidSchema = z
  .object({
    action: z.literal("get").describe("Get single MR by IID or branch name"),
    project_id: projectIdField,
    merge_request_iid: mergeRequestIidField
      .optional()
      .describe("Internal MR ID. Required unless branch_name provided."),
    branch_name: z.string().optional().describe("Find MR by its source branch name"),
    include_diverged_commits_count: includeDivergedCommitsCountField,
    include_rebase_in_progress: includeRebaseInProgressField,
  })
  .passthrough();

// --- Action: diffs ---
// Note: .passthrough() preserves unknown fields for superRefine validation
const DiffsMergeRequestSchema = z
  .object({
    action: z.literal("diffs").describe("Get file changes/diffs for an MR"),
    project_id: projectIdField,
    merge_request_iid: mergeRequestIidField,
    include_diverged_commits_count: includeDivergedCommitsCountField,
    include_rebase_in_progress: includeRebaseInProgressField,
    per_page: z.number().optional().describe("Number of items per page"),
    page: z.number().optional().describe("Page number"),
  })
  .passthrough();

// --- Action: compare ---
// Note: .passthrough() preserves unknown fields for superRefine validation
const CompareMergeRequestSchema = z
  .object({
    action: z.literal("compare").describe("Compare two branches or commits"),
    project_id: projectIdField,
    from: z.string().describe("Source reference: branch name or commit SHA"),
    to: z.string().describe("Target reference: branch name or commit SHA"),
    straight: flexibleBoolean
      .optional()
      .describe("true=straight diff, false=three-way diff from common ancestor"),
  })
  .passthrough();

// --- Discriminated union combining all actions ---
// Note: GetMergeRequestSchema uses .refine() which doesn't work with discriminatedUnion directly,
// so we use a two-step approach: discriminatedUnion for base validation, then refinement
const BrowseMergeRequestsBaseSchema = z.discriminatedUnion("action", [
  ListMergeRequestsSchema,
  GetMergeRequestByIidSchema,
  DiffsMergeRequestSchema,
  CompareMergeRequestSchema,
]);

// Action-specific field sets for strict validation
const listOnlyFields = [
  "state",
  "order_by",
  "sort",
  "milestone",
  "view",
  "labels",
  "with_labels_details",
  "with_merge_status_recheck",
  "created_after",
  "created_before",
  "updated_after",
  "updated_before",
  "scope",
  "author_id",
  "author_username",
  "assignee_id",
  "assignee_username",
  "my_reaction_emoji",
  "source_branch",
  "target_branch",
  "search",
  "in",
  "wip",
  "not",
  "environment",
  "deployed_before",
  "deployed_after",
  "approved_by_ids",
  "approved_by_usernames",
  "reviewer_id",
  "reviewer_username",
  "with_api_entity_associations",
  "min_access_level",
];
const compareOnlyFields = ["from", "to", "straight"];
const getOnlyFields = ["merge_request_iid", "branch_name"];

// Apply refinement for 'get' action validation and action-specific field validation
export const BrowseMergeRequestsSchema = BrowseMergeRequestsBaseSchema.refine(
  data => {
    if (data.action === "get") {
      return data.merge_request_iid !== undefined || data.branch_name !== undefined;
    }
    return true;
  },
  {
    message: "Either merge_request_iid or branch_name must be provided for 'get' action",
    path: ["merge_request_iid"],
  }
).superRefine((data, ctx) => {
  const input = data as Record<string, unknown>;

  // Check for list-only fields used in non-list actions
  if (data.action !== "list") {
    for (const field of listOnlyFields) {
      if (field in input && input[field] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `'${field}' is only valid for 'list' action`,
          path: [field],
        });
      }
    }
  }

  // Check for compare-only fields used in non-compare actions
  if (data.action !== "compare") {
    for (const field of compareOnlyFields) {
      if (field in input && input[field] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `'${field}' is only valid for 'compare' action`,
          path: [field],
        });
      }
    }
  }

  // Check for get-only fields (merge_request_iid, branch_name) used in list action
  if (data.action === "list") {
    for (const field of getOnlyFields) {
      if (field in input && input[field] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `'${field}' is only valid for 'get' action`,
          path: [field],
        });
      }
    }
  }
});

// ============================================================================
// browse_mr_discussions - CQRS Query Tool (discriminated union schema)
// Actions: list, drafts, draft
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Action: list ---
const ListMrDiscussionsSchema = z.object({
  action: z.literal("list").describe("List all discussion threads on an MR"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  per_page: z.number().optional().describe("Number of items per page"),
  page: z.number().optional().describe("Page number"),
});

// --- Action: drafts ---
const ListDraftNotesSchema = z.object({
  action: z.literal("drafts").describe("List unpublished draft notes on an MR"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
});

// --- Action: draft ---
const GetDraftNoteSchema = z.object({
  action: z.literal("draft").describe("Get single draft note details"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  draft_note_id: requiredId.describe("Unique identifier of the draft note"),
});

// --- Discriminated union combining all actions ---
export const BrowseMrDiscussionsSchema = z.discriminatedUnion("action", [
  ListMrDiscussionsSchema,
  ListDraftNotesSchema,
  GetDraftNoteSchema,
]);

// ============================================================================
// Export type definitions
// ============================================================================

export type BrowseMergeRequestsInput = z.infer<typeof BrowseMergeRequestsSchema>;
export type BrowseMrDiscussionsInput = z.infer<typeof BrowseMrDiscussionsSchema>;
