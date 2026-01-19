import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

// ============================================================================
// browse_labels - CQRS Query Tool (flat schema for Claude API compatibility)
// Actions: list, get
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const BrowseLabelsSchema = z
  .object({
    action: z.enum(["list", "get"]).describe("Action to perform"),
    namespace: z.string().describe("Namespace path (group or project)"),
    // get action fields
    label_id: requiredId
      .optional()
      .describe("The ID or title of the label. Required for 'get' action."),
    // list action fields
    search: z.string().optional().describe("For 'list': keyword to filter labels by"),
    with_counts: flexibleBoolean
      .optional()
      .describe("For 'list': include issue and merge request counts"),
    include_ancestor_groups: flexibleBoolean
      .optional()
      .describe("Include ancestor groups when listing or getting labels"),
    // pagination fields (for list)
    per_page: z.number().optional().describe("Number of items per page"),
    page: z.number().optional().describe("Page number"),
  })
  .refine(data => data.action !== "get" || data.label_id !== undefined, {
    message: "label_id is required for 'get' action",
    path: ["label_id"],
  });

// ============================================================================
// Type exports
// ============================================================================

export type BrowseLabelsInput = z.infer<typeof BrowseLabelsSchema>;
