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
// manage_merge_request - CQRS Command Tool (flat schema for Claude API compatibility)
// Actions: create, update, merge
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const ManageMergeRequestSchema = z
  .object({
    action: z.enum(["create", "update", "merge"]).describe("Action to perform"),
    project_id: requiredId.describe("Project ID or URL-encoded path"),
    // create action fields
    source_branch: z
      .string()
      .optional()
      .describe("Branch containing changes to merge. Required for 'create' action."),
    // shared create/update fields
    target_branch: z.string().optional().describe("Branch to merge into."),
    title: z.string().optional().describe("MR title/summary. Required for 'create' action."),
    assignee_id: z.string().optional().describe("Single assignee user ID."),
    assignee_ids: z.array(z.string()).optional().describe("Multiple assignee IDs."),
    reviewer_ids: z.array(z.string()).optional().describe("User IDs for code reviewers."),
    description: z.string().optional().describe("MR description (Markdown)."),
    target_project_id: z.coerce
      .string()
      .optional()
      .describe("Target project for cross-project MRs. For 'create' action."),
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
    // update action fields
    merge_request_iid: requiredId
      .optional()
      .describe("Internal MR ID unique to project. Required for 'update' and 'merge' actions."),
    add_labels: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe("Labels to add. For 'update' action."),
    remove_labels: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe("Labels to remove. For 'update' action."),
    state_event: z
      .string()
      .transform(val => val.toLowerCase())
      .pipe(z.enum(["close", "reopen"]))
      .optional()
      .describe("State event: close or reopen. For 'update' action."),
    discussion_locked: flexibleBoolean
      .optional()
      .describe("Lock discussion thread. For 'update' action."),
    // merge action fields
    merge_commit_message: z
      .string()
      .optional()
      .describe("Custom merge commit message. For 'merge' action."),
    squash_commit_message: z
      .string()
      .optional()
      .describe("Custom squash commit message. For 'merge' action."),
    should_remove_source_branch: flexibleBoolean
      .optional()
      .describe("Remove source branch after merge. For 'merge' action."),
    merge_when_pipeline_succeeds: flexibleBoolean
      .optional()
      .describe("Merge when pipeline succeeds. For 'merge' action."),
    sha: z.string().optional().describe("SHA of the head commit. For 'merge' action."),
  })
  // Required field validations
  .refine(data => data.action !== "create" || data.source_branch !== undefined, {
    message: "source_branch is required for 'create' action",
    path: ["source_branch"],
  })
  .refine(data => data.action !== "create" || data.target_branch !== undefined, {
    message: "target_branch is required for 'create' action",
    path: ["target_branch"],
  })
  .refine(data => data.action !== "create" || data.title !== undefined, {
    message: "title is required for 'create' action",
    path: ["title"],
  })
  .refine(data => data.action === "create" || data.merge_request_iid !== undefined, {
    message: "merge_request_iid is required for 'update' and 'merge' actions",
    path: ["merge_request_iid"],
  })
  // Reject fields not applicable to action
  .refine(data => data.action === "create" || data.source_branch === undefined, {
    message: "source_branch is only valid for 'create' action",
    path: ["source_branch"],
  })
  .refine(data => data.action === "create" || data.target_project_id === undefined, {
    message: "target_project_id is only valid for 'create' action",
    path: ["target_project_id"],
  })
  .refine(data => data.action === "update" || data.add_labels === undefined, {
    message: "add_labels is only valid for 'update' action",
    path: ["add_labels"],
  })
  .refine(data => data.action === "update" || data.remove_labels === undefined, {
    message: "remove_labels is only valid for 'update' action",
    path: ["remove_labels"],
  })
  .refine(data => data.action === "update" || data.state_event === undefined, {
    message: "state_event is only valid for 'update' action",
    path: ["state_event"],
  })
  .refine(data => data.action === "update" || data.discussion_locked === undefined, {
    message: "discussion_locked is only valid for 'update' action",
    path: ["discussion_locked"],
  })
  .refine(data => data.action === "merge" || data.merge_commit_message === undefined, {
    message: "merge_commit_message is only valid for 'merge' action",
    path: ["merge_commit_message"],
  })
  .refine(data => data.action === "merge" || data.squash_commit_message === undefined, {
    message: "squash_commit_message is only valid for 'merge' action",
    path: ["squash_commit_message"],
  })
  .refine(data => data.action === "merge" || data.should_remove_source_branch === undefined, {
    message: "should_remove_source_branch is only valid for 'merge' action",
    path: ["should_remove_source_branch"],
  })
  .refine(data => data.action === "merge" || data.merge_when_pipeline_succeeds === undefined, {
    message: "merge_when_pipeline_succeeds is only valid for 'merge' action",
    path: ["merge_when_pipeline_succeeds"],
  })
  .refine(data => data.action === "merge" || data.sha === undefined, {
    message: "sha is only valid for 'merge' action",
    path: ["sha"],
  })
  .refine(data => data.action !== "merge" || data.target_branch === undefined, {
    message: "target_branch is not valid for 'merge' action",
    path: ["target_branch"],
  })
  .refine(data => data.action !== "merge" || data.title === undefined, {
    message: "title is not valid for 'merge' action",
    path: ["title"],
  });

// ============================================================================
// manage_mr_discussion - CQRS Command Tool (flat schema for Claude API compatibility)
// Actions: comment, thread, reply, update
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const ManageMrDiscussionSchema = z
  .object({
    action: z.enum(["comment", "thread", "reply", "update"]).describe("Action to perform"),
    project_id: requiredId.describe("Project ID or URL-encoded path"),
    // comment action fields
    noteable_type: z
      .string()
      .transform(val => val.toLowerCase())
      .pipe(z.enum(["issue", "merge_request"]))
      .optional()
      .describe("Type of noteable: issue or merge_request. Required for 'comment' action."),
    noteable_id: requiredId
      .optional()
      .describe("ID of the noteable object. Required for 'comment' action."),
    confidential: flexibleBoolean
      .optional()
      .describe("Confidential note flag. For 'comment' action."),
    // thread/reply/update action fields
    merge_request_iid: requiredId
      .optional()
      .describe("Internal MR ID. Required for 'thread', 'reply', 'update' actions."),
    // thread action fields
    position: MergeRequestThreadPositionSchema.optional().describe(
      "Position for diff note. For 'thread' action."
    ),
    commit_id: z
      .string()
      .optional()
      .describe("SHA of commit to start discussion on. For 'thread' action."),
    // reply action fields
    discussion_id: z
      .string()
      .optional()
      .describe("ID of the discussion to reply to. Required for 'reply' action."),
    // update action fields
    note_id: requiredId
      .optional()
      .describe("ID of the note to update. Required for 'update' action."),
    // shared fields
    body: z.string().optional().describe("Content/text. Required for all actions."),
    created_at: z
      .string()
      .optional()
      .describe("Date time string (ISO 8601). For 'comment' and 'reply' actions."),
  })
  .refine(data => data.body !== undefined, {
    message: "body is required",
    path: ["body"],
  })
  .refine(data => data.action !== "comment" || data.noteable_type !== undefined, {
    message: "noteable_type is required for 'comment' action",
    path: ["noteable_type"],
  })
  .refine(data => data.action !== "comment" || data.noteable_id !== undefined, {
    message: "noteable_id is required for 'comment' action",
    path: ["noteable_id"],
  })
  .refine(
    data =>
      !["thread", "reply", "update"].includes(data.action) || data.merge_request_iid !== undefined,
    {
      message: "merge_request_iid is required for 'thread', 'reply', 'update' actions",
      path: ["merge_request_iid"],
    }
  )
  .refine(data => data.action !== "reply" || data.discussion_id !== undefined, {
    message: "discussion_id is required for 'reply' action",
    path: ["discussion_id"],
  })
  .refine(data => data.action !== "update" || data.note_id !== undefined, {
    message: "note_id is required for 'update' action",
    path: ["note_id"],
  })
  // Reject fields not applicable to action
  .refine(data => data.action === "comment" || data.noteable_type === undefined, {
    message: "noteable_type is only valid for 'comment' action",
    path: ["noteable_type"],
  })
  .refine(data => data.action === "comment" || data.noteable_id === undefined, {
    message: "noteable_id is only valid for 'comment' action",
    path: ["noteable_id"],
  })
  .refine(data => data.action === "comment" || data.confidential === undefined, {
    message: "confidential is only valid for 'comment' action",
    path: ["confidential"],
  })
  .refine(data => data.action !== "comment" || data.merge_request_iid === undefined, {
    message: "merge_request_iid is not valid for 'comment' action (use noteable_id instead)",
    path: ["merge_request_iid"],
  })
  .refine(data => data.action === "thread" || data.position === undefined, {
    message: "position is only valid for 'thread' action",
    path: ["position"],
  })
  .refine(data => data.action === "thread" || data.commit_id === undefined, {
    message: "commit_id is only valid for 'thread' action",
    path: ["commit_id"],
  })
  .refine(data => data.action === "reply" || data.discussion_id === undefined, {
    message: "discussion_id is only valid for 'reply' action",
    path: ["discussion_id"],
  })
  .refine(data => data.action === "update" || data.note_id === undefined, {
    message: "note_id is only valid for 'update' action",
    path: ["note_id"],
  })
  .refine(data => ["comment", "reply"].includes(data.action) || data.created_at === undefined, {
    message: "created_at is only valid for 'comment' and 'reply' actions",
    path: ["created_at"],
  });

// ============================================================================
// manage_draft_notes - CQRS Command Tool (flat schema for Claude API compatibility)
// Actions: create, update, publish, publish_all, delete
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const ManageDraftNotesSchema = z
  .object({
    action: z
      .enum(["create", "update", "publish", "publish_all", "delete"])
      .describe("Action to perform"),
    project_id: requiredId.describe("Project ID or URL-encoded path"),
    merge_request_iid: requiredId.describe("Internal MR ID unique to project."),
    // create/update action fields
    note: z
      .string()
      .optional()
      .describe("Content of the draft note. Required for 'create' and 'update' actions."),
    position: MergeRequestThreadPositionSchema.optional().describe(
      "Position for diff note. For 'create' and 'update' actions."
    ),
    // create action fields
    in_reply_to_discussion_id: z
      .string()
      .optional()
      .describe("Discussion ID to reply to. For 'create' action."),
    commit_id: z
      .string()
      .optional()
      .describe("SHA of commit to start discussion on. For 'create' action."),
    // update/publish/delete action fields
    draft_note_id: requiredId
      .optional()
      .describe("ID of the draft note. Required for 'update', 'publish', 'delete' actions."),
  })
  // Required field validations
  .refine(data => !["create", "update"].includes(data.action) || data.note !== undefined, {
    message: "note is required for 'create' and 'update' actions",
    path: ["note"],
  })
  .refine(
    data =>
      !["update", "publish", "delete"].includes(data.action) || data.draft_note_id !== undefined,
    {
      message: "draft_note_id is required for 'update', 'publish', 'delete' actions",
      path: ["draft_note_id"],
    }
  )
  // Reject fields not applicable to action
  .refine(data => ["create", "update"].includes(data.action) || data.note === undefined, {
    message: "note is only valid for 'create' and 'update' actions",
    path: ["note"],
  })
  .refine(data => ["create", "update"].includes(data.action) || data.position === undefined, {
    message: "position is only valid for 'create' and 'update' actions",
    path: ["position"],
  })
  .refine(data => data.action === "create" || data.in_reply_to_discussion_id === undefined, {
    message: "in_reply_to_discussion_id is only valid for 'create' action",
    path: ["in_reply_to_discussion_id"],
  })
  .refine(data => data.action === "create" || data.commit_id === undefined, {
    message: "commit_id is only valid for 'create' action",
    path: ["commit_id"],
  })
  .refine(data => data.action !== "create" || data.draft_note_id === undefined, {
    message: "draft_note_id is not valid for 'create' action",
    path: ["draft_note_id"],
  });

// ============================================================================
// Export type definitions
// ============================================================================

export type ManageMergeRequestInput = z.infer<typeof ManageMergeRequestSchema>;
export type ManageMrDiscussionInput = z.infer<typeof ManageMrDiscussionSchema>;
export type ManageDraftNotesInput = z.infer<typeof ManageDraftNotesSchema>;
export type MergeRequestThreadPosition = z.infer<typeof MergeRequestThreadPositionSchema>;
