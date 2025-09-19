import { z } from "zod";
import { PaginationOptionsSchema } from "../shared";
import { flexibleBoolean } from "../utils";

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

// Read-only pipeline operation schemas
export const ListPipelinesSchema = z
  .object({
    project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
    scope: z
      .enum(["running", "pending", "finished", "branches", "tags"])
      .optional()
      .describe("The scope of pipelines to return"),
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
      .describe("The status of pipelines to return"),
    source: z
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
      .optional()
      .describe("The source of pipelines"),
    ref: z.string().optional().describe("The ref to filter by"),
    sha: z.string().optional().describe("The SHA to filter by"),
    yaml_errors: z.boolean().optional().describe("Filter by YAML errors"),
    name: z.string().optional().describe("The name of the user who triggered the pipeline"),
    username: z.string().optional().describe("The username who triggered the pipeline"),
    updated_after: z.string().optional().describe("ISO 8601 datetime to filter by updated_after"),
    updated_before: z.string().optional().describe("ISO 8601 datetime to filter by updated_before"),
    order_by: z
      .enum(["id", "status", "ref", "updated_at", "user_id"])
      .optional()
      .describe("Order pipelines by"),
    sort: z.enum(["asc", "desc"]).optional().describe("Sort order"),
  })
  .merge(PaginationOptionsSchema);

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
      .array()
      .optional()
      .describe("Scope of jobs to show"),
    include_retried: z.boolean().optional().describe("Include retried jobs in the response"),
  })
  .merge(PaginationOptionsSchema);

export const ListPipelineTriggerJobsSchema = z
  .object({
    project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
    pipeline_id: z.coerce.string().describe("The ID of the pipeline"),
    scope: z
      // https://docs.gitlab.com/api/jobs/#job-status-values
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
      .array()
      .optional()
      .describe("Scope of jobs to show"),
    include_retried: z.boolean().optional().describe("Include retried jobs in the response"),
  })
  .merge(PaginationOptionsSchema);

// Schema for the input parameters for pipeline job operations
export const GetPipelineJobOutputSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  job_id: z.coerce.string().describe("The ID of the job"),
  limit: z.number().optional().describe("Limit the number of lines of output to return (optional)"),
  max_lines: z
    .number()
    .optional()
    .describe("Maximum number of lines to return (alternative to limit)"),
  start: z.number().optional().describe("Start from specific line number"),
});

// Export types
export type GitLabPipeline = z.infer<typeof GitLabPipelineSchema>;
export type GitLabPipelineJob = z.infer<typeof GitLabPipelineJobSchema>;
export type GitLabPipelineTriggerJob = z.infer<typeof GitLabPipelineTriggerJobSchema>;
export type ListPipelinesOptions = z.infer<typeof ListPipelinesSchema>;
export type GetPipelineOptions = z.infer<typeof GetPipelineSchema>;
export type ListPipelineJobsOptions = z.infer<typeof ListPipelineJobsSchema>;
export type ListPipelineTriggerJobsOptions = z.infer<typeof ListPipelineTriggerJobsSchema>;
