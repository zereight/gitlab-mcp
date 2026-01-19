import { z } from "zod";
import { requiredId } from "../utils";

// ============================================================================
// manage_milestone - CQRS Command Tool (flat schema for Claude API compatibility)
// Actions: create, update, delete, promote
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const ManageMilestoneSchema = z
  .object({
    action: z.enum(["create", "update", "delete", "promote"]).describe("Action to perform"),
    namespace: z.string().describe("Namespace path (group or project)"),
    // update/delete/promote action fields
    milestone_id: requiredId
      .optional()
      .describe(
        "The ID of a project or group milestone. Required for 'update', 'delete', 'promote' actions."
      ),
    // create/update action fields
    title: z
      .string()
      .optional()
      .describe("The title of the milestone. Required for 'create' action."),
    description: z.string().optional().describe("The description of the milestone"),
    due_date: z.string().optional().describe("The due date of the milestone (YYYY-MM-DD)"),
    start_date: z.string().optional().describe("The start date of the milestone (YYYY-MM-DD)"),
    // update action fields
    state_event: z
      .string()
      .transform(val => val.toLowerCase())
      .pipe(z.enum(["close", "activate"]))
      .optional()
      .describe("For 'update': the state event of the milestone (close or activate)"),
  })
  .refine(
    data =>
      !["update", "delete", "promote"].includes(data.action) || data.milestone_id !== undefined,
    {
      message: "milestone_id is required for 'update', 'delete', and 'promote' actions",
      path: ["milestone_id"],
    }
  )
  .refine(data => data.action !== "create" || data.title !== undefined, {
    message: "title is required for 'create' action",
    path: ["title"],
  });

// ============================================================================
// Type exports
// ============================================================================

export type ManageMilestoneInput = z.infer<typeof ManageMilestoneSchema>;
