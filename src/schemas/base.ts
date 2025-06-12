import { z } from "zod";

// Common base schemas used across multiple tools
export const GitLabUserSchema = z.object({
  username: z.string(),
  id: z.number(),
  name: z.string(),
  avatar_url: z.string(),
  web_url: z.string(),
});

export const GitLabHeadPipelineSchema = z.object({
  id: z.number(),
  iid: z.number().optional(),
  project_id: z.number(),
  status: z.string(),
});

export const GitLabMergeRequestDiffRefSchema = z.object({
  base_sha: z.string(),
  head_sha: z.string(),
  start_sha: z.string(),
});

// Base schema for project-related operations
export const ProjectParamsSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
});

// Types
export type GitLabUser = z.infer<typeof GitLabUserSchema>;
export type GitLabHeadPipeline = z.infer<typeof GitLabHeadPipelineSchema>;
export type GitLabMergeRequestDiffRef = z.infer<typeof GitLabMergeRequestDiffRefSchema>; 