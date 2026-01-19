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
// browse_files - CQRS Query Tool (discriminated union schema)
// Actions: tree, content
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const projectIdField = requiredId.describe("Project ID or URL-encoded path");
const refField = z.string().optional().describe("Branch, tag, or commit SHA");

// --- Action: tree ---
const TreeActionSchema = z.object({
  action: z.literal("tree").describe("List files and folders in a directory"),
  project_id: projectIdField,
  ref: refField,
  path: z.string().optional().describe("Directory path to list"),
  recursive: flexibleBoolean.optional().describe("Include nested directories"),
  per_page: z.number().int().min(1).max(100).optional().describe("Results per page (max 100)"),
  page: z.number().int().min(1).optional().describe("Page number"),
});

// --- Action: content ---
const ContentActionSchema = z.object({
  action: z.literal("content").describe("Read file contents"),
  project_id: projectIdField,
  ref: refField,
  file_path: z.string().describe("Path to the file to read"),
});

// --- Discriminated union combining all actions ---
export const BrowseFilesSchema = z.discriminatedUnion("action", [
  TreeActionSchema,
  ContentActionSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type GitLabFileContent = z.infer<typeof GitLabFileContentSchema>;
export type GitLabDirectoryContent = z.infer<typeof GitLabDirectoryContentSchema>;
export type GitLabContent = z.infer<typeof GitLabContentSchema>;
export type GitLabCreateUpdateFileResponse = z.infer<typeof GitLabCreateUpdateFileResponseSchema>;
export type GitLabTree = z.infer<typeof GitLabTreeSchema>;
export type BrowseFilesInput = z.infer<typeof BrowseFilesSchema>;
