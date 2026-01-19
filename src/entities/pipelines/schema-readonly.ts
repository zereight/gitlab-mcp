import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

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
      has_details: flexibleBoolean.optional(),
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
  tag: flexibleBoolean,
  coverage: z.coerce.number().nullable().optional(),
  allow_failure: flexibleBoolean.optional(),
  created_at: z.string(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
  duration: z.number().optional(),
  queued_duration: z.number().optional(),
  user: z
    .object({
      id: z.coerce.string(),
      name: z.string(),
      username: z.string(),
      state: z.string(),
      avatar_url: z.string().nullable().optional(),
      web_url: z.string(),
    })
    .optional(),
  commit: z
    .object({
      id: z.string(),
      short_id: z.string(),
      title: z.string(),
      author_name: z.string(),
      author_email: z.string(),
      created_at: z.string(),
      message: z.string(),
    })
    .optional(),
  pipeline: z
    .object({
      id: z.coerce.string(),
      project_id: z.coerce.string(),
      ref: z.string(),
      sha: z.string(),
      status: z.string(),
    })
    .optional(),
  web_url: z.string(),
});

// Pipeline trigger job (bridge) schema
export const GitLabPipelineTriggerJobSchema = z.object({
  id: z.coerce.string(),
  status: z.string(),
  stage: z.string(),
  name: z.string(),
  ref: z.string(),
  tag: flexibleBoolean,
  coverage: z.coerce.number().nullable().optional(),
  allow_failure: flexibleBoolean.optional(),
  created_at: z.string(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
  duration: z.number().optional(),
  queued_duration: z.number().optional(),
  user: z
    .object({
      id: z.coerce.string(),
      name: z.string(),
      username: z.string(),
      state: z.string(),
      avatar_url: z.string().nullable().optional(),
      web_url: z.string(),
    })
    .optional(),
  commit: z
    .object({
      id: z.string(),
      short_id: z.string(),
      title: z.string(),
      author_name: z.string(),
      author_email: z.string(),
      created_at: z.string(),
      message: z.string(),
    })
    .optional(),
  pipeline: z
    .object({
      id: z.coerce.string(),
      project_id: z.coerce.string(),
      ref: z.string(),
      sha: z.string(),
      status: z.string(),
    })
    .optional(),
  web_url: z.string(),
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
    .optional(),
});

// ============================================================================
// Shared enums for pipeline filtering
// ============================================================================

const PipelineScopeSchema = z
  .enum(["running", "pending", "finished", "branches", "tags"])
  .describe("The scope of pipelines to return");

const PipelineStatusSchema = z
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
  .describe("The status of pipelines to return");

const PipelineSourceSchema = z
  .enum([
    "push",
    "web",
    "trigger",
    "schedule",
    "api",
    "external",
    "chat",
    "webide",
    "merge_request_event",
    "external_pull_request_event",
    "parent_pipeline",
    "ondemand_dast_scan",
    "ondemand_dast_validation",
  ])
  .describe("The source of pipelines");

const JobScopeSchema = z
  .enum(["created", "pending", "running", "failed", "success", "canceled", "skipped", "manual"])
  .describe("Scope of jobs to show");

const TriggerJobScopeSchema = z
  .enum([
    "created",
    "pending",
    "running",
    "failed",
    "success",
    "canceled",
    "skipped",
    "manual",
    "waiting_for_resource",
    "preparing",
  ])
  .describe("Scope of trigger jobs to show");

// ============================================================================
// browse_pipelines - CQRS Query Tool (flat schema for Claude API compatibility)
// Actions: list, get, jobs, triggers, job, logs
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const BrowsePipelinesSchema = z
  .object({
    action: z
      .enum(["list", "get", "jobs", "triggers", "job", "logs"])
      .describe("Action to perform"),
    project_id: requiredId.describe("Project ID or URL-encoded path"),
    // list action fields
    scope: PipelineScopeSchema.optional().describe("For 'list': pipeline scope filter"),
    status: PipelineStatusSchema.optional().describe("For 'list': pipeline status filter"),
    source: PipelineSourceSchema.optional().describe("For 'list': pipeline source filter"),
    ref: z.string().optional().describe("For 'list': the ref to filter by"),
    sha: z.string().optional().describe("For 'list': the SHA to filter by"),
    yaml_errors: z.boolean().optional().describe("For 'list': filter by YAML errors"),
    name: z
      .string()
      .optional()
      .describe("For 'list': the name of the user who triggered the pipeline"),
    username: z.string().optional().describe("For 'list': the username who triggered the pipeline"),
    updated_after: z
      .string()
      .optional()
      .describe("For 'list': ISO 8601 datetime to filter by updated_after"),
    updated_before: z
      .string()
      .optional()
      .describe("For 'list': ISO 8601 datetime to filter by updated_before"),
    order_by: z
      .enum(["id", "status", "ref", "updated_at", "user_id"])
      .optional()
      .describe("For 'list': order pipelines by"),
    sort: z.enum(["asc", "desc"]).optional().describe("For 'list': sort order"),
    // get/jobs/triggers action fields
    pipeline_id: requiredId
      .optional()
      .describe("The ID of the pipeline. Required for 'get', 'jobs', 'triggers' actions."),
    // jobs action fields
    job_scope: z.array(JobScopeSchema).optional().describe("For 'jobs': scope of jobs to show"),
    // triggers action fields
    trigger_scope: z
      .array(TriggerJobScopeSchema)
      .optional()
      .describe("For 'triggers': scope of trigger jobs to show"),
    // jobs/triggers shared fields
    include_retried: z
      .boolean()
      .optional()
      .describe("For 'jobs'/'triggers': include retried jobs in the response"),
    // job/logs action fields
    job_id: requiredId
      .optional()
      .describe("The ID of the job. Required for 'job' and 'logs' actions."),
    // logs action fields
    limit: z
      .number()
      .optional()
      .describe(
        "For 'logs': maximum number of lines to return. When combined with start, acts as line count from that position"
      ),
    max_lines: z
      .number()
      .optional()
      .describe("For 'logs': maximum number of lines to return (alternative to limit)"),
    start: z
      .number()
      .optional()
      .describe(
        "For 'logs': start from specific line number (0-based). Positive values start from beginning, negative values start from end (e.g., -100 = last 100 lines)"
      ),
    // pagination fields (for list, jobs, triggers)
    per_page: z.number().optional().describe("Number of items per page"),
    page: z.number().optional().describe("Page number"),
  })
  .refine(
    data => !["get", "jobs", "triggers"].includes(data.action) || data.pipeline_id !== undefined,
    {
      message: "pipeline_id is required for 'get', 'jobs', and 'triggers' actions",
      path: ["pipeline_id"],
    }
  )
  .refine(data => !["job", "logs"].includes(data.action) || data.job_id !== undefined, {
    message: "job_id is required for 'job' and 'logs' actions",
    path: ["job_id"],
  });

// ============================================================================
// Type exports
// ============================================================================

export type BrowsePipelinesInput = z.infer<typeof BrowsePipelinesSchema>;
export type GitLabPipeline = z.infer<typeof GitLabPipelineSchema>;
export type GitLabPipelineJob = z.infer<typeof GitLabPipelineJobSchema>;
export type GitLabPipelineTriggerJob = z.infer<typeof GitLabPipelineTriggerJobSchema>;
