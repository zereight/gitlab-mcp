import { z } from "zod";

// ============================================================================
// manage_wiki - CQRS Command Tool (flat schema for Claude API compatibility)
// Actions: create, update, delete
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const ManageWikiSchema = z
  .object({
    action: z.enum(["create", "update", "delete"]).describe("Action to perform"),
    namespace: z.string().describe("Namespace path (group or project)"),
    // update/delete action fields
    slug: z
      .string()
      .optional()
      .describe("URL-encoded slug of the wiki page. Required for 'update' and 'delete' actions."),
    // create/update action fields
    title: z.string().optional().describe("Title of the wiki page. Required for 'create' action."),
    content: z
      .string()
      .optional()
      .describe("Content of the wiki page. Required for 'create' action."),
    format: z
      .enum(["markdown", "rdoc", "asciidoc", "org"])
      .optional()
      .describe("Content format (markdown, rdoc, asciidoc, org). Defaults to markdown."),
  })
  .refine(data => data.action === "create" || data.slug !== undefined, {
    message: "slug is required for 'update' and 'delete' actions",
    path: ["slug"],
  })
  .refine(data => data.action !== "create" || data.title !== undefined, {
    message: "title is required for 'create' action",
    path: ["title"],
  })
  .refine(data => data.action !== "create" || data.content !== undefined, {
    message: "content is required for 'create' action",
    path: ["content"],
  });

// ============================================================================
// Type exports
// ============================================================================

export type ManageWikiInput = z.infer<typeof ManageWikiSchema>;
