import { z } from "zod";

// Write-only milestone operation schemas
// Schema for creating a new milestone
export const CreateProjectMilestoneSchema = z.object({
  namespace: z.string().describe("Namespace path (group or project) to create milestone in"),
  title: z.string().describe("The title of the milestone"),
  description: z.string().optional().describe("The description of the milestone"),
  due_date: z.string().optional().describe("The due date of the milestone (YYYY-MM-DD)"),
  start_date: z.string().optional().describe("The start date of the milestone (YYYY-MM-DD)"),
});

// Schema for editing a milestone
export const EditProjectMilestoneSchema = z.object({
  namespace: z.string().describe("Namespace path (group or project) containing the milestone"),
  milestone_id: z.coerce.string().describe("The ID of a project or group milestone"),
  title: z.string().optional().describe("The title of the milestone"),
  description: z.string().optional().describe("The description of the milestone"),
  due_date: z.string().optional().describe("The due date of the milestone (YYYY-MM-DD)"),
  start_date: z.string().optional().describe("The start date of the milestone (YYYY-MM-DD)"),
  state_event: z
    .string()
    .transform(val => val.toLowerCase())
    .pipe(z.enum(["close", "activate"]))
    .optional()
    .describe("The state event of the milestone"),
});

// Schema for deleting a milestone
export const DeleteProjectMilestoneSchema = z.object({
  namespace: z.string().describe("Namespace path (group or project) containing the milestone"),
  milestone_id: z.coerce.string().describe("The ID of a project or group milestone"),
});

// Schema for promoting a project milestone to a group milestone
export const PromoteProjectMilestoneSchema = z.object({
  namespace: z.string().describe("Namespace path (group or project) containing the milestone"),
  milestone_id: z.coerce.string().describe("The ID of a project or group milestone"),
});

// Type exports
export type CreateProjectMilestoneOptions = z.infer<typeof CreateProjectMilestoneSchema>;
export type EditProjectMilestoneOptions = z.infer<typeof EditProjectMilestoneSchema>;
export type DeleteProjectMilestoneOptions = z.infer<typeof DeleteProjectMilestoneSchema>;
export type PromoteProjectMilestoneOptions = z.infer<typeof PromoteProjectMilestoneSchema>;
