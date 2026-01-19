import { z } from "zod";
import { requiredId } from "../utils";

// ============================================================================
// manage_milestone - CQRS Command Tool (discriminated union schema)
// Actions: create, update, delete, promote
//
// Uses z.discriminatedUnion() to define action-specific parameters.
// Benefits:
// - Each action has ONLY its relevant parameters (token savings)
// - TypeScript type narrowing in handlers
// - Filtering denied actions removes their exclusive parameters from schema
// - JSON Schema outputs oneOf which is flattened for AI clients at runtime
// ============================================================================

// --- Base fields shared by all actions ---
const namespaceField = z.string().describe("Namespace path (group or project)");

// --- Create action: creates a new milestone ---
const CreateMilestoneSchema = z.object({
  action: z.literal("create"),
  namespace: namespaceField,
  title: z.string().describe("The title of the milestone"),
  description: z.string().optional().describe("The description of the milestone"),
  due_date: z.string().optional().describe("The due date of the milestone (YYYY-MM-DD)"),
  start_date: z.string().optional().describe("The start date of the milestone (YYYY-MM-DD)"),
});

// --- Update action: modifies an existing milestone ---
const UpdateMilestoneSchema = z.object({
  action: z.literal("update"),
  namespace: namespaceField,
  milestone_id: requiredId.describe("The ID of the milestone to update"),
  title: z.string().optional().describe("The new title of the milestone"),
  description: z.string().optional().describe("The new description of the milestone"),
  due_date: z.string().optional().describe("The due date of the milestone (YYYY-MM-DD)"),
  start_date: z.string().optional().describe("The start date of the milestone (YYYY-MM-DD)"),
  state_event: z
    .string()
    .transform(val => val.toLowerCase())
    .pipe(z.enum(["close", "activate"]))
    .optional()
    .describe("State event to apply: 'close' or 'activate'"),
});

// --- Delete action: removes a milestone ---
const DeleteMilestoneSchema = z.object({
  action: z.literal("delete"),
  namespace: namespaceField,
  milestone_id: requiredId.describe("The ID of the milestone to delete"),
});

// --- Promote action: elevates project milestone to group level ---
const PromoteMilestoneSchema = z.object({
  action: z.literal("promote"),
  namespace: namespaceField,
  milestone_id: requiredId.describe("The ID of the project milestone to promote to group level"),
});

// --- Discriminated union combining all actions ---
export const ManageMilestoneSchema = z.discriminatedUnion("action", [
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
  DeleteMilestoneSchema,
  PromoteMilestoneSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ManageMilestoneInput = z.infer<typeof ManageMilestoneSchema>;
