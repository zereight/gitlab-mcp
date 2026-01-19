import { z } from "zod";
import { flexibleBoolean, flexibleBooleanNullable, requiredId } from "./utils";

// Shared schemas that are used across multiple entities
export const PaginationOptionsSchema = z.object({
  page: z.number().int().min(1).optional().describe("Page number"),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Number of items per page (max 100)"),
});

// Basic milestone schema to avoid circular dependencies
export const GitLabMilestoneSchema = z.object({
  id: z.coerce.string(),
  iid: z.coerce.string(),
  title: z.string(),
  description: z.string().nullable().default(""),
  state: z.string(),
  web_url: z.string(),
});

// Base schemas for common types (used by both read and write operations)
export const GitLabAuthorSchema = z.object({
  name: z.string(),
  email: z.string(),
  date: z.string(),
});

export const GitLabUserSchema = z.object({
  id: z.coerce.string(),
  username: z.string(),
  name: z.string(),
  avatar_url: z.string().nullable().optional(),
});

export const GitLabNamespaceSchema = z.object({
  id: z.coerce.string(),
  name: z.string(),
  path: z.string(),
  kind: z.string(),
  full_path: z.string(),
  parent_id: z.coerce.string().nullable(),
  avatar_url: z.string().nullable().optional(),
  web_url: z.string(),
});

export const ProjectParamsSchema = z.object({
  project_id: requiredId.describe("Project ID or URL-encoded path"),
});

// GitLab Project schema (complete response structure for GitLab 18.3)
export const GitLabProjectSchema = z.object({
  id: z.coerce.string(),
  description: z.string().nullable(),
  name: z.string(),
  name_with_namespace: z.string(),
  path: z.string(),
  path_with_namespace: z.string(),
  created_at: z.string(),
  default_branch: z.string().nullable(),
  tag_list: z.array(z.string()),
  topics: z.array(z.string()),
  ssh_url_to_repo: z.string(),
  http_url_to_repo: z.string(),
  web_url: z.string(),
  readme_url: z.string().nullable().optional(),
  forks_count: z.number(),
  avatar_url: z.string().nullable(),
  star_count: z.number(),
  last_activity_at: z.string(),
  visibility: z.enum(["private", "internal", "public"]),
  namespace: GitLabNamespaceSchema,
  repository_storage: z.string().optional(),
  container_registry_image_prefix: z.string().optional(),
  _links: z.object({
    self: z.string(),
    issues: z.string(),
    merge_requests: z.string(),
    repo_branches: z.string(),
    labels: z.string(),
    events: z.string(),
    members: z.string(),
    cluster_agents: z.string().optional(),
  }),
  marked_for_deletion_at: z.string().nullable(),
  marked_for_deletion_on: z.string().nullable().optional(),
  packages_enabled: flexibleBoolean.optional(),
  empty_repo: flexibleBoolean,
  archived: flexibleBoolean,
  resolve_outdated_diff_discussions: flexibleBoolean.optional(),
  container_expiration_policy: z
    .object({
      cadence: z.string(),
      enabled: flexibleBoolean,
      keep_n: z.number(),
      older_than: z.string(),
      name_regex: z.string(),
      name_regex_keep: z.string().nullable(),
      next_run_at: z.string(),
    })
    .optional(),
  repository_object_format: z.string().optional(),
  issues_enabled: flexibleBoolean,
  merge_requests_enabled: flexibleBoolean,
  wiki_enabled: flexibleBoolean,
  jobs_enabled: flexibleBoolean,
  snippets_enabled: flexibleBoolean,
  container_registry_enabled: flexibleBoolean.optional(),
  service_desk_enabled: flexibleBoolean.optional(),
  service_desk_address: z.string().nullable().optional(),
  can_create_merge_request_in: flexibleBoolean.optional(),
  issues_access_level: z.string(),
  repository_access_level: z.string(),
  merge_requests_access_level: z.string(),
  forking_access_level: z.string().optional(),
  wiki_access_level: z.string(),
  builds_access_level: z.string(),
  snippets_access_level: z.string(),
  pages_access_level: z.string().optional(),
  analytics_access_level: z.string().optional(),
  container_registry_access_level: z.string().optional(),
  security_and_compliance_access_level: z.string().optional(),
  releases_access_level: z.string().optional(),
  environments_access_level: z.string().optional(),
  feature_flags_access_level: z.string().optional(),
  infrastructure_access_level: z.string().optional(),
  monitor_access_level: z.string().optional(),
  model_experiments_access_level: z.string().optional(),
  model_registry_access_level: z.string().optional(),
  emails_disabled: flexibleBoolean.optional(),
  emails_enabled: flexibleBoolean.optional(),
  shared_runners_enabled: flexibleBoolean.optional(),
  lfs_enabled: flexibleBoolean.optional(),
  creator_id: z.coerce.string().optional(),
  import_url: z.string().nullable().optional(),
  import_type: z.string().nullable().optional(),
  import_status: z.string().optional(),
  import_error: z.string().nullable().optional(),
  open_issues_count: z.number().optional(),
  description_html: z.string().optional(),
  updated_at: z.string(),
  ci_default_git_depth: z.number().nullable().optional(),
  ci_delete_pipelines_in_seconds: z.number().nullable().optional(),
  ci_forward_deployment_enabled: flexibleBoolean.optional(),
  ci_forward_deployment_rollback_allowed: flexibleBoolean.optional(),
  ci_job_token_scope_enabled: flexibleBoolean.optional(),
  ci_separated_caches: flexibleBoolean.optional(),
  ci_allow_fork_pipelines_to_run_in_parent_project: flexibleBoolean.optional(),
  ci_id_token_sub_claim_components: z.array(z.string()).optional(),
  build_git_strategy: z.string().optional(),
  keep_latest_artifact: flexibleBoolean.optional(),
  restrict_user_defined_variables: flexibleBoolean.optional(),
  ci_pipeline_variables_minimum_override_role: z.string().optional(),
  runner_token_expiration_interval: z.number().nullable().optional(),
  group_runners_enabled: flexibleBoolean.optional(),
  auto_cancel_pending_pipelines: z.string().optional(),
  build_timeout: z.number().optional(),
  auto_devops_enabled: flexibleBoolean.optional(),
  auto_devops_deploy_strategy: z.string().optional(),
  ci_push_repository_for_job_token_allowed: flexibleBoolean.optional(),
  runners_token: z.string().optional(),
  ci_config_path: z.string().nullable().optional(),
  public_jobs: flexibleBoolean.optional(),
  shared_with_groups: z.array(z.unknown()).optional(),
  only_allow_merge_if_pipeline_succeeds: flexibleBoolean.optional(),
  allow_merge_on_skipped_pipeline: z.boolean().nullable().optional(),
  request_access_enabled: flexibleBoolean.optional(),
  only_allow_merge_if_all_discussions_are_resolved: flexibleBoolean.optional(),
  remove_source_branch_after_merge: flexibleBoolean.optional(),
  printing_merge_request_link_enabled: flexibleBoolean.optional(),
  merge_method: z.string().optional(),
  merge_request_title_regex: z.string().nullable().optional(),
  merge_request_title_regex_description: z.string().nullable().optional(),
  squash_option: z.string().optional(),
  enforce_auth_checks_on_uploads: flexibleBoolean.optional(),
  suggestion_commit_message: z.string().nullable().optional(),
  merge_commit_template: z.string().nullable().optional(),
  squash_commit_template: z.string().nullable().optional(),
  issue_branch_template: z.string().nullable().optional(),
  warn_about_potentially_unwanted_characters: flexibleBoolean.optional(),
  autoclose_referenced_issues: flexibleBoolean.optional(),
  max_artifacts_size: z.number().nullable().optional(),
  approvals_before_merge: z.number().optional(),
  mirror: flexibleBoolean.optional(),
  external_authorization_classification_label: z.string().nullable().optional(),
  requirements_enabled: flexibleBoolean.optional(),
  requirements_access_level: z.string().optional(),
  security_and_compliance_enabled: flexibleBoolean.optional(),
  secret_push_protection_enabled: flexibleBoolean.optional(),
  pre_receive_secret_detection_enabled: flexibleBoolean.optional(),
  compliance_frameworks: z.array(z.unknown()).optional(),
  issues_template: z.string().nullable().optional(),
  merge_requests_template: z.string().nullable().optional(),
  ci_restrict_pipeline_cancellation_role: z.string().optional(),
  merge_pipelines_enabled: flexibleBoolean.optional(),
  merge_trains_enabled: flexibleBoolean.optional(),
  merge_trains_skip_train_allowed: flexibleBoolean.optional(),
  only_allow_merge_if_all_status_checks_passed: flexibleBoolean.optional(),
  allow_pipeline_trigger_approve_deployment: flexibleBoolean.optional(),
  prevent_merge_without_jira_issue: flexibleBoolean.optional(),
  duo_remote_flows_enabled: flexibleBoolean.optional(),
  spp_repository_pipeline_access: flexibleBoolean.optional(),
  permissions: z
    .object({
      project_access: z
        .object({
          access_level: z.number(),
          notification_level: z.number(),
        })
        .nullable()
        .optional(),
      group_access: z
        .object({
          access_level: z.number(),
          notification_level: z.number(),
        })
        .nullable()
        .optional(),
    })
    .optional(),
});

// Label schema (shared for both read and write)
export const GitLabLabelSchema = z.object({
  id: z.coerce.string(),
  name: z.string(),
  color: z.string(),
  text_color: z.string().optional(),
  description: z.string().nullable(),
  description_html: z.string().nullable().optional(),
  open_issues_count: z.number().nullable().optional(),
  closed_issues_count: z.number().nullable().optional(),
  open_merge_requests_count: z.number().nullable().optional(),
  subscribed: flexibleBoolean.nullable().optional(),
  priority: z.number().nullable().optional(),
  is_project_label: flexibleBoolean.optional(),
});

// Issue schema (shared response structure)
export const GitLabIssueSchema = z.object({
  id: z.coerce.string(),
  iid: z.coerce.string(),
  project_id: z.coerce.string(),
  title: z.string(),
  description: z.string().nullable().default(""),
  state: z.string(),
  author: GitLabUserSchema,
  assignees: z.array(GitLabUserSchema),
  labels: z.array(z.string()),
  milestone: GitLabMilestoneSchema.nullable(),
  type: z.enum(["ISSUE", "INCIDENT", "TEST_CASE", "TASK"]).optional(),
  user_notes_count: z.number().optional(),
  merge_requests_count: z.number().optional(),
  upvotes: z.number().optional(),
  downvotes: z.number().optional(),
  due_date: z.string().nullable().optional(),
  confidential: flexibleBoolean.optional(),
  discussion_locked: flexibleBooleanNullable.optional(),
  issue_type: z.string().optional(),
  web_url: z.string(),
  time_stats: z
    .object({
      time_estimate: z.number(),
      total_time_spent: z.number(),
      human_time_estimate: z.string().nullable(),
      human_total_time_spent: z.string().nullable(),
    })
    .optional(),
  task_completion_status: z
    .object({
      count: z.number(),
      completed_count: z.number(),
    })
    .optional(),
  blocking_issues_count: z.number().optional(),
  has_tasks: flexibleBoolean.optional(),
  task_status: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  closed_by: GitLabUserSchema.nullable().optional(),
  service_desk_reply_to: z.string().nullable().optional(),
});
