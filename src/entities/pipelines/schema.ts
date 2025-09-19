import { z } from 'zod';

export const CreatePipelineSchema = z.object({
  project_id: z.coerce.string().describe('Project ID or URL-encoded path'),
  ref: z.string().describe('The branch or tag to run the pipeline on'),
  variables: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
        variable_type: z.enum(['env_var', 'file']).optional(),
      }),
    )
    .optional()
    .describe('Variables to pass to the pipeline'),
});

export const RetryPipelineSchema = z.object({
  project_id: z.coerce.string().describe('Project ID or URL-encoded path'),
  pipeline_id: z.coerce.string().describe('The ID of the pipeline to retry'),
});

// Schema for canceling a pipeline
export const CancelPipelineSchema = RetryPipelineSchema;

// Write-only pipeline operation schemas

// Schema for running a manual job
export const PlayPipelineJobSchema = z.object({
  project_id: z.coerce.string().describe('Project ID or URL-encoded path'),
  job_id: z.coerce.string().describe('The ID of the job'),
  job_variables_attributes: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
        variable_type: z.enum(['env_var', 'file']).optional(),
      }),
    )
    .optional()
    .describe('Variables to pass to the job'),
});

export const PipelineJobControlSchema = z.object({
  project_id: z.coerce.string().describe('Project ID or URL-encoded path'),
  job_id: z.coerce.string().describe('The ID of the job'),
});

export const RetryPipelineJobSchema = PipelineJobControlSchema;

// Schema for canceling a job
export const CancelPipelineJobSchema = z.object({
  project_id: z.coerce.string().describe('Project ID or URL-encoded path'),
  job_id: z.coerce.string().describe('The ID of the job'),
  force: z.boolean().optional().describe('Force cancellation of the job'),
});

// Export types
export type CreatePipelineOptions = z.infer<typeof CreatePipelineSchema>;
export type RetryPipelineOptions = z.infer<typeof RetryPipelineSchema>;
export type CancelPipelineOptions = z.infer<typeof CancelPipelineSchema>;
