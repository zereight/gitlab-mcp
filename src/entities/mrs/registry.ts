import * as z from "zod";
import {
  BrowseMergeRequestsSchema,
  BrowseMergeRequestsInput,
  BrowseMrDiscussionsSchema,
  BrowseMrDiscussionsInput,
} from "./schema-readonly";
import {
  ManageMergeRequestSchema,
  ManageMergeRequestInput,
  ManageMrDiscussionSchema,
  ManageMrDiscussionInput,
  ManageDraftNotesSchema,
  ManageDraftNotesInput,
} from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { normalizeProjectId } from "../../utils/projectIdentifier";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * MRS (Merge Requests) tools registry - 5 CQRS tools replacing 20 individual tools
 *
 * browse_merge_requests (Query): list, get, diffs, compare
 * browse_mr_discussions (Query): list, drafts, draft
 * manage_merge_request (Command): create, update, merge
 * manage_mr_discussion (Command): comment, thread, reply, update
 * manage_draft_notes (Command): create, update, publish, publish_all, delete
 */
export const mrsToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // browse_merge_requests - CQRS Query Tool
  // ============================================================================
  [
    "browse_merge_requests",
    {
      name: "browse_merge_requests",
      description:
        'BROWSE merge requests. Actions: "list" shows MRs with filtering, "get" retrieves single MR by IID or branch, "diffs" shows file changes, "compare" diffs two branches/commits.',
      inputSchema: z.toJSONSchema(BrowseMergeRequestsSchema),
      handler: async (args: unknown) => {
        const input = BrowseMergeRequestsSchema.parse(args);

        switch (input.action) {
          case "list": {
            const { action: _action, project_id, ...rest } = input;
            const query = toQuery(rest, []);

            const path = project_id
              ? `projects/${normalizeProjectId(project_id)}/merge_requests`
              : `merge_requests`;

            return gitlab.get(path, { query });
          }

          case "get": {
            if (input.merge_request_iid) {
              return gitlab.get(
                `projects/${normalizeProjectId(input.project_id)}/merge_requests/${input.merge_request_iid}`
              );
            } else if (input.branch_name) {
              const result = await gitlab.get<unknown[]>(
                `projects/${normalizeProjectId(input.project_id)}/merge_requests`,
                { query: { source_branch: input.branch_name } }
              );

              if (Array.isArray(result) && result.length > 0) {
                return result[0];
              }
              throw new Error("No merge request found for branch");
            }
            throw new Error("Either merge_request_iid or branch_name must be provided");
          }

          case "diffs": {
            const query: Record<string, number | undefined> = {};
            if (input.page !== undefined) query.page = input.page;
            if (input.per_page !== undefined) query.per_page = input.per_page;

            return gitlab.get(
              `projects/${normalizeProjectId(input.project_id)}/merge_requests/${input.merge_request_iid}/changes`,
              { query }
            );
          }

          case "compare": {
            const query: Record<string, string | boolean | undefined> = {
              from: input.from,
              to: input.to,
            };
            if (input.straight !== undefined) query.straight = input.straight;

            return gitlab.get(
              `projects/${normalizeProjectId(input.project_id)}/repository/compare`,
              { query }
            );
          }

          /* istanbul ignore next -- TypeScript exhaustive check, unreachable with Zod validation */
          default: {
            const _exhaustive: never = input;
            throw new Error(`Unknown action: ${(_exhaustive as BrowseMergeRequestsInput).action}`);
          }
        }
      },
    },
  ],

  // ============================================================================
  // browse_mr_discussions - CQRS Query Tool
  // ============================================================================
  [
    "browse_mr_discussions",
    {
      name: "browse_mr_discussions",
      description:
        'BROWSE MR discussions and draft notes. Actions: "list" shows all discussion threads, "drafts" lists unpublished draft notes, "draft" gets single draft note.',
      inputSchema: z.toJSONSchema(BrowseMrDiscussionsSchema),
      handler: async (args: unknown) => {
        const input = BrowseMrDiscussionsSchema.parse(args);

        switch (input.action) {
          case "list": {
            const { action: _action, project_id, merge_request_iid, ...rest } = input;
            const query = toQuery(rest, []);

            return gitlab.get(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/discussions`,
              { query }
            );
          }

          case "drafts": {
            return gitlab.get(
              `projects/${normalizeProjectId(input.project_id)}/merge_requests/${input.merge_request_iid}/draft_notes`
            );
          }

          case "draft": {
            return gitlab.get(
              `projects/${normalizeProjectId(input.project_id)}/merge_requests/${input.merge_request_iid}/draft_notes/${input.draft_note_id}`
            );
          }

          /* istanbul ignore next -- TypeScript exhaustive check, unreachable with Zod validation */
          default: {
            const _exhaustive: never = input;
            throw new Error(`Unknown action: ${(_exhaustive as BrowseMrDiscussionsInput).action}`);
          }
        }
      },
    },
  ],

  // ============================================================================
  // manage_merge_request - CQRS Command Tool
  // ============================================================================
  [
    "manage_merge_request",
    {
      name: "manage_merge_request",
      description:
        'MANAGE merge requests. Actions: "create" creates new MR, "update" modifies existing MR, "merge" merges approved MR into target branch.',
      inputSchema: z.toJSONSchema(ManageMergeRequestSchema),
      handler: async (args: unknown) => {
        const input = ManageMergeRequestSchema.parse(args);

        switch (input.action) {
          case "create": {
            const { action: _action, project_id, ...body } = input;

            // Handle array fields - convert to comma-separated strings for form encoding
            const processedBody: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(body)) {
              if (Array.isArray(value)) {
                processedBody[key] = value.join(",");
              } else {
                processedBody[key] = value;
              }
            }

            return gitlab.post(`projects/${normalizeProjectId(project_id)}/merge_requests`, {
              body: processedBody,
              contentType: "form",
            });
          }

          case "update": {
            const { action: _action, project_id, merge_request_iid, ...body } = input;

            // Handle array fields
            const processedBody: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(body)) {
              if (Array.isArray(value)) {
                processedBody[key] = value.join(",");
              } else {
                processedBody[key] = value;
              }
            }

            return gitlab.put(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}`,
              { body: processedBody, contentType: "form" }
            );
          }

          case "merge": {
            const { action: _action, project_id, merge_request_iid, ...body } = input;

            return gitlab.put(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/merge`,
              { body, contentType: "form" }
            );
          }

          /* istanbul ignore next -- TypeScript exhaustive check, unreachable with Zod validation */
          default: {
            const _exhaustive: never = input;
            throw new Error(`Unknown action: ${(_exhaustive as ManageMergeRequestInput).action}`);
          }
        }
      },
    },
  ],

  // ============================================================================
  // manage_mr_discussion - CQRS Command Tool
  // ============================================================================
  [
    "manage_mr_discussion",
    {
      name: "manage_mr_discussion",
      description:
        'MANAGE MR discussions. Actions: "comment" adds comment to issue/MR, "thread" starts new discussion, "reply" responds to existing thread, "update" modifies note.',
      inputSchema: z.toJSONSchema(ManageMrDiscussionSchema),
      handler: async (args: unknown) => {
        const input = ManageMrDiscussionSchema.parse(args);

        switch (input.action) {
          case "comment": {
            const body: Record<string, unknown> = { body: input.body };
            if (input.created_at) body.created_at = input.created_at;
            if (input.confidential !== undefined) body.confidential = input.confidential;

            const resourceType =
              input.noteable_type === "merge_request" ? "merge_requests" : "issues";

            return gitlab.post(
              `projects/${normalizeProjectId(input.project_id)}/${resourceType}/${input.noteable_id}/notes`,
              { body, contentType: "form" }
            );
          }

          case "thread": {
            const body: Record<string, unknown> = { body: input.body };
            if (input.position) body.position = JSON.stringify(input.position);
            if (input.commit_id) body.commit_id = input.commit_id;

            return gitlab.post(
              `projects/${normalizeProjectId(input.project_id)}/merge_requests/${input.merge_request_iid}/discussions`,
              { body, contentType: "form" }
            );
          }

          case "reply": {
            const body: Record<string, unknown> = { body: input.body };
            if (input.created_at) body.created_at = input.created_at;

            return gitlab.post(
              `projects/${normalizeProjectId(input.project_id)}/merge_requests/${input.merge_request_iid}/discussions/${input.discussion_id}/notes`,
              { body, contentType: "form" }
            );
          }

          case "update": {
            return gitlab.put(
              `projects/${normalizeProjectId(input.project_id)}/merge_requests/${input.merge_request_iid}/notes/${input.note_id}`,
              { body: { body: input.body }, contentType: "form" }
            );
          }

          /* istanbul ignore next -- TypeScript exhaustive check, unreachable with Zod validation */
          default: {
            const _exhaustive: never = input;
            throw new Error(`Unknown action: ${(_exhaustive as ManageMrDiscussionInput).action}`);
          }
        }
      },
    },
  ],

  // ============================================================================
  // manage_draft_notes - CQRS Command Tool
  // ============================================================================
  [
    "manage_draft_notes",
    {
      name: "manage_draft_notes",
      description:
        'MANAGE draft notes. Actions: "create" creates draft note, "update" modifies draft, "publish" publishes single draft, "publish_all" publishes all drafts, "delete" removes draft.',
      inputSchema: z.toJSONSchema(ManageDraftNotesSchema),
      handler: async (args: unknown) => {
        const input = ManageDraftNotesSchema.parse(args);

        switch (input.action) {
          case "create": {
            const body: Record<string, unknown> = { note: input.note };
            if (input.position) body.position = JSON.stringify(input.position);
            if (input.in_reply_to_discussion_id)
              body.in_reply_to_discussion_id = input.in_reply_to_discussion_id;
            if (input.commit_id) body.commit_id = input.commit_id;

            return gitlab.post(
              `projects/${normalizeProjectId(input.project_id)}/merge_requests/${input.merge_request_iid}/draft_notes`,
              { body, contentType: "form" }
            );
          }

          case "update": {
            const body: Record<string, unknown> = { note: input.note };
            if (input.position) body.position = JSON.stringify(input.position);

            return gitlab.put(
              `projects/${normalizeProjectId(input.project_id)}/merge_requests/${input.merge_request_iid}/draft_notes/${input.draft_note_id}`,
              { body, contentType: "form" }
            );
          }

          case "publish": {
            const result = await gitlab.put<void>(
              `projects/${normalizeProjectId(input.project_id)}/merge_requests/${input.merge_request_iid}/draft_notes/${input.draft_note_id}/publish`
            );
            // PUT publish returns 204 No Content (undefined) on success
            return result ?? { published: true };
          }

          case "publish_all": {
            const result = await gitlab.post<void>(
              `projects/${normalizeProjectId(input.project_id)}/merge_requests/${input.merge_request_iid}/draft_notes/bulk_publish`
            );
            // POST bulk_publish returns 204 No Content (undefined) on success
            return result ?? { published: true };
          }

          case "delete": {
            await gitlab.delete<void>(
              `projects/${normalizeProjectId(input.project_id)}/merge_requests/${input.merge_request_iid}/draft_notes/${input.draft_note_id}`
            );
            return { success: true, message: "Draft note deleted successfully" };
          }

          /* istanbul ignore next -- TypeScript exhaustive check, unreachable with Zod validation */
          default: {
            const _exhaustive: never = input;
            throw new Error(`Unknown action: ${(_exhaustive as ManageDraftNotesInput).action}`);
          }
        }
      },
    },
  ],
]);

/**
 * Get read-only tool names from the registry
 */
export function getMrsReadOnlyToolNames(): string[] {
  return ["browse_merge_requests", "browse_mr_discussions"];
}

/**
 * Get all tool definitions from the registry
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
