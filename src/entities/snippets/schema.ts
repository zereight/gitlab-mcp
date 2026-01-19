import { z } from "zod";
import { requiredId } from "../utils";

// ============================================================================
// manage_snippet - CQRS Command Tool (discriminated union schema)
// Actions: create, update, delete
// Uses z.discriminatedUnion() for type-safe action handling.
// ============================================================================

// --- Shared schemas ---

// Visibility level schema with flexible coercion
const flexibleVisibility = z.preprocess(
  val => {
    if (typeof val === "string") {
      const normalized = val.toLowerCase().trim();
      if (["private", "priv"].includes(normalized)) {
        return "private";
      }
      if (["internal", "intern"].includes(normalized)) {
        return "internal";
      }
      if (["public", "pub"].includes(normalized)) {
        return "public";
      }
    }
    return val;
  },
  z.enum(["private", "internal", "public"])
);

// Snippet file schema for multi-file support
const SnippetFileSchema = z.object({
  file_path: z
    .string()
    .min(1)
    .describe(
      "The path/name of the file within the snippet. Can include subdirectories (e.g., 'src/main.py'). Must be unique within the snippet"
    ),
  content: z
    .string()
    .optional()
    .describe(
      "The content of the file. Required for 'create' and 'update' actions. Can be empty string for placeholder files"
    ),
  action: z
    .enum(["create", "update", "delete", "move"])
    .optional()
    .describe(
      "Action to perform on the file (only for update operations): 'create' adds a new file, 'update' modifies existing file, 'delete' removes file, 'move' renames file (requires previous_path)"
    ),
  previous_path: z
    .string()
    .optional()
    .describe(
      "Original file path when using 'move' action to rename a file. Must match an existing file in the snippet"
    ),
});

// --- Shared fields ---
const projectIdField = z
  .string()
  .optional()
  .describe("Project ID or URL-encoded path. Leave empty for personal snippets");

// --- Action: create ---
const CreateSnippetSchema = z.object({
  action: z.literal("create").describe("Create a new snippet with one or more files"),
  projectId: projectIdField.describe(
    "Project ID or URL-encoded path to create a project snippet. Leave empty for personal snippet"
  ),
  title: z
    .string()
    .min(1)
    .max(255)
    .describe(
      "The title of the snippet. Displayed in snippet list and as page title. Max 255 chars"
    ),
  description: z
    .string()
    .optional()
    .describe("Optional description explaining the snippet purpose. Supports markdown"),
  visibility: flexibleVisibility
    .optional()
    .default("private")
    .describe(
      "Visibility: 'private' (author only), 'internal' (authenticated users), 'public' (everyone). Defaults to 'private'"
    ),
  files: z
    .array(
      z.object({
        file_path: z.string().min(1),
        content: z.string(),
      })
    )
    .min(1)
    .describe(
      "Array of files to include. At least one file required. Each needs file_path and content"
    ),
});

// --- Action: update ---
const UpdateSnippetSchema = z.object({
  action: z.literal("update").describe("Update an existing snippet metadata or files"),
  id: requiredId.describe("The ID of the snippet to update"),
  projectId: projectIdField.describe(
    "Project ID or URL-encoded path. Required for project snippets, leave empty for personal"
  ),
  title: z.string().min(1).max(255).optional().describe("Update the snippet title. Max 255 chars"),
  description: z.string().optional().describe("Update the snippet description. Supports markdown"),
  visibility: flexibleVisibility.optional().describe("Update the visibility level"),
  files: z
    .array(SnippetFileSchema)
    .optional()
    .describe(
      "Array of file operations. Each file must specify 'action': create/update/delete/move. Move requires previous_path"
    ),
});

// --- Action: delete ---
const DeleteSnippetSchema = z.object({
  action: z.literal("delete").describe("Permanently delete a snippet"),
  id: requiredId.describe("The ID of the snippet to delete. This operation cannot be undone"),
  projectId: projectIdField.describe(
    "Project ID or URL-encoded path. Required for project snippets, leave empty for personal"
  ),
});

// --- Discriminated union combining all actions ---
export const ManageSnippetSchema = z.discriminatedUnion("action", [
  CreateSnippetSchema,
  UpdateSnippetSchema,
  DeleteSnippetSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ManageSnippetInput = z.infer<typeof ManageSnippetSchema>;
export type SnippetFile = z.infer<typeof SnippetFileSchema>;
