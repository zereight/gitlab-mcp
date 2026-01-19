import { z } from "zod";

// WRITE OPERATION SCHEMAS for GitLab Snippets

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
      "The content of the file. Required for 'create' and 'update' actions. Can be empty string for placeholder files. For binary content, use base64 encoding"
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

// Create snippet action parameter
const CreateSnippetActionSchema = z.literal("create");

// Create snippet schema (write)
export const CreateSnippetSchema = z
  .object({
    action: CreateSnippetActionSchema.describe("Must be 'create' for creating a new snippet"),
    projectId: z
      .string()
      .optional()
      .describe(
        "Project ID or URL-encoded path to create a project snippet. Leave empty for a personal snippet"
      ),
    title: z
      .string()
      .min(1)
      .max(255)
      .describe(
        "The title of the snippet. This is displayed in the snippet list and as the page title. Maximum 255 characters"
      ),
    description: z
      .string()
      .optional()
      .describe(
        "Optional description explaining the purpose of the snippet. Supports markdown formatting"
      ),
    visibility: flexibleVisibility
      .optional()
      .default("private")
      .describe(
        "Visibility level: 'private' (only author), 'internal' (authenticated users), or 'public' (everyone). Defaults to 'private'"
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
        "Array of files to include in the snippet. At least one file is required. Each file needs file_path and content"
      ),
  })
  .refine(data => data.files.length > 0, {
    message: "At least one file is required",
    path: ["files"],
  });

// Update snippet action parameter
const UpdateSnippetActionSchema = z.literal("update");

// Update snippet schema (write)
export const UpdateSnippetSchema = z
  .object({
    action: UpdateSnippetActionSchema.describe("Must be 'update' for updating an existing snippet"),
    id: z
      .number()
      .int()
      .positive()
      .describe("The ID of the snippet to update. Must be an existing snippet"),
    projectId: z
      .string()
      .optional()
      .describe(
        "Project ID or URL-encoded path (required for project snippets). Leave empty for personal snippets"
      ),
    title: z
      .string()
      .min(1)
      .max(255)
      .optional()
      .describe("Update the title of the snippet. Maximum 255 characters"),
    description: z
      .string()
      .optional()
      .describe("Update the description of the snippet. Supports markdown formatting"),
    visibility: flexibleVisibility
      .optional()
      .describe("Update the visibility level of the snippet"),
    files: z
      .array(SnippetFileSchema)
      .optional()
      .describe(
        "Array of file operations to perform. Each file must specify an 'action': 'create' (add new file), 'update' (modify existing), 'delete' (remove file), or 'move' (rename file with previous_path)"
      ),
  })
  .refine(
    data => {
      // At least one field must be provided for update
      return (
        data.title !== undefined ||
        data.description !== undefined ||
        data.visibility !== undefined ||
        (data.files !== undefined && data.files.length > 0)
      );
    },
    {
      message:
        "At least one field must be provided to update (title, description, visibility, or files)",
    }
  );

// Delete snippet action parameter
const DeleteSnippetActionSchema = z.literal("delete");

// Delete snippet schema (write)
export const DeleteSnippetSchema = z.object({
  action: DeleteSnippetActionSchema.describe("Must be 'delete' for deleting a snippet"),
  id: z
    .number()
    .int()
    .positive()
    .describe("The ID of the snippet to delete. This operation is permanent and cannot be undone"),
  projectId: z
    .string()
    .optional()
    .describe(
      "Project ID or URL-encoded path (required for project snippets). Leave empty for personal snippets"
    ),
});

// Export type definitions
export type CreateSnippetOptions = z.infer<typeof CreateSnippetSchema>;
export type UpdateSnippetOptions = z.infer<typeof UpdateSnippetSchema>;
export type DeleteSnippetOptions = z.infer<typeof DeleteSnippetSchema>;
export type SnippetFile = z.infer<typeof SnippetFileSchema>;
