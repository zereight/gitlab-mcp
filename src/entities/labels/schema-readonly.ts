import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

// ============================================================================
// browse_labels - CQRS Query Tool (discriminated union schema)
// Actions: list, get
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const namespaceField = z.string().describe("Namespace path (group or project)");
const includeAncestorGroupsField = flexibleBoolean
  .optional()
  .describe("Include ancestor groups when listing or getting labels");

// --- Action: list ---
const ListLabelsSchema = z.object({
  action: z.literal("list").describe("List labels with optional filtering"),
  namespace: namespaceField,
  search: z.string().optional().describe("Keyword to filter labels by"),
  with_counts: flexibleBoolean.optional().describe("Include issue and merge request counts"),
  include_ancestor_groups: includeAncestorGroupsField,
  per_page: z.number().optional().describe("Number of items per page"),
  page: z.number().optional().describe("Page number"),
});

// --- Action: get ---
const GetLabelSchema = z.object({
  action: z.literal("get").describe("Get a single label by ID or title"),
  namespace: namespaceField,
  label_id: requiredId.describe("The ID or title of the label"),
  include_ancestor_groups: includeAncestorGroupsField,
});

// --- Discriminated union combining all actions ---
export const BrowseLabelsSchema = z.discriminatedUnion("action", [
  ListLabelsSchema,
  GetLabelSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type BrowseLabelsInput = z.infer<typeof BrowseLabelsSchema>;
