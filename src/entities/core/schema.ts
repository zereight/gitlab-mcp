import { z } from "zod";
import { flexibleBoolean } from "../utils";

// WRITE-ONLY OPERATION SCHEMAS

// Repository operations (write)
export const CreateRepositorySchema = z.object({
  name: z
    .string()
    .describe(
      'Project display name. Can contain spaces and special characters. Example: "My Awesome Project".'
    ),
  namespacePath: z
    .string()
    .optional()
    .describe(
      'Target namespace for project creation. Use group path ("test"), user path ("username"), or subgroup ("group/subgroup"). Omit for current user namespace. Tool automatically resolves paths to IDs and validates existence.'
    ),
  description: z
    .string()
    .optional()
    .describe(
      "Project description shown on overview page. Supports Markdown formatting. Max 2000 chars."
    ),
  issues_enabled: flexibleBoolean
    .optional()
    .describe("Enable issue tracking for bug reports and feature requests. Default: true."),
  merge_requests_enabled: flexibleBoolean
    .optional()
    .describe("Enable merge requests for code review and collaboration. Default: true."),
  jobs_enabled: flexibleBoolean
    .optional()
    .describe("Enable CI/CD jobs and pipelines. Required for automated testing and deployment."),
  wiki_enabled: flexibleBoolean
    .optional()
    .describe(
      "Enable project wiki for documentation. Creates separate Git repository for wiki content."
    ),
  snippets_enabled: flexibleBoolean
    .optional()
    .describe("Enable code snippets for sharing small code examples and scripts."),
  resolve_outdated_diff_discussions: flexibleBoolean
    .optional()
    .describe(
      "Auto-resolve MR discussions on modified lines when new commits are pushed. Keeps discussions relevant."
    ),
  container_registry_enabled: flexibleBoolean
    .optional()
    .describe("Enable Docker container registry for storing and managing Docker images."),
  container_registry_access_level: z
    .enum(["disabled", "private", "enabled"])
    .optional()
    .describe(
      "Container registry visibility: disabled=off, private=project members only, enabled=follows project visibility."
    ),
  shared_runners_enabled: flexibleBoolean
    .optional()
    .describe("Use GitLab shared runners for CI/CD. Disable to use only project-specific runners."),
  visibility: z
    .enum(["private", "internal", "public"])
    .optional()
    .describe(
      "Project visibility: private=members only, internal=logged-in users, public=everyone. Affects clone/browse access."
    ),
  import_url: z
    .string()
    .optional()
    .describe(
      "Git URL to import existing repository. Supports HTTP(S) and SSH URLs. Example: https://github.com/user/repo.git"
    ),
  public_jobs: flexibleBoolean
    .optional()
    .describe(
      "Allow non-members to view CI/CD job logs and artifacts. Useful for open source projects."
    ),
  only_allow_merge_if_pipeline_succeeds: flexibleBoolean
    .optional()
    .describe("Require all CI/CD pipelines to pass before allowing merge. Ensures code quality."),
  allow_merge_on_skipped_pipeline: flexibleBoolean
    .optional()
    .describe("Treat skipped pipelines as successful. Use when some pipelines are optional."),
  only_allow_merge_if_all_discussions_are_resolved: flexibleBoolean
    .optional()
    .describe(
      "Require all discussion threads to be resolved before merge. Ensures all feedback is addressed."
    ),
  merge_method: z
    .enum(["merge", "rebase_merge", "ff"])
    .optional()
    .describe(
      "Merge strategy: merge=create merge commit, rebase_merge=rebase then merge, ff=fast-forward only."
    ),
  autoclose_referenced_issues: flexibleBoolean
    .optional()
    .describe(
      'Automatically close issues referenced by "Closes #123" in commit messages when merged to default branch.'
    ),
  suggestion_commit_message: z
    .string()
    .optional()
    .describe(
      "Template for commit messages when applying code suggestions. Supports variables like %{suggestion_author}."
    ),
  remove_source_branch_after_merge: flexibleBoolean
    .optional()
    .describe(
      'Auto-enable "Delete source branch" checkbox on new MRs. Keeps repository clean after merging.'
    ),
  lfs_enabled: flexibleBoolean
    .optional()
    .describe("Enable Git LFS (Large File Storage) for managing large binary files efficiently."),
  request_access_enabled: flexibleBoolean
    .optional()
    .describe(
      "Allow non-members to request project access. Maintainers can approve/deny requests."
    ),
  tag_list: z
    .array(z.string())
    .optional()
    .describe(
      'Project tags/topics for categorization and discovery. Example: ["javascript", "frontend", "react"].'
    ),
  printing_merge_request_link_enabled: flexibleBoolean
    .optional()
    .describe(
      "Display MR creation URL in git push output. Convenient for quickly creating MRs after pushing."
    ),
  build_git_strategy: z
    .enum(["fetch", "clone"])
    .optional()
    .describe(
      "CI/CD git strategy: fetch=incremental fetch (faster), clone=fresh clone each time (cleaner)."
    ),
  build_timeout: z
    .number()
    .optional()
    .describe(
      "Maximum job runtime in seconds before automatic termination. Default: 3600 (1 hour)."
    ),
  auto_cancel_pending_pipelines: z
    .enum(["disabled", "enabled"])
    .optional()
    .describe("Cancel redundant pipelines when new commits are pushed. Saves CI resources."),
  build_coverage_regex: z
    .string()
    .optional()
    .describe(
      'Regex pattern to extract test coverage from job output. Example: "Total:\\s*(\\d+\\.?\\d*)%".'
    ),
  ci_config_path: z
    .string()
    .optional()
    .describe(
      "Path to CI/CD configuration file. Default: .gitlab-ci.yml. Can be in other repos with @group/project."
    ),
  auto_devops_enabled: flexibleBoolean
    .optional()
    .describe(
      "Enable Auto DevOps for automatic CI/CD pipeline configuration. Requires Kubernetes for deployment."
    ),
  auto_devops_deploy_strategy: z
    .enum(["continuous", "manual", "timed_incremental"])
    .optional()
    .describe(
      "Auto DevOps deployment strategy: continuous=every push, manual=manual trigger, timed_incremental=gradual rollout."
    ),
  repository_storage: z
    .string()
    .optional()
    .describe(
      "Storage shard for repository data (admin setting). Used in multi-shard GitLab installations."
    ),
  approvals_before_merge: z
    .number()
    .optional()
    .describe(
      "Minimum number of approvals required for merge requests. Requires GitLab Premium. 0=disabled."
    ),
  external_authorization_classification_label: z
    .string()
    .optional()
    .describe(
      "External authorization system classification label. For compliance with external auth systems."
    ),
  mirror: flexibleBoolean
    .optional()
    .describe(
      "Enable repository mirroring from external source. Keeps fork synchronized with upstream."
    ),
  mirror_trigger_builds: flexibleBoolean
    .optional()
    .describe("Trigger CI/CD pipelines when mirror updates. Useful for testing upstream changes."),
  initialize_with_readme: flexibleBoolean
    .optional()
    .describe(
      "Create initial README.md file. Prevents empty repository and enables immediate cloning."
    ),
  template_name: z
    .string()
    .optional()
    .describe(
      'Template name for project initialization. Use with use_custom_template=true. Example: "rails", "spring".'
    ),
  template_project_id: z
    .number()
    .optional()
    .describe(
      "Source project ID to use as template. Creates project with same structure and settings."
    ),
  use_custom_template: flexibleBoolean
    .optional()
    .describe(
      "Enable custom project templates. Requires template_name or template_project_id. For advanced project initialization."
    ),
  group_with_project_templates_id: z
    .number()
    .optional()
    .describe(
      "Group ID containing custom project templates. For organizations with standard project structures."
    ),
  packages_enabled: flexibleBoolean
    .optional()
    .describe(
      "Enable package registry for NPM, Maven, PyPI, etc. packages. Store and share dependencies."
    ),
  service_desk_enabled: flexibleBoolean
    .optional()
    .describe(
      "Enable Service Desk for customer support via email. Creates issues from emails. Premium feature."
    ),
  compliance_frameworks: z
    .array(z.string())
    .optional()
    .describe(
      'Compliance framework names for regulatory requirements. Example: ["SOC2", "GDPR"]. Ultimate feature.'
    ),
});

export const ForkRepositorySchema = z.object({
  project_id: z.coerce
    .string()
    .describe(
      'Source project to fork. Use numeric ID or URL-encoded path like "gitlab-org%2Fgitlab".'
    ),
  namespace: z
    .string()
    .optional()
    .describe(
      "Target namespace (group or user) for the fork. Use ID or path. Defaults to current user namespace."
    ),
  namespace_path: z
    .string()
    .optional()
    .describe("Alternative to namespace parameter. Specify target namespace by path only."),
  name: z
    .string()
    .optional()
    .describe("Display name for the fork. Defaults to original project name."),
  path: z
    .string()
    .optional()
    .describe("URL path for the fork. Must be unique in namespace. Defaults to original path."),
});

export const CreateBranchSchema = z.object({
  project_id: z.coerce
    .string()
    .describe("Target project for new branch. Use numeric ID or URL-encoded path."),
  branch: z
    .string()
    .describe(
      "New branch name. Must be unique. Cannot contain spaces or special chars except - and _."
    ),
  ref: z
    .string()
    .describe(
      'Source reference: existing branch name or commit SHA. Example: "main" or "abc123def".'
    ),
});

export const CreateGroupSchema = z.object({
  name: z
    .string()
    .describe('Group display name. Can contain spaces and special characters. Example: "My Team".'),
  path: z
    .string()
    .describe(
      'Group path for URLs. Must be unique, URL-safe (letters, numbers, dash, underscore only). Example: "my-team".'
    ),
  description: z
    .string()
    .optional()
    .describe("Group description shown on overview page. Supports Markdown formatting."),
  visibility: z
    .enum(["private", "internal", "public"])
    .optional()
    .default("private")
    .describe("Group visibility: private=members only, internal=logged-in users, public=everyone."),
  parent_id: z
    .number()
    .optional()
    .describe("Parent group ID to create subgroup. Omit for root-level group."),
  lfs_enabled: z.boolean().optional().describe("Enable Git LFS for all projects in this group."),
  request_access_enabled: z
    .boolean()
    .optional()
    .describe("Allow non-members to request group access."),
  default_branch_protection: z
    .number()
    .optional()
    .describe("Default branch protection level: 0=no protection, 1=partial, 2=full protection."),
  avatar: z.string().optional().describe("Group avatar image file path or URL."),
});

// Export type definitions
export type CreateRepositoryOptions = z.infer<typeof CreateRepositorySchema>;
export type ForkRepositoryOptions = z.infer<typeof ForkRepositorySchema>;
export type CreateBranchOptions = z.infer<typeof CreateBranchSchema>;
export type CreateGroupOptions = z.infer<typeof CreateGroupSchema>;
