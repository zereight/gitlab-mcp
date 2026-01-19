import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

// ============================================================================
// CONSOLIDATED WRITE SCHEMAS - Discriminated union schema pattern
// Uses z.discriminatedUnion() for type-safe action handling.
// ============================================================================

// manage_repository: discriminated union schema for create/fork actions

// --- Shared fields for manage_repository ---
const repoNamespaceField = z
  .string()
  .optional()
  .describe("Target namespace path. Omit for current user namespace.");
const repoIssuesEnabledField = flexibleBoolean.optional().describe("Enable issue tracking.");
const repoMrEnabledField = flexibleBoolean.optional().describe("Enable merge requests.");
const repoJobsEnabledField = flexibleBoolean.optional().describe("Enable CI/CD jobs.");
const repoWikiEnabledField = flexibleBoolean.optional().describe("Enable project wiki.");
const repoSnippetsEnabledField = flexibleBoolean.optional().describe("Enable code snippets.");
const repoLfsEnabledField = flexibleBoolean.optional().describe("Enable Git LFS.");
const repoRequestAccessEnabledField = flexibleBoolean.optional().describe("Allow access requests.");
const repoPipelineMergeField = flexibleBoolean
  .optional()
  .describe("Require passing pipelines for merge.");
const repoDiscussionMergeField = flexibleBoolean
  .optional()
  .describe("Require resolved discussions for merge.");

// --- Action: create ---
const CreateRepositorySchema = z.object({
  action: z.literal("create").describe("Create a new project"),
  name: requiredId.describe("Project name."),
  namespace: repoNamespaceField,
  description: z.string().optional().describe("Project description."),
  visibility: z
    .enum(["private", "internal", "public"])
    .optional()
    .describe("Project visibility level."),
  initialize_with_readme: flexibleBoolean.optional().describe("Create initial README.md file."),
  issues_enabled: repoIssuesEnabledField,
  merge_requests_enabled: repoMrEnabledField,
  jobs_enabled: repoJobsEnabledField,
  wiki_enabled: repoWikiEnabledField,
  snippets_enabled: repoSnippetsEnabledField,
  lfs_enabled: repoLfsEnabledField,
  request_access_enabled: repoRequestAccessEnabledField,
  only_allow_merge_if_pipeline_succeeds: repoPipelineMergeField,
  only_allow_merge_if_all_discussions_are_resolved: repoDiscussionMergeField,
});

// --- Action: fork ---
const ForkRepositorySchema = z.object({
  action: z.literal("fork").describe("Fork an existing project"),
  project_id: requiredId.describe("Source project to fork. Numeric ID or URL-encoded path."),
  namespace: repoNamespaceField,
  namespace_path: z.string().optional().describe("Target namespace path for fork."),
  fork_name: z
    .string()
    .optional()
    .describe("New name for forked project (maps to API 'name' parameter)."),
  fork_path: z
    .string()
    .optional()
    .describe("New path for forked project (maps to API 'path' parameter)."),
  issues_enabled: repoIssuesEnabledField,
  merge_requests_enabled: repoMrEnabledField,
  jobs_enabled: repoJobsEnabledField,
  wiki_enabled: repoWikiEnabledField,
  snippets_enabled: repoSnippetsEnabledField,
  lfs_enabled: repoLfsEnabledField,
  request_access_enabled: repoRequestAccessEnabledField,
  only_allow_merge_if_pipeline_succeeds: repoPipelineMergeField,
  only_allow_merge_if_all_discussions_are_resolved: repoDiscussionMergeField,
});

// --- Discriminated union combining all actions ---
export const ManageRepositorySchema = z.discriminatedUnion("action", [
  CreateRepositorySchema,
  ForkRepositorySchema,
]);

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

// ============================================================================
// manage_todos - CQRS Command Tool (discriminated union schema)
// Actions: mark_done, mark_all_done, restore
//
// Uses z.discriminatedUnion() to define action-specific parameters.
// Benefits:
// - Each action has ONLY its relevant parameters (token savings)
// - TypeScript type narrowing in handlers
// - Filtering denied actions removes their exclusive parameters from schema
// - JSON Schema outputs oneOf which is flattened for AI clients at runtime
// ============================================================================

// --- Mark done action: marks a single todo as done ---
const MarkDoneTodoSchema = z.object({
  action: z.literal("mark_done").describe("Mark a single todo as done"),
  id: z.number().int().positive().describe("Todo ID to mark as done"),
});

// --- Mark all done action: marks all todos as done ---
const MarkAllDoneTodosSchema = z.object({
  action: z.literal("mark_all_done").describe("Mark all todos as done (clears entire queue)"),
});

// --- Restore action: restores a todo to pending state ---
const RestoreTodoSchema = z.object({
  action: z.literal("restore").describe("Restore a completed todo to pending state"),
  id: z.number().int().positive().describe("Todo ID to restore"),
});

// --- Discriminated union combining all actions ---
export const ManageTodosSchema = z.discriminatedUnion("action", [
  MarkDoneTodoSchema,
  MarkAllDoneTodosSchema,
  RestoreTodoSchema,
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Consolidated types
export type ManageRepositoryOptions = z.infer<typeof ManageRepositorySchema>;
export type ManageTodosOptions = z.infer<typeof ManageTodosSchema>;

// Kept as-is types
export type CreateBranchOptions = z.infer<typeof CreateBranchSchema>;
export type CreateGroupOptions = z.infer<typeof CreateGroupSchema>;
