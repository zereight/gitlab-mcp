import { z } from "zod";
import { requiredId } from "../utils";

// ============================================================================
// manage_ref - CQRS Command Tool (discriminated union schema)
// Actions: create_branch, delete_branch, protect_branch, unprotect_branch,
//          update_branch_protection, create_tag, delete_tag, protect_tag, unprotect_tag
// Uses z.discriminatedUnion() for type-safe action handling.
// ============================================================================

// --- Shared fields ---
const projectIdField = requiredId.describe(
  "Project ID or URL-encoded path (e.g., 'my-group/my-project')"
);

// Access levels for protection rules
// 0 = No access, 30 = Developers, 40 = Maintainers, 60 = Admins
const accessLevelField = z
  .number()
  .int()
  .describe("Access level: 0=No access, 30=Developers, 40=Maintainers, 60=Admins");

// --- Action: create_branch ---
const CreateBranchSchema = z.object({
  action: z.literal("create_branch").describe("Create a new branch from an existing ref"),
  project_id: projectIdField,
  branch: z.string().describe("Name for the new branch"),
  ref: z.string().describe("Source branch name, tag, or commit SHA to create from"),
});

// --- Action: delete_branch ---
const DeleteBranchSchema = z.object({
  action: z.literal("delete_branch").describe("Delete a branch from the repository"),
  project_id: projectIdField,
  branch: z.string().describe("Branch name to delete"),
});

// --- Action: protect_branch ---
const ProtectBranchSchema = z.object({
  action: z.literal("protect_branch").describe("Add protection rules to a branch or pattern"),
  project_id: projectIdField,
  name: z.string().describe("Branch name or wildcard pattern (e.g., 'main', 'release-*')"),
  push_access_level: accessLevelField.optional().describe("Who can push (default: 40=Maintainers)"),
  merge_access_level: accessLevelField
    .optional()
    .describe("Who can merge (default: 40=Maintainers)"),
  unprotect_access_level: accessLevelField
    .optional()
    .describe("Who can unprotect (default: 40=Maintainers)"),
  allow_force_push: z
    .boolean()
    .optional()
    .describe("Allow force push to protected branch (default: false)"),
  allowed_to_push: z
    .array(
      z.object({
        user_id: z.number().optional().describe("User ID"),
        group_id: z.number().optional().describe("Group ID"),
        access_level: accessLevelField.optional().describe("Access level"),
      })
    )
    .optional()
    .describe("Granular push access (Premium feature)"),
  allowed_to_merge: z
    .array(
      z.object({
        user_id: z.number().optional().describe("User ID"),
        group_id: z.number().optional().describe("Group ID"),
        access_level: accessLevelField.optional().describe("Access level"),
      })
    )
    .optional()
    .describe("Granular merge access (Premium feature)"),
  allowed_to_unprotect: z
    .array(
      z.object({
        user_id: z.number().optional().describe("User ID"),
        group_id: z.number().optional().describe("Group ID"),
        access_level: accessLevelField.optional().describe("Access level"),
      })
    )
    .optional()
    .describe("Granular unprotect access (Premium feature)"),
  code_owner_approval_required: z
    .boolean()
    .optional()
    .describe("Require code owner approval (Premium feature)"),
});

// --- Action: unprotect_branch ---
const UnprotectBranchSchema = z.object({
  action: z.literal("unprotect_branch").describe("Remove protection from a branch"),
  project_id: projectIdField,
  name: z.string().describe("Branch name or wildcard pattern to unprotect"),
});

// --- Action: update_branch_protection ---
const UpdateBranchProtectionSchema = z.object({
  action: z.literal("update_branch_protection").describe("Update protection rules for a branch"),
  project_id: projectIdField,
  name: z.string().describe("Branch name or wildcard pattern"),
  allow_force_push: z.boolean().optional().describe("Allow force push to protected branch"),
  allowed_to_push: z
    .array(
      z.object({
        user_id: z.number().optional().describe("User ID"),
        group_id: z.number().optional().describe("Group ID"),
        access_level: accessLevelField.optional().describe("Access level"),
      })
    )
    .optional()
    .describe("Granular push access (Premium feature)"),
  allowed_to_merge: z
    .array(
      z.object({
        user_id: z.number().optional().describe("User ID"),
        group_id: z.number().optional().describe("Group ID"),
        access_level: accessLevelField.optional().describe("Access level"),
      })
    )
    .optional()
    .describe("Granular merge access (Premium feature)"),
  allowed_to_unprotect: z
    .array(
      z.object({
        user_id: z.number().optional().describe("User ID"),
        group_id: z.number().optional().describe("Group ID"),
        access_level: accessLevelField.optional().describe("Access level"),
      })
    )
    .optional()
    .describe("Granular unprotect access (Premium feature)"),
  code_owner_approval_required: z
    .boolean()
    .optional()
    .describe("Require code owner approval (Premium feature)"),
});

// --- Action: create_tag ---
const CreateTagSchema = z.object({
  action: z.literal("create_tag").describe("Create a new tag in the repository"),
  project_id: projectIdField,
  tag_name: z.string().describe("Name for the new tag (e.g., 'v1.0.0')"),
  ref: z.string().describe("Source branch name or commit SHA to create tag from"),
  message: z.string().optional().describe("Annotation message (creates annotated tag if provided)"),
});

// --- Action: delete_tag ---
const DeleteTagSchema = z.object({
  action: z.literal("delete_tag").describe("Delete a tag from the repository"),
  project_id: projectIdField,
  tag_name: z.string().describe("Tag name to delete"),
});

// --- Action: protect_tag ---
const ProtectTagSchema = z.object({
  action: z.literal("protect_tag").describe("Add protection rules to a tag pattern (Premium)"),
  project_id: projectIdField,
  name: z.string().describe("Tag name or wildcard pattern (e.g., 'v*', 'release-*')"),
  create_access_level: accessLevelField
    .optional()
    .describe("Who can create matching tags (default: 40=Maintainers)"),
  allowed_to_create: z
    .array(
      z.object({
        user_id: z.number().optional().describe("User ID"),
        group_id: z.number().optional().describe("Group ID"),
        access_level: accessLevelField.optional().describe("Access level"),
      })
    )
    .optional()
    .describe("Granular create access (Premium feature)"),
});

// --- Action: unprotect_tag ---
const UnprotectTagSchema = z.object({
  action: z.literal("unprotect_tag").describe("Remove protection from a tag pattern (Premium)"),
  project_id: projectIdField,
  name: z.string().describe("Tag name or wildcard pattern to unprotect"),
});

// --- Discriminated union combining all actions ---
export const ManageRefSchema = z.discriminatedUnion("action", [
  CreateBranchSchema,
  DeleteBranchSchema,
  ProtectBranchSchema,
  UnprotectBranchSchema,
  UpdateBranchProtectionSchema,
  CreateTagSchema,
  DeleteTagSchema,
  ProtectTagSchema,
  UnprotectTagSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ManageRefInput = z.infer<typeof ManageRefSchema>;
