import { z } from "zod";
import { flexibleBoolean } from "../utils";

// ============================================================================
// browse_wiki - CQRS Query Tool (flat schema for Claude API compatibility)
// Actions: list, get
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const BrowseWikiSchema = z
  .object({
    action: z.enum(["list", "get"]).describe("Action to perform"),
    namespace: z.string().describe("Namespace path (group or project)"),
    // get action fields
    slug: z
      .string()
      .optional()
      .describe("URL-encoded slug of the wiki page. Required for 'get' action."),
    // list action fields
    with_content: flexibleBoolean
      .optional()
      .describe("For 'list': include content of the wiki pages"),
    // pagination fields (for list)
    per_page: z.number().optional().describe("Number of items per page"),
    page: z.number().optional().describe("Page number"),
  })
  .refine(data => data.action !== "get" || data.slug !== undefined, {
    message: "slug is required for 'get' action",
    path: ["slug"],
  });

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
