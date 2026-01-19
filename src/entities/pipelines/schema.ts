import { z } from "zod";
import { requiredId } from "../utils";

// ============================================================================
// Shared schemas for pipeline variables
// ============================================================================

const PipelineVariableSchema = z.object({
  key: z.string(),
  value: z.string(),
  variable_type: z.enum(["env_var", "file"]).optional(),
});

// ============================================================================
// manage_pipeline - CQRS Command Tool (discriminated union)
// Actions: create, retry, cancel
// ============================================================================

const ManagePipelineBaseSchema = z.object({
  project_id: requiredId.describe("Project ID or URL-encoded path"),
});

// Create pipeline action
const ManagePipelineCreateSchema = ManagePipelineBaseSchema.extend({
  action: z.literal("create"),
  ref: z.string().describe("The branch or tag to run the pipeline on"),
  variables: z
    .array(PipelineVariableSchema)
    .optional()
    .describe("Variables to pass to the pipeline"),
});

// Retry pipeline action
const ManagePipelineRetrySchema = ManagePipelineBaseSchema.extend({
  action: z.literal("retry"),
  pipeline_id: requiredId.describe("The ID of the pipeline to retry"),
});

// Cancel pipeline action
const ManagePipelineCancelSchema = ManagePipelineBaseSchema.extend({
  action: z.literal("cancel"),
  pipeline_id: requiredId.describe("The ID of the pipeline to cancel"),
});

export const ManagePipelineSchema = z.discriminatedUnion("action", [
  ManagePipelineCreateSchema,
  ManagePipelineRetrySchema,
  ManagePipelineCancelSchema,
]);

// ============================================================================
// manage_pipeline_job - CQRS Command Tool (discriminated union)
// Actions: play, retry, cancel
// ============================================================================

const ManagePipelineJobBaseSchema = z.object({
  project_id: requiredId.describe("Project ID or URL-encoded path"),
  job_id: requiredId.describe("The ID of the job"),
});

// Play manual job action
const ManagePipelineJobPlaySchema = ManagePipelineJobBaseSchema.extend({
  action: z.literal("play"),
  job_variables_attributes: z
    .array(PipelineVariableSchema)
    .optional()
    .describe("Variables to pass to the job"),
});

// Retry job action
const ManagePipelineJobRetrySchema = ManagePipelineJobBaseSchema.extend({
  action: z.literal("retry"),
});

// Cancel job action
const ManagePipelineJobCancelSchema = ManagePipelineJobBaseSchema.extend({
  action: z.literal("cancel"),
  force: z.boolean().optional().describe("Force cancellation of the job"),
});

export const ManagePipelineJobSchema = z.discriminatedUnion("action", [
  ManagePipelineJobPlaySchema,
  ManagePipelineJobRetrySchema,
  ManagePipelineJobCancelSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ManagePipelineInput = z.infer<typeof ManagePipelineSchema>;
export type ManagePipelineJobInput = z.infer<typeof ManagePipelineJobSchema>;
