import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";
import { ProjectParamsSchema } from "../shared";

// WRITE FILE OPERATION SCHEMAS

// File operations (write)
export const CreateOrUpdateFileSchema = ProjectParamsSchema.extend({
  file_path: z.string().describe("URL-encoded full path to the file"),
  branch: z.string().describe("Name of the new branch to create"),
  start_branch: z.string().optional().describe("Name of the base branch to start from"),
  encoding: z.enum(["text", "base64"]).optional().describe("Change encoding"),
  author_email: z.string().optional().describe("Author email for the commit"),
  author_name: z.string().optional().describe("Author name for the commit"),
  content: z.string().describe("File content"),
  commit_message: z.string().describe("Commit message"),
  last_commit_id: z.string().optional().describe("Last known file commit id"),
  execute_filemode: flexibleBoolean.optional().describe("Execute file mode"),
});

// Push multiple files operations (write)
export const PushFilesSchema = ProjectParamsSchema.extend({
  branch: z.string().describe("Target branch name"),
  commit_message: z.string().describe("Commit message"),
  files: z
    .array(
      z.object({
        file_path: z.string(),
        content: z.string(),
        encoding: z.enum(["text", "base64"]).optional(),
        execute_filemode: flexibleBoolean.optional(),
      })
    )
    .describe("Array of files to push"),
  start_branch: z.string().optional().describe("Start branch name"),
  author_email: z.string().optional().describe("Author email"),
  author_name: z.string().optional().describe("Author name"),
});

// File upload operations (write)
export const MarkdownUploadSchema = ProjectParamsSchema.extend({
  file: z.string().describe("Base64 encoded file content or file path"),
  filename: z.string().describe("Name of the file"),
});

// ============================================================================
// manage_files - CQRS Command Tool (discriminated union)
// ============================================================================

const ManageFilesSingleSchema = z.object({
  project_id: requiredId.describe("Project ID or URL-encoded path"),
  action: z.literal("single"),
  file_path: z.string().describe("Path to the file"),
  content: z.string().describe("File content (text or base64 encoded)"),
  commit_message: z.string().describe("Commit message"),
  branch: z.string().describe("Target branch name"),
  start_branch: z.string().optional().describe("Base branch to start from"),
  encoding: z.enum(["text", "base64"]).optional().describe("Content encoding (default: text)"),
  author_email: z.string().optional().describe("Commit author email"),
  author_name: z.string().optional().describe("Commit author name"),
  last_commit_id: z.string().optional().describe("Last known commit ID for conflict detection"),
  execute_filemode: flexibleBoolean.optional().describe("Set executable permission"),
});

const BatchFileActionSchema = z.object({
  file_path: z.string().describe("Path to the file"),
  content: z.string().describe("File content"),
  encoding: z.enum(["text", "base64"]).optional().describe("Content encoding"),
  execute_filemode: flexibleBoolean.optional().describe("Set executable permission"),
});

const ManageFilesBatchSchema = z.object({
  project_id: requiredId.describe("Project ID or URL-encoded path"),
  action: z.literal("batch"),
  branch: z.string().describe("Target branch name"),
  commit_message: z.string().describe("Commit message"),
  files: z.array(BatchFileActionSchema).min(1).describe("Files to commit"),
  start_branch: z.string().optional().describe("Base branch to start from"),
  author_email: z.string().optional().describe("Commit author email"),
  author_name: z.string().optional().describe("Commit author name"),
});

const ManageFilesUploadSchema = z.object({
  project_id: requiredId.describe("Project ID or URL-encoded path"),
  action: z.literal("upload"),
  file: z.string().describe("Base64 encoded file content"),
  filename: z.string().describe("Name of the file"),
});

export const ManageFilesSchema = z.discriminatedUnion("action", [
  ManageFilesSingleSchema,
  ManageFilesBatchSchema,
  ManageFilesUploadSchema,
]);

// Export type definitions
export type CreateOrUpdateFileOptions = z.infer<typeof CreateOrUpdateFileSchema>;
export type PushFilesOptions = z.infer<typeof PushFilesSchema>;
export type MarkdownUploadOptions = z.infer<typeof MarkdownUploadSchema>;
export type ManageFilesInput = z.infer<typeof ManageFilesSchema>;
