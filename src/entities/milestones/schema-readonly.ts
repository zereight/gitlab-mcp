import { z } from "zod";
import { PaginationOptionsSchema, GitLabMilestoneSchema } from "../shared";
import { flexibleBoolean } from "../utils";

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

// Read-only milestone operation schemas
// Schema for listing project/group milestones
export const ListProjectMilestonesSchema = z
  .object({
    namespacePath: z.string().describe("Namespace path (group or project) to list milestones from"),
    iids: z
      .array(z.string())
      .optional()
      .describe("Return only the milestones having the given iid"),
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
  })
  .merge(PaginationOptionsSchema);

// Base schema for milestone operations
const GetProjectMilestoneBaseSchema = z.object({
  namespacePath: z.string().describe("Namespace path (group or project) containing the milestone"),
  milestone_id: z.coerce.string().describe("The ID of a project or group milestone"),
});

// Schema for getting a single milestone
export const GetProjectMilestoneSchema = GetProjectMilestoneBaseSchema;

// Schema for getting issues assigned to a milestone
export const GetMilestoneIssuesSchema = GetProjectMilestoneSchema;

// Schema for getting merge requests assigned to a milestone
export const GetMilestoneMergeRequestsSchema =
  GetProjectMilestoneBaseSchema.merge(PaginationOptionsSchema);

// Schema for getting burndown chart events for a milestone
export const GetMilestoneBurndownEventsSchema =
  GetProjectMilestoneBaseSchema.merge(PaginationOptionsSchema);

// Type exports
export type GitLabMilestones = z.infer<typeof GitLabMilestonesSchema>;
export type ListProjectMilestonesOptions = z.infer<typeof ListProjectMilestonesSchema>;
export type GetProjectMilestoneOptions = z.infer<typeof GetProjectMilestoneSchema>;
export type GetMilestoneIssuesOptions = z.infer<typeof GetMilestoneIssuesSchema>;
export type GetMilestoneMergeRequestsOptions = z.infer<typeof GetMilestoneMergeRequestsSchema>;
export type GetMilestoneBurndownEventsOptions = z.infer<typeof GetMilestoneBurndownEventsSchema>;
