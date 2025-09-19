import { z } from 'zod';
import { flexibleBoolean } from '../utils';
import { ProjectParamsSchema } from '../shared';

// WRITE MERGE REQUEST OPERATION SCHEMAS

// Merge request thread position schema - used for diff notes
export const MergeRequestThreadPositionCreateSchema = z.object({
  base_sha: z
    .string()
    .describe('Base commit SHA where the MR diverged from target. Used for three-way diff.')
    .optional(),
  start_sha: z
    .string()
    .describe('Starting commit SHA in target branch for diff comparison context.')
    .optional(),
  head_sha: z
    .string()
    .describe('Latest commit SHA in the MR source branch. Points to current MR HEAD.')
    .optional(),
  position_type: z
    .enum(['text', 'image'])
    .optional()
    .describe('Comment type: text=code/text comment, image=comment on image diff.'),
  old_path: z
    .string()
    .optional()
    .describe('Original file path before changes. Used for renamed/moved files.'),
  new_path: z
    .string()
    .optional()
    .describe('Current file path after changes. Same as old_path if not renamed.'),
  old_line: z
    .number()
    .optional()
    .describe('Line number in original file (left side of diff). For removed/modified lines.'),
  new_line: z
    .number()
    .optional()
    .describe('Line number in changed file (right side of diff). For added/modified lines.'),
  line_range: z
    .object({
      start: z.object({
        line_code: z.string(),
        type: z.enum(['new', 'old']).optional(),
        old_line: z.number().optional(),
        new_line: z.number().optional(),
      }),
      end: z.object({
        line_code: z.string(),
        type: z.enum(['new', 'old']).optional(),
        old_line: z.number().optional(),
        new_line: z.number().optional(),
      }),
    })
    .optional()
    .describe(
      'Define start and end points for comments spanning multiple lines. Enables code range discussions.',
    ),
  width: z
    .number()
    .optional()
    .describe('Image width in pixels. Required for image position comments.'),
  height: z
    .number()
    .optional()
    .describe('Image height in pixels. Required for image position comments.'),
  x: z.number().optional().describe('Horizontal pixel position for image comment. 0 is left edge.'),
  y: z.number().optional().describe('Vertical pixel position for image comment. 0 is top edge.'),
});

// Merge request operations (write)
const MergeRequestOptionsSchema = {
  source_branch: z
    .string()
    .min(1)
    .describe(
      'Branch containing changes to merge. Example: "feature-login". Must exist in repository.',
    ),
  target_branch: z
    .string()
    .min(1)
    .describe(
      'Branch to merge into. Usually "main" or "master". Must exist and be different from source.',
    ),
  title: z
    .string()
    .min(1)
    .describe(
      'MR title/summary. Should clearly describe the changes. Example: "Add user authentication".',
    ),
  assignee_id: z
    .string()
    .optional()
    .describe(
      'Single assignee user ID. Person responsible for MR. Deprecated - use assignee_ids instead.',
    ),
  assignee_ids: z
    .array(z.string())
    .optional()
    .describe(
      'Multiple assignee IDs. People responsible for completing the MR. Overrides assignee_id.',
    ),
  reviewer_ids: z
    .array(z.string())
    .optional()
    .describe(
      'User IDs for code reviewers. Different from assignees - reviewers provide feedback.',
    ),
  description: z
    .string()
    .optional()
    .describe('Detailed MR description. Supports Markdown. Explain what changed and why.'),
  target_project_id: z.coerce
    .string()
    .optional()
    .describe(
      'Target project for cross-project MRs. Use when merging between forks. Defaults to source project.',
    ),
  labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe(
      'Labels to categorize MR. Pass single string, comma-separated, or array. Example: ["bug", "priority::high"].',
    ),
  milestone_id: z
    .string()
    .optional()
    .describe('Associate MR with milestone for release planning. Use milestone ID, not title.'),
  remove_source_branch: flexibleBoolean
    .optional()
    .describe('Auto-delete source branch after merge. Keeps repository clean. Default: false.'),
  allow_collaboration: flexibleBoolean
    .optional()
    .describe(
      'Let target branch maintainers push to source branch. Enables collaboration on forks.',
    ),
  allow_maintainer_to_push: flexibleBoolean
    .optional()
    .describe('Deprecated - use allow_collaboration. Let maintainers push to fork source branch.'),
  squash: flexibleBoolean
    .optional()
    .describe(
      'Combine all commits into one when merging. Creates cleaner history. Follows project settings if not set.',
    ),
};

export const CreateMergeRequestOptionsSchema = z.object(MergeRequestOptionsSchema);
export const CreateMergeRequestSchema = ProjectParamsSchema.extend(MergeRequestOptionsSchema);

export const UpdateMergeRequestSchema = z.object({
  project_id: z.coerce.string().describe('Project ID or URL-encoded path'),
  merge_request_iid: z.coerce.string().describe('The internal ID of the merge request'),
  target_branch: z.string().optional().describe('Target branch'),
  title: z.string().optional().describe('Title of MR'),
  assignee_id: z
    .string()
    .optional()
    .describe(
      'Single assignee user ID. Person responsible for MR. Deprecated - use assignee_ids instead.',
    ),
  assignee_ids: z
    .array(z.string())
    .optional()
    .describe(
      'Multiple assignee IDs. People responsible for completing the MR. Overrides assignee_id.',
    ),
  reviewer_ids: z
    .array(z.string())
    .optional()
    .describe(
      'User IDs for code reviewers. Different from assignees - reviewers provide feedback.',
    ),
  description: z
    .string()
    .optional()
    .describe('Detailed MR description. Supports Markdown. Explain what changed and why.'),
  labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe(
      'Labels to categorize MR. Pass single string, comma-separated, or array. Example: ["bug", "priority::high"].',
    ),
  add_labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe('Labels to add to MR'),
  remove_labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe('Labels to remove from MR'),
  state_event: z
    .string()
    .transform((val) => val.toLowerCase())
    .pipe(z.enum(['close', 'reopen']))
    .optional()
    .describe('State event for MR'),
  remove_source_branch: flexibleBoolean
    .optional()
    .describe('Auto-delete source branch after merge. Keeps repository clean. Default: false.'),
  squash: flexibleBoolean
    .optional()
    .describe(
      'Combine all commits into one when merging. Creates cleaner history. Follows project settings if not set.',
    ),
  discussion_locked: flexibleBoolean.optional().describe('Lock discussion thread'),
  allow_collaboration: flexibleBoolean
    .optional()
    .describe(
      'Let target branch maintainers push to source branch. Enables collaboration on forks.',
    ),
  allow_maintainer_to_push: flexibleBoolean
    .optional()
    .describe('Deprecated - use allow_collaboration. Let maintainers push to fork source branch.'),
  milestone_id: z
    .string()
    .optional()
    .describe('Associate MR with milestone for release planning. Use milestone ID, not title.'),
});

// Merge operations (write)
export const MergeMergeRequestSchema = z.object({
  project_id: z.coerce.string().describe('Project ID or URL-encoded path'),
  merge_request_iid: z.coerce.string().describe('The internal ID of the merge request'),
  merge_commit_message: z.string().optional().describe('Custom merge commit message'),
  squash_commit_message: z.string().optional().describe('Custom squash commit message'),
  should_remove_source_branch: flexibleBoolean
    .optional()
    .describe('Remove source branch after merge'),
  merge_when_pipeline_succeeds: flexibleBoolean.optional().describe('Merge when pipeline succeeds'),
  sha: z.string().optional().describe('SHA of the head commit'),
  squash: flexibleBoolean.optional().describe('Squash commits when merging'),
});

// Note operations (write)
export const CreateNoteSchema = z.object({
  project_id: z.coerce.string().describe('Project ID or URL-encoded path'),
  noteable_type: z
    .string()
    .transform((val) => val.toLowerCase())
    .pipe(z.enum(['issue', 'merge_request']))
    .describe('Type of noteable object'),
  noteable_id: z.coerce.string().describe('ID of the noteable object'),
  body: z.string().describe('The content of a note'),
  created_at: z.string().optional().describe('Date time string, ISO 8601 formatted'),
  confidential: flexibleBoolean.optional().describe('Confidential note flag'),
});

// Merge request thread operations (write)
export const CreateMergeRequestThreadSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe('The internal ID of the merge request'),
  body: z.string().describe('The content of the thread'),
  position: MergeRequestThreadPositionCreateSchema.optional().describe(
    'Position when creating a diff note',
  ),
  commit_id: z.string().optional().describe('SHA referencing commit to start discussion on'),
});

// Merge request note operations (write)
export const UpdateMergeRequestNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe('The internal ID of the merge request'),
  note_id: z.coerce.string().describe('The ID of the note'),
  body: z.string().describe('The content of a note'),
});

export const CreateMergeRequestNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe('The internal ID of the merge request'),
  discussion_id: z.string().describe('The ID of a discussion'),
  body: z.string().describe('The content of a note'),
  created_at: z.string().optional().describe('Date time string, ISO 8601 formatted'),
});

// Draft note operations (write)
export const CreateDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe('The internal ID of the merge request'),
  note: z.string().describe('The content of a note'),
  position: MergeRequestThreadPositionCreateSchema.optional().describe(
    'Position when creating a diff note',
  ),
  in_reply_to_discussion_id: z.string().optional().describe('The ID of a discussion to reply to'),
  commit_id: z.string().optional().describe('SHA referencing commit to start discussion on'),
});

export const UpdateDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe('The internal ID of the merge request'),
  draft_note_id: z.coerce.string().describe('The ID of the draft note'),
  note: z.string().describe('The content of a note'),
  position: MergeRequestThreadPositionCreateSchema.optional().describe(
    'Position when creating a diff note',
  ),
});

export const DeleteDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe('The internal ID of the merge request'),
  draft_note_id: z.coerce.string().describe('The ID of the draft note'),
});

// Draft note publishing operations (write)
export const PublishDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe('The internal ID of the merge request'),
  draft_note_id: z.coerce.string().describe('The ID of the draft note'),
});

export const BulkPublishDraftNotesSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string().describe('The internal ID of the merge request'),
});

// Export type definitions
export type CreateMergeRequestOptions = z.infer<typeof CreateMergeRequestSchema>;
export type UpdateMergeRequestOptions = z.infer<typeof UpdateMergeRequestSchema>;
export type MergeMergeRequestOptions = z.infer<typeof MergeMergeRequestSchema>;
export type CreateNoteOptions = z.infer<typeof CreateNoteSchema>;
export type MergeRequestThreadPositionCreate = z.infer<
  typeof MergeRequestThreadPositionCreateSchema
>;
export type CreateMergeRequestThreadOptions = z.infer<typeof CreateMergeRequestThreadSchema>;
export type UpdateMergeRequestNoteOptions = z.infer<typeof UpdateMergeRequestNoteSchema>;
export type CreateMergeRequestNoteOptions = z.infer<typeof CreateMergeRequestNoteSchema>;
export type CreateDraftNoteOptions = z.infer<typeof CreateDraftNoteSchema>;
export type UpdateDraftNoteOptions = z.infer<typeof UpdateDraftNoteSchema>;
export type DeleteDraftNoteOptions = z.infer<typeof DeleteDraftNoteSchema>;
export type PublishDraftNoteOptions = z.infer<typeof PublishDraftNoteSchema>;
export type BulkPublishDraftNotesOptions = z.infer<typeof BulkPublishDraftNotesSchema>;
