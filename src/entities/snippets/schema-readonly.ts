import { z } from "zod";
import { PaginationOptionsSchema } from "../shared";

// READ-ONLY OPERATION SCHEMAS for GitLab Snippets

// List snippets scope enum
const SnippetScopeSchema = z.enum(["personal", "project", "public"]);

// List snippets schema (read-only)
export const ListSnippetsSchema = z
  .object({
    scope: SnippetScopeSchema.describe(
      'The scope of snippets to list: "personal" for current user snippets, "project" for project-specific snippets, "public" for all public snippets'
    ),
    projectId: z
      .string()
      .optional()
      .describe(
        "Project ID or URL-encoded path (required when scope is 'project'). Example: '123' or 'group/project'"
      ),
    visibility: z
      .enum(["private", "internal", "public"])
      .optional()
      .describe(
        "Filter snippets by visibility level. Private: only author can see. Internal: authenticated users can see. Public: anyone can see"
      ),
    created_after: z
      .string()
      .optional()
      .describe(
        "Return snippets created after this date (ISO 8601 format). Example: '2024-01-01T00:00:00Z'"
      ),
    created_before: z
      .string()
      .optional()
      .describe(
        "Return snippets created before this date (ISO 8601 format). Example: '2024-12-31T23:59:59Z'"
      ),
  })
  .merge(PaginationOptionsSchema)
  .refine(data => data.scope !== "project" || data.projectId, {
    message: "projectId is required when scope is 'project'",
    path: ["projectId"],
  });

// Get snippet action parameter for read operations
const GetSnippetActionSchema = z.literal("read");

// Get single snippet schema (read-only)
export const GetSnippetSchema = z
  .object({
    action: GetSnippetActionSchema.describe("Must be 'read' for retrieving snippet details"),
    id: z.number().int().positive().describe("The ID of the snippet to retrieve"),
    projectId: z
      .string()
      .optional()
      .describe(
        "Project ID or URL-encoded path (required for project snippets). Leave empty for personal snippets"
      ),
    raw: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Return raw content of the snippet files instead of metadata. Useful for downloading snippet content directly"
      ),
  })
  .refine(data => !data.projectId || typeof data.projectId === "string", {
    message: "projectId must be a string when provided",
    path: ["projectId"],
  });

// Export type definitions
export type ListSnippetsOptions = z.infer<typeof ListSnippetsSchema>;
export type GetSnippetOptions = z.infer<typeof GetSnippetSchema>;
