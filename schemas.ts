import { z } from "zod";
import { flexibleBoolean } from "./customSchemas.js";

// Base schemas for common types
export const GitLabAuthorSchema = z.object({
  name: z.string(),
  email: z.string(),
  date: z.string(),
});

// Pipeline related schemas
export const GitLabPipelineSchema = z.object({
  id: z.coerce.string(),
  project_id: z.coerce.string(),
  sha: z.string(),
  ref: z.string(),
  status: z.string(),
  source: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  web_url: z.string(),
  duration: z.number().nullable().optional(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  coverage: z.coerce.number().nullable().optional(),
  user: z
    .object({
      id: z.coerce.string(),
      name: z.string(),
      username: z.string(),
      avatar_url: z.string().nullable().optional(),
    })
    .optional(),
  detailed_status: z
    .object({
      icon: z.string().optional(),
      text: z.string().optional(),
      label: z.string().optional(),
      group: z.string().optional(),
      tooltip: z.string().optional(),
      has_details: z.boolean().optional(),
      details_path: z.string().optional(),
      illustration: z
        .object({
          image: z.string().optional(),
          size: z.string().optional(),
          title: z.string().optional(),
        })
        .nullable()
        .optional(),
      favicon: z.string().optional(),
    })
    .optional(),
});

// Pipeline job related schemas
export const GitLabPipelineJobSchema = z.object({
  id: z.coerce.string(),
  status: z.string(),
  stage: z.string(),
  name: z.string(),
  ref: z.string(),
  tag: z.boolean(),
  coverage: z.coerce.number().nullable().optional(),
  created_at: z.string(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  user: z
    .object({
      id: z.coerce.string(),
      name: z.string(),
      username: z.string(),
      avatar_url: z.string().nullable().optional(),
    })
    .optional(),
  commit: z
    .object({
      id: z.string(),
      short_id: z.string(),
      title: z.string(),
      author_name: z.string(),
      author_email: z.string(),
    })
    .optional(),
  pipeline: z
    .object({
      id: z.coerce.string(),
      project_id: z.coerce.string(),
      status: z.string(),
      ref: z.string(),
      sha: z.string(),
    })
    .optional(),
  web_url: z.string().optional(),
});

// Pipeline trigger job (bridge) schema
export const GitLabPipelineTriggerJobSchema = z.object({
  id: z.coerce.string(),
  status: z.string(),
  stage: z.string(),
  name: z.string(),
  ref: z.string(),
  tag: z.boolean(),
  coverage: z.number().nullable().optional(),
  created_at: z.string(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  queued_duration: z.number().nullable().optional(),
  user: z
    .object({
      id: z.coerce.string(),
      name: z.string(),
      username: z.string(),
      avatar_url: z.string().nullable().optional(),
    })
    .optional(),
  commit: z
    .object({
      id: z.string(),
      short_id: z.string(),
      title: z.string(),
      author_name: z.string(),
      author_email: z.string(),
    })
    .optional(),
  pipeline: z
    .object({
      id: z.coerce.string(),
      project_id: z.coerce.string(),
      status: z.string(),
      ref: z.string(),
      sha: z.string(),
      created_at: z.string().optional(),
      updated_at: z.string().optional(),
      web_url: z.string().optional(),
    })
    .optional(),
  web_url: z.string().optional(),
  allow_failure: z.boolean().optional(),
  archived: z.boolean().optional(),
  source: z.string().optional(),
  erased_at: z.string().nullable().optional(),
  project: z
    .object({
      ci_job_token_scope_enabled: z.boolean().optional(),
    })
    .optional(),
  downstream_pipeline: z
    .object({
      id: z.coerce.string(),
      sha: z.string(),
      ref: z.string(),
      status: z.string(),
      created_at: z.string(),
      updated_at: z.string(),
      web_url: z.string(),
    })
    .nullable()
    .optional(),
});

// Shared base schema for various pagination options
// See https://docs.gitlab.com/api/rest/#pagination
export const PaginationOptionsSchema = z.object({
  page: z.number().optional().describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().describe("Number of items per page (max: 100, default: 20)"),
});

// Schema for listing pipelines
export const ListPipelinesSchema = z
  .object({
    project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
    scope: z
      .enum(["running", "pending", "finished", "branches", "tags"])
      .optional()
      .describe("The scope of pipelines"),
    status: z
      .enum([
        "created",
        "waiting_for_resource",
        "preparing",
        "pending",
        "running",
        "success",
        "failed",
        "canceled",
        "skipped",
        "manual",
        "scheduled",
      ])
      .optional()
      .describe("The status of pipelines"),
    ref: z.string().optional().describe("The ref of pipelines"),
    sha: z.string().optional().describe("The SHA of pipelines"),
    yaml_errors: z.boolean()
      .optional()
      .describe("Returns pipelines with invalid configurations"),
    username: z.string().optional().describe("The username of the user who triggered pipelines"),
    updated_after: z
      .string()
      .optional()
      .describe("Return pipelines updated after the specified date"),
    updated_before: z
      .string()
      .optional()
      .describe("Return pipelines updated before the specified date"),
    order_by: z
      .enum(["id", "status", "ref", "updated_at", "user_id"])
      .optional()
      .describe("Order pipelines by"),
    sort: z.enum(["asc", "desc"]).optional().describe("Sort pipelines"),
  })
  .merge(PaginationOptionsSchema);

// Schema for getting a specific pipeline
export const GetPipelineSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  pipeline_id: z.coerce.string().describe("The ID of the pipeline"),
});

// Schema for listing jobs in a pipeline
export const ListPipelineJobsSchema = z
  .object({
    project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
    pipeline_id: z.coerce.string().describe("The ID of the pipeline"),
    scope: z
      .enum(["created", "pending", "running", "failed", "success", "canceled", "skipped", "manual"])
      .optional()
      .describe("The scope of jobs to show"),
    include_retried: z.boolean().optional().describe("Whether to include retried jobs"),
  })
  .merge(PaginationOptionsSchema);

// Schema for listing trigger jobs (bridges) in a pipeline
export const ListPipelineTriggerJobsSchema = z
  .object({
    project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
    pipeline_id: z.coerce.string().describe("The ID of the pipeline"),
    scope: z
      // https://docs.gitlab.com/api/jobs/#job-status-values
      .enum([
        "canceled",
        "canceling",
        "created",
        "failed",
        "manual",
        "pending",
        "preparing",
        "running",
        "scheduled",
        "skipped",
        "success",
        "waiting_for_resource",
      ])
      .optional()
      .describe("The scope of trigger jobs to show"),
  })
  .merge(PaginationOptionsSchema);

// Schema for creating a new pipeline
export const CreatePipelineSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  ref: z.string().describe("The branch or tag to run the pipeline on"),
  variables: z
    .array(
      z.object({
        key: z.string().describe("The key of the variable"),
        value: z.string().describe("The value of the variable"),
      })
    )
    .optional()
    .describe("An array of variables to use for the pipeline"),
});

// Schema for retrying a pipeline
export const RetryPipelineSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  pipeline_id: z.coerce.string().describe("The ID of the pipeline to retry"),
});

// Schema for canceling a pipeline
export const CancelPipelineSchema = RetryPipelineSchema;

// Schema for the input parameters for pipeline job operations
export const GetPipelineJobOutputSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  job_id: z.coerce.string().describe("The ID of the job"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of lines to return from the end of the log (default: 1000)"),
  offset: z
    .number()
    .optional()
    .describe("Number of lines to skip from the end of the log (default: 0)"),
});

// Schema for pipeline job control operations
export const PipelineJobControlSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  job_id: z.coerce.string().describe("The ID of the job"),
});

// Schema for running a manual job
export const PlayPipelineJobSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  job_id: z.coerce.string().describe("The ID of the job"),
  job_variables_attributes: z
    .array(
      z.object({
        key: z.string().describe("Variable key"),
        value: z.string().describe("Variable value"),
      })
    )
    .optional()
    .describe("Custom job variables to use when running the job"),
});

// Schema for retrying a job
export const RetryPipelineJobSchema = PipelineJobControlSchema;

// Schema for canceling a job  
export const CancelPipelineJobSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  job_id: z.coerce.string().describe("The ID of the job"),
  force: z.boolean().optional().describe("Force cancellation of the job"),
});

// User schemas
export const GitLabUserSchema = z.object({
  username: z.string().optional(), // Changed from login to match GitLab API
  id: z.coerce.string(),
  name: z.string().optional(),
  avatar_url: z.string().nullable().optional(),
  web_url: z.string().optional(), // Changed from html_url to match GitLab API
});

export const GetUsersSchema = z.object({
  usernames: z.array(z.string()).describe("Array of usernames to search for"),
});

export const GitLabUsersResponseSchema = z.record(
  z.string(),
  z
    .object({
      id: z.coerce.string(),
      username: z.string(),
      name: z.string(),
      avatar_url: z.string().nullable(),
      web_url: z.string(),
    })
    .nullable()
);

// Namespace related schemas

// Base schema for project-related operations
const ProjectParamsSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or complete URL-encoded path to project"), // Changed from owner/repo to match GitLab API
});
export const GitLabNamespaceSchema = z.object({
  id: z.coerce.string(),
  name: z.string(),
  path: z.string(),
  kind: z.enum(["user", "group"]),
  full_path: z.string(),
  parent_id: z.coerce.string().nullable(),
  avatar_url: z.string().nullable(),
  web_url: z.string(),
  members_count_with_descendants: z.number().optional(),
  billable_members_count: z.number().optional(),
  max_seats_used: z.number().optional(),
  seats_in_use: z.number().optional(),
  plan: z.string().optional(),
  end_date: z.string().nullable().optional(),
  trial_ends_on: z.string().nullable().optional(),
  trial: z.boolean().optional(),
  root_repository_size: z.number().optional(),
  projects_count: z.number().optional(),
});

export const GitLabNamespaceExistsResponseSchema = z.object({
  exists: z.boolean(),
  suggests: z.array(z.string()).optional(),
});

// Repository related schemas
export const GitLabOwnerSchema = z.object({
  username: z.string(), // Changed from login to match GitLab API
  id: z.coerce.string(),
  avatar_url: z.string().nullable(),
  web_url: z.string(), // Changed from html_url to match GitLab API
  name: z.string(), // Added as GitLab includes full name
  state: z.string(), // Added as GitLab includes user state
});

export const GitLabRepositorySchema = z.object({
  id: z.coerce.string(),
  name: z.string(),
  path_with_namespace: z.string(),
  visibility: z.string().optional(),
  owner: GitLabOwnerSchema.optional(),
  web_url: z.string().optional(),
  description: z.string().nullable(),
  fork: z.boolean().optional(),
  ssh_url_to_repo: z.string().optional(),
  http_url_to_repo: z.string().optional(),
  created_at: z.string().optional(),
  last_activity_at: z.string().optional(),
  default_branch: z.string().optional(),
  namespace: z
    .object({
      id: z.coerce.string(),
      name: z.string(),
      path: z.string(),
      kind: z.string(),
      full_path: z.string(),
      avatar_url: z.string().nullable().optional(),
      web_url: z.string().optional(),
    })
    .optional(),
  readme_url: z.string().optional().nullable(),
  topics: z.array(z.string()).optional(),
  tag_list: z.array(z.string()).optional(), // deprecated but still present
  open_issues_count: z.number().optional(),
  archived: z.boolean().optional(),
  forks_count: z.number().optional(),
  star_count: z.number().optional(),
  permissions: z
    .object({
      project_access: z
        .object({
          access_level: z.number(),
          notification_level: z.number().nullable().optional(),
        })
        .optional()
        .nullable(),
      group_access: z
        .object({
          access_level: z.number(),
          notification_level: z.number().nullable().optional(),
        })
        .optional()
        .nullable(),
    })
    .optional(),
  container_registry_enabled: z.boolean().optional(),
  container_registry_access_level: z.string().optional(),
  issues_enabled: z.boolean().optional(),
  merge_requests_enabled: z.boolean().optional(),
  merge_requests_template: z.string().nullable().optional(),
  wiki_enabled: z.boolean().optional(),
  jobs_enabled: z.boolean().optional(),
  snippets_enabled: z.boolean().optional(),
  can_create_merge_request_in: z.boolean().optional(),
  resolve_outdated_diff_discussions: z.boolean().nullable().optional(),
  shared_runners_enabled: z.boolean().optional(),
  shared_with_groups: z
    .array(
      z.object({
        group_id: z.coerce.string(),
        group_name: z.string(),
        group_full_path: z.string(),
        group_access_level: z.number(),
      })
    )
    .optional(),
});

// Project schema (extended from repository schema)
export const GitLabProjectSchema = GitLabRepositorySchema;

// File content schemas
export const GitLabFileContentSchema = z.object({
  file_name: z.string(), // Changed from name to match GitLab API
  file_path: z.string(), // Changed from path to match GitLab API
  size: z.number(),
  encoding: z.string(),
  content: z.string(),
  content_sha256: z.string(), // Changed from sha to match GitLab API
  ref: z.string(), // Added as GitLab requires branch reference
  blob_id: z.string(), // Added to match GitLab API
  commit_id: z.string(), // ID of the current file version
  last_commit_id: z.string(), // Added to match GitLab API
  execute_filemode: z.boolean().optional(), // Added to match GitLab API
});

export const GitLabDirectoryContentSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.string(),
  mode: z.string(),
  id: z.string(), // Changed from sha to match GitLab API
  web_url: z.string(), // Changed from html_url to match GitLab API
});

export const GitLabContentSchema = z.union([
  GitLabFileContentSchema,
  z.array(GitLabDirectoryContentSchema),
]);

// Operation schemas
export const FileOperationSchema = z.object({
  path: z.string(),
  content: z.string(),
});

// Tree and commit schemas
export const GitLabTreeItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["tree", "blob"]),
  path: z.string(),
  mode: z.string(),
});

export const GetRepositoryTreeSchema = z.object({
  project_id: z.coerce.string().describe("The ID or URL-encoded path of the project"),
  path: z.string().optional().describe("The path inside the repository"),
  ref: z
    .string()
    .optional()
    .describe("The name of a repository branch or tag. Defaults to the default branch."),
  recursive: z.boolean().optional().describe("Boolean value to get a recursive tree"),
  per_page: z.number().optional().describe("Number of results to show per page"),
  page_token: z.string().optional().describe("The tree record ID for pagination"),
  pagination: z.string().optional().describe("Pagination method (keyset)"),
});

export const GitLabTreeSchema = z.object({
  id: z.string(), // Changed from sha to match GitLab API
  tree: z.array(GitLabTreeItemSchema),
});

export const GitLabCommitSchema = z.object({
  id: z.string(), // Changed from sha to match GitLab API
  short_id: z.string(), // Added to match GitLab API
  title: z.string(), // Changed from message to match GitLab API
  author_name: z.string(),
  author_email: z.string(),
  authored_date: z.string(),
  committer_name: z.string(),
  committer_email: z.string(),
  committed_date: z.string(),
  created_at: z.string().optional(), // Add created_at field
  message: z.string().optional(), // Add full message field
  web_url: z.string(), // Changed from html_url to match GitLab API
  parent_ids: z.array(z.string()), // Changed from parents to match GitLab API
  stats: z
    .object({
      additions: z.number().optional().nullable(),
      deletions: z.number().optional().nullable(),
      total: z.number().optional().nullable(),
    })
    .optional(), // Only present when with_stats=true
  trailers: z.record(z.string()).optional().default({}), // Git trailers, may be empty object
  extended_trailers: z.record(z.array(z.string())).optional().default({}), // Extended trailers, may be empty object
});

// Reference schema
export const GitLabReferenceSchema = z.object({
  name: z.string(), // Changed from ref to match GitLab API
  commit: z.object({
    id: z.string(), // Changed from sha to match GitLab API
    web_url: z.string(), // Changed from url to match GitLab API
  }),
});

// Milestones rest api output schemas
export const GitLabMilestonesSchema = z.object({
  id: z.coerce.string(),
  iid: z.coerce.string(),
  project_id: z.coerce.string(),
  title: z.string(),
  description: z.string().nullable(),
  due_date: z.string().nullable(),
  start_date: z.string().nullable(),
  state: z.string(),
  updated_at: z.string(),
  created_at: z.string(),
  expired: z.boolean(),
  web_url: z.string().optional(),
});

// Input schemas for operations
export const CreateRepositoryOptionsSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  visibility: z.enum(["private", "internal", "public"]).optional(), // Changed from private to match GitLab API
  initialize_with_readme: z.boolean().optional(), // Changed from auto_init to match GitLab API
});

export const CreateIssueOptionsSchema = z.object({
  title: z.string(),
  description: z.string().optional(), // Changed from body to match GitLab API
  assignee_ids: z.array(z.number()).optional(), // Changed from assignees to match GitLab API
  milestone_id: z.coerce.string().optional(), // Changed from milestone to match GitLab API
  labels: z.array(z.string()).optional(),
});

export const GitLabDiffSchema = z.object({
  old_path: z.string(),
  new_path: z.string(),
  a_mode: z.string(),
  b_mode: z.string(),
  diff: z.string(),
  new_file: z.boolean(),
  renamed_file: z.boolean(),
  deleted_file: z.boolean(),
});

// Response schemas for operations
export const GitLabCreateUpdateFileResponseSchema = z.object({
  file_path: z.string(),
  branch: z.string(),
  commit_id: z.string().optional(), // Optional since it's not always returned by the API
  content: GitLabFileContentSchema.optional(),
});

export const GitLabSearchResponseSchema = z.object({
  count: z.number().optional(),
  total_pages: z.number().optional(),
  current_page: z.number().optional(),
  items: z.array(GitLabRepositorySchema),
});

// create branch schemas
export const CreateBranchOptionsSchema = z.object({
  name: z.string(), // Changed from ref to match GitLab API
  ref: z.string(), // The source branch/commit for the new branch
});

export const GitLabCompareResultSchema = z.object({
  commit: z
    .object({
      id: z.string().optional(),
      short_id: z.string().optional(),
      title: z.string().optional(),
      author_name: z.string().optional(),
      author_email: z.string().optional(),
      created_at: z.string().optional(),
    })
    .optional(),
  commits: z.array(GitLabCommitSchema),
  diffs: z.array(GitLabDiffSchema),
  compare_timeout: z.boolean().optional(),
  compare_same_ref: z.boolean().optional(),
});

// Issue related schemas
export const GitLabLabelSchema = z.object({
  id: z.coerce.string(),
  name: z.string(),
  color: z.string(),
  text_color: z.string(),
  description: z.string().nullable(),
  description_html: z.string().nullable(),
  open_issues_count: z.number().optional(),
  closed_issues_count: z.number().optional(),
  open_merge_requests_count: z.number().optional(),
  subscribed: z.boolean().optional(),
  priority: z.number().nullable().optional(),
  is_project_label: z.boolean().optional(),
});

export const GitLabMilestoneSchema = z.object({
  id: z.coerce.string(),
  iid: z.coerce.string(), // Added to match GitLab API
  title: z.string(),
  description: z.string().nullable().default(""),
  state: z.string(),
  web_url: z.string(), // Changed from html_url to match GitLab API
});

export const GitLabIssueSchema = z.object({
  id: z.coerce.string(),
  iid: z.coerce.string(), // Added to match GitLab API
  project_id: z.coerce.string(), // Added to match GitLab API
  title: z.string(),
  description: z.string().nullable().default(""), // Changed from body to match GitLab API
  state: z.string(),
  author: GitLabUserSchema,
  assignees: z.array(GitLabUserSchema),
  labels: z.array(GitLabLabelSchema).or(z.array(z.string())), // Support both label objects and strings
  milestone: GitLabMilestoneSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  web_url: z.string(), // Changed from html_url to match GitLab API
  references: z
    .object({
      short: z.string(),
      relative: z.string(),
      full: z.string(),
    })
    .optional(),
  time_stats: z
    .object({
      time_estimate: z.number(),
      total_time_spent: z.number(),
      human_time_estimate: z.string().nullable(),
      human_total_time_spent: z.string().nullable(),
    })
    .optional(),
  confidential: z.boolean().optional(),
  due_date: z.string().nullable().optional(),
  discussion_locked: z.boolean().nullable().optional(),
  weight: z.number().nullable().optional(),
  issue_type: z.string().describe("the type of issue.").nullish(),
});

// NEW SCHEMA: For issue with link details (used in listing issue links)
export const GitLabIssueWithLinkDetailsSchema = GitLabIssueSchema.extend({
  issue_link_id: z.coerce.string(),
  link_type: z.enum(["relates_to", "blocks", "is_blocked_by"]),
  link_created_at: z.string(),
  link_updated_at: z.string(),
});

// Fork related schemas
export const GitLabForkParentSchema = z.object({
  name: z.string(),
  path_with_namespace: z.string(), // Changed from full_name to match GitLab API
  owner: z
    .object({
      username: z.string(), // Changed from login to match GitLab API
      id: z.coerce.string(),
      avatar_url: z.string().nullable(),
    })
    .optional(), // Made optional to handle cases where GitLab API doesn't include it
  web_url: z.string(), // Changed from html_url to match GitLab API
});

export const GitLabForkSchema = GitLabRepositorySchema.extend({
  forked_from_project: GitLabForkParentSchema.optional(), // Made optional to handle cases where GitLab API doesn't include it
});

// Merge Request related schemas (equivalent to Pull Request)
export const GitLabMergeRequestDiffRefSchema = z.object({
  base_sha: z.string(),
  head_sha: z.string(),
  start_sha: z.string(),
});

export const GitLabMergeRequestSchema = z.object({
  id: z.coerce.string(),
  iid: z.coerce.string(),
  project_id: z.coerce.string(),
  title: z.string(),
  description: z.string().nullable(),
  state: z.string(),
  merged: z.boolean().optional(),
  draft: z.boolean().optional(),
  author: GitLabUserSchema,
  assignees: z.array(GitLabUserSchema).optional(),
  reviewers: z.array(GitLabUserSchema).optional(),
  source_branch: z.string(),
  target_branch: z.string(),
  diff_refs: GitLabMergeRequestDiffRefSchema.nullable().optional(),
  web_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  merged_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  merge_commit_sha: z.string().nullable(),
  detailed_merge_status: z.string().optional(),
  merge_status: z.string().optional(),
  merge_error: z.string().nullable().optional(),
  work_in_progress: z.boolean().optional(),
  blocking_discussions_resolved: z.boolean().optional(),
  should_remove_source_branch: z.boolean().nullable().optional(),
  force_remove_source_branch: z.boolean().nullable().optional(),
  allow_collaboration: z.boolean().optional(),
  allow_maintainer_to_push: z.boolean().optional(),
  changes_count: z.string().nullable().optional(),
  merge_when_pipeline_succeeds: z.boolean().optional(),
  squash: z.boolean().optional(),
  labels: z.array(z.string()).optional(),
});

export const LineRangeSchema = z
  .object({
    start: z
      .object({
        line_code: z
          .string()
          .nullable()
          .optional()
          .describe(
            "CRITICAL: Line identifier in format '{file_path_sha1_hash}_{old_line_number}_{new_line_number}'. USUALLY REQUIRED for GitLab diff comments despite being optional in schema. Example: 'a1b2c3d4e5f6_10_15'. Get this from GitLab diff API response, never fabricate."
          ),
        type: z
          .enum(["new", "old", "expanded", "logic", "style"])
          .nullable()
          .optional()
          .describe(
            "Line type: 'old' = deleted/original line, 'new' = added/modified line, null = unchanged context. MUST match the line_code format and old_line/new_line values."
          ),
        old_line: z
          .number()
          .nullable()
          .optional()
          .describe(
            "Line number in original file (before changes). REQUIRED when type='old', NULL when type='new' (for purely added lines), can be present for context lines."
          ),
        new_line: z
          .number()
          .nullable()
          .optional()
          .describe(
            "Line number in modified file (after changes). REQUIRED when type='new', NULL when type='old' (for purely deleted lines), can be present for context lines."
          ),
      })
      .describe(
        "Start line position for multiline comment range. MUST specify either old_line OR new_line (or both for context), never neither."
      ),
    end: z
      .object({
        line_code: z
          .string()
          .nullable()
          .optional()
          .describe(
            "CRITICAL: Line identifier in format '{file_path_sha1_hash}_{old_line_number}_{new_line_number}'. USUALLY REQUIRED for GitLab diff comments despite being optional in schema. Example: 'a1b2c3d4e5f6_12_17'. Must be from same file as start.line_code."
          ),
        type: z
          .enum(["new", "old", "expanded", "logic", "style"])
          .nullable()
          .optional()
          .describe(
            "Line type: 'old' = deleted/original line, 'new' = added/modified line, null = unchanged context. SHOULD MATCH start.type for consistent ranges (don't mix old/new types)."
          ),
        old_line: z
          .number()
          .nullable()
          .optional()
          .describe(
            "Line number in original file (before changes). REQUIRED when type='old', NULL when type='new' (for purely added lines), can be present for context lines. MUST be >= start.old_line if both specified."
          ),
        new_line: z
          .number()
          .nullable()
          .optional()
          .describe(
            "Line number in modified file (after changes). REQUIRED when type='new', NULL when type='old' (for purely deleted lines), can be present for context lines. MUST be >= start.new_line if both specified."
          ),
      })
      .describe(
        "End line position for multiline comment range. MUST specify either old_line OR new_line (or both for context), never neither. Range must be valid (end >= start)."
      ),
  })
  .describe(
    "Line range for multiline comments on GitLab merge request diffs. VALIDATION RULES: 1) line_code is critical for GitLab API success, 2) start/end must have consistent types, 3) line numbers must form valid range, 4) get line_code from GitLab diff API, never generate manually."
  );

// Discussion related schemas
export const GitLabDiscussionNoteSchema = z.object({
  id: z.coerce.string(),
  type: z.enum(["DiscussionNote", "DiffNote", "Note"]).nullable().optional(), // Allow null type for regular notes
  body: z.string().optional(),
  attachment: z.any().nullable().optional(), // Can be string or object, handle appropriately
  author: GitLabUserSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  system: z.boolean().optional(),
  noteable_id: z.coerce.string().optional(),
  noteable_type: z.enum(["Issue", "MergeRequest", "Snippet", "Commit", "Epic"]).optional(),
  project_id: z.coerce.string().optional(),
  noteable_iid: z.coerce.string().nullable().optional(),
  resolvable: z.boolean().optional(),
  resolved: z.boolean().optional(),
  resolved_by: GitLabUserSchema.nullable().optional(),
  resolved_at: z.string().nullable().optional(),
  position: z
    .object({
      // Only present for DiffNote
      base_sha: z.string().optional(),
      start_sha: z.string().optional(),
      head_sha: z.string().optional(),
      old_path: z.string().nullable().optional().describe("File path before change"),
      new_path: z.string().nullable().optional().describe("File path after change"),
      position_type: z.enum(["text", "image", "file"]).optional(),
      new_line: z
        .number()
        .nullable()
        .optional()
        .describe(
          "Line number in the modified file (after changes). Used for added lines and context lines. Null for deleted lines."
        ),
      old_line: z
        .number()
        .nullable()
        .optional()
        .describe(
          "Line number in the original file (before changes). Used for deleted lines and context lines. Null for newly added lines."
        ),
      line_range: LineRangeSchema.nullable().optional(), // For multi-line diff notes
      width: z.number().optional(), // For image diff notes
      height: z.number().optional(), // For image diff notes
      x: z.number().optional(), // For image diff notes
      y: z.number().optional(), // For image diff notes
    })
    .passthrough() // Allow additional fields
    .optional(),
}).passthrough(); // Allow additional fields that GitLab might return
export type GitLabDiscussionNote = z.infer<typeof GitLabDiscussionNoteSchema>;

// Reusable pagination schema for GitLab API responses.
// See https://docs.gitlab.com/api/rest/#pagination
export const GitLabPaginationSchema = z.object({
  x_next_page: z.number().nullable().optional(),
  x_page: z.number().optional(),
  x_per_page: z.number().optional(),
  x_prev_page: z.number().nullable().optional(),
  x_total: z.number().nullable().optional(),
  x_total_pages: z.number().nullable().optional(),
});
export type GitLabPagination = z.infer<typeof GitLabPaginationSchema>;

// Base paginated response schema that can be extended.
// See https://docs.gitlab.com/api/rest/#pagination
export const PaginatedResponseSchema = z.object({
  pagination: GitLabPaginationSchema.optional(),
});

export const GitLabDiscussionSchema = z.object({
  id: z.coerce.string(),
  individual_note: z.boolean(),
  notes: z.array(GitLabDiscussionNoteSchema),
});
export type GitLabDiscussion = z.infer<typeof GitLabDiscussionSchema>;

// Create a schema for paginated discussions response
export const PaginatedDiscussionsResponseSchema = z.object({
  items: z.array(GitLabDiscussionSchema),
  pagination: GitLabPaginationSchema,
});

// Export the paginated response type for discussions
export type PaginatedDiscussionsResponse = z.infer<typeof PaginatedDiscussionsResponseSchema>;

export const ListIssueDiscussionsSchema = z
  .object({
    project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
    issue_iid: z.coerce.string().describe("The internal ID of the project issue"),
  })
  .merge(PaginationOptionsSchema);

// Input schema for listing merge request discussions
export const ListMergeRequestDiscussionsSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("The IID of a merge request"),
}).merge(PaginationOptionsSchema);

// Input schema for updating a merge request discussion note
export const UpdateMergeRequestNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("The IID of a merge request"),
  discussion_id: z.coerce.string().describe("The ID of a thread"),
  note_id: z.coerce.string().describe("The ID of a thread note"),
  body: z.string().optional().describe("The content of the note or reply"),
  resolved: z.boolean().optional().describe("Resolve or unresolve the note"),
})
  .refine(data => data.body !== undefined || data.resolved !== undefined, {
    message: "At least one of 'body' or 'resolved' must be provided",
  })
  .refine(data => !(data.body !== undefined && data.resolved !== undefined), {
    message: "Only one of 'body' or 'resolved' can be provided, not both",
  });

// Input schema for adding a note to an existing merge request discussion
export const CreateMergeRequestNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("The IID of a merge request"),
  discussion_id: z.coerce.string().describe("The ID of a thread"),
  body: z.string().describe("The content of the note or reply"),
  created_at: z.string().optional().describe("Date the note was created at (ISO 8601 format)"),
});

// Input schema for updating an issue discussion note
export const UpdateIssueNoteSchema = ProjectParamsSchema.extend({
  issue_iid: z.coerce.string().describe("The IID of an issue"),
  discussion_id: z.coerce.string().describe("The ID of a thread"),
  note_id: z.coerce.string().describe("The ID of a thread note"),
  body: z.string().describe("The content of the note or reply"),
});

// Input schema for adding a note to an existing issue discussion
export const CreateIssueNoteSchema = ProjectParamsSchema.extend({
  issue_iid: z.coerce.string().describe("The IID of an issue"),
  discussion_id: z.coerce.string().describe("The ID of a thread"),
  body: z.string().describe("The content of the note or reply"),
  created_at: z.string().optional().describe("Date the note was created at (ISO 8601 format)"),
});

// API Operation Parameter Schemas

export const CreateOrUpdateFileSchema = ProjectParamsSchema.extend({
  file_path: z.string().describe("Path where to create/update the file"),
  content: z.string().describe("Content of the file"),
  commit_message: z.string().describe("Commit message"),
  branch: z.string().describe("Branch to create/update the file in"),
  previous_path: z.string().optional().describe("Path of the file to move/rename"),
  last_commit_id: z.string().optional().describe("Last known file commit ID"),
  commit_id: z.string().optional().describe("Current file commit ID (for update operations)"),
});

export const SearchRepositoriesSchema = z
  .object({
    search: z.string().describe("Search query"), // Changed from query to match GitLab API
  })
  .merge(PaginationOptionsSchema);

export const CreateRepositorySchema = z.object({
  name: z.string().describe("Repository name"),
  description: z.string().optional().describe("Repository description"),
  visibility: z
    .enum(["private", "internal", "public"])
    .optional()
    .describe("Repository visibility level"),
  initialize_with_readme: z.boolean().optional().describe("Initialize with README.md"),
});

export const GetFileContentsSchema = ProjectParamsSchema.extend({
  file_path: z.string().describe("Path to the file or directory"),
  ref: z.string().optional().describe("Branch/tag/commit to get contents from"),
});

export const PushFilesSchema = ProjectParamsSchema.extend({
  branch: z.string().describe("Branch to push to"),
  files: z
    .array(
      z.object({
        file_path: z.string().describe("Path where to create the file"),
        content: z.string().describe("Content of the file"),
      })
    )
    .describe("Array of files to push"),
  commit_message: z.string().describe("Commit message"),
});

export const CreateIssueSchema = ProjectParamsSchema.extend({
  title: z.string().describe("Issue title"),
  description: z.string().optional().describe("Issue description"),
  assignee_ids: z.array(z.number()).optional().describe("Array of user IDs to assign"),
  labels: z.array(z.string()).optional().describe("Array of label names"),
  milestone_id: z.coerce.string().optional().describe("Milestone ID to assign"),
  issue_type: z.enum(["issue", "incident", "test_case", "task"]).describe("the type of issue. One of issue, incident, test_case or task.").nullish().default("issue"),
});

const MergeRequestOptionsSchema = {
  title: z.string().describe("Merge request title"),
  description: z.string().optional().describe("Merge request description"),
  source_branch: z.string().describe("Branch containing changes"),
  target_branch: z.string().describe("Branch to merge into"),
  target_project_id: z.coerce.string().optional().describe("Numeric ID of the target project."),
  assignee_ids: z.array(z.number()).optional().describe("The ID of the users to assign the MR to"),
  reviewer_ids: z
    .array(z.number())
    .optional()
    .describe("The ID of the users to assign as reviewers of the MR"),
  labels: z.array(z.string()).optional().describe("Labels for the MR"),
  draft: z.boolean().optional().describe("Create as draft merge request"),
  allow_collaboration: z.boolean().optional().describe("Allow commits from upstream members"),
  remove_source_branch: z.boolean().nullable()
    .optional()
    .describe("Flag indicating if a merge request should remove the source branch when merging."),
  squash: z.boolean().nullable()
    .optional()
    .describe("If true, squash all commits into a single commit on merge."),
};
export const CreateMergeRequestOptionsSchema = z.object(MergeRequestOptionsSchema);
export const CreateMergeRequestSchema = ProjectParamsSchema.extend(MergeRequestOptionsSchema);

export const ForkRepositorySchema = ProjectParamsSchema.extend({
  namespace: z.string().optional().describe("Namespace to fork to (full path)"),
});

// Branch related schemas
export const CreateBranchSchema = ProjectParamsSchema.extend({
  branch: z.string().describe("Name for the new branch"),
  ref: z.string().optional().describe("Source branch/commit for new branch"),
});

export const GetBranchDiffsSchema = ProjectParamsSchema.extend({
  from: z.string().describe("The base branch or commit SHA to compare from"),
  to: z.string().describe("The target branch or commit SHA to compare to"),
  straight: z.boolean()
    .optional()
    .describe("Comparison method: false for '...' (default), true for '--'"),
  excluded_file_patterns: z
    .array(z.string())
    .optional()
    .describe(
      'Array of regex patterns to exclude files from the diff results. Each pattern is a JavaScript-compatible regular expression that matches file paths to ignore. Examples: ["^test/mocks/", "\\.spec\\.ts$", "package-lock\\.json"]'
    ),
});

export const GetMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().optional().describe("The IID of a merge request"),
  source_branch: z.string().optional().describe("Source branch name"),
});

export const UpdateMergeRequestSchema = GetMergeRequestSchema.extend({
  title: z.string().optional().describe("The title of the merge request"),
  description: z.string().optional().describe("The description of the merge request"),
  target_branch: z.string().optional().describe("The target branch"),
  assignee_ids: z.array(z.number()).optional().describe("The ID of the users to assign the MR to"),
  reviewer_ids: z
    .array(z.number())
    .optional()
    .describe("The ID of the users to assign as reviewers of the MR"),
  labels: z.array(z.string()).optional().describe("Labels for the MR"),
  state_event: z
    .enum(["close", "reopen"])
    .optional()
    .describe("New state (close/reopen) for the MR"),
  remove_source_branch: z
    .boolean()
    .optional()
    .describe("Flag indicating if the source branch should be removed"),
  squash: z.boolean().optional().describe("Squash commits into a single commit when merging"),
  draft: z.boolean().optional().describe("Work in progress merge request"),
});

export const MergeMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().optional().describe("The IID of a merge request"),
  auto_merge: z.boolean().optional().default(false).describe("If true, the merge request merges when the pipeline succeeds."),
  merge_commit_message: z.string().optional().describe("Custom merge commit message"),
  merge_when_pipeline_succeeds: z.boolean().optional().default(false).describe("If true, the merge request merges when the pipeline succeeds.in GitLab 17.11. Use"),
  should_remove_source_branch: z.boolean().optional().default(false).describe("Remove source branch after merge"),
  squash_commit_message: z.string().optional().describe("Custom squash commit message"),
  squash: z.boolean().optional().default(false).describe("Squash commits into a single commit when merging"),
});

export const GetMergeRequestDiffsSchema = GetMergeRequestSchema.extend({
  view: z.enum(["inline", "parallel"]).optional().describe("Diff view type"),
});

export const ListMergeRequestDiffsSchema = GetMergeRequestSchema.extend({
  page: z.number().optional().describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().describe("Number of items per page (max: 100, default: 20)"),
  unidiff: z.boolean()
    .optional()
    .describe(
      "Present diffs in the unified diff format. Default is false. Introduced in GitLab 16.5."
    ),
});

export const CreateNoteSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or namespace/project_path"),
  noteable_type: z
    .enum(["issue", "merge_request"])
    .describe("Type of noteable (issue or merge_request)"),
  noteable_iid: z.coerce.string().describe("IID of the issue or merge request"),
  body: z.string().describe("Note content"),
});

// Issues API operation schemas
export const ListIssuesSchema = z
  .object({
    project_id: z.coerce
      .string()
      .optional()
      .describe(
        "Project ID or URL-encoded path (optional - if not provided, lists issues across all accessible projects)"
      ),
    assignee_id: z.coerce
      .string()
      .optional()
      .describe("Return issues assigned to the given user ID. user id or none or any"),
    assignee_username: z
      .array(z.string())
      .optional()
      .describe("Return issues assigned to the given username"),
    author_id: z.coerce.string().optional().describe("Return issues created by the given user ID"),
    author_username: z.string().optional().describe("Return issues created by the given username"),
    confidential: z.boolean().optional().describe("Filter confidential or public issues"),
    created_after: z.string().optional().describe("Return issues created after the given time"),
    created_before: z.string().optional().describe("Return issues created before the given time"),
    due_date: z.string().optional().describe("Return issues that have the due date"),
    labels: z.array(z.string()).optional().describe("Array of label names"),
    milestone: z.string().optional().describe("Milestone title"),

    issue_type: z
      .enum(["issue","incident","test_case","task"])
      .optional()
      .describe("Filter to a given type of issue. One of issue, incident, test_case or task"),
    iteration_id: z.coerce
      .string()
      .optional()
      .describe("Return issues assigned to the given iteration ID. None returns issues that do not belong to an iteration. Any returns issues that belong to an iteration. "),
    scope: z
      .enum(["created_by_me", "assigned_to_me", "all"])
      .optional()
      .describe("Return issues from a specific scope"),
    search: z.string().optional().describe("Search for specific terms"),
    state: z
      .enum(["opened", "closed", "all"])
      .optional()
      .describe("Return issues with a specific state"),
    updated_after: z.string().optional().describe("Return issues updated after the given time"),
    updated_before: z.string().optional().describe("Return issues updated before the given time"),
    with_labels_details: z.boolean().optional().describe("Return more details for each label"),
  })
  .merge(PaginationOptionsSchema);

// Merge Requests API operation schemas
export const ListMergeRequestsSchema = z
  .object({
    project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
    assignee_id: z.coerce
      .string()
      .optional()
      .describe("Return issues assigned to the given user ID. user id or none or any"),
    assignee_username: z
      .string()
      .optional()
      .describe("Returns merge requests assigned to the given username"),
    author_id: z.coerce
      .string()
      .optional()
      .describe("Returns merge requests created by the given user ID"),
    author_username: z
      .string()
      .optional()
      .describe("Returns merge requests created by the given username"),
    reviewer_id: z.coerce
      .string()
      .optional()
      .describe("Returns merge requests which have the user as a reviewer. user id or none or any"),
    reviewer_username: z
      .string()
      .optional()
      .describe("Returns merge requests which have the user as a reviewer"),
    created_after: z
      .string()
      .optional()
      .describe("Return merge requests created after the given time"),
    created_before: z
      .string()
      .optional()
      .describe("Return merge requests created before the given time"),
    updated_after: z
      .string()
      .optional()
      .describe("Return merge requests updated after the given time"),
    updated_before: z
      .string()
      .optional()
      .describe("Return merge requests updated before the given time"),
    labels: z.array(z.string()).optional().describe("Array of label names"),
    milestone: z.string().optional().describe("Milestone title"),
    scope: z
      .enum(["created_by_me", "assigned_to_me", "all"])
      .optional()
      .describe("Return merge requests from a specific scope"),
    search: z.string().optional().describe("Search for specific terms"),
    state: z
      .enum(["opened", "closed", "locked", "merged", "all"])
      .optional()
      .describe("Return merge requests with a specific state"),
    order_by: z
      .enum([
        "created_at",
        "updated_at",
        "priority",
        "label_priority",
        "milestone_due",
        "popularity",
      ])
      .optional()
      .describe("Return merge requests ordered by the given field"),
    sort: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Return merge requests sorted in ascending or descending order"),
    target_branch: z
      .string()
      .optional()
      .describe("Return merge requests targeting a specific branch"),
    source_branch: z
      .string()
      .optional()
      .describe("Return merge requests from a specific source branch"),
    wip: z
      .enum(["yes", "no"])
      .optional()
      .describe("Filter merge requests against their wip status"),
    with_labels_details: z.boolean().optional().describe("Return more details for each label"),
  })
  .merge(PaginationOptionsSchema);

export const GetIssueSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.coerce.string().describe("The internal ID of the project issue"),
});

export const UpdateIssueSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.coerce.string().describe("The internal ID of the project issue"),
  title: z.string().optional().describe("The title of the issue"),
  description: z.string().optional().describe("The description of the issue"),
  assignee_ids: z.array(z.number()).optional().describe("Array of user IDs to assign issue to"),
  confidential: z.boolean().optional().describe("Set the issue to be confidential"),
  discussion_locked: z.boolean().optional().describe("Flag to lock discussions"),
  due_date: z.string().optional().describe("Date the issue is due (YYYY-MM-DD)"),
  labels: z.array(z.string()).optional().describe("Array of label names"),
  milestone_id: z.coerce.string().optional().describe("Milestone ID to assign"),
  state_event: z.enum(["close", "reopen"]).optional().describe("Update issue state (close/reopen)"),
  weight: z.number().optional().describe("Weight of the issue (0-9)"),
  issue_type: z.enum(["issue", "incident", "test_case", "task"]).describe("the type of issue. One of issue, incident, test_case or task."),

});

export const DeleteIssueSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.coerce.string().describe("The internal ID of the project issue"),
});

// Issue links related schemas
export const GitLabIssueLinkSchema = z.object({
  source_issue: GitLabIssueSchema,
  target_issue: GitLabIssueSchema,
  link_type: z.enum(["relates_to", "blocks", "is_blocked_by"]),
});

export const ListIssueLinksSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.coerce.string().describe("The internal ID of a project's issue"),
});

export const GetIssueLinkSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.coerce.string().describe("The internal ID of a project's issue"),
  issue_link_id: z.coerce.string().describe("ID of an issue relationship"),
});

export const CreateIssueLinkSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.coerce.string().describe("The internal ID of a project's issue"),
  target_project_id: z.coerce.string().describe("The ID or URL-encoded path of a target project"),
  target_issue_iid: z.coerce.string().describe("The internal ID of a target project's issue"),
  link_type: z
    .enum(["relates_to", "blocks", "is_blocked_by"])
    .optional()
    .describe("The type of the relation, defaults to relates_to"),
});

export const DeleteIssueLinkSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.coerce.string().describe("The internal ID of a project's issue"),
  issue_link_id: z.coerce.string().describe("The ID of an issue relationship"),
});

// Namespace API operation schemas
export const ListNamespacesSchema = z
  .object({
    search: z.string().optional().describe("Search term for namespaces"),
    owned: z.boolean().optional().describe("Filter for namespaces owned by current user"),
  })
  .merge(PaginationOptionsSchema);

export const GetNamespaceSchema = z.object({
  namespace_id: z.coerce.string().describe("Namespace ID or full path"),
});

export const VerifyNamespaceSchema = z.object({
  path: z.string().describe("Namespace path to verify"),
});

// Project API operation schemas
export const GetProjectSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
});

export const ListProjectsSchema = z
  .object({
    search: z.string().optional().describe("Search term for projects"),
    search_namespaces: z.boolean()
      .optional()
      .describe("Needs to be true if search is full path"),
    owned: z.boolean().optional().describe("Filter for projects owned by current user"),
    membership: z.boolean()
      .optional()
      .describe("Filter for projects where current user is a member"),
    simple: z.boolean().optional().describe("Return only limited fields"),
    archived: z.boolean().optional().describe("Filter for archived projects"),
    visibility: z
      .enum(["public", "internal", "private"])
      .optional()
      .describe("Filter by project visibility"),
    order_by: z
      .enum(["id", "name", "path", "created_at", "updated_at", "last_activity_at"])
      .optional()
      .describe("Return projects ordered by field"),
    sort: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Return projects sorted in ascending or descending order"),
    with_issues_enabled: z
      .boolean()
      .optional()
      .describe("Filter projects with issues feature enabled"),
    with_merge_requests_enabled: z
      .boolean()
      .optional()
      .describe("Filter projects with merge requests feature enabled"),
    min_access_level: z.number().optional().describe("Filter by minimum access level"),
  })
  .merge(PaginationOptionsSchema);

// Label operation schemas
export const ListLabelsSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  with_counts: z
    .boolean()
    .optional()
    .describe("Whether or not to include issue and merge request counts"),
  include_ancestor_groups: z.boolean().optional().describe("Include ancestor groups"),
  search: z.string().optional().describe("Keyword to filter labels by"),
});

export const GetLabelSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  label_id: z.coerce.string().describe("The ID or title of a project's label"),
  include_ancestor_groups: z.boolean().optional().describe("Include ancestor groups"),
});

export const CreateLabelSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  name: z.string().describe("The name of the label"),
  color: z
    .string()
    .describe("The color of the label given in 6-digit hex notation with leading '#' sign"),
  description: z.string().optional().describe("The description of the label"),
  priority: z.number().nullable().optional().describe("The priority of the label"),
});

export const UpdateLabelSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  label_id: z.coerce.string().describe("The ID or title of a project's label"),
  new_name: z.string().optional().describe("The new name of the label"),
  color: z
    .string()
    .optional()
    .describe("The color of the label given in 6-digit hex notation with leading '#' sign"),
  description: z.string().optional().describe("The new description of the label"),
  priority: z.number().nullable().optional().describe("The new priority of the label"),
});

export const DeleteLabelSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  label_id: z.coerce.string().describe("The ID or title of a project's label"),
});

// Group projects schema
export const ListGroupProjectsSchema = z
  .object({
    group_id: z.coerce.string().describe("Group ID or path"),
    include_subgroups: z.boolean().optional().describe("Include projects from subgroups"),
    search: z.string().optional().describe("Search term to filter projects"),
    order_by: z
      .enum(["name", "path", "created_at", "updated_at", "last_activity_at"])
      .optional()
      .describe("Field to sort by"),
    sort: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    archived: z.boolean().optional().describe("Filter for archived projects"),
    visibility: z
      .enum(["public", "internal", "private"])
      .optional()
      .describe("Filter by project visibility"),
    with_issues_enabled: z
      .boolean()
      .optional()
      .describe("Filter projects with issues feature enabled"),
    with_merge_requests_enabled: z
      .boolean()
      .optional()
      .describe("Filter projects with merge requests feature enabled"),
    min_access_level: z.number().optional().describe("Filter by minimum access level"),
    with_programming_language: z.string().optional().describe("Filter by programming language"),
    starred: z.boolean().optional().describe("Filter by starred projects"),
    statistics: z.boolean().optional().describe("Include project statistics"),
    with_custom_attributes: z.boolean().optional().describe("Include custom attributes"),
    with_security_reports: z.boolean().optional().describe("Include security reports"),
  })
  .merge(PaginationOptionsSchema);

// Add wiki operation schemas
export const ListWikiPagesSchema = z
  .object({
    project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
    with_content: z.boolean().optional().describe("Include content of the wiki pages"),
  })
  .merge(PaginationOptionsSchema);

export const GetWikiPageSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  slug: z.string().describe("URL-encoded slug of the wiki page"),
});
export const CreateWikiPageSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  title: z.string().describe("Title of the wiki page"),
  content: z.string().describe("Content of the wiki page"),
  format: z.string().optional().describe("Content format, e.g., markdown, rdoc"),
});
export const UpdateWikiPageSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  slug: z.string().describe("URL-encoded slug of the wiki page"),
  title: z.string().optional().describe("New title of the wiki page"),
  content: z.string().optional().describe("New content of the wiki page"),
  format: z.string().optional().describe("Content format, e.g., markdown, rdoc"),
});

export const DeleteWikiPageSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  slug: z.string().describe("URL-encoded slug of the wiki page"),
});

// Define wiki response schemas
export const GitLabWikiPageSchema = z.object({
  title: z.string(),
  slug: z.string(),
  format: z.string(),
  content: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Merge Request Thread position schema - used for diff notes
// Extremely flexible position schema for API responses - accepts any structure

// Strict position schema for creating draft notes and merge request threads
export const MergeRequestThreadPositionCreateSchema = z.object({
  base_sha: z.string().describe("REQUIRED: Base commit SHA in the source branch. Get this from merge request diff_refs.base_sha."),
  head_sha: z.string().describe("REQUIRED: SHA referencing HEAD of the source branch. Get this from merge request diff_refs.head_sha."),
  start_sha: z.string().describe("REQUIRED: SHA referencing the start commit of the source branch. Get this from merge request diff_refs.start_sha."),
  position_type: z.enum(["text", "image", "file"]).describe("REQUIRED: Position type. Use 'text' for code diffs, 'image' for image diffs, 'file' for file-level comments."),
  new_path: z.string().nullable().optional().describe("File path after changes. REQUIRED for most diff comments. Use same as old_path if file wasn't renamed."),
  old_path: z.string().nullable().optional().describe("File path before changes. REQUIRED for most diff comments. Use same as new_path if file wasn't renamed."),
  new_line: z.number().nullable().optional().describe("Line number in modified file (after changes). Use for added lines or context lines. NULL for deleted lines. For single-line comments on new lines."),
  old_line: z.number().nullable().optional().describe("Line number in original file (before changes). Use for deleted lines or context lines. NULL for added lines. For single-line comments on old lines."),
  line_range: LineRangeSchema.optional().describe("MULTILINE COMMENTS: Specify start/end line positions for commenting on multiple lines. Alternative to single old_line/new_line."),
  width: z.number().optional().describe("IMAGE DIFFS ONLY: Width of the image (for position_type='image')."),
  height: z.number().optional().describe("IMAGE DIFFS ONLY: Height of the image (for position_type='image')."),
  x: z.number().optional().describe("IMAGE DIFFS ONLY: X coordinate on the image (for position_type='image')."),
  y: z.number().optional().describe("IMAGE DIFFS ONLY: Y coordinate on the image (for position_type='image')."),
});

export const MergeRequestThreadPositionSchema = z.object({
  base_sha: z
    .string()
    .describe(
      "REQUIRED: Base commit SHA in the source branch. Get this from merge request diff_refs.base_sha."
    ),
  head_sha: z
    .string()
    .describe(
      "REQUIRED: SHA referencing HEAD of the source branch. Get this from merge request diff_refs.head_sha."
    ),
  start_sha: z
    .string()
    .describe(
      "REQUIRED: SHA referencing the start commit of the source branch. Get this from merge request diff_refs.start_sha."
    ),
  position_type: z
    .enum(["text", "image", "file"])
    .describe(
      "REQUIRED: Position type. Use 'text' for code diffs, 'image' for image diffs, 'file' for file-level comments."
    ),
  new_path: z
    .string()
    .nullable()
    .optional()
    .describe(
      "File path after changes. REQUIRED for most diff comments. Use same as old_path if file wasn't renamed."
    ),
  old_path: z
    .string()
    .nullable()
    .optional()
    .describe(
      "File path before changes. REQUIRED for most diff comments. Use same as new_path if file wasn't renamed."
    ),
  new_line: z
    .number()
    .nullable()
    .optional()
    .describe(
      "Line number in modified file (after changes). Use for added lines or context lines. NULL for deleted lines. For single-line comments on new lines."
    ),
  old_line: z
    .number()
    .nullable()
    .optional()
    .describe(
      "Line number in original file (before changes). Use for deleted lines or context lines. NULL for added lines. For single-line comments on old lines."
    ),
  line_range: LineRangeSchema.optional().describe(
    "MULTILINE COMMENTS: Specify start/end line positions for commenting on multiple lines. Alternative to single old_line/new_line."
  ),
  width: z
    .number()
    .optional()
    .describe("IMAGE DIFFS ONLY: Width of the image (for position_type='image')."),
  height: z
    .number()
    .optional()
    .describe("IMAGE DIFFS ONLY: Height of the image (for position_type='image')."),
  x: z
    .number()
    .optional()
    .describe("IMAGE DIFFS ONLY: X coordinate on the image (for position_type='image')."),
  y: z
    .number()
    .optional()
    .describe("IMAGE DIFFS ONLY: Y coordinate on the image (for position_type='image')."),
});

// Draft Notes API schemas
export const GitLabDraftNoteSchema = z.object({
  id: z.coerce.string(),
  author: GitLabUserSchema.optional(),
  body: z.string().optional(),
  note: z.string().optional(), // Some APIs might use 'note' instead of 'body'
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  position: MergeRequestThreadPositionSchema.nullable().optional(),
  resolve_discussion: z.boolean().optional(),
}).transform((data) => ({
  // Normalize the response to always have consistent field names
  id: data.id,
  author: data.author,
  body: data.body || data.note || "",
  created_at: data.created_at || "",
  updated_at: data.updated_at || "",
  position: data.position,
  resolve_discussion: data.resolve_discussion,
}));

export type GitLabDraftNote = z.infer<typeof GitLabDraftNoteSchema>;

// Get draft note schema
export const GetDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("The IID of a merge request"),
  draft_note_id: z.coerce.string().describe("The ID of the draft note"),
});

// List draft notes schema
export const ListDraftNotesSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("The IID of a merge request"),
});

// Create draft note schema
export const CreateDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("The IID of a merge request"),
  body: z.string().describe("The content of the draft note"),
  position: MergeRequestThreadPositionCreateSchema.optional().describe("Position when creating a diff note"),
  resolve_discussion: z.boolean().optional().describe("Whether to resolve the discussion when publishing"),
});

// Update draft note schema
export const UpdateDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("The IID of a merge request"),
  draft_note_id: z.coerce.string().describe("The ID of the draft note"),
  body: z.string().optional().describe("The content of the draft note"),
  position: MergeRequestThreadPositionCreateSchema.optional().describe("Position when creating a diff note"),
  resolve_discussion: z.boolean().optional().describe("Whether to resolve the discussion when publishing"),
});

// Delete draft note schema
export const DeleteDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("The IID of a merge request"),
  draft_note_id: z.coerce.string().describe("The ID of the draft note"),
});

// Publish draft note schema
export const PublishDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("The IID of a merge request"),
  draft_note_id: z.coerce.string().describe("The ID of the draft note"),
});

// Bulk publish draft notes schema
export const BulkPublishDraftNotesSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("The IID of a merge request"),
});

// Schema for creating a new merge request thread
export const CreateMergeRequestThreadSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe("The IID of a merge request"),
  body: z.string().describe("The content of the thread"),
  position: MergeRequestThreadPositionSchema.optional().describe(
    "Position when creating a diff note"
  ),
  created_at: z.string().optional().describe("Date the thread was created at (ISO 8601 format)"),
});

// Milestone related schemas
// Schema for listing project milestones
export const ListProjectMilestonesSchema = ProjectParamsSchema.extend({
  iids: z.array(z.number()).optional().describe("Return only the milestones having the given iid"),
  state: z
    .enum(["active", "closed"])
    .optional()
    .describe("Return only active or closed milestones"),
  title: z
    .string()
    .optional()
    .describe("Return only milestones with a title matching the provided string"),
  search: z
    .string()
    .optional()
    .describe("Return only milestones with a title or description matching the provided string"),
  include_ancestors: z.boolean().optional().describe("Include ancestor groups"),
  updated_before: z
    .string()
    .optional()
    .describe("Return milestones updated before the specified date (ISO 8601 format)"),
  updated_after: z
    .string()
    .optional()
    .describe("Return milestones updated after the specified date (ISO 8601 format)"),
}).merge(PaginationOptionsSchema);

// Schema for getting a single milestone
export const GetProjectMilestoneSchema = ProjectParamsSchema.extend({
  milestone_id: z.coerce.string().describe("The ID of a project milestone"),
});

// Schema for creating a new milestone
export const CreateProjectMilestoneSchema = ProjectParamsSchema.extend({
  title: z.string().describe("The title of the milestone"),
  description: z.string().optional().describe("The description of the milestone"),
  due_date: z.string().optional().describe("The due date of the milestone (YYYY-MM-DD)"),
  start_date: z.string().optional().describe("The start date of the milestone (YYYY-MM-DD)"),
});

// Schema for editing a milestone
export const EditProjectMilestoneSchema = GetProjectMilestoneSchema.extend({
  title: z.string().optional().describe("The title of the milestone"),
  description: z.string().optional().describe("The description of the milestone"),
  due_date: z.string().optional().describe("The due date of the milestone (YYYY-MM-DD)"),
  start_date: z.string().optional().describe("The start date of the milestone (YYYY-MM-DD)"),
  state_event: z
    .enum(["close", "activate"])
    .optional()
    .describe("The state event of the milestone"),
});

// Schema for deleting a milestone
export const DeleteProjectMilestoneSchema = GetProjectMilestoneSchema;

// Schema for getting issues assigned to a milestone
export const GetMilestoneIssuesSchema = GetProjectMilestoneSchema;

// Schema for getting merge requests assigned to a milestone
export const GetMilestoneMergeRequestsSchema =
  GetProjectMilestoneSchema.merge(PaginationOptionsSchema);

// Schema for promoting a project milestone to a group milestone
export const PromoteProjectMilestoneSchema = GetProjectMilestoneSchema;

// Schema for getting burndown chart events for a milestone
export const GetMilestoneBurndownEventsSchema =
  GetProjectMilestoneSchema.merge(PaginationOptionsSchema);

// Add schemas for commit operations
export const ListCommitsSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or complete URL-encoded path to project"),
  ref_name: z
    .string()
    .optional()
    .describe(
      "The name of a repository branch, tag or revision range, or if not given the default branch"
    ),
  since: z
    .string()
    .optional()
    .describe(
      "Only commits after or on this date are returned in ISO 8601 format YYYY-MM-DDTHH:MM:SSZ"
    ),
  until: z
    .string()
    .optional()
    .describe(
      "Only commits before or on this date are returned in ISO 8601 format YYYY-MM-DDTHH:MM:SSZ"
    ),
  path: z.string().optional().describe("The file path"),
  author: z.string().optional().describe("Search commits by commit author"),
  all: z.boolean().optional().describe("Retrieve every commit from the repository"),
  with_stats: z.boolean()
    .optional()
    .describe("Stats about each commit are added to the response"),
  first_parent: z.boolean()
    .optional()
    .describe("Follow only the first parent commit upon seeing a merge commit"),
  order: z.enum(["default", "topo"]).optional().describe("List commits in order"),
  trailers: z.boolean().optional().describe("Parse and include Git trailers for every commit"),
  page: z.number().optional().describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().describe("Number of items per page (max: 100, default: 20)"),
});

export const GetCommitSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or complete URL-encoded path to project"),
  sha: z.string().describe("The commit hash or name of a repository branch or tag"),
  stats: z.boolean().optional().describe("Include commit stats"),
});

export const GetCommitDiffSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or complete URL-encoded path to project"),
  sha: z.string().describe("The commit hash or name of a repository branch or tag"),
  full_diff: flexibleBoolean.optional().describe("Whether to return the full diff or only first page (default: false)"),
});

// Schema for listing issues assigned to the current user
export const MyIssuesSchema = z.object({
  project_id: z.string().optional().describe("Project ID or URL-encoded path (optional when GITLAB_PROJECT_ID is set)"),
  state: z
    .enum(["opened", "closed", "all"])
    .optional()
    .describe("Return issues with a specific state (default: opened)"),
  labels: z.array(z.string()).optional().describe("Array of label names to filter by"),
  milestone: z.string().optional().describe("Milestone title to filter by"),
  search: z.string().optional().describe("Search for specific terms in title and description"),
  created_after: z.string().optional().describe("Return issues created after the given time (ISO 8601)"),
  created_before: z.string().optional().describe("Return issues created before the given time (ISO 8601)"),
  updated_after: z.string().optional().describe("Return issues updated after the given time (ISO 8601)"),
  updated_before: z.string().optional().describe("Return issues updated before the given time (ISO 8601)"),
  per_page: z.number().optional().describe("Number of items per page (default: 20, max: 100)"),
  page: z.number().optional().describe("Page number for pagination (default: 1)"),
});

// Schema for listing project members
export const ListProjectMembersSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  query: z.string().optional().describe("Search for members by name or username"),
  user_ids: z.array(z.number()).optional().describe("Filter by user IDs"),
  skip_users: z.array(z.number()).optional().describe("User IDs to exclude"),
  per_page: z.number().optional().describe("Number of items per page (default: 20, max: 100)"),
  page: z.number().optional().describe("Page number for pagination (default: 1)"),
});

// Schema for GitLab project member
export const GitLabProjectMemberSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  state: z.string(),
  avatar_url: z.string().nullable(),
  web_url: z.string(),
  access_level: z.number(),
  access_level_description: z.string().optional(),
  created_at: z.string(),
  expires_at: z.string().nullable().optional(),
  email: z.string().optional(),

});

// Markdown upload schemas
export const GitLabMarkdownUploadSchema = z.object({
  id: z.number(),
  alt: z.string(),
  url: z.string(),
  full_path: z.string(),
  markdown: z.string(),
});

export const MarkdownUploadSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path of the project"),
  file_path: z.string().describe("Path to the file to upload"),
});

export const DownloadAttachmentSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path of the project"),
  secret: z.string().describe("The 32-character secret of the upload"),
  filename: z.string().describe("The filename of the upload"),
  local_path: z.string().optional().describe("Local path to save the file (optional, defaults to current directory)"),
});

export const GroupIteration = z.object({
  id: z.coerce.string(),
  iid: z.coerce.string(),
  sequence: z.number(),
  group_id: z.coerce.string(),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  state: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  due_date: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  web_url: z.string().optional().nullable(),
});

export const ListGroupIterationsSchema = z
  .object({
    group_id: z.coerce.string().describe("Group ID or URL-encoded path"),
    state: z
      .enum(["opened", "upcoming", "current", "closed", "all"])
      .optional()
      .describe("Return opened, upcoming, current, closed, or all iterations."),
    search: z
      .string()
      .optional()
      .describe("Return only iterations with a title matching the provided string."),
    search_in: z
      .array(z.enum(["title", "cadence_title"]))
      .optional()
      .describe(
        "Fields in which fuzzy search should be performed with the query given in the argument search. The available options are title and cadence_title. Default is [title]."
      ),
    include_ancestors: z.boolean()
      .optional()
      .describe("Include iterations for group and its ancestors. Defaults to true."),
    include_descendants: z.boolean()
      .optional()
      .describe("Include iterations for group and its descendants. Defaults to false."),
    updated_before: z
      .string()
      .optional()
      .describe(
        "Return only iterations updated before the given datetime. Expected in ISO 8601 format (2019-03-15T08:00:00Z)."
      ),
    updated_after: z
      .string()
      .optional()
      .describe(
        "Return only iterations updated after the given datetime. Expected in ISO 8601 format (2019-03-15T08:00:00Z)."
      ),
  })
  .merge(PaginationOptionsSchema);



// Events API schemas
export const GitLabEventAuthorSchema = z.object({
  id: z.coerce.string(),
  name: z.string(),
  username: z.string(),
  state: z.string(),
  avatar_url: z.string().nullable(),
  web_url: z.string(),
});

export const GitLabEventSchema = z.object({
  id: z.coerce.string(),
  project_id: z.coerce.string(),
  action_name: z.string(),
  target_id: z.coerce.string().nullable(),
  target_iid: z.coerce.string().nullable(),
  target_type: z.string().nullable(),
  author_id: z.coerce.string(),
  target_title: z.string().nullable(),
  created_at: z.string(),
  author: GitLabEventAuthorSchema,
  author_username: z.string(),
  imported: z.boolean(),
  imported_from: z.string(),
}).passthrough(); // Allow additional fields

// List events schema
export const ListEventsSchema = z.object({
  action: z.string().optional().describe("If defined, returns events with the specified action type"),
  target_type: z.enum(["epic", "issue", "merge_request", "milestone", "note", "project", "snippet", "user"]).optional().describe("If defined, returns events with the specified target type"),
  before: z.string().optional().describe("If defined, Returns events created before the specified date (YYYY-MM-DD format). To include events on 2025-08-29, use before=2025-08-30"),
  after: z.string().optional().describe("If defined, Returns events created after the specified date (YYYY-MM-DD format). To include events on 2025-08-29, use after=2025-08-28"),
  scope: z.string().optional().describe("Include all events across a user's projects"),
  sort: z.enum(["asc", "desc"]).optional().describe("Direction to sort the results by creation date. Default: desc"),
  page: z.number().optional().describe("Returns the specified results page. Default: 1"),
  per_page: z.number().optional().describe("Number of results per page. Default: 20"),
});

// Get project events schema
export const GetProjectEventsSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  action: z.string().optional().describe("If defined, returns events with the specified action type"),
  target_type: z.enum(["epic", "issue", "merge_request", "milestone", "note", "project", "snippet", "user"]).optional().describe("If defined, returns events with the specified target type"),
  before: z.string().optional().describe("If defined, Returns events created before the specified date (YYYY-MM-DD format). To include events on 2025-08-29, use before=2025-08-30"),
  after: z.string().optional().describe("If defined, Returns events created after the specified date (YYYY-MM-DD format). To include events on 2025-08-29, use after=2025-08-28"),
  sort: z.enum(["asc", "desc"]).optional().describe("Direction to sort the results by creation date. Default: desc"),
  page: z.number().optional().describe("Returns the specified results page. Default: 1"),
  per_page: z.number().optional().describe("Number of results per page. Default: 20"),
});

// Export types
export type GitLabAuthor = z.infer<typeof GitLabAuthorSchema>;
export type GitLabFork = z.infer<typeof GitLabForkSchema>;
export type GitLabIssue = z.infer<typeof GitLabIssueSchema>;
export type GitLabIssueWithLinkDetails = z.infer<typeof GitLabIssueWithLinkDetailsSchema>;
export type GitLabMergeRequest = z.infer<typeof GitLabMergeRequestSchema>;
export type GitLabRepository = z.infer<typeof GitLabRepositorySchema>;
export type GitLabFileContent = z.infer<typeof GitLabFileContentSchema>;
export type GitLabDirectoryContent = z.infer<typeof GitLabDirectoryContentSchema>;
export type GitLabContent = z.infer<typeof GitLabContentSchema>;
export type FileOperation = z.infer<typeof FileOperationSchema>;
export type GitLabTree = z.infer<typeof GitLabTreeSchema>;
export type GitLabCompareResult = z.infer<typeof GitLabCompareResultSchema>;
export type GitLabCommit = z.infer<typeof GitLabCommitSchema>;
export type GitLabReference = z.infer<typeof GitLabReferenceSchema>;
export type CreateRepositoryOptions = z.infer<typeof CreateRepositoryOptionsSchema>;
export type CreateIssueOptions = z.infer<typeof CreateIssueOptionsSchema>;
export type CreateMergeRequestOptions = z.infer<typeof CreateMergeRequestOptionsSchema>;
export type CreateBranchOptions = z.infer<typeof CreateBranchOptionsSchema>;
export type GitLabCreateUpdateFileResponse = z.infer<typeof GitLabCreateUpdateFileResponseSchema>;
export type GitLabSearchResponse = z.infer<typeof GitLabSearchResponseSchema>;
export type GitLabMergeRequestDiff = z.infer<typeof GitLabDiffSchema>;
export type CreateNoteOptions = z.infer<typeof CreateNoteSchema>;
export type GitLabIssueLink = z.infer<typeof GitLabIssueLinkSchema>;
export type ListIssueDiscussionsOptions = z.infer<typeof ListIssueDiscussionsSchema>;
export type ListMergeRequestDiscussionsOptions = z.infer<typeof ListMergeRequestDiscussionsSchema>;
export type UpdateIssueNoteOptions = z.infer<typeof UpdateIssueNoteSchema>;
export type CreateIssueNoteOptions = z.infer<typeof CreateIssueNoteSchema>;
export type GitLabNamespace = z.infer<typeof GitLabNamespaceSchema>;
export type GitLabNamespaceExistsResponse = z.infer<typeof GitLabNamespaceExistsResponseSchema>;
export type GitLabProject = z.infer<typeof GitLabProjectSchema>;
export type GitLabLabel = z.infer<typeof GitLabLabelSchema>;
export type ListWikiPagesOptions = z.infer<typeof ListWikiPagesSchema>;
export type GetWikiPageOptions = z.infer<typeof GetWikiPageSchema>;
export type CreateWikiPageOptions = z.infer<typeof CreateWikiPageSchema>;
export type UpdateWikiPageOptions = z.infer<typeof UpdateWikiPageSchema>;
export type DeleteWikiPageOptions = z.infer<typeof DeleteWikiPageSchema>;
export type GitLabWikiPage = z.infer<typeof GitLabWikiPageSchema>;
export type GitLabTreeItem = z.infer<typeof GitLabTreeItemSchema>;
export type GetRepositoryTreeOptions = z.infer<typeof GetRepositoryTreeSchema>;
export type MergeRequestThreadPosition = z.infer<typeof MergeRequestThreadPositionSchema>;
export type MergeRequestThreadPositionCreate = z.infer<typeof MergeRequestThreadPositionCreateSchema>;
export type CreateMergeRequestThreadOptions = z.infer<typeof CreateMergeRequestThreadSchema>;
export type CreateMergeRequestNoteOptions = z.infer<typeof CreateMergeRequestNoteSchema>;
export type GitLabPipelineJob = z.infer<typeof GitLabPipelineJobSchema>;
export type GitLabPipelineTriggerJob = z.infer<typeof GitLabPipelineTriggerJobSchema>;
export type GitLabPipeline = z.infer<typeof GitLabPipelineSchema>;
export type ListPipelinesOptions = z.infer<typeof ListPipelinesSchema>;
export type GetPipelineOptions = z.infer<typeof GetPipelineSchema>;
export type ListPipelineJobsOptions = z.infer<typeof ListPipelineJobsSchema>;
export type ListPipelineTriggerJobsOptions = z.infer<typeof ListPipelineTriggerJobsSchema>;
export type CreatePipelineOptions = z.infer<typeof CreatePipelineSchema>;
export type RetryPipelineOptions = z.infer<typeof RetryPipelineSchema>;
export type CancelPipelineOptions = z.infer<typeof CancelPipelineSchema>;
export type GitLabMilestones = z.infer<typeof GitLabMilestonesSchema>;
export type ListProjectMilestonesOptions = z.infer<typeof ListProjectMilestonesSchema>;
export type GetProjectMilestoneOptions = z.infer<typeof GetProjectMilestoneSchema>;
export type CreateProjectMilestoneOptions = z.infer<typeof CreateProjectMilestoneSchema>;
export type EditProjectMilestoneOptions = z.infer<typeof EditProjectMilestoneSchema>;
export type DeleteProjectMilestoneOptions = z.infer<typeof DeleteProjectMilestoneSchema>;
export type GetMilestoneIssuesOptions = z.infer<typeof GetMilestoneIssuesSchema>;
export type GetMilestoneMergeRequestsOptions = z.infer<typeof GetMilestoneMergeRequestsSchema>;
export type PromoteProjectMilestoneOptions = z.infer<typeof PromoteProjectMilestoneSchema>;
export type GetMilestoneBurndownEventsOptions = z.infer<typeof GetMilestoneBurndownEventsSchema>;
export type GitLabUser = z.infer<typeof GitLabUserSchema>;
export type GitLabUsersResponse = z.infer<typeof GitLabUsersResponseSchema>;
export type PaginationOptions = z.infer<typeof PaginationOptionsSchema>;
export type ListCommitsOptions = z.infer<typeof ListCommitsSchema>;
export type GetCommitOptions = z.infer<typeof GetCommitSchema>;
export type GetCommitDiffOptions = z.infer<typeof GetCommitDiffSchema>;
export type MyIssuesOptions = z.infer<typeof MyIssuesSchema>;
export type ListProjectMembersOptions = z.infer<typeof ListProjectMembersSchema>;
export type GitLabProjectMember = z.infer<typeof GitLabProjectMemberSchema>;
export type GroupIteration = z.infer<typeof GroupIteration>;
export type ListGroupIterationsOptions = z.infer<typeof ListGroupIterationsSchema>;

// Draft Notes type exports
export type ListDraftNotesOptions = z.infer<typeof ListDraftNotesSchema>;
export type CreateDraftNoteOptions = z.infer<typeof CreateDraftNoteSchema>;
export type UpdateDraftNoteOptions = z.infer<typeof UpdateDraftNoteSchema>;
export type DeleteDraftNoteOptions = z.infer<typeof DeleteDraftNoteSchema>;
export type PublishDraftNoteOptions = z.infer<typeof PublishDraftNoteSchema>;
export type BulkPublishDraftNotesOptions = z.infer<typeof BulkPublishDraftNotesSchema>;
export type GitLabMarkdownUpload = z.infer<typeof GitLabMarkdownUploadSchema>;
export type MarkdownUploadOptions = z.infer<typeof MarkdownUploadSchema>;

// Events API type exports
export type GitLabEvent = z.infer<typeof GitLabEventSchema>;
export type GitLabEventAuthor = z.infer<typeof GitLabEventAuthorSchema>;
export type ListEventsOptions = z.infer<typeof ListEventsSchema>;
export type GetProjectEventsOptions = z.infer<typeof GetProjectEventsSchema>;
