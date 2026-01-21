import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

// ============================================================================
// browse_releases - CQRS Query Tool (discriminated union schema)
// Actions: list, get, assets
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const projectIdField = requiredId.describe(
  "Project ID or URL-encoded path (e.g., 'my-group/my-project')"
);
const tagNameField = z
  .string()
  .describe("The Git tag associated with the release (e.g., 'v1.0.0')");

// --- Action: list ---
const ListReleasesSchema = z.object({
  action: z.literal("list").describe("List all releases for a project, sorted by release date"),
  project_id: projectIdField,
  order_by: z
    .enum(["released_at", "created_at"])
    .optional()
    .describe("Sort releases by field (default: released_at)"),
  sort: z.enum(["desc", "asc"]).optional().describe("Sort direction (default: desc)"),
  include_html_description: flexibleBoolean
    .optional()
    .describe("Include HTML-rendered description in response"),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Number of items per page (max 100)"),
  page: z.number().int().min(1).optional().describe("Page number"),
});

// --- Action: get ---
const GetReleaseSchema = z.object({
  action: z.literal("get").describe("Get a specific release by its tag name"),
  project_id: projectIdField,
  tag_name: tagNameField,
  include_html_description: flexibleBoolean
    .optional()
    .describe("Include HTML-rendered description in response"),
});

// --- Action: assets ---
const ListReleaseAssetsSchema = z.object({
  action: z.literal("assets").describe("List all asset links for a specific release"),
  project_id: projectIdField,
  tag_name: tagNameField,
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Number of items per page (max 100)"),
  page: z.number().int().min(1).optional().describe("Page number"),
});

// --- Discriminated union combining all actions ---
export const BrowseReleasesSchema = z.discriminatedUnion("action", [
  ListReleasesSchema,
  GetReleaseSchema,
  ListReleaseAssetsSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type BrowseReleasesInput = z.infer<typeof BrowseReleasesSchema>;
