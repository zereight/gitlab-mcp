import { z } from "zod";
import { flexibleBoolean } from "../utils";

// ============================================================================
// CONSOLIDATED WRITE SCHEMAS (Issue #16)
// ============================================================================

// manage_repository: Consolidates create_repository, fork_repository (2 → 1)
export const ManageRepositorySchema = z.object({
  action: z
    .enum(["create", "fork"])
    .describe("Operation: create=new repository, fork=copy existing repository."),

  // For "create" action
  name: z.string().optional().describe('Project name (required for "create" action).'),
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

  // For "fork" action
  // Note: fork_name/fork_path are distinct from create's name to avoid schema conflicts.
  // Handler maps these to GitLab API's 'name'/'path' params for fork endpoint.
  project_id: z.coerce
    .string()
    .optional()
    .describe('Source project to fork (required for "fork" action).'),
  namespace_path: z.string().optional().describe("Target namespace for fork."),
  fork_name: z.string().optional().describe("New name for forked project (maps to API 'name')."),
  fork_path: z.string().optional().describe("New path for forked project (maps to API 'path')."),

  // Common creation options
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
});

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

// Todos management (write operations)
export const ManageTodosSchema = z.object({
  action: z
    .enum(["mark_done", "mark_all_done", "restore"])
    .describe(
      "Action: mark_done=complete single todo, mark_all_done=complete all, restore=reopen completed."
    ),
  id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Todo ID (required for mark_done and restore)."),
});

// ============================================================================
// DEPRECATED WRITE SCHEMAS (kept for backward compatibility)
// ============================================================================

// @deprecated Use ManageRepositorySchema with action: "create"
export const CreateRepositorySchema = z.object({
  name: z.string().describe("Project display name."),
  namespace: z.string().optional().describe("Target namespace path."),
  description: z.string().optional().describe("Project description."),
  issues_enabled: flexibleBoolean.optional(),
  merge_requests_enabled: flexibleBoolean.optional(),
  jobs_enabled: flexibleBoolean.optional(),
  wiki_enabled: flexibleBoolean.optional(),
  snippets_enabled: flexibleBoolean.optional(),
  resolve_outdated_diff_discussions: flexibleBoolean.optional(),
  container_registry_enabled: flexibleBoolean.optional(),
  container_registry_access_level: z.enum(["disabled", "private", "enabled"]).optional(),
  shared_runners_enabled: flexibleBoolean.optional(),
  visibility: z.enum(["private", "internal", "public"]).optional(),
  import_url: z.string().optional(),
  public_jobs: flexibleBoolean.optional(),
  only_allow_merge_if_pipeline_succeeds: flexibleBoolean.optional(),
  allow_merge_on_skipped_pipeline: flexibleBoolean.optional(),
  only_allow_merge_if_all_discussions_are_resolved: flexibleBoolean.optional(),
  merge_method: z.enum(["merge", "rebase_merge", "ff"]).optional(),
  autoclose_referenced_issues: flexibleBoolean.optional(),
  suggestion_commit_message: z.string().optional(),
  remove_source_branch_after_merge: flexibleBoolean.optional(),
  lfs_enabled: flexibleBoolean.optional(),
  request_access_enabled: flexibleBoolean.optional(),
  tag_list: z.array(z.string()).optional(),
  printing_merge_request_link_enabled: flexibleBoolean.optional(),
  build_git_strategy: z.enum(["fetch", "clone"]).optional(),
  build_timeout: z.number().optional(),
  auto_cancel_pending_pipelines: z.enum(["disabled", "enabled"]).optional(),
  build_coverage_regex: z.string().optional(),
  ci_config_path: z.string().optional(),
  auto_devops_enabled: flexibleBoolean.optional(),
  auto_devops_deploy_strategy: z.enum(["continuous", "manual", "timed_incremental"]).optional(),
  repository_storage: z.string().optional(),
  approvals_before_merge: z.number().optional(),
  external_authorization_classification_label: z.string().optional(),
  mirror: flexibleBoolean.optional(),
  mirror_trigger_builds: flexibleBoolean.optional(),
  initialize_with_readme: flexibleBoolean.optional(),
  template_name: z.string().optional(),
  template_project_id: z.number().optional(),
  use_custom_template: flexibleBoolean.optional(),
  group_with_project_templates_id: z.number().optional(),
  packages_enabled: flexibleBoolean.optional(),
  service_desk_enabled: flexibleBoolean.optional(),
  compliance_frameworks: z.array(z.string()).optional(),
});

// @deprecated Use ManageRepositorySchema with action: "fork"
export const ForkRepositorySchema = z.object({
  project_id: z.coerce.string().describe("Source project to fork."),
  namespace: z.string().optional().describe("Target namespace."),
  namespace_path: z.string().optional().describe("Target namespace path."),
  name: z.string().optional().describe("Fork name."),
  path: z.string().optional().describe("Fork path."),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Consolidated types
export type ManageRepositoryOptions = z.infer<typeof ManageRepositorySchema>;

// Kept as-is types
export type CreateBranchOptions = z.infer<typeof CreateBranchSchema>;
export type CreateGroupOptions = z.infer<typeof CreateGroupSchema>;
export type ManageTodosOptions = z.infer<typeof ManageTodosSchema>;

// Deprecated types
export type CreateRepositoryOptions = z.infer<typeof CreateRepositorySchema>;
export type ForkRepositoryOptions = z.infer<typeof ForkRepositorySchema>;
