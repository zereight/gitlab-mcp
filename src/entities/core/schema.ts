import { z } from "zod";
import { flexibleBoolean } from "../utils";

// ============================================================================
// CONSOLIDATED WRITE SCHEMAS (Issue #16)
// Using Zod discriminated unions for compile-time action validation
// ============================================================================

// Common options shared between create and fork actions
const CommonRepositoryOptions = {
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
};

// manage_repository: Discriminated union for create vs fork
const CreateRepositoryAction = z.object({
  action: z.literal("create").describe("Create a new repository."),
  name: z.string().describe("Project name (required for create)."),
  namespace: z
    .string()
    .optional()
    .describe("Target namespace path. Omit for current user namespace."),
  description: z.string().optional().describe("Project description."),
  visibility: z
    .enum(["private", "internal", "public"])
    .optional()
    .describe("Project visibility level."),
  initialize_with_readme: flexibleBoolean.optional().describe("Create initial README.md file."),
  ...CommonRepositoryOptions,
});

// fork_name/fork_path are distinct from create's name to avoid schema conflicts in the
// discriminated union. Handler maps these to GitLab API's name/path parameters.
const ForkRepositoryAction = z.object({
  action: z.literal("fork").describe("Fork an existing repository."),
  project_id: z.coerce
    .string()
    .describe("Source project to fork (required for fork). Numeric ID or URL-encoded path."),
  namespace: z.string().optional().describe("Target namespace ID or path for fork."),
  namespace_path: z.string().optional().describe("Target namespace path for fork."),
  fork_name: z
    .string()
    .optional()
    .describe("New name for forked project (maps to API 'name' parameter)."),
  fork_path: z
    .string()
    .optional()
    .describe("New path for forked project (maps to API 'path' parameter)."),
  ...CommonRepositoryOptions,
});

export const ManageRepositorySchema = z
  .discriminatedUnion("action", [CreateRepositoryAction, ForkRepositoryAction])
  .describe(
    "REPOSITORY MANAGEMENT: Create or fork GitLab projects. Use 'create' with name for new project. Use 'fork' with project_id to copy existing project."
  );

// ============================================================================
// KEPT AS-IS WRITE SCHEMAS
// ============================================================================

export const CreateBranchSchema = z.object({
  project_id: z.coerce.string().describe("Target project for new branch."),
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

// manage_todos: Discriminated union for mark_done/mark_all_done/restore
const MarkDoneTodoAction = z.object({
  action: z.literal("mark_done").describe("Mark a single todo as done."),
  id: z.number().int().positive().describe("Todo ID to mark as done (required)."),
});

const MarkAllDoneTodoAction = z.object({
  action: z.literal("mark_all_done").describe("Mark all todos as done."),
});

const RestoreTodoAction = z.object({
  action: z.literal("restore").describe("Restore a completed todo to pending."),
  id: z.number().int().positive().describe("Todo ID to restore (required)."),
});

export const ManageTodosSchema = z
  .discriminatedUnion("action", [MarkDoneTodoAction, MarkAllDoneTodoAction, RestoreTodoAction])
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
