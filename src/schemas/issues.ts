// Issue-related schemas for GitLab MCP

import { z } from "zod";
import { GitLabUserSchema, ProjectParamsSchema } from "./base.js";

// Label schema for issue fields
export const GitLabLabelSchema = z.object({
  id: z.number(),
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

// Milestone schema for issue fields
export const GitLabMilestoneSchema = z.object({
  id: z.number(),
  iid: z.number(),
  title: z.string(),
  description: z.string().nullable().default(""),
  state: z.string(),
  web_url: z.string(),
});

// Issue schema
export const GitLabIssueSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().nullable().default(""),
  state: z.string(),
  author: GitLabUserSchema,
  assignees: z.array(GitLabUserSchema),
  labels: z.array(GitLabLabelSchema).or(z.array(z.string())),
  milestone: GitLabMilestoneSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  web_url: z.string(),
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
});

// Create issue schema
export const CreateIssueSchema = ProjectParamsSchema.extend({
  title: z.string().describe("Issue title"),
  description: z.string().optional().describe("Issue description"),
  assignee_ids: z
    .array(z.number())
    .optional()
    .describe("Array of user IDs to assign"),
  labels: z.array(z.string()).optional().describe("Array of label names"),
  milestone_id: z.number().optional().describe("Milestone ID to assign"),
});

// Get issue schema
export const GetIssueSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.number().describe("The internal ID of the project issue"),
});

// Update issue schema
export const UpdateIssueSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  issue_iid: z.number().describe("The internal ID of the project issue"),
  title: z.string().optional().describe("The title of the issue"),
  description: z.string().optional().describe("The description of the issue"),
  assignee_ids: z
    .array(z.number())
    .optional()
    .describe("Array of user IDs to assign issue to"),
  confidential: z
    .boolean()
    .optional()
    .describe("Set the issue to be confidential"),
  discussion_locked: z
    .boolean()
    .optional()
    .describe("Flag to lock discussions"),
  due_date: z
    .string()
    .optional()
    .describe("Date the issue is due (YYYY-MM-DD)"),
  labels: z.array(z.string()).optional().describe("Array of label names"),
  milestone_id: z.number().optional().describe("Milestone ID to assign"),
  state_event: z
    .enum(["close", "reopen"])
    .optional()
    .describe("Update issue state (close/reopen)"),
  weight: z.number().optional().describe("Weight of the issue (0-9)"),
});

// Export types
export type GitLabLabel = z.infer<typeof GitLabLabelSchema>;
export type GitLabMilestone = z.infer<typeof GitLabMilestoneSchema>;
export type GitLabIssue = z.infer<typeof GitLabIssueSchema>;
export type CreateIssueOptions = z.infer<typeof CreateIssueSchema>;
export type GetIssueOptions = z.infer<typeof GetIssueSchema>;
export type UpdateIssueOptions = z.infer<typeof UpdateIssueSchema>;