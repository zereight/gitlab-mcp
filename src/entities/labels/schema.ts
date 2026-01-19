import { z } from "zod";
import { requiredId } from "../utils";

// ============================================================================
// manage_label - CQRS Command Tool (flat schema for Claude API compatibility)
// Actions: create, update, delete
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const ManageLabelSchema = z
  .object({
    action: z.enum(["create", "update", "delete"]).describe("Action to perform"),
    namespace: z.string().describe("Namespace path (group or project)"),
    // update/delete action fields
    label_id: requiredId
      .optional()
      .describe("The ID or title of the label. Required for 'update' and 'delete' actions."),
    // create/update action fields
    name: z.string().optional().describe("The name of the label. Required for 'create' action."),
    new_name: z.string().optional().describe("For 'update': the new name of the label"),
    color: z
      .string()
      .optional()
      .describe(
        "The color of the label in 6-digit hex notation with leading '#' (e.g. #FFAABB) or CSS color name. Required for 'create' action."
      ),
    description: z.string().optional().describe("The description of the label"),
    priority: z
      .number()
      .optional()
      .describe(
        "The priority of the label. Must be greater or equal than zero or null to remove the priority."
      ),
  })
  .refine(data => data.action === "create" || data.label_id !== undefined, {
    message: "label_id is required for 'update' and 'delete' actions",
    path: ["label_id"],
  })
  .refine(data => data.action !== "create" || data.name !== undefined, {
    message: "name is required for 'create' action",
    path: ["name"],
  })
  .refine(data => data.action !== "create" || data.color !== undefined, {
    message: "color is required for 'create' action",
    path: ["color"],
  });

// ============================================================================
// Type exports
// ============================================================================

export type ManageLabelInput = z.infer<typeof ManageLabelSchema>;
