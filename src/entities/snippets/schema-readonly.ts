import { z } from "zod";
import { requiredId } from "../utils";

// ============================================================================
// browse_snippets - CQRS Query Tool (discriminated union schema)
// Actions: list, get
// Uses z.discriminatedUnion() for type-safe action handling.
// ============================================================================

// --- Shared enums ---
const SnippetScopeSchema = z
  .enum(["personal", "project", "public"])
  .describe("The scope of snippets");

const SnippetVisibilitySchema = z
  .enum(["private", "internal", "public"])
  .describe("Visibility level of snippets");

// --- Shared fields ---
const projectIdField = z
  .string()
  .optional()
  .describe("Project ID or URL-encoded path (e.g., '123' or 'group/project')");

// --- Action: list ---
const ListSnippetsSchema = z.object({
  action: z.literal("list").describe("List snippets with filtering by scope and visibility"),
  scope: SnippetScopeSchema.describe(
    'Scope of snippets: "personal" for current user, "project" for project-specific (requires projectId), "public" for all public snippets'
  ),
  projectId: projectIdField.describe(
    "Project ID or URL-encoded path. Required when scope is 'project'"
  ),
  visibility: SnippetVisibilitySchema.optional().describe(
    "Filter by visibility: private (author only), internal (authenticated users), public (everyone)"
  ),
  created_after: z
    .string()
    .optional()
    .describe(
      "Return snippets created after this date (ISO 8601). Example: '2024-01-01T00:00:00Z'"
    ),
  created_before: z
    .string()
    .optional()
    .describe(
      "Return snippets created before this date (ISO 8601). Example: '2024-12-31T23:59:59Z'"
    ),
  per_page: z.number().optional().describe("Number of items per page"),
  page: z.number().optional().describe("Page number"),
});

// --- Action: get ---
const GetSnippetSchema = z.object({
  action: z.literal("get").describe("Get single snippet details or raw content"),
  id: requiredId.describe("The ID of the snippet to retrieve"),
  projectId: projectIdField.describe(
    "Project ID or URL-encoded path. Required for project snippets, leave empty for personal snippets"
  ),
  raw: z
    .boolean()
    .optional()
    .default(false)
    .describe("Return raw content of snippet files instead of metadata"),
});

// --- Discriminated union combining all actions ---
export const BrowseSnippetsSchema = z.discriminatedUnion("action", [
  ListSnippetsSchema,
  GetSnippetSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type BrowseSnippetsInput = z.infer<typeof BrowseSnippetsSchema>;
