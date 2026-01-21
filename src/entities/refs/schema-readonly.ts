import { z } from "zod";
import { requiredId } from "../utils";

// ============================================================================
// browse_refs - CQRS Query Tool (discriminated union schema)
// Actions: list_branches, get_branch, list_tags, get_tag,
//          list_protected_branches, get_protected_branch, list_protected_tags
// Uses z.discriminatedUnion() for type-safe action handling.
// ============================================================================

// --- Shared fields ---
const projectIdField = requiredId.describe(
  "Project ID or URL-encoded path (e.g., 'my-group/my-project')"
);

// Pagination fields
const perPageField = z
  .number()
  .int()
  .min(1)
  .max(100)
  .optional()
  .describe("Number of items per page (max 100)");
const pageField = z.number().int().min(1).optional().describe("Page number");

// --- Action: list_branches ---
const ListBranchesSchema = z.object({
  action: z.literal("list_branches").describe("List all repository branches with optional search"),
  project_id: projectIdField,
  search: z.string().optional().describe("Filter branches by name (supports wildcards)"),
  regex: z.string().optional().describe("Filter branches by regex pattern"),
  per_page: perPageField,
  page: pageField,
});

// --- Action: get_branch ---
const GetBranchSchema = z.object({
  action: z.literal("get_branch").describe("Get details of a specific branch"),
  project_id: projectIdField,
  branch: z.string().describe("Branch name (URL-encoded if contains slashes)"),
});

// --- Action: list_tags ---
const ListTagsSchema = z.object({
  action: z.literal("list_tags").describe("List all repository tags"),
  project_id: projectIdField,
  search: z.string().optional().describe("Filter tags by name (supports wildcards)"),
  order_by: z
    .enum(["name", "updated", "version"])
    .optional()
    .describe("Sort by field (default: updated)"),
  sort: z.enum(["asc", "desc"]).optional().describe("Sort direction (default: desc)"),
  per_page: perPageField,
  page: pageField,
});

// --- Action: get_tag ---
const GetTagSchema = z.object({
  action: z.literal("get_tag").describe("Get details of a specific tag"),
  project_id: projectIdField,
  tag_name: z.string().describe("Tag name (URL-encoded if contains special characters)"),
});

// --- Action: list_protected_branches ---
const ListProtectedBranchesSchema = z.object({
  action: z
    .literal("list_protected_branches")
    .describe("List all protected branches with their protection rules"),
  project_id: projectIdField,
  search: z.string().optional().describe("Filter protected branches by name"),
  per_page: perPageField,
  page: pageField,
});

// --- Action: get_protected_branch ---
const GetProtectedBranchSchema = z.object({
  action: z.literal("get_protected_branch").describe("Get protection rules for a specific branch"),
  project_id: projectIdField,
  name: z.string().describe("Branch name or wildcard pattern (e.g., 'main', 'release-*')"),
});

// --- Action: list_protected_tags ---
const ListProtectedTagsSchema = z.object({
  action: z
    .literal("list_protected_tags")
    .describe("List all protected tags with their protection rules"),
  project_id: projectIdField,
  per_page: perPageField,
  page: pageField,
});

// --- Discriminated union combining all actions ---
export const BrowseRefsSchema = z.discriminatedUnion("action", [
  ListBranchesSchema,
  GetBranchSchema,
  ListTagsSchema,
  GetTagSchema,
  ListProtectedBranchesSchema,
  GetProtectedBranchSchema,
  ListProtectedTagsSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type BrowseRefsInput = z.infer<typeof BrowseRefsSchema>;
