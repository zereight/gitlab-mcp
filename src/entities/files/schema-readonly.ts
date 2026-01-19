import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

// ============================================================================
// Response schemas for GitLab file API responses
// ============================================================================

export const GitLabFileContentSchema = z.object({
  file_name: z.string(),
  file_path: z.string(),
  size: z.number(),
  encoding: z.string(),
  content_sha256: z.string().optional(),
  ref: z.string().optional(),
  blob_id: z.string(),
  commit_id: z.string(),
  last_commit_id: z.string(),
  content: z.string().optional(),
});

export const GitLabDirectoryContentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["tree", "blob"]),
  path: z.string(),
  mode: z.string(),
});

export const GitLabContentSchema = z.union([GitLabFileContentSchema, GitLabDirectoryContentSchema]);

export const GitLabCreateUpdateFileResponseSchema = z.object({
  file_path: z.string(),
  branch: z.string(),
});

export const GitLabTreeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["tree", "blob"]),
  path: z.string(),
  mode: z.string(),
});

// ============================================================================
// browse_files - CQRS Query Tool (flat schema for Claude API compatibility)
// Actions: tree, content
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const BrowseFilesSchema = z
  .object({
    action: z.enum(["tree", "content"]).describe("Action to perform: tree or content"),
    project_id: requiredId.describe("Project ID or URL-encoded path"),
    ref: z.string().optional().describe("Branch, tag, or commit SHA"),
    // tree action fields
    path: z.string().optional().describe("Directory path to list. For 'tree' action."),
    recursive: flexibleBoolean
      .optional()
      .describe("Include nested directories. For 'tree' action."),
    per_page: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Results per page (max 100). For 'tree' action."),
    page: z.number().int().min(1).optional().describe("Page number. For 'tree' action."),
    // content action fields
    file_path: z
      .string()
      .optional()
      .describe("Path to the file to read. Required for 'content' action."),
  })
  .refine(data => data.action !== "content" || data.file_path !== undefined, {
    message: "file_path is required for 'content' action",
    path: ["file_path"],
  });

// Export type definitions
export type GitLabFileContent = z.infer<typeof GitLabFileContentSchema>;
export type GitLabDirectoryContent = z.infer<typeof GitLabDirectoryContentSchema>;
export type GitLabContent = z.infer<typeof GitLabContentSchema>;
export type GitLabCreateUpdateFileResponse = z.infer<typeof GitLabCreateUpdateFileResponseSchema>;
export type GitLabTree = z.infer<typeof GitLabTreeSchema>;
export type BrowseFilesInput = z.infer<typeof BrowseFilesSchema>;
