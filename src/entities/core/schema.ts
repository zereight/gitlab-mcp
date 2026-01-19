import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

// ============================================================================
// CONSOLIDATED WRITE SCHEMAS - Flat schemas with .refine() validation (Issue #29)
// Using flat z.object() instead of discriminatedUnion for Claude API compatibility
// ============================================================================

// manage_repository: Flat schema for create vs fork actions
export const ManageRepositorySchema = z
  .object({
    action: z
      .enum(["create", "fork"])
      .describe("Action: 'create' makes new project, 'fork' copies existing project."),
    // Common options for both actions
    namespace: z
      .string()
      .optional()
      .describe("Target namespace path. Omit for current user namespace."),
    issues_enabled: flexibleBoolean.optional().describe("Enable issue tracking."),
    merge_requests_enabled: flexibleBoolean.optional().describe("Enable merge requests."),
    jobs_enabled: flexibleBoolean.optional().describe("Enable CI/CD jobs."),
    wiki_enabled: flexibleBoolean.optional().describe("Enable project wiki."),
    snippets_enabled: flexibleBoolean.optional().describe("Enable code snippets."),
    lfs_enabled: flexibleBoolean.optional().describe("Enable Git LFS."),
    request_access_enabled: flexibleBoolean.optional().describe("Allow access requests."),
    only_allow_merge_if_pipeline_succeeds: flexibleBoolean
      .optional()
      .describe("Require passing pipelines for merge."),
    only_allow_merge_if_all_discussions_are_resolved: flexibleBoolean
      .optional()
      .describe("Require resolved discussions for merge."),
    // Create action fields
    name: z.string().optional().describe("Project name (required for 'create' action)."),
    description: z.string().optional().describe("Project description."),
    visibility: z
      .enum(["private", "internal", "public"])
      .optional()
      .describe("Project visibility level."),
    initialize_with_readme: flexibleBoolean.optional().describe("Create initial README.md file."),
    // Fork action fields
    project_id: z.coerce
      .string()
      .optional()
      .describe(
        "Source project to fork (required for 'fork' action). Numeric ID or URL-encoded path."
      ),
    namespace_path: z.string().optional().describe("Target namespace path for fork."),
    fork_name: z
      .string()
      .optional()
      .describe("New name for forked project (maps to API 'name' parameter)."),
    fork_path: z
      .string()
      .optional()
      .describe("New path for forked project (maps to API 'path' parameter)."),
  })
  .refine(
    data => {
      if (data.action === "create") {
        return data.name !== undefined && data.name.trim() !== "";
      }
      return true;
    },
    { message: "name is required for 'create' action", path: ["name"] }
  )
  .refine(
    data => {
      if (data.action === "fork") {
        return data.project_id !== undefined && data.project_id.trim() !== "";
      }
      return true;
    },
    { message: "project_id is required for 'fork' action", path: ["project_id"] }
  )
  .describe(
    "REPOSITORY MANAGEMENT: Create or fork GitLab projects. Use 'create' with name for new project. Use 'fork' with project_id to copy existing project."
  );

// ============================================================================
// KEPT AS-IS WRITE SCHEMAS
// ============================================================================

export const CreateBranchSchema = z.object({
  project_id: requiredId.describe("Target project for new branch."),
  branch: z.string().describe("New branch name."),
  ref: z.string().describe("Source reference (branch name or commit SHA)."),
});

export const CreateGroupSchema = z.object({
  name: z.string().describe("Group display name."),
  path: z.string().describe("Group path for URLs (URL-safe)."),
  description: z.string().optional().describe("Group description."),
  visibility: z
    .enum(["private", "internal", "public"])
    .optional()
    .default("private")
    .describe("Group visibility level."),
  parent_id: z.number().optional().describe("Parent group ID for subgroup."),
  lfs_enabled: z.boolean().optional().describe("Enable Git LFS."),
  request_access_enabled: z.boolean().optional().describe("Allow access requests."),
  default_branch_protection: z
    .number()
    .optional()
    .describe("Branch protection level: 0=none, 1=partial, 2=full."),
  avatar: z.string().optional().describe("Group avatar URL."),
});

// manage_todos: Flat schema for mark_done/mark_all_done/restore actions
export const ManageTodosSchema = z
  .object({
    action: z
      .enum(["mark_done", "mark_all_done", "restore"])
      .describe(
        "Action: 'mark_done' marks single todo done, 'mark_all_done' clears all, 'restore' restores todo."
      ),
    id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Todo ID (required for 'mark_done' and 'restore' actions)."),
  })
  .refine(
    data => {
      if (data.action === "mark_done" || data.action === "restore") {
        return data.id !== undefined;
      }
      return true;
    },
    { message: "id is required for 'mark_done' and 'restore' actions", path: ["id"] }
  )
  .describe(
    "TODO ACTIONS: Manage GitLab todo items. mark_done requires id, mark_all_done clears all, restore requires id."
  );

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Consolidated types
export type ManageRepositoryOptions = z.infer<typeof ManageRepositorySchema>;
export type ManageTodosOptions = z.infer<typeof ManageTodosSchema>;

// Kept as-is types
export type CreateBranchOptions = z.infer<typeof CreateBranchSchema>;
export type CreateGroupOptions = z.infer<typeof CreateGroupSchema>;
