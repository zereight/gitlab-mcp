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
// browse_milestones - CQRS Query Tool (discriminated union schema)
// Actions: list, get, issues, merge_requests, burndown
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const namespaceField = z.string().describe("Namespace path (group or project)");
const milestoneIdField = requiredId.describe("The ID of a project or group milestone");
const paginationFields = {
  per_page: z.number().optional().describe("Number of items per page"),
  page: z.number().optional().describe("Page number"),
};

// --- Action: list ---
const ListMilestonesSchema = z.object({
  action: z.literal("list").describe("List milestones with optional filtering"),
  namespace: namespaceField,
  iids: z.array(z.string()).optional().describe("Return only the milestones having the given iid"),
  state: z
    .enum(["active", "closed"])
    .optional()
    .describe("Return only active or closed milestones"),
  title: z
    .string()
    .optional()
    .describe("Return only milestones with a title matching the provided string"),
  search: z
    .string()
    .optional()
    .describe("Return only milestones with a title or description matching the provided string"),
  include_ancestors: flexibleBoolean.optional().describe("Include ancestor groups"),
  updated_before: z
    .string()
    .optional()
    .describe("Return milestones updated before the specified date (ISO 8601 format)"),
  updated_after: z
    .string()
    .optional()
    .describe("Return milestones updated after the specified date (ISO 8601 format)"),
  ...paginationFields,
});

// --- Action: get ---
const GetMilestoneSchema = z.object({
  action: z.literal("get").describe("Get a single milestone by ID"),
  namespace: namespaceField,
  milestone_id: milestoneIdField,
});

// --- Action: issues ---
const MilestoneIssuesSchema = z.object({
  action: z.literal("issues").describe("List issues assigned to a milestone"),
  namespace: namespaceField,
  milestone_id: milestoneIdField,
  ...paginationFields,
});

// --- Action: merge_requests ---
const MilestoneMergeRequestsSchema = z.object({
  action: z.literal("merge_requests").describe("List merge requests assigned to a milestone"),
  namespace: namespaceField,
  milestone_id: milestoneIdField,
  ...paginationFields,
});

// --- Action: burndown ---
const MilestoneBurndownSchema = z.object({
  action: z.literal("burndown").describe("Get burndown chart data for a milestone"),
  namespace: namespaceField,
  milestone_id: milestoneIdField,
  ...paginationFields,
});

// --- Discriminated union combining all actions ---
export const BrowseMilestonesSchema = z.discriminatedUnion("action", [
  ListMilestonesSchema,
  GetMilestoneSchema,
  MilestoneIssuesSchema,
  MilestoneMergeRequestsSchema,
  MilestoneBurndownSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type BrowseMilestonesInput = z.infer<typeof BrowseMilestonesSchema>;
export type GitLabMilestones = z.infer<typeof GitLabMilestonesSchema>;
