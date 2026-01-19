import { z } from "zod";
import { flexibleBoolean } from "../utils";
import { ProjectParamsSchema } from "../shared";

// ============================================================================
// Shared position schema for diff notes
// ============================================================================

export const MergeRequestThreadPositionSchema = z.object({
  base_sha: z.string().optional().describe("Base commit SHA for three-way diff."),
  start_sha: z.string().optional().describe("Starting commit SHA in target branch."),
  head_sha: z.string().optional().describe("Latest commit SHA in MR source branch."),
  position_type: z.enum(["text", "image"]).optional().describe("Comment type: text or image."),
  old_path: z.string().optional().describe("Original file path before changes."),
  new_path: z.string().optional().describe("Current file path after changes."),
  old_line: z.number().optional().describe("Line number in original file."),
  new_line: z.number().optional().describe("Line number in changed file."),
  line_range: z
    .object({
      start: z.object({
        line_code: z.string(),
        type: z.enum(["new", "old"]).optional(),
        old_line: z.number().optional(),
        new_line: z.number().optional(),
      }),
      end: z.object({
        line_code: z.string(),
        type: z.enum(["new", "old"]).optional(),
        old_line: z.number().optional(),
        new_line: z.number().optional(),
      }),
    })
    .optional()
    .describe("Line range for multi-line comments."),
  width: z.number().optional().describe("Image width in pixels."),
  height: z.number().optional().describe("Image height in pixels."),
  x: z.number().optional().describe("Horizontal pixel position for image comment."),
  y: z.number().optional().describe("Vertical pixel position for image comment."),
});

// ============================================================================
// manage_merge_request - CQRS Command Tool (discriminated union)
// Actions: create, update, merge
// ============================================================================

const ManageMRBaseSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
});

// Create merge request action
const ManageMRCreateSchema = ManageMRBaseSchema.extend({
  action: z.literal("create"),
  source_branch: z.string().min(1).describe("Branch containing changes to merge."),
  target_branch: z.string().min(1).describe("Branch to merge into."),
  title: z.string().min(1).describe("MR title/summary."),
  assignee_id: z.string().optional().describe("Single assignee user ID."),
  assignee_ids: z.array(z.string()).optional().describe("Multiple assignee IDs."),
  reviewer_ids: z.array(z.string()).optional().describe("User IDs for code reviewers."),
  description: z.string().optional().describe("Detailed MR description (Markdown)."),
  target_project_id: z.coerce.string().optional().describe("Target project for cross-project MRs."),
  labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Labels to categorize MR."),
  milestone_id: z.string().optional().describe("Associate MR with milestone."),
  remove_source_branch: flexibleBoolean
    .optional()
    .describe("Auto-delete source branch after merge."),
  allow_collaboration: flexibleBoolean
    .optional()
    .describe("Let maintainers push to source branch."),
  allow_maintainer_to_push: flexibleBoolean
    .optional()
    .describe("Deprecated - use allow_collaboration."),
  squash: flexibleBoolean.optional().describe("Combine all commits into one when merging."),
});

// Update merge request action
const ManageMRUpdateSchema = ManageMRBaseSchema.extend({
  action: z.literal("update"),
  merge_request_iid: z.coerce.string().describe("Internal MR ID unique to project."),
  target_branch: z.string().optional().describe("Target branch."),
  title: z.string().optional().describe("MR title."),
  assignee_id: z.string().optional().describe("Single assignee user ID."),
  assignee_ids: z.array(z.string()).optional().describe("Multiple assignee IDs."),
  reviewer_ids: z.array(z.string()).optional().describe("User IDs for code reviewers."),
  description: z.string().optional().describe("MR description (Markdown)."),
  labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Labels to set."),
  add_labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Labels to add."),
  remove_labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Labels to remove."),
  state_event: z
    .string()
    .transform(val => val.toLowerCase())
    .pipe(z.enum(["close", "reopen"]))
    .optional()
    .describe("State event: close or reopen."),
  remove_source_branch: flexibleBoolean
    .optional()
    .describe("Auto-delete source branch after merge."),
  squash: flexibleBoolean.optional().describe("Combine all commits into one when merging."),
  discussion_locked: flexibleBoolean.optional().describe("Lock discussion thread."),
  allow_collaboration: flexibleBoolean
    .optional()
    .describe("Let maintainers push to source branch."),
  allow_maintainer_to_push: flexibleBoolean
    .optional()
    .describe("Deprecated - use allow_collaboration."),
  milestone_id: z.string().optional().describe("Associate MR with milestone."),
});

// Merge merge request action
const ManageMRMergeSchema = ManageMRBaseSchema.extend({
  action: z.literal("merge"),
  merge_request_iid: z.coerce.string().describe("Internal MR ID unique to project."),
  merge_commit_message: z.string().optional().describe("Custom merge commit message."),
  squash_commit_message: z.string().optional().describe("Custom squash commit message."),
  should_remove_source_branch: flexibleBoolean
    .optional()
    .describe("Remove source branch after merge."),
  merge_when_pipeline_succeeds: flexibleBoolean
    .optional()
    .describe("Merge when pipeline succeeds."),
  sha: z.string().optional().describe("SHA of the head commit."),
  squash: flexibleBoolean.optional().describe("Squash commits when merging."),
});

export const ManageMergeRequestSchema = z.discriminatedUnion("action", [
  ManageMRCreateSchema,
  ManageMRUpdateSchema,
  ManageMRMergeSchema,
]);

// ============================================================================
// manage_mr_discussion - CQRS Command Tool (discriminated union)
// Actions: comment, thread, reply, update
// ============================================================================

const ManageDiscussionBaseSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
});

// Add comment to issue or merge request
const ManageDiscussionCommentSchema = ManageDiscussionBaseSchema.extend({
  action: z.literal("comment"),
  noteable_type: z
    .string()
    .transform(val => val.toLowerCase())
    .pipe(z.enum(["issue", "merge_request"]))
    .describe("Type of noteable: issue or merge_request."),
  noteable_id: z.coerce.string().describe("ID of the noteable object."),
  body: z.string().describe("Content of the comment."),
  created_at: z.string().optional().describe("Date time string (ISO 8601)."),
  confidential: flexibleBoolean.optional().describe("Confidential note flag."),
});

// Start new discussion thread on merge request
const ManageDiscussionThreadSchema = ManageDiscussionBaseSchema.extend({
  action: z.literal("thread"),
  merge_request_iid: z.coerce.string().describe("Internal MR ID."),
  body: z.string().describe("Content of the thread."),
  position: MergeRequestThreadPositionSchema.optional().describe("Position for diff note."),
  commit_id: z.string().optional().describe("SHA of commit to start discussion on."),
});

// Reply to existing discussion thread
const ManageDiscussionReplySchema = ManageDiscussionBaseSchema.extend({
  action: z.literal("reply"),
  merge_request_iid: z.coerce.string().describe("Internal MR ID."),
  discussion_id: z.string().describe("ID of the discussion to reply to."),
  body: z.string().describe("Content of the reply."),
  created_at: z.string().optional().describe("Date time string (ISO 8601)."),
});

// Update existing note in discussion
const ManageDiscussionUpdateSchema = ManageDiscussionBaseSchema.extend({
  action: z.literal("update"),
  merge_request_iid: z.coerce.string().describe("Internal MR ID."),
  note_id: z.coerce.string().describe("ID of the note to update."),
  body: z.string().describe("New content of the note."),
});

export const ManageMrDiscussionSchema = z.discriminatedUnion("action", [
  ManageDiscussionCommentSchema,
  ManageDiscussionThreadSchema,
  ManageDiscussionReplySchema,
  ManageDiscussionUpdateSchema,
]);

// ============================================================================
// manage_draft_notes - CQRS Command Tool (discriminated union)
// Actions: create, update, publish, publish_all, delete
// ============================================================================

const ManageDraftBaseSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  merge_request_iid: z.coerce.string().describe("Internal MR ID unique to project."),
});

// Create draft note
const ManageDraftCreateSchema = ManageDraftBaseSchema.extend({
  action: z.literal("create"),
  note: z.string().describe("Content of the draft note."),
  position: MergeRequestThreadPositionSchema.optional().describe("Position for diff note."),
  in_reply_to_discussion_id: z.string().optional().describe("Discussion ID to reply to."),
  commit_id: z.string().optional().describe("SHA of commit to start discussion on."),
});

// Update draft note
const ManageDraftUpdateSchema = ManageDraftBaseSchema.extend({
  action: z.literal("update"),
  draft_note_id: z.coerce.string().describe("ID of the draft note."),
  note: z.string().describe("New content of the draft note."),
  position: MergeRequestThreadPositionSchema.optional().describe("Position for diff note."),
});

// Publish single draft note
const ManageDraftPublishSchema = ManageDraftBaseSchema.extend({
  action: z.literal("publish"),
  draft_note_id: z.coerce.string().describe("ID of the draft note to publish."),
});

// Publish all draft notes
const ManageDraftPublishAllSchema = ManageDraftBaseSchema.extend({
  action: z.literal("publish_all"),
});

// Delete draft note
const ManageDraftDeleteSchema = ManageDraftBaseSchema.extend({
  action: z.literal("delete"),
  draft_note_id: z.coerce.string().describe("ID of the draft note to delete."),
});

export const ManageDraftNotesSchema = z.discriminatedUnion("action", [
  ManageDraftCreateSchema,
  ManageDraftUpdateSchema,
  ManageDraftPublishSchema,
  ManageDraftPublishAllSchema,
  ManageDraftDeleteSchema,
]);

// ============================================================================
// Legacy schemas (kept for backward compatibility during transition)
// ============================================================================

// Thread position schema - legacy alias
export const MergeRequestThreadPositionCreateSchema = MergeRequestThreadPositionSchema;

// Merge request operations (write) - legacy
const MergeRequestOptionsSchema = {
  source_branch: z.string().min(1).describe("Branch containing changes to merge."),
  target_branch: z.string().min(1).describe("Branch to merge into."),
  title: z.string().min(1).describe("MR title/summary."),
  assignee_id: z.string().optional().describe("Single assignee user ID."),
  assignee_ids: z.array(z.string()).optional().describe("Multiple assignee IDs."),
  reviewer_ids: z.array(z.string()).optional().describe("User IDs for code reviewers."),
  description: z.string().optional().describe("Detailed MR description."),
  target_project_id: z.coerce.string().optional().describe("Target project for cross-project MRs."),
  labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Labels to categorize MR."),
  milestone_id: z.string().optional().describe("Associate MR with milestone."),
  remove_source_branch: flexibleBoolean
    .optional()
    .describe("Auto-delete source branch after merge."),
  allow_collaboration: flexibleBoolean
    .optional()
    .describe("Let maintainers push to source branch."),
  allow_maintainer_to_push: flexibleBoolean
    .optional()
    .describe("Deprecated - use allow_collaboration."),
  squash: flexibleBoolean.optional().describe("Combine all commits into one when merging."),
};

export const CreateMergeRequestOptionsSchema = z.object(MergeRequestOptionsSchema);
export const CreateMergeRequestSchema = ProjectParamsSchema.extend(MergeRequestOptionsSchema);

export const UpdateMergeRequestSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  merge_request_iid: z.coerce.string().describe("The internal ID of the merge request"),
  target_branch: z.string().optional(),
  title: z.string().optional(),
  assignee_id: z.string().optional(),
  assignee_ids: z.array(z.string()).optional(),
  reviewer_ids: z.array(z.string()).optional(),
  description: z.string().optional(),
  labels: z.union([z.string(), z.array(z.string())]).optional(),
  add_labels: z.union([z.string(), z.array(z.string())]).optional(),
  remove_labels: z.union([z.string(), z.array(z.string())]).optional(),
  state_event: z
    .string()
    .transform(val => val.toLowerCase())
    .pipe(z.enum(["close", "reopen"]))
    .optional(),
  remove_source_branch: flexibleBoolean.optional(),
  squash: flexibleBoolean.optional(),
  discussion_locked: flexibleBoolean.optional(),
  allow_collaboration: flexibleBoolean.optional(),
  allow_maintainer_to_push: flexibleBoolean.optional(),
  milestone_id: z.string().optional(),
});

export const MergeMergeRequestSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  merge_request_iid: z.coerce.string().describe("The internal ID of the merge request"),
  merge_commit_message: z.string().optional(),
  squash_commit_message: z.string().optional(),
  should_remove_source_branch: flexibleBoolean.optional(),
  merge_when_pipeline_succeeds: flexibleBoolean.optional(),
  sha: z.string().optional(),
  squash: flexibleBoolean.optional(),
});

export const CreateNoteSchema = z.object({
  project_id: z.coerce.string().describe("Project ID or URL-encoded path"),
  noteable_type: z
    .string()
    .transform(val => val.toLowerCase())
    .pipe(z.enum(["issue", "merge_request"])),
  noteable_id: z.coerce.string(),
  body: z.string(),
  created_at: z.string().optional(),
  confidential: flexibleBoolean.optional(),
});

export const CreateMergeRequestThreadSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string(),
  body: z.string(),
  position: MergeRequestThreadPositionSchema.optional(),
  commit_id: z.string().optional(),
});

export const UpdateMergeRequestNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string(),
  note_id: z.coerce.string(),
  body: z.string(),
});

export const CreateMergeRequestNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string(),
  discussion_id: z.string(),
  body: z.string(),
  created_at: z.string().optional(),
});

export const CreateDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string(),
  note: z.string(),
  position: MergeRequestThreadPositionSchema.optional(),
  in_reply_to_discussion_id: z.string().optional(),
  commit_id: z.string().optional(),
});

export const UpdateDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string(),
  draft_note_id: z.coerce.string(),
  note: z.string(),
  position: MergeRequestThreadPositionSchema.optional(),
});

export const DeleteDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string(),
  draft_note_id: z.coerce.string(),
});

export const PublishDraftNoteSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string(),
  draft_note_id: z.coerce.string(),
});

export const BulkPublishDraftNotesSchema = ProjectParamsSchema.extend({
  merge_request_iid: z.coerce.string(),
});

// Export type definitions
export type ManageMergeRequestInput = z.infer<typeof ManageMergeRequestSchema>;
export type ManageMrDiscussionInput = z.infer<typeof ManageMrDiscussionSchema>;
export type ManageDraftNotesInput = z.infer<typeof ManageDraftNotesSchema>;
export type MergeRequestThreadPosition = z.infer<typeof MergeRequestThreadPositionSchema>;
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
