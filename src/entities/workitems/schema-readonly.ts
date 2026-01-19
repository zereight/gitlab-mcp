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
// browse_work_items - CQRS Query Tool (flat schema for Claude API compatibility)
// Actions: list, get
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const BrowseWorkItemsSchema = z
  .object({
    action: z.enum(["list", "get"]).describe("Action to perform: list or get"),
    // list action fields
    namespace: z
      .string()
      .optional()
      .describe(
        "Namespace path (group or project). Groups return epics, projects return issues/tasks. Required for 'list' action."
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
    // get action fields
    id: WorkItemIdSchema.optional().describe(
      "Work item ID to retrieve. Required for 'get' action."
    ),
  })
  .refine(data => data.action !== "list" || data.namespace !== undefined, {
    message: "namespace is required for 'list' action",
    path: ["namespace"],
  })
  .refine(data => data.action !== "get" || data.id !== undefined, {
    message: "id is required for 'get' action",
    path: ["id"],
  });

// ============================================================================
// Type exports
// ============================================================================

export type BrowseWorkItemsInput = z.infer<typeof BrowseWorkItemsSchema>;
export type WorkItemTypeEnum = z.infer<typeof WorkItemTypeEnumSchema>;
export type WorkItemState = z.infer<typeof WorkItemStateSchema>;
