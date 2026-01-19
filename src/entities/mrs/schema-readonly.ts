import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

// ============================================================================
// browse_merge_requests - CQRS Query Tool (flat schema for Claude API compatibility)
// Actions: list, get, diffs, compare
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const BrowseMergeRequestsSchema = z
  .object({
    action: z.enum(["list", "get", "diffs", "compare"]).describe("Action to perform"),
    project_id: z.coerce
      .string()
      .optional()
      .describe(
        "Project ID or URL-encoded path. Required for 'get', 'diffs', 'compare'. Optional for 'list' (cross-project search)."
      ),
    // get/diffs action fields
    merge_request_iid: requiredId
      .optional()
      .describe(
        "Internal MR ID unique to project. Required for 'diffs'. For 'get': required unless branch_name provided."
      ),
    include_diverged_commits_count: flexibleBoolean
      .optional()
      .describe("Include count of commits the source branch is behind target. For 'get'/'diffs'."),
    include_rebase_in_progress: flexibleBoolean
      .optional()
      .describe("Check if MR is currently being rebased. For 'get'/'diffs'."),
    // get action fields
    branch_name: z
      .string()
      .optional()
      .describe("Find MR by its source branch name. For 'get' action only."),
    // compare action fields
    from: z
      .string()
      .optional()
      .describe("Source reference: branch name or commit SHA. Required for 'compare' action."),
    to: z
      .string()
      .optional()
      .describe("Target reference: branch name or commit SHA. Required for 'compare' action."),
    straight: flexibleBoolean
      .optional()
      .describe(
        "true=straight diff, false=three-way diff from common ancestor. For 'compare' action."
      ),
    // list action fields
    state: z
      .enum(["opened", "closed", "locked", "merged", "all"])
      .optional()
      .describe("MR state filter. For 'list' action."),
    order_by: z
      .enum(["created_at", "updated_at", "title", "priority"])
      .optional()
      .describe("Sort field. For 'list' action."),
    sort: z.enum(["asc", "desc"]).optional().describe("Sort direction. For 'list' action."),
    milestone: z
      .string()
      .optional()
      .describe('Filter by milestone title. Use "None" or "Any". For \'list\' action.'),
    view: z
      .enum(["simple", "full"])
      .optional()
      .describe("Response detail level. For 'list' action."),
    labels: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe("Filter by labels. For 'list' action."),
    with_labels_details: flexibleBoolean
      .optional()
      .describe("Return full label objects. For 'list' action."),
    with_merge_status_recheck: flexibleBoolean
      .optional()
      .describe("Trigger async recheck of merge status. For 'list' action."),
    created_after: z
      .string()
      .optional()
      .describe("Filter MRs created after (ISO 8601). For 'list' action."),
    created_before: z
      .string()
      .optional()
      .describe("Filter MRs created before (ISO 8601). For 'list' action."),
    updated_after: z
      .string()
      .optional()
      .describe("Filter MRs modified after (ISO 8601). For 'list' action."),
    updated_before: z
      .string()
      .optional()
      .describe("Filter MRs modified before (ISO 8601). For 'list' action."),
    scope: z
      .enum(["created_by_me", "assigned_to_me", "all"])
      .optional()
      .describe("Filter scope. For 'list' action."),
    author_id: z.number().optional().describe("Filter by author's user ID. For 'list' action."),
    author_username: z
      .string()
      .optional()
      .describe("Filter by author's username. For 'list' action."),
    assignee_id: z.number().optional().describe("Filter by assignee's user ID. For 'list' action."),
    assignee_username: z
      .string()
      .optional()
      .describe("Filter by assignee's username. For 'list' action."),
    my_reaction_emoji: z
      .string()
      .optional()
      .describe("Filter MRs you've reacted to. For 'list' action."),
    source_branch: z.string().optional().describe("Filter by source branch. For 'list' action."),
    target_branch: z.string().optional().describe("Filter by target branch. For 'list' action."),
    search: z.string().optional().describe("Text search in title/description. For 'list' action."),
    in: z
      .enum(["title", "description", "title,description"])
      .optional()
      .describe("Search scope. For 'list' action."),
    wip: z.enum(["yes", "no"]).optional().describe("Draft/WIP filter. For 'list' action."),
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
      .describe("Exclusion filters. For 'list' action."),
    environment: z
      .string()
      .optional()
      .describe("Filter by deployment environment. For 'list' action."),
    deployed_before: z
      .string()
      .optional()
      .describe("Filter MRs deployed before. For 'list' action."),
    deployed_after: z.string().optional().describe("Filter MRs deployed after. For 'list' action."),
    approved_by_ids: z
      .array(z.string())
      .optional()
      .describe("Filter MRs approved by user IDs. For 'list' action."),
    approved_by_usernames: z
      .array(z.string())
      .optional()
      .describe("Filter MRs approved by usernames. For 'list' action."),
    reviewer_id: z.number().optional().describe("Filter by reviewer user ID. For 'list' action."),
    reviewer_username: z
      .string()
      .optional()
      .describe("Filter by reviewer username. For 'list' action."),
    with_api_entity_associations: flexibleBoolean
      .optional()
      .describe("Include extra API associations. For 'list' action."),
    min_access_level: z
      .number()
      .optional()
      .describe("Minimum access level filter (10-50). For 'list' action."),
    // pagination fields (for list, diffs)
    per_page: z
      .number()
      .optional()
      .describe("Number of items per page. For 'list'/'diffs' actions."),
    page: z.number().optional().describe("Page number. For 'list'/'diffs' actions."),
  })
  // Required field validations
  .refine(data => data.action === "list" || data.project_id !== undefined, {
    message: "project_id is required for 'get', 'diffs', 'compare' actions",
    path: ["project_id"],
  })
  .refine(
    data =>
      data.action !== "get" ||
      data.merge_request_iid !== undefined ||
      data.branch_name !== undefined,
    {
      message: "Either merge_request_iid or branch_name must be provided for 'get' action",
      path: ["merge_request_iid"],
    }
  )
  .refine(data => data.action !== "diffs" || data.merge_request_iid !== undefined, {
    message: "merge_request_iid is required for 'diffs' action",
    path: ["merge_request_iid"],
  })
  .refine(data => data.action !== "compare" || data.from !== undefined, {
    message: "from is required for 'compare' action",
    path: ["from"],
  })
  .refine(data => data.action !== "compare" || data.to !== undefined, {
    message: "to is required for 'compare' action",
    path: ["to"],
  })
  // Reject fields not applicable to action
  .refine(data => ["get", "diffs"].includes(data.action) || data.merge_request_iid === undefined, {
    message: "merge_request_iid is only valid for 'get' and 'diffs' actions",
    path: ["merge_request_iid"],
  })
  .refine(
    data =>
      ["get", "diffs"].includes(data.action) || data.include_diverged_commits_count === undefined,
    {
      message: "include_diverged_commits_count is only valid for 'get' and 'diffs' actions",
      path: ["include_diverged_commits_count"],
    }
  )
  .refine(
    data => ["get", "diffs"].includes(data.action) || data.include_rebase_in_progress === undefined,
    {
      message: "include_rebase_in_progress is only valid for 'get' and 'diffs' actions",
      path: ["include_rebase_in_progress"],
    }
  )
  .refine(data => data.action === "get" || data.branch_name === undefined, {
    message: "branch_name is only valid for 'get' action",
    path: ["branch_name"],
  })
  .refine(data => data.action === "compare" || data.from === undefined, {
    message: "from is only valid for 'compare' action",
    path: ["from"],
  })
  .refine(data => data.action === "compare" || data.to === undefined, {
    message: "to is only valid for 'compare' action",
    path: ["to"],
  })
  .refine(data => data.action === "compare" || data.straight === undefined, {
    message: "straight is only valid for 'compare' action",
    path: ["straight"],
  })
  // List-only fields rejection
  .refine(data => data.action === "list" || data.state === undefined, {
    message: "state is only valid for 'list' action",
    path: ["state"],
  })
  .refine(data => data.action === "list" || data.order_by === undefined, {
    message: "order_by is only valid for 'list' action",
    path: ["order_by"],
  })
  .refine(data => data.action === "list" || data.sort === undefined, {
    message: "sort is only valid for 'list' action",
    path: ["sort"],
  })
  .refine(data => data.action === "list" || data.milestone === undefined, {
    message: "milestone is only valid for 'list' action",
    path: ["milestone"],
  })
  .refine(data => data.action === "list" || data.view === undefined, {
    message: "view is only valid for 'list' action",
    path: ["view"],
  })
  .refine(data => data.action === "list" || data.labels === undefined, {
    message: "labels is only valid for 'list' action",
    path: ["labels"],
  })
  .refine(data => data.action === "list" || data.with_labels_details === undefined, {
    message: "with_labels_details is only valid for 'list' action",
    path: ["with_labels_details"],
  })
  .refine(data => data.action === "list" || data.with_merge_status_recheck === undefined, {
    message: "with_merge_status_recheck is only valid for 'list' action",
    path: ["with_merge_status_recheck"],
  })
  .refine(data => data.action === "list" || data.created_after === undefined, {
    message: "created_after is only valid for 'list' action",
    path: ["created_after"],
  })
  .refine(data => data.action === "list" || data.created_before === undefined, {
    message: "created_before is only valid for 'list' action",
    path: ["created_before"],
  })
  .refine(data => data.action === "list" || data.updated_after === undefined, {
    message: "updated_after is only valid for 'list' action",
    path: ["updated_after"],
  })
  .refine(data => data.action === "list" || data.updated_before === undefined, {
    message: "updated_before is only valid for 'list' action",
    path: ["updated_before"],
  })
  .refine(data => data.action === "list" || data.scope === undefined, {
    message: "scope is only valid for 'list' action",
    path: ["scope"],
  })
  .refine(data => data.action === "list" || data.author_id === undefined, {
    message: "author_id is only valid for 'list' action",
    path: ["author_id"],
  })
  .refine(data => data.action === "list" || data.author_username === undefined, {
    message: "author_username is only valid for 'list' action",
    path: ["author_username"],
  })
  .refine(data => data.action === "list" || data.assignee_id === undefined, {
    message: "assignee_id is only valid for 'list' action",
    path: ["assignee_id"],
  })
  .refine(data => data.action === "list" || data.assignee_username === undefined, {
    message: "assignee_username is only valid for 'list' action",
    path: ["assignee_username"],
  })
  .refine(data => data.action === "list" || data.my_reaction_emoji === undefined, {
    message: "my_reaction_emoji is only valid for 'list' action",
    path: ["my_reaction_emoji"],
  })
  .refine(data => data.action === "list" || data.source_branch === undefined, {
    message: "source_branch is only valid for 'list' action",
    path: ["source_branch"],
  })
  .refine(data => data.action === "list" || data.target_branch === undefined, {
    message: "target_branch is only valid for 'list' action",
    path: ["target_branch"],
  })
  .refine(data => data.action === "list" || data.search === undefined, {
    message: "search is only valid for 'list' action",
    path: ["search"],
  })
  .refine(data => data.action === "list" || data.in === undefined, {
    message: "in is only valid for 'list' action",
    path: ["in"],
  })
  .refine(data => data.action === "list" || data.wip === undefined, {
    message: "wip is only valid for 'list' action",
    path: ["wip"],
  })
  .refine(data => data.action === "list" || data.not === undefined, {
    message: "not is only valid for 'list' action",
    path: ["not"],
  })
  .refine(data => data.action === "list" || data.environment === undefined, {
    message: "environment is only valid for 'list' action",
    path: ["environment"],
  })
  .refine(data => data.action === "list" || data.deployed_before === undefined, {
    message: "deployed_before is only valid for 'list' action",
    path: ["deployed_before"],
  })
  .refine(data => data.action === "list" || data.deployed_after === undefined, {
    message: "deployed_after is only valid for 'list' action",
    path: ["deployed_after"],
  })
  .refine(data => data.action === "list" || data.approved_by_ids === undefined, {
    message: "approved_by_ids is only valid for 'list' action",
    path: ["approved_by_ids"],
  })
  .refine(data => data.action === "list" || data.approved_by_usernames === undefined, {
    message: "approved_by_usernames is only valid for 'list' action",
    path: ["approved_by_usernames"],
  })
  .refine(data => data.action === "list" || data.reviewer_id === undefined, {
    message: "reviewer_id is only valid for 'list' action",
    path: ["reviewer_id"],
  })
  .refine(data => data.action === "list" || data.reviewer_username === undefined, {
    message: "reviewer_username is only valid for 'list' action",
    path: ["reviewer_username"],
  })
  .refine(data => data.action === "list" || data.with_api_entity_associations === undefined, {
    message: "with_api_entity_associations is only valid for 'list' action",
    path: ["with_api_entity_associations"],
  })
  .refine(data => data.action === "list" || data.min_access_level === undefined, {
    message: "min_access_level is only valid for 'list' action",
    path: ["min_access_level"],
  })
  // Pagination valid for list and diffs
  .refine(data => ["list", "diffs"].includes(data.action) || data.per_page === undefined, {
    message: "per_page is only valid for 'list' and 'diffs' actions",
    path: ["per_page"],
  })
  .refine(data => ["list", "diffs"].includes(data.action) || data.page === undefined, {
    message: "page is only valid for 'list' and 'diffs' actions",
    path: ["page"],
  });

// ============================================================================
// browse_mr_discussions - CQRS Query Tool (flat schema for Claude API compatibility)
// Actions: list, drafts, draft
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const BrowseMrDiscussionsSchema = z
  .object({
    action: z.enum(["list", "drafts", "draft"]).describe("Action to perform"),
    project_id: requiredId.describe("Project ID or URL-encoded path"),
    merge_request_iid: requiredId.describe("Internal MR ID unique to project."),
    // draft action fields
    draft_note_id: requiredId
      .optional()
      .describe("Unique identifier of the draft note. Required for 'draft' action."),
    // pagination fields (for list)
    per_page: z.number().optional().describe("Number of items per page. For 'list' action."),
    page: z.number().optional().describe("Page number. For 'list' action."),
  })
  // Required field validations
  .refine(data => data.action !== "draft" || data.draft_note_id !== undefined, {
    message: "draft_note_id is required for 'draft' action",
    path: ["draft_note_id"],
  })
  // Reject fields not applicable to action
  .refine(data => data.action === "draft" || data.draft_note_id === undefined, {
    message: "draft_note_id is only valid for 'draft' action",
    path: ["draft_note_id"],
  })
  .refine(data => data.action === "list" || data.per_page === undefined, {
    message: "per_page is only valid for 'list' action",
    path: ["per_page"],
  })
  .refine(data => data.action === "list" || data.page === undefined, {
    message: "page is only valid for 'list' action",
    path: ["page"],
  });

// ============================================================================
// Export type definitions
// ============================================================================

export type BrowseMergeRequestsInput = z.infer<typeof BrowseMergeRequestsSchema>;
export type BrowseMrDiscussionsInput = z.infer<typeof BrowseMrDiscussionsSchema>;
