import { z } from "zod";

// ============================================================================
// Base schemas for work items
// ============================================================================

export const WorkItemIdSchema = z.string().min(1).describe("Work item ID");

export const WorkItemTypeEnumSchema = z
  .string()
  .transform(val => val.toUpperCase().replace(/\s+/g, "_"))
  .pipe(
    z.enum([
      "EPIC",
      "ISSUE",
      "TASK",
      "INCIDENT",
      "TEST_CASE",
      "REQUIREMENT",
      "OBJECTIVE",
      "KEY_RESULT",
    ])
  )
  .describe("Type of work item");

export const WorkItemStateSchema = z
  .string()
  .transform(val => val.toUpperCase())
  .pipe(z.enum(["OPEN", "CLOSED"]))
  .describe("State of work item");

export const WorkItemStateEventSchema = z
  .string()
  .transform(val => val.toUpperCase())
  .pipe(z.enum(["CLOSE", "REOPEN"]))
  .describe("State event for updating work item");

// ============================================================================
// browse_work_items - CQRS Query Tool (discriminated union schema)
// Actions: list, get
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const workItemIdField = WorkItemIdSchema.describe("Work item ID to retrieve");

// --- Action: list ---
const ListWorkItemsSchema = z.object({
  action: z.literal("list").describe("List work items with filtering"),
  namespace: z
    .string()
    .describe(
      "Namespace path (group or project). Groups return epics, projects return issues/tasks."
    ),
  types: z.array(WorkItemTypeEnumSchema).optional().describe("Filter by work item types"),
  state: z
    .array(WorkItemStateSchema)
    .optional()
    .default(["OPEN"])
    .describe(
      'Filter by work item state. Defaults to OPEN items only. Use ["OPEN", "CLOSED"] for all items.'
    ),
  first: z.number().optional().default(20).describe("Number of items to return"),
  after: z
    .string()
    .optional()
    .describe("Cursor for pagination (use endCursor from previous response)"),
  simple: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Return simplified structure with essential fields only. RECOMMENDED: Use default true for most cases."
    ),
});

// --- Action: get ---
const GetWorkItemSchema = z.object({
  action: z.literal("get").describe("Get single work item details"),
  id: workItemIdField,
});

// --- Discriminated union combining all actions ---
export const BrowseWorkItemsSchema = z.discriminatedUnion("action", [
  ListWorkItemsSchema,
  GetWorkItemSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type BrowseWorkItemsInput = z.infer<typeof BrowseWorkItemsSchema>;
export type WorkItemTypeEnum = z.infer<typeof WorkItemTypeEnumSchema>;
export type WorkItemState = z.infer<typeof WorkItemStateSchema>;
