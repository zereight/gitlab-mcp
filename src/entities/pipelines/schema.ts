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
// manage_pipeline - CQRS Command Tool (flat schema for Claude API compatibility)
// Actions: create, retry, cancel
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const ManagePipelineSchema = z
  .object({
    action: z.enum(["create", "retry", "cancel"]).describe("Action to perform"),
    project_id: requiredId.describe("Project ID or URL-encoded path"),
    // create action fields
    ref: z
      .string()
      .optional()
      .describe("The branch or tag to run the pipeline on. Required for 'create' action."),
    variables: z
      .array(PipelineVariableSchema)
      .optional()
      .describe("Variables to pass to the pipeline. For 'create' action."),
    // retry/cancel action fields
    pipeline_id: requiredId
      .optional()
      .describe("The ID of the pipeline. Required for 'retry' and 'cancel' actions."),
  })
  .refine(data => data.action !== "create" || data.ref !== undefined, {
    message: "ref is required for 'create' action",
    path: ["ref"],
  })
  .refine(data => data.action === "create" || data.pipeline_id !== undefined, {
    message: "pipeline_id is required for 'retry' and 'cancel' actions",
    path: ["pipeline_id"],
  });

// ============================================================================
// manage_pipeline_job - CQRS Command Tool (flat schema for Claude API compatibility)
// Actions: play, retry, cancel
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const ManagePipelineJobSchema = z.object({
  action: z.enum(["play", "retry", "cancel"]).describe("Action to perform"),
  project_id: requiredId.describe("Project ID or URL-encoded path"),
  job_id: requiredId.describe("The ID of the job"),
  // play action fields
  job_variables_attributes: z
    .array(PipelineVariableSchema)
    .optional()
    .describe("Variables to pass to the job. For 'play' action."),
  // cancel action fields
  force: z.boolean().optional().describe("Force cancellation of the job. For 'cancel' action."),
});

// ============================================================================
// Type exports
// ============================================================================

export type ManagePipelineInput = z.infer<typeof ManagePipelineSchema>;
export type ManagePipelineJobInput = z.infer<typeof ManagePipelineJobSchema>;
