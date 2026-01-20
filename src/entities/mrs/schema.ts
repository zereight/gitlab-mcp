import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

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
// manage_merge_request - CQRS Command Tool (discriminated union schema)
// Actions: create, update, merge
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const projectIdField = requiredId.describe("Project ID or URL-encoded path");
const mergeRequestIidField = requiredId.describe("Internal MR ID unique to project");

// --- Action: create ---
const CreateMergeRequestSchema = z.object({
  action: z.literal("create").describe("Create a new merge request"),
  project_id: projectIdField,
  source_branch: z.string().describe("Branch containing changes to merge"),
  target_branch: z.string().describe("Branch to merge into"),
  title: z.string().describe("MR title/summary"),
  assignee_id: z.string().optional().describe("Single assignee user ID"),
  assignee_ids: z.array(z.string()).optional().describe("Multiple assignee IDs"),
  reviewer_ids: z.array(z.string()).optional().describe("User IDs for code reviewers"),
  description: z.string().optional().describe("MR description (Markdown)"),
  target_project_id: z.coerce.string().optional().describe("Target project for cross-project MRs"),
  labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Labels to categorize MR"),
  milestone_id: z.string().optional().describe("Associate MR with milestone"),
  remove_source_branch: flexibleBoolean
    .optional()
    .describe("Auto-delete source branch after merge"),
  allow_collaboration: flexibleBoolean.optional().describe("Let maintainers push to source branch"),
  allow_maintainer_to_push: flexibleBoolean
    .optional()
    .describe("Deprecated - use allow_collaboration"),
  squash: flexibleBoolean.optional().describe("Combine all commits into one when merging"),
});

// --- Action: update ---
const UpdateMergeRequestSchema = z.object({
  action: z.literal("update").describe("Update an existing merge request"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  target_branch: z.string().optional().describe("Branch to merge into"),
  title: z.string().optional().describe("MR title/summary"),
  assignee_id: z.string().optional().describe("Single assignee user ID"),
  assignee_ids: z.array(z.string()).optional().describe("Multiple assignee IDs"),
  reviewer_ids: z.array(z.string()).optional().describe("User IDs for code reviewers"),
  description: z.string().optional().describe("MR description (Markdown)"),
  labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Labels to categorize MR"),
  add_labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Labels to add"),
  remove_labels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Labels to remove"),
  milestone_id: z.string().optional().describe("Associate MR with milestone"),
  remove_source_branch: flexibleBoolean
    .optional()
    .describe("Auto-delete source branch after merge"),
  allow_collaboration: flexibleBoolean.optional().describe("Let maintainers push to source branch"),
  allow_maintainer_to_push: flexibleBoolean
    .optional()
    .describe("Deprecated - use allow_collaboration"),
  squash: flexibleBoolean.optional().describe("Combine all commits into one when merging"),
  state_event: z
    .string()
    .transform(val => val.toLowerCase())
    .pipe(z.enum(["close", "reopen"]))
    .optional()
    .describe("State event: close or reopen"),
  discussion_locked: flexibleBoolean.optional().describe("Lock discussion thread"),
});

// --- Action: merge ---
const MergeMergeRequestSchema = z.object({
  action: z.literal("merge").describe("Merge an approved merge request"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  merge_commit_message: z.string().optional().describe("Custom merge commit message"),
  squash_commit_message: z.string().optional().describe("Custom squash commit message"),
  squash: flexibleBoolean.optional().describe("Combine all commits into one when merging"),
  should_remove_source_branch: flexibleBoolean
    .optional()
    .describe("Remove source branch after merge"),
  merge_when_pipeline_succeeds: flexibleBoolean.optional().describe("Merge when pipeline succeeds"),
  sha: z.string().optional().describe("SHA of the head commit"),
});

// --- Discriminated union combining all actions ---
export const ManageMergeRequestSchema = z.discriminatedUnion("action", [
  CreateMergeRequestSchema,
  UpdateMergeRequestSchema,
  MergeMergeRequestSchema,
]);

// ============================================================================
// manage_mr_discussion - CQRS Command Tool (discriminated union schema)
// Actions: comment, thread, reply, update, apply_suggestion, apply_suggestions
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Action: comment ---
const CommentOnNoteableSchema = z.object({
  action: z.literal("comment").describe("Add a comment to an issue or merge request"),
  project_id: projectIdField,
  noteable_type: z
    .string()
    .transform(val => val.toLowerCase())
    .pipe(z.enum(["issue", "merge_request"]))
    .describe("Type of noteable: issue or merge_request"),
  noteable_id: requiredId.describe("ID of the noteable object"),
  body: z.string().describe("Content/text of the comment"),
  confidential: flexibleBoolean.optional().describe("Confidential note flag"),
  created_at: z.string().optional().describe("Date time string (ISO 8601)"),
});

// --- Action: thread ---
const CreateThreadSchema = z.object({
  action: z.literal("thread").describe("Start a new discussion thread on an MR"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  body: z.string().describe("Content/text of the thread"),
  position: MergeRequestThreadPositionSchema.optional().describe("Position for diff note"),
  commit_id: z.string().optional().describe("SHA of commit to start discussion on"),
});

// --- Action: reply ---
const ReplyToThreadSchema = z.object({
  action: z.literal("reply").describe("Reply to an existing discussion thread"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  discussion_id: z.string().describe("ID of the discussion to reply to"),
  body: z.string().describe("Content/text of the reply"),
  created_at: z.string().optional().describe("Date time string (ISO 8601)"),
});

// --- Action: update ---
const UpdateNoteSchema = z.object({
  action: z.literal("update").describe("Update an existing note/comment"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  note_id: requiredId.describe("ID of the note to update"),
  body: z.string().describe("New content/text for the note"),
});

// --- Action: apply_suggestion ---
const ApplySuggestionSchema = z.object({
  action: z.literal("apply_suggestion").describe("Apply a single code suggestion from a review"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  suggestion_id: z.number().describe("ID of the suggestion to apply"),
  commit_message: z.string().optional().describe("Custom commit message for the apply commit"),
});

// --- Action: apply_suggestions ---
const ApplySuggestionsSchema = z.object({
  action: z.literal("apply_suggestions").describe("Batch apply multiple code suggestions"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  suggestion_ids: z.array(z.number()).min(1).describe("Array of suggestion IDs to apply"),
  commit_message: z.string().optional().describe("Custom commit message for the apply commit"),
});

// --- Discriminated union combining all actions ---
export const ManageMrDiscussionSchema = z.discriminatedUnion("action", [
  CommentOnNoteableSchema,
  CreateThreadSchema,
  ReplyToThreadSchema,
  UpdateNoteSchema,
  ApplySuggestionSchema,
  ApplySuggestionsSchema,
]);

// ============================================================================
// manage_draft_notes - CQRS Command Tool (discriminated union schema)
// Actions: create, update, publish, publish_all, delete
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const draftNoteIdField = requiredId.describe("ID of the draft note");

// --- Action: create ---
const CreateDraftNoteSchema = z.object({
  action: z.literal("create").describe("Create a new draft note"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  note: z.string().describe("Content of the draft note"),
  position: MergeRequestThreadPositionSchema.optional().describe("Position for diff note"),
  in_reply_to_discussion_id: z.string().optional().describe("Discussion ID to reply to"),
  commit_id: z.string().optional().describe("SHA of commit to start discussion on"),
});

// --- Action: update ---
const UpdateDraftNoteSchema = z.object({
  action: z.literal("update").describe("Update an existing draft note"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  draft_note_id: draftNoteIdField,
  note: z.string().describe("New content for the draft note"),
  position: MergeRequestThreadPositionSchema.optional().describe("Position for diff note"),
});

// --- Action: publish ---
const PublishDraftNoteSchema = z.object({
  action: z.literal("publish").describe("Publish a single draft note"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  draft_note_id: draftNoteIdField,
});

// --- Action: publish_all ---
const PublishAllDraftNotesSchema = z.object({
  action: z.literal("publish_all").describe("Publish all draft notes at once"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
});

// --- Action: delete ---
const DeleteDraftNoteSchema = z.object({
  action: z.literal("delete").describe("Delete a draft note"),
  project_id: projectIdField,
  merge_request_iid: mergeRequestIidField,
  draft_note_id: draftNoteIdField,
});

// --- Discriminated union combining all actions ---
export const ManageDraftNotesSchema = z.discriminatedUnion("action", [
  CreateDraftNoteSchema,
  UpdateDraftNoteSchema,
  PublishDraftNoteSchema,
  PublishAllDraftNotesSchema,
  DeleteDraftNoteSchema,
]);

// ============================================================================
// Export type definitions
// ============================================================================

export type ManageMergeRequestInput = z.infer<typeof ManageMergeRequestSchema>;
export type ManageMrDiscussionInput = z.infer<typeof ManageMrDiscussionSchema>;
export type ManageDraftNotesInput = z.infer<typeof ManageDraftNotesSchema>;
export type MergeRequestThreadPosition = z.infer<typeof MergeRequestThreadPositionSchema>;
