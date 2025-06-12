import { z } from "zod";
import { GitLabUserSchema, GitLabHeadPipelineSchema, GitLabMergeRequestDiffRefSchema, ProjectParamsSchema } from "./base.js";

// Merge Request schema
export const GitLabMergeRequestSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  state: z.string(),
  merged: z.boolean().optional(),
  draft: z.boolean().optional(),
  author: GitLabUserSchema,
  assignees: z.array(GitLabUserSchema).optional(),
  source_branch: z.string(),
  target_branch: z.string(),
  diff_refs: GitLabMergeRequestDiffRefSchema.nullable().optional(),
  head_pipeline: GitLabHeadPipelineSchema.nullable().optional(),
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

// Discussion Note schema
export const GitLabDiscussionNoteSchema = z.object({
  id: z.number(),
  type: z.enum(["DiscussionNote", "DiffNote", "Note"]).nullable(),
  body: z.string(),
  attachment: z.any().nullable(),
  author: GitLabUserSchema,
  created_at: z.string(),
  updated_at: z.string(),
  system: z.boolean(),
  noteable_id: z.number(),
  noteable_type: z.enum(["Issue", "MergeRequest", "Snippet", "Commit", "Epic"]),
  project_id: z.number().optional(),
  noteable_iid: z.number().nullable(),
  resolvable: z.boolean().optional(),
  resolved: z.boolean().optional(),
  resolved_by: GitLabUserSchema.nullable().optional(),
  resolved_at: z.string().nullable().optional(),
  position: z.object({
    base_sha: z.string(),
    start_sha: z.string(),
    head_sha: z.string(),
    old_path: z.string(),
    new_path: z.string(),
    position_type: z.enum(["text", "image", "file"]),
    old_line: z.number().nullable(),
    new_line: z.number().nullable(),
    line_range: z.object({
      start: z.object({
        line_code: z.string(),
        type: z.enum(["new", "old", "expanded"]).nullable(),
        old_line: z.number().nullable(),
        new_line: z.number().nullable(),
      }),
      end: z.object({
        line_code: z.string(),
        type: z.enum(["new", "old", "expanded"]).nullable(),
        old_line: z.number().nullable(),
        new_line: z.number().nullable(),
      }),
    }).nullable().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
  }).optional(),
});

// Discussion schema
export const GitLabDiscussionSchema = z.object({
  id: z.string(),
  individual_note: z.boolean(),
  notes: z.array(GitLabDiscussionNoteSchema),
});

// Input schemas for MR operations
export const GetMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().optional().describe("The IID of a merge request"),
  source_branch: z.string().optional().describe("Source branch name"),
});

export const ListMergeRequestDiscussionsSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("The IID of a merge request"),
});

export const CreateMergeRequestNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("The IID of a merge request"),
  discussion_id: z.string().describe("The ID of a thread"),
  body: z.string().describe("The content of the note or reply"),
  created_at: z.string().optional().describe("Date the note was created at (ISO 8601 format)"),
});

export const UpdateMergeRequestSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().optional().describe("The IID of a merge request"),
  source_branch: z.string().optional().describe("Source branch name"),
  title: z.string().optional().describe("The title of the merge request"),
  description: z.string().optional().describe("The description of the merge request"),
  target_branch: z.string().optional().describe("The target branch"),
  assignee_ids: z.array(z.number()).optional().describe("The ID of the users to assign the MR to"),
  labels: z.array(z.string()).optional().describe("Labels for the MR"),
  state_event: z.enum(["close", "reopen"]).optional().describe("New state (close/reopen) for the MR"),
  remove_source_branch: z.boolean().optional().describe("Flag indicating if the source branch should be removed"),
  squash: z.boolean().optional().describe("Squash commits into a single commit when merging"),
  draft: z.boolean().optional().describe("Work in progress merge request"),
});

// Types
export type GitLabMergeRequest = z.infer<typeof GitLabMergeRequestSchema>;
export type GitLabDiscussionNote = z.infer<typeof GitLabDiscussionNoteSchema>;
export type GitLabDiscussion = z.infer<typeof GitLabDiscussionSchema>; 