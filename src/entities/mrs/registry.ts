/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as z from "zod";
import {
  GetBranchDiffsSchema,
  GetMergeRequestSchema,
  GetMergeRequestDiffsSchema,
  ListMergeRequestDiffsSchema,
  ListMergeRequestDiscussionsSchema,
  GetDraftNoteSchema,
  ListDraftNotesSchema,
  ListMergeRequestsSchema,
} from "./schema-readonly";
import {
  CreateMergeRequestSchema,
  UpdateMergeRequestSchema,
  MergeMergeRequestSchema,
  CreateNoteSchema,
  CreateMergeRequestThreadSchema,
  UpdateMergeRequestNoteSchema,
  CreateMergeRequestNoteSchema,
  CreateDraftNoteSchema,
  UpdateDraftNoteSchema,
  DeleteDraftNoteSchema,
  PublishDraftNoteSchema,
  BulkPublishDraftNotesSchema,
} from "./schema";
import { enhancedFetch } from "../../utils/fetch";
import { normalizeProjectId } from "../../utils/projectIdentifier";
import { cleanGidsFromObject } from "../../utils/idConversion";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * MRS (Merge Requests) tools registry - unified registry containing all MR tools with their handlers
 */
export const mrsToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // Read-only tools
  [
    "get_branch_diffs",
    {
      name: "get_branch_diffs",
      description:
        "COMPARE: Get diffs between two branches or commits in a GitLab project. Use when: Reviewing changes before merging, Analyzing code differences, Generating change reports. Supports both direct comparison and merge-base comparison methods.",
      inputSchema: z.toJSONSchema(GetBranchDiffsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetBranchDiffsSchema.parse(args);
        const { project_id, from, to, straight } = options;

        const queryParams = new URLSearchParams();
        if (straight !== undefined) {
          queryParams.set("straight", String(straight));
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/repository/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const diff = await response.json();
        return cleanGidsFromObject(diff);
      },
    },
  ],
  [
    "get_merge_request",
    {
      name: "get_merge_request",
      description:
        "READ: Get comprehensive details of a merge request including status, discussions, and approvals. Use when: Reviewing MR details, Checking merge status, Gathering information for automation. Accepts either MR IID or source branch name for flexibility.",
      inputSchema: z.toJSONSchema(GetMergeRequestSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetMergeRequestSchema.parse(args);
        const { project_id, merge_request_iid, branch_name } = options;

        let apiUrl: string;

        if (merge_request_iid) {
          // Get specific MR by IID
          apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}`;
        } else if (branch_name) {
          // Search for MR by source branch
          apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/merge_requests?source_branch=${encodeURIComponent(branch_name)}`;
        } else {
          throw new Error("Either merge_request_iid or branch_name must be provided");
        }

        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (branch_name) {
          // When searching by branch, return the first MR found
          if (Array.isArray(result) && result.length > 0) {
            return result[0];
          } else {
            throw new Error("No merge request found for branch");
          }
        }

        return cleanGidsFromObject(result);
      },
    },
  ],
  [
    "list_merge_requests",
    {
      name: "list_merge_requests",
      description:
        "BROWSE: List merge requests in a GitLab project with extensive filtering capabilities. Use when: Finding MRs by state/author/assignee, Complex queries for MR management, Reporting on merge requests. Can search globally or within specific projects.",
      inputSchema: z.toJSONSchema(ListMergeRequestsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListMergeRequestsSchema.parse(args);

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== "project_id") {
            queryParams.set(key, String(value));
          }
        });

        // Handle optional project_id - use global endpoint if not provided
        const apiUrl = options.project_id
          ? `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/merge_requests?${queryParams}`
          : `${process.env.GITLAB_API_URL}/api/v4/merge_requests?${queryParams}`;

        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const mergeRequests = await response.json();
        return cleanGidsFromObject(mergeRequests);
      },
    },
  ],
  [
    "get_merge_request_diffs",
    {
      name: "get_merge_request_diffs",
      description:
        "READ: Get all file changes and diffs included in a merge request. Use when: Reviewing code changes, Analyzing modifications, Automating code review processes. Shows actual file differences that would be applied if merged.",
      inputSchema: z.toJSONSchema(GetMergeRequestDiffsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetMergeRequestDiffsSchema.parse(args);
        const { project_id, merge_request_iid, page, per_page } = options;

        const queryParams = new URLSearchParams();
        if (page !== undefined) {
          queryParams.set("page", String(page));
        }
        if (per_page !== undefined) {
          queryParams.set("per_page", String(per_page));
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/changes?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const diffs = await response.json();
        return cleanGidsFromObject(diffs);
      },
    },
  ],
  [
    "list_merge_request_diffs",
    {
      name: "list_merge_request_diffs",
      description:
        "BROWSE: List all diffs in a merge request with pagination for large changesets. Use when: Dealing with MRs containing many changes, Managing memory usage, Processing large diffs efficiently. Provides paginated access to file modifications.",
      inputSchema: z.toJSONSchema(ListMergeRequestDiffsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListMergeRequestDiffsSchema.parse(args);
        const { project_id, merge_request_iid, page, per_page } = options;

        const queryParams = new URLSearchParams();
        if (page !== undefined) {
          queryParams.set("page", String(page));
        }
        if (per_page !== undefined) {
          queryParams.set("per_page", String(per_page));
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/diffs?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const diffs = await response.json();
        return cleanGidsFromObject(diffs);
      },
    },
  ],
  [
    "mr_discussions",
    {
      name: "mr_discussions",
      description:
        "DISCUSS: List all discussion threads and comments on a merge request. Use when: Tracking code review feedback, Managing conversations, Extracting review insights. Includes both resolved and unresolved discussions with full context.",
      inputSchema: z.toJSONSchema(ListMergeRequestDiscussionsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListMergeRequestDiscussionsSchema.parse(args);
        const { project_id, merge_request_iid } = options;

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id" && key !== "merge_request_iid") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/discussions?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const discussions = await response.json();
        return cleanGidsFromObject(discussions);
      },
    },
  ],
  [
    "get_draft_note",
    {
      name: "get_draft_note",
      description:
        "DRAFT: Retrieve a specific draft note (unpublished comment) from a merge request. Use when: Reviewing pending feedback before publishing, Managing draft review comments. Draft notes are only visible to their author until published.",
      inputSchema: z.toJSONSchema(GetDraftNoteSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetDraftNoteSchema.parse(args);
        const { project_id, merge_request_iid, draft_note_id } = options;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/draft_notes/${draft_note_id}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const draftNote = await response.json();
        return cleanGidsFromObject(draftNote);
      },
    },
  ],
  [
    "list_draft_notes",
    {
      name: "list_draft_notes",
      description:
        "DRAFT: List all draft notes (unpublished comments) for a merge request. Use when: Reviewing all pending feedback before publishing, Managing batch review comments. Draft notes allow reviewers to prepare comprehensive feedback before sharing.",
      inputSchema: z.toJSONSchema(ListDraftNotesSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListDraftNotesSchema.parse(args);
        const { project_id, merge_request_iid } = options;

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id" && key !== "merge_request_iid") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/draft_notes?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const draftNotes = await response.json();
        return cleanGidsFromObject(draftNotes);
      },
    },
  ],
  // Write tools
  [
    "create_merge_request",
    {
      name: "create_merge_request",
      description:
        "CREATE: Create a new merge request to propose code changes for review and merging. Use when: Initiating code review process, Proposing features, Submitting fixes. For labels: Use list_labels FIRST to discover existing project taxonomy. Requires source and target branches, supports setting assignees, reviewers, and labels.",
      inputSchema: z.toJSONSchema(CreateMergeRequestSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateMergeRequestSchema.parse(args);

        const body = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              body.set(key, value.join(","));
            } else {
              body.set(key, String(value));
            }
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/merge_requests`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const mergeRequest = await response.json();
        return cleanGidsFromObject(mergeRequest);
      },
    },
  ],
  [
    "merge_merge_request",
    {
      name: "merge_merge_request",
      description:
        "MERGE: Merge an approved merge request into the target branch. Use when: Completing the code review process, Integrating changes. Supports various merge methods (merge commit, squash, rebase) and can delete source branch after merging.",
      inputSchema: z.toJSONSchema(MergeMergeRequestSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = MergeMergeRequestSchema.parse(args);

        const body = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id" && key !== "merge_request_iid") {
            body.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/merge_requests/${options.merge_request_iid}/merge`;
        const response = await enhancedFetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        return cleanGidsFromObject(result);
      },
    },
  ],
  [
    "create_note",
    {
      name: "create_note",
      description:
        "COMMENT: Add a comment to an issue or merge request for discussion or feedback. Use when: Providing code review comments, Asking questions, Documenting decisions. Supports markdown formatting and can trigger notifications to participants.",
      inputSchema: z.toJSONSchema(CreateNoteSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateNoteSchema.parse(args);

        const body = new URLSearchParams();
        body.set("body", options.body);
        if (options.created_at) {
          body.set("created_at", options.created_at);
        }
        if (options.confidential !== undefined) {
          body.set("confidential", String(options.confidential));
        }

        const resourceType =
          options.noteable_type === "merge_request" ? "merge_requests" : "issues";
        const resourceId = options.noteable_id;

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/${resourceType}/${resourceId}/notes`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const note = await response.json();
        return cleanGidsFromObject(note);
      },
    },
  ],
  [
    "create_draft_note",
    {
      name: "create_draft_note",
      description:
        "DRAFT: Create a draft note (unpublished comment) on a merge request. Use when: Preparing review feedback that can be refined before publishing. Draft notes are ideal for comprehensive reviews where all comments are published together.",
      inputSchema: z.toJSONSchema(CreateDraftNoteSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateDraftNoteSchema.parse(args);

        const body = new URLSearchParams();
        body.set("note", options.note);
        if (options.position) {
          body.set("position", JSON.stringify(options.position));
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/merge_requests/${options.merge_request_iid}/draft_notes`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const draftNote = await response.json();
        return cleanGidsFromObject(draftNote);
      },
    },
  ],
  [
    "publish_draft_note",
    {
      name: "publish_draft_note",
      description:
        "DRAFT: Publish a previously created draft note to make it visible to all participants. Use when: Selectively sharing specific review comments when ready. Once published, the note becomes a regular comment and triggers notifications.",
      inputSchema: z.toJSONSchema(PublishDraftNoteSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = PublishDraftNoteSchema.parse(args);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/merge_requests/${options.merge_request_iid}/draft_notes/${options.draft_note_id}/publish`;
        const response = await enhancedFetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        // PUT publish returns 204 No Content on success
        const result = response.status === 204 ? { published: true } : await response.json();
        return cleanGidsFromObject(result);
      },
    },
  ],
  [
    "bulk_publish_draft_notes",
    {
      name: "bulk_publish_draft_notes",
      description:
        "Publish all pending draft notes for a merge request simultaneously. Use to share comprehensive review feedback in one action. Ideal for thorough code reviews where all comments should be seen together for context.",
      inputSchema: z.toJSONSchema(BulkPublishDraftNotesSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = BulkPublishDraftNotesSchema.parse(args);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/merge_requests/${options.merge_request_iid}/draft_notes/bulk_publish`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        // POST bulk_publish returns 204 No Content on success
        const result = response.status === 204 ? { published: true } : await response.json();
        return cleanGidsFromObject(result);
      },
    },
  ],
  [
    "update_merge_request",
    {
      name: "update_merge_request",
      description:
        "UPDATE: Update properties of an existing merge request such as title, description, or assignees. Use when: Refining MR details, Changing reviewers, Updating labels. For labels: Use list_labels FIRST to discover existing taxonomy before updating. Accepts either MR IID or source branch name for identification.",
      inputSchema: z.toJSONSchema(UpdateMergeRequestSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = UpdateMergeRequestSchema.parse(args);

        const body = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "project_id" && key !== "merge_request_iid") {
            if (Array.isArray(value)) {
              body.set(key, value.join(","));
            } else {
              body.set(key, String(value));
            }
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/merge_requests/${options.merge_request_iid}`;
        const response = await enhancedFetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const mergeRequest = await response.json();
        return cleanGidsFromObject(mergeRequest);
      },
    },
  ],
  [
    "create_merge_request_thread",
    {
      name: "create_merge_request_thread",
      description:
        "Start a new discussion thread on a merge request for focused conversation. Use to raise specific concerns, ask questions about code sections, or initiate design discussions. Threads can be resolved when addressed.",
      inputSchema: z.toJSONSchema(CreateMergeRequestThreadSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateMergeRequestThreadSchema.parse(args);

        const body = new URLSearchParams();
        body.set("body", options.body);
        if (options.position) {
          body.set("position", JSON.stringify(options.position));
        }
        if (options.commit_id) {
          body.set("commit_id", options.commit_id);
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/merge_requests/${options.merge_request_iid}/discussions`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const discussion = await response.json();
        return cleanGidsFromObject(discussion);
      },
    },
  ],
  [
    "update_merge_request_note",
    {
      name: "update_merge_request_note",
      description:
        "Edit an existing comment within a merge request discussion thread. Use to correct mistakes, clarify points, or update information in previous comments. Maintains discussion history while allowing content refinement.",
      inputSchema: z.toJSONSchema(UpdateMergeRequestNoteSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = UpdateMergeRequestNoteSchema.parse(args);

        const body = new URLSearchParams();
        body.set("body", options.body);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/merge_requests/${options.merge_request_iid}/notes/${options.note_id}`;
        const response = await enhancedFetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const note = await response.json();
        return cleanGidsFromObject(note);
      },
    },
  ],
  [
    "create_merge_request_note",
    {
      name: "create_merge_request_note",
      description:
        "Reply to an existing discussion thread in a merge request. Use to continue conversations, provide answers, or add context to ongoing discussions. Keeps related comments organized in threaded format.",
      inputSchema: z.toJSONSchema(CreateMergeRequestNoteSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateMergeRequestNoteSchema.parse(args);

        const body = new URLSearchParams();
        body.set("body", options.body);
        if (options.created_at) {
          body.set("created_at", options.created_at);
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/merge_requests/${options.merge_request_iid}/discussions/${options.discussion_id}/notes`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const note = await response.json();
        return cleanGidsFromObject(note);
      },
    },
  ],
  [
    "update_draft_note",
    {
      name: "update_draft_note",
      description:
        "Modify a draft note before publishing to refine review feedback. Use to edit, improve, or correct draft comments based on further code examination. Changes are only visible to the author until the note is published.",
      inputSchema: z.toJSONSchema(UpdateDraftNoteSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = UpdateDraftNoteSchema.parse(args);

        const body = new URLSearchParams();
        body.set("note", options.note);
        if (options.position) {
          body.set("position", JSON.stringify(options.position));
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/merge_requests/${options.merge_request_iid}/draft_notes/${options.draft_note_id}`;
        const response = await enhancedFetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const draftNote = await response.json();
        return cleanGidsFromObject(draftNote);
      },
    },
  ],
  [
    "delete_draft_note",
    {
      name: "delete_draft_note",
      description:
        "Remove a draft note that is no longer needed or relevant. Use to clean up draft feedback that won't be published or to start fresh with review comments. Only the author can delete their own draft notes.",
      inputSchema: z.toJSONSchema(DeleteDraftNoteSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = DeleteDraftNoteSchema.parse(args);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodeURIComponent(options.project_id)}/merge_requests/${options.merge_request_iid}/draft_notes/${options.draft_note_id}`;
        const response = await enhancedFetch(apiUrl, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        return { success: true, message: "Draft note deleted successfully" };
      },
    },
  ],
]);

/**
 * Get read-only tool names from the registry
 */
export function getMrsReadOnlyToolNames(): string[] {
  return [
    "get_branch_diffs",
    "get_merge_request",
    "get_merge_request_diffs",
    "list_merge_request_diffs",
    "mr_discussions",
    "get_draft_note",
    "list_draft_notes",
    "list_merge_requests",
  ];
}

/**
 * Get all tool definitions from the registry (for backward compatibility)
 */
export function getMrsToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(mrsToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredMrsTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getMrsReadOnlyToolNames();
    return Array.from(mrsToolRegistry.values()).filter(tool => readOnlyNames.includes(tool.name));
  }
  return getMrsToolDefinitions();
}
