import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

// ============================================================================
// manage_files - CQRS Command Tool (flat schema for Claude API compatibility)
// Actions: single, batch, upload
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

const BatchFileActionSchema = z.object({
  file_path: z.string().describe("Path to the file"),
  content: z.string().describe("File content"),
  encoding: z.enum(["text", "base64"]).optional().describe("Content encoding"),
  execute_filemode: flexibleBoolean.optional().describe("Set executable permission"),
});

export const ManageFilesSchema = z
  .object({
    action: z.enum(["single", "batch", "upload"]).describe("Action to perform"),
    project_id: requiredId.describe("Project ID or URL-encoded path"),
    // single action fields
    file_path: z.string().optional().describe("Path to the file. Required for 'single' action."),
    content: z
      .string()
      .optional()
      .describe("File content (text or base64 encoded). Required for 'single' action."),
    // shared single/batch fields
    commit_message: z
      .string()
      .optional()
      .describe("Commit message. Required for 'single' and 'batch' actions."),
    branch: z
      .string()
      .optional()
      .describe("Target branch name. Required for 'single' and 'batch' actions."),
    start_branch: z.string().optional().describe("Base branch to start from"),
    encoding: z
      .enum(["text", "base64"])
      .optional()
      .describe("Content encoding (default: text). For 'single' action."),
    author_email: z.string().optional().describe("Commit author email"),
    author_name: z.string().optional().describe("Commit author name"),
    last_commit_id: z
      .string()
      .optional()
      .describe("Last known commit ID for conflict detection. For 'single' action."),
    execute_filemode: flexibleBoolean
      .optional()
      .describe("Set executable permission. For 'single' action."),
    // batch action fields
    files: z
      .array(BatchFileActionSchema)
      .optional()
      .describe("Files to commit. Required for 'batch' action."),
    // upload action fields
    file: z
      .string()
      .optional()
      .describe("Base64 encoded file content. Required for 'upload' action."),
    filename: z.string().optional().describe("Name of the file. Required for 'upload' action."),
  })
  .refine(data => data.action !== "single" || data.file_path !== undefined, {
    message: "file_path is required for 'single' action",
    path: ["file_path"],
  })
  .refine(data => data.action !== "single" || data.content !== undefined, {
    message: "content is required for 'single' action",
    path: ["content"],
  })
  .refine(data => data.action !== "single" || data.commit_message !== undefined, {
    message: "commit_message is required for 'single' action",
    path: ["commit_message"],
  })
  .refine(data => data.action !== "single" || data.branch !== undefined, {
    message: "branch is required for 'single' action",
    path: ["branch"],
  })
  .refine(data => data.action !== "batch" || data.branch !== undefined, {
    message: "branch is required for 'batch' action",
    path: ["branch"],
  })
  .refine(data => data.action !== "batch" || data.commit_message !== undefined, {
    message: "commit_message is required for 'batch' action",
    path: ["commit_message"],
  })
  .refine(data => data.action !== "batch" || (data.files && data.files.length > 0), {
    message: "files array with at least one file is required for 'batch' action",
    path: ["files"],
  })
  .refine(data => data.action !== "upload" || data.file !== undefined, {
    message: "file is required for 'upload' action",
    path: ["file"],
  })
  .refine(data => data.action !== "upload" || data.filename !== undefined, {
    message: "filename is required for 'upload' action",
    path: ["filename"],
  });

// Export type definitions
export type ManageFilesInput = z.infer<typeof ManageFilesSchema>;
