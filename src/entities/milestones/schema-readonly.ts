import { z } from "zod";
import { GitLabMilestoneSchema } from "../shared";
import { flexibleBoolean, requiredId } from "../utils";

// Re-export shared schema
export { GitLabMilestoneSchema };

// Milestones rest api output schemas
export const GitLabMilestonesSchema = z.object({
  id: z.coerce.string(),
  iid: z.coerce.string(),
  project_id: z.coerce.string(),
  title: z.string(),
  description: z.string().nullable(),
  due_date: z.string().nullable(),
  start_date: z.string().nullable(),
  state: z.string(),
  updated_at: z.string(),
  created_at: z.string(),
  expired: flexibleBoolean,
  web_url: z.string().optional(),
});

// ============================================================================
// browse_milestones - CQRS Query Tool (flat schema for Claude API compatibility)
// Actions: list, get, issues, merge_requests, burndown
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const BrowseMilestonesSchema = z
  .object({
    action: z
      .enum(["list", "get", "issues", "merge_requests", "burndown"])
      .describe("Action to perform"),
    namespace: z.string().describe("Namespace path (group or project)"),
    // get/issues/merge_requests/burndown action fields
    milestone_id: requiredId
      .optional()
      .describe(
        "The ID of a project or group milestone. Required for 'get', 'issues', 'merge_requests', 'burndown' actions."
      ),
    // list action fields
    iids: z
      .array(z.string())
      .optional()
      .describe("For 'list': return only the milestones having the given iid"),
    state: z
      .enum(["active", "closed"])
      .optional()
      .describe("For 'list': return only active or closed milestones"),
    title: z
      .string()
      .optional()
      .describe("For 'list': return only milestones with a title matching the provided string"),
    search: z
      .string()
      .optional()
      .describe(
        "For 'list': return only milestones with a title or description matching the provided string"
      ),
    include_ancestors: flexibleBoolean.optional().describe("For 'list': include ancestor groups"),
    updated_before: z
      .string()
      .optional()
      .describe(
        "For 'list': return milestones updated before the specified date (ISO 8601 format)"
      ),
    updated_after: z
      .string()
      .optional()
      .describe("For 'list': return milestones updated after the specified date (ISO 8601 format)"),
    // pagination fields (for list, merge_requests, burndown)
    per_page: z.number().optional().describe("Number of items per page"),
    page: z.number().optional().describe("Page number"),
  })
  .refine(
    data =>
      !["get", "issues", "merge_requests", "burndown"].includes(data.action) ||
      data.milestone_id !== undefined,
    {
      message:
        "milestone_id is required for 'get', 'issues', 'merge_requests', and 'burndown' actions",
      path: ["milestone_id"],
    }
  );

// ============================================================================
// Type exports
// ============================================================================

export type BrowseMilestonesInput = z.infer<typeof BrowseMilestonesSchema>;
export type GitLabMilestones = z.infer<typeof GitLabMilestonesSchema>;
