import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

// ============================================================================
// manage_files - CQRS Command Tool (discriminated union schema)
// Actions: single, batch, upload
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const projectIdField = requiredId.describe("Project ID or URL-encoded path");

// --- Helper schema for batch file actions ---
const BatchFileActionSchema = z.object({
  file_path: z.string().describe("Path to the file"),
  content: z.string().describe("File content"),
  encoding: z.enum(["text", "base64"]).optional().describe("Content encoding"),
  execute_filemode: flexibleBoolean.optional().describe("Set executable permission"),
});

// --- Action: single ---
const SingleActionSchema = z.object({
  action: z.literal("single").describe("Create or update a single file"),
  project_id: projectIdField,
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

// --- Action: batch ---
const BatchActionSchema = z.object({
  action: z.literal("batch").describe("Commit multiple files atomically"),
  project_id: projectIdField,
  branch: z.string().describe("Target branch name"),
  commit_message: z.string().describe("Commit message"),
  files: z.array(BatchFileActionSchema).min(1).describe("Files to commit (at least one required)"),
  start_branch: z.string().optional().describe("Base branch to start from"),
  author_email: z.string().optional().describe("Commit author email"),
  author_name: z.string().optional().describe("Commit author name"),
});

// --- Action: upload ---
const UploadActionSchema = z.object({
  action: z.literal("upload").describe("Upload a file as markdown attachment"),
  project_id: projectIdField,
  file: z.string().describe("Base64 encoded file content"),
  filename: z.string().describe("Name of the file"),
});

// --- Discriminated union combining all actions ---
export const ManageFilesSchema = z.discriminatedUnion("action", [
  SingleActionSchema,
  BatchActionSchema,
  UploadActionSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ManageFilesInput = z.infer<typeof ManageFilesSchema>;
