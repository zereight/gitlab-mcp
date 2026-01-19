import { z } from "zod";
import { requiredId } from "../utils";

// ============================================================================
// manage_label - CQRS Command Tool (discriminated union schema)
// Actions: create, update, delete
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const namespaceField = z.string().describe("Namespace path (group or project)");
const labelIdField = requiredId.describe("The ID or title of the label");
const descriptionField = z.string().optional().describe("The description of the label");
const priorityField = z
  .number()
  .optional()
  .describe(
    "The priority of the label. Must be greater or equal than zero or null to remove the priority."
  );

// --- Action: create ---
const CreateLabelSchema = z.object({
  action: z.literal("create").describe("Create a new label"),
  namespace: namespaceField,
  name: z.string().describe("The name of the label"),
  color: z
    .string()
    .describe(
      "The color of the label in 6-digit hex notation with leading '#' (e.g. #FFAABB) or CSS color name"
    ),
  description: descriptionField,
  priority: priorityField,
});

// --- Action: update ---
const UpdateLabelSchema = z.object({
  action: z.literal("update").describe("Update an existing label"),
  namespace: namespaceField,
  label_id: labelIdField,
  name: z.string().optional().describe("The name of the label"),
  new_name: z.string().optional().describe("The new name of the label"),
  color: z
    .string()
    .optional()
    .describe(
      "The color of the label in 6-digit hex notation with leading '#' (e.g. #FFAABB) or CSS color name"
    ),
  description: descriptionField,
  priority: priorityField,
});

// --- Action: delete ---
const DeleteLabelSchema = z.object({
  action: z.literal("delete").describe("Delete a label"),
  namespace: namespaceField,
  label_id: labelIdField,
});

// --- Discriminated union combining all actions ---
export const ManageLabelSchema = z.discriminatedUnion("action", [
  CreateLabelSchema,
  UpdateLabelSchema,
  DeleteLabelSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ManageLabelInput = z.infer<typeof ManageLabelSchema>;
