import { z } from "zod";
import { GitLabUserSchema, GitLabHeadPipelineSchema, GitLabMergeRequestDiffRefSchema, ProjectParamsSchema } from "./base.js";

// Optimized Merge Request schema - only essential fields for AI agents
export const OptimizedGitLabMergeRequestSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  state: z.string(),
  merged: z.boolean().optional(),
  draft: z.boolean().optional(),
  author: z.object({
    username: z.string(),
  }),
  assignees: z.array(z.object({
    username: z.string(),
  })).optional(),
  source_branch: z.string(),
  target_branch: z.string(),
  head_pipeline: z.object({
    id: z.number(),
    iid: z.number().optional(),
    project_id: z.number(),
    status: z.string(),
  }).nullable().optional(),
  web_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  merged_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  changes_count: z.string().nullable().optional(),
  merge_when_pipeline_succeeds: z.boolean().optional(),
  squash: z.boolean().optional(),
  labels: z.array(z.string()).optional(),
});

// Full Merge Request schema (for validation of GitLab API responses)
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

/**
 * Transform full GitLab MR response to optimized format for AI agents
 */
export function streamlineMergeRequest(fullMR: any): z.infer<typeof OptimizedGitLabMergeRequestSchema> {
  return {
    id: fullMR.id,
    iid: fullMR.iid,
    project_id: fullMR.project_id,
    title: fullMR.title,
    description: fullMR.description,
    state: fullMR.state,
    merged: fullMR.merged,
    draft: fullMR.draft,
    author: {
      username: fullMR.author?.username,
    },
    assignees: fullMR.assignees?.map((assignee: any) => ({
      username: assignee.username,
    })),
    source_branch: fullMR.source_branch,
    target_branch: fullMR.target_branch,
    head_pipeline: fullMR.head_pipeline ? {
      id: fullMR.head_pipeline.id,
      iid: fullMR.head_pipeline.iid,
      project_id: fullMR.head_pipeline.project_id,
      status: fullMR.head_pipeline.status,
    } : null,
    web_url: fullMR.web_url,
    created_at: fullMR.created_at,
    updated_at: fullMR.updated_at,
    merged_at: fullMR.merged_at,
    closed_at: fullMR.closed_at,
    changes_count: fullMR.changes_count,
    merge_when_pipeline_succeeds: fullMR.merge_when_pipeline_succeeds,
    squash: fullMR.squash,
    labels: fullMR.labels,
  };
}

// Optimized Discussion Note schema - only essential fields for AI code review responses
export const OptimizedGitLabDiscussionNoteSchema = z.object({
  id: z.number(),
  type: z.enum(["DiscussionNote", "DiffNote", "Note"]).nullable(),
  body: z.string(),
  author: z.object({
    username: z.string(),
  }),
  created_at: z.string(),
  resolvable: z.boolean().optional(),
  resolved: z.boolean().optional(),
  position: z.object({
    new_path: z.string(),
    old_path: z.string(),
    new_line: z.number().nullable(),
    old_line: z.number().nullable(),
  }).optional(),
});

// Optimized Discussion schema - streamlined for AI agents
export const OptimizedGitLabDiscussionSchema = z.object({
  id: z.string(),
  notes: z.array(OptimizedGitLabDiscussionNoteSchema),
});

// Full Discussion Note schema (for validation of GitLab API responses)
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

// Full Discussion schema (for validation of GitLab API responses)
export const GitLabDiscussionSchema = z.object({
  id: z.string(),
  individual_note: z.boolean(),
  notes: z.array(GitLabDiscussionNoteSchema),
});

/**
 * Transform full GitLab discussion response to optimized format for AI code review
 */
export function streamlineDiscussion(fullDiscussion: any): z.infer<typeof OptimizedGitLabDiscussionSchema> {
  return {
    id: fullDiscussion.id,
    notes: fullDiscussion.notes?.map((note: any) => ({
      id: note.id,
      type: note.type,
      body: note.body,
      author: {
        username: note.author?.username,
      },
      created_at: note.created_at,
      resolvable: note.resolvable,
      resolved: note.resolved,
      position: note.position ? {
        new_path: note.position.new_path,
        old_path: note.position.old_path,
        new_line: note.position.new_line,
        old_line: note.position.old_line,
      } : undefined,
    })) || [],
  };
}

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
export type OptimizedGitLabMergeRequest = z.infer<typeof OptimizedGitLabMergeRequestSchema>;
export type GitLabDiscussionNote = z.infer<typeof GitLabDiscussionNoteSchema>;
export type OptimizedGitLabDiscussionNote = z.infer<typeof OptimizedGitLabDiscussionNoteSchema>;
export type GitLabDiscussion = z.infer<typeof GitLabDiscussionSchema>;
export type OptimizedGitLabDiscussion = z.infer<typeof OptimizedGitLabDiscussionSchema>; 