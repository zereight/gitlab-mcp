import { z } from "zod";
import { flexibleBoolean } from "../utils";

// ============================================================================
// browse_wiki - CQRS Query Tool (discriminated union schema)
// Actions: list, get
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const namespaceField = z.string().describe("Namespace path (group or project)");

// --- Action: list ---
const ListWikiSchema = z.object({
  action: z.literal("list").describe("List all wiki pages"),
  namespace: namespaceField,
  with_content: flexibleBoolean.optional().describe("Include content of the wiki pages"),
  per_page: z.number().optional().describe("Number of items per page"),
  page: z.number().optional().describe("Page number"),
});

// --- Action: get ---
const GetWikiSchema = z.object({
  action: z.literal("get").describe("Get a single wiki page by slug"),
  namespace: namespaceField,
  slug: z.string().describe("URL-encoded slug of the wiki page"),
});

// --- Discriminated union combining all actions ---
export const BrowseWikiSchema = z.discriminatedUnion("action", [ListWikiSchema, GetWikiSchema]);

// ============================================================================
// Response schemas for wiki pages
// ============================================================================

export const GitLabWikiPageSchema = z.object({
  title: z.string(),
  slug: z.string(),
  format: z.string(),
  content: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// ============================================================================
// Type exports
// ============================================================================

export type BrowseWikiInput = z.infer<typeof BrowseWikiSchema>;
export type GitLabWikiPage = z.infer<typeof GitLabWikiPageSchema>;
