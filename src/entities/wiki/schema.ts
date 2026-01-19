import { z } from "zod";

// ============================================================================
// manage_wiki - CQRS Command Tool (discriminated union schema)
// Actions: create, update, delete
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const namespaceField = z.string().describe("Namespace path (group or project)");
const slugField = z.string().describe("URL-encoded slug of the wiki page");
const titleField = z.string().describe("Title of the wiki page");
const contentField = z.string().describe("Content of the wiki page");
const formatField = z
  .enum(["markdown", "rdoc", "asciidoc", "org"])
  .optional()
  .describe("Content format (markdown, rdoc, asciidoc, org). Defaults to markdown.");

// --- Action: create ---
const CreateWikiSchema = z.object({
  action: z.literal("create").describe("Create a new wiki page"),
  namespace: namespaceField,
  title: titleField,
  content: contentField,
  format: formatField,
});

// --- Action: update ---
const UpdateWikiSchema = z.object({
  action: z.literal("update").describe("Update an existing wiki page"),
  namespace: namespaceField,
  slug: slugField,
  title: z.string().optional().describe("New title of the wiki page"),
  content: z.string().optional().describe("New content of the wiki page"),
  format: formatField,
});

// --- Action: delete ---
const DeleteWikiSchema = z.object({
  action: z.literal("delete").describe("Delete a wiki page"),
  namespace: namespaceField,
  slug: slugField,
});

// --- Discriminated union combining all actions ---
export const ManageWikiSchema = z.discriminatedUnion("action", [
  CreateWikiSchema,
  UpdateWikiSchema,
  DeleteWikiSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ManageWikiInput = z.infer<typeof ManageWikiSchema>;
