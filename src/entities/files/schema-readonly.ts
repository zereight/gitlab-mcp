import { z } from "zod";
import { flexibleBoolean } from "../utils";
import { ProjectParamsSchema } from "../shared";

// READ-ONLY FILE OPERATION SCHEMAS

// Repository content response schemas (read-only)
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

// Response schemas (read-only)
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

// Repository operations (read-only)
export const GetRepositoryTreeSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  path: z.string().optional().describe("The path inside repository"),
  ref: z.string().optional().describe("The name of a repository branch or tag"),
  recursive: flexibleBoolean.optional().describe("Boolean value used to get a recursive tree"),
  per_page: z.number().int().min(1).max(100).optional().describe("Number of results per page"),
  page: z.number().int().min(1).optional().describe("Page number"),
});

// Get file contents (read-only)
export const GetFileContentsSchema = ProjectParamsSchema.extend({
  file_path: z.string().describe("URL-encoded full path to the file"),
  ref: z.string().optional().describe("The name of branch, tag or commit"),
});

// ============================================================================
// browse_files - CQRS Query Tool (discriminated union)
// ============================================================================

const BrowseFilesBaseSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  ref: z.string().optional().describe("Branch, tag, or commit SHA"),
});

const BrowseFilesTreeSchema = BrowseFilesBaseSchema.extend({
  action: z.literal("tree"),
  path: z.string().optional().describe("Directory path to list"),
  recursive: flexibleBoolean.optional().describe("Include nested directories"),
  per_page: z.number().int().min(1).max(100).optional().describe("Results per page (max 100)"),
  page: z.number().int().min(1).optional().describe("Page number"),
});

const BrowseFilesContentSchema = BrowseFilesBaseSchema.extend({
  action: z.literal("content"),
  file_path: z.string().describe("Path to the file to read"),
});

export const BrowseFilesSchema = z.discriminatedUnion("action", [
  BrowseFilesTreeSchema,
  BrowseFilesContentSchema,
]);

// Export type definitions
export type GitLabFileContent = z.infer<typeof GitLabFileContentSchema>;
export type GitLabDirectoryContent = z.infer<typeof GitLabDirectoryContentSchema>;
export type GitLabContent = z.infer<typeof GitLabContentSchema>;
export type GitLabCreateUpdateFileResponse = z.infer<typeof GitLabCreateUpdateFileResponseSchema>;
export type GitLabTree = z.infer<typeof GitLabTreeSchema>;
export type GetRepositoryTreeOptions = z.infer<typeof GetRepositoryTreeSchema>;
export type GetFileContentsOptions = z.infer<typeof GetFileContentsSchema>;
export type BrowseFilesInput = z.infer<typeof BrowseFilesSchema>;
