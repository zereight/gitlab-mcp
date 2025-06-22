import { z } from "zod";
import { GitLabUserSchema, ProjectParamsSchema } from "./base.js";

// Optimized Discussion Note schema - only essential fields for AI code review responses
export const OptimizedGitLabDiscussionNoteSchema = z.object({
  id: z.number(),
  body: z.string(),
  author: z.object({
    username: z.string(),
  }),
  resolvable: z.boolean().optional(),
  resolved: z.boolean().optional(),
  position: z.object({
    new_path: z.string(),
    new_line: z.number().nullable(),
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
      body: note.body,
      author: {
        username: note.author?.username,
      },
      resolvable: note.resolvable,
      resolved: note.resolved,
      position: note.position ? {
        new_path: note.position.new_path,
        new_line: note.position.new_line,
      } : undefined,
    })) || [],
  };
}

// Paginated Discussion Response schema - for client-side pagination
export const PaginatedDiscussionResponseSchema = z.object({
  total_unresolved: z.number().describe("Total number of unresolved discussions"),
  total_pages: z.number().describe("Total number of pages"),
  current_page: z.number().describe("Current page number"),
  per_page: z.number().describe("Number of discussions per page"),
  discussions: z.array(OptimizedGitLabDiscussionSchema).describe("Discussions for current page"),
});

// Schema for creating a new merge request note/discussion
export const CreateMergeRequestNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.number().describe("The IID of a merge request"),
  body: z.string().describe("The content of the note"),
  position: z.object({
    base_sha: z.string().describe("Base commit SHA in the source branch"),
    head_sha: z.string().describe("SHA referencing HEAD of the source branch"),
    start_sha: z.string().describe("SHA referencing commit in the target branch"),
    position_type: z.enum(["text", "image", "file"]).describe("Type of position reference"),
    new_path: z.string().optional().describe("File path after change"),
    old_path: z.string().optional().describe("File path before change"),
    new_line: z.number().nullable().optional().describe("Line number after change"),
    old_line: z.number().nullable().optional().describe("Line number before change"),
  }).optional().describe("Position when creating a diff note"),
  created_at: z.string().optional().describe("Date the note was created at (ISO 8601 format)"),
});

// Types
export type GitLabDiscussionNote = z.infer<typeof GitLabDiscussionNoteSchema>;
export type OptimizedGitLabDiscussionNote = z.infer<typeof OptimizedGitLabDiscussionNoteSchema>;
export type GitLabDiscussion = z.infer<typeof GitLabDiscussionSchema>;
export type OptimizedGitLabDiscussion = z.infer<typeof OptimizedGitLabDiscussionSchema>;
export type PaginatedDiscussionResponse = z.infer<typeof PaginatedDiscussionResponseSchema>;
export type CreateMergeRequestNoteOptions = z.infer<typeof CreateMergeRequestNoteSchema>; 