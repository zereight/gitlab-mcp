import * as z from "zod";
import { BrowseMergeRequestsSchema, BrowseMrDiscussionsSchema } from "./schema-readonly";
import {
  ManageMergeRequestSchema,
  ManageMrDiscussionSchema,
  ManageDraftNotesSchema,
} from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { normalizeProjectId } from "../../utils/projectIdentifier";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";
import { isActionDenied } from "../../config";

/**
 * MRS (Merge Requests) tools registry - 5 CQRS tools replacing 20 individual tools
 *
 * browse_merge_requests (Query): list, get, diffs, compare
 * browse_mr_discussions (Query): list, drafts, draft
 * manage_merge_request (Command): create, update, merge
 * manage_mr_discussion (Command): comment, thread, reply, update, apply_suggestion, apply_suggestions
 * manage_draft_notes (Command): create, update, publish, publish_all, delete
 */
export const mrsToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // browse_merge_requests - CQRS Query Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "browse_merge_requests",
    {
      name: "browse_merge_requests",
      description:
        'BROWSE merge requests. Actions: "list" shows MRs with filtering, "get" retrieves single MR by IID or branch, "diffs" shows file changes, "compare" diffs two branches/commits.',
      inputSchema: z.toJSONSchema(BrowseMergeRequestsSchema),
      gate: { envVar: "USE_MRS", defaultValue: true },
      handler: async (args: unknown) => {
        const input = BrowseMergeRequestsSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("browse_merge_requests", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for browse_merge_requests tool`);
        }

        switch (input.action) {
          case "list": {
            // TypeScript knows: input has state, order_by, sort, milestone, etc. (all optional)
            const { action: _action, project_id, ...rest } = input;
            const query = toQuery(rest, []);

            const path = project_id
              ? `projects/${normalizeProjectId(project_id)}/merge_requests`
              : `merge_requests`;

            return gitlab.get(path, { query });
          }

          case "get": {
            // TypeScript knows: input has project_id (required), merge_request_iid (optional), branch_name (optional)
            const { project_id, merge_request_iid, branch_name } = input;

            // Build query params for optional fields
            const query: Record<string, boolean | string | undefined> = {};
            if (input.include_diverged_commits_count !== undefined)
              query.include_diverged_commits_count = input.include_diverged_commits_count;
            if (input.include_rebase_in_progress !== undefined)
              query.include_rebase_in_progress = input.include_rebase_in_progress;

            if (merge_request_iid) {
              return gitlab.get(
                `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}`,
                Object.keys(query).length > 0 ? { query } : undefined
              );
            } else if (branch_name) {
              const result = await gitlab.get<unknown[]>(
                `projects/${normalizeProjectId(project_id)}/merge_requests`,
                { query: { source_branch: branch_name, ...query } }
              );

              if (Array.isArray(result) && result.length > 0) {
                return result[0];
              }
              throw new Error("No merge request found for branch");
            }
            /* istanbul ignore next -- unreachable: schema validation ensures merge_request_iid or branch_name */
            throw new Error("Either merge_request_iid or branch_name must be provided");
          }

          case "diffs": {
            // TypeScript knows: input has project_id (required), merge_request_iid (required)
            const { project_id, merge_request_iid } = input;

            const query: Record<string, number | boolean | undefined> = {};
            if (input.page !== undefined) query.page = input.page;
            if (input.per_page !== undefined) query.per_page = input.per_page;
            if (input.include_diverged_commits_count !== undefined)
              query.include_diverged_commits_count = input.include_diverged_commits_count;
            if (input.include_rebase_in_progress !== undefined)
              query.include_rebase_in_progress = input.include_rebase_in_progress;

            return gitlab.get(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/changes`,
              { query }
            );
          }

          case "compare": {
            // TypeScript knows: input has project_id (required), from (required), to (required)
            const { project_id, from, to, straight } = input;

            const query: Record<string, string | boolean | undefined> = {
              from,
              to,
            };
            if (straight !== undefined) query.straight = straight;

            return gitlab.get(`projects/${normalizeProjectId(project_id)}/repository/compare`, {
              query,
            });
          }

          /* istanbul ignore next -- unreachable with Zod discriminatedUnion */
          default:
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
        }
      },
    },
  ],

  // ============================================================================
  // browse_mr_discussions - CQRS Query Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "browse_mr_discussions",
    {
      name: "browse_mr_discussions",
      description:
        'BROWSE MR discussions and draft notes. Actions: "list" shows all discussion threads, "drafts" lists unpublished draft notes, "draft" gets single draft note.',
      inputSchema: z.toJSONSchema(BrowseMrDiscussionsSchema),
      gate: { envVar: "USE_MRS", defaultValue: true },
      handler: async (args: unknown) => {
        const input = BrowseMrDiscussionsSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("browse_mr_discussions", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for browse_mr_discussions tool`);
        }

        switch (input.action) {
          case "list": {
            // TypeScript knows: input has project_id (required), merge_request_iid (required), per_page, page (optional)
            const { action: _action, project_id, merge_request_iid, ...rest } = input;
            const query = toQuery(rest, []);

            return gitlab.get(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/discussions`,
              { query }
            );
          }

          case "drafts": {
            // TypeScript knows: input has project_id (required), merge_request_iid (required)
            const { project_id, merge_request_iid } = input;
            return gitlab.get(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/draft_notes`
            );
          }

          case "draft": {
            // TypeScript knows: input has project_id (required), merge_request_iid (required), draft_note_id (required)
            const { project_id, merge_request_iid, draft_note_id } = input;
            return gitlab.get(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/draft_notes/${draft_note_id}`
            );
          }

          /* istanbul ignore next -- unreachable with Zod discriminatedUnion */
          default:
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
        }
      },
    },
  ],

  // ============================================================================
  // manage_merge_request - CQRS Command Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "manage_merge_request",
    {
      name: "manage_merge_request",
      description:
        'MANAGE merge requests. Actions: "create" creates new MR, "update" modifies existing MR, "merge" merges approved MR into target branch.',
      inputSchema: z.toJSONSchema(ManageMergeRequestSchema),
      gate: { envVar: "USE_MRS", defaultValue: true },
      handler: async (args: unknown) => {
        const input = ManageMergeRequestSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("manage_merge_request", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for manage_merge_request tool`);
        }

        switch (input.action) {
          case "create": {
            // TypeScript knows: input has source_branch (required), target_branch (required), title (required)
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
            // TypeScript knows: input has merge_request_iid (required)
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
            // TypeScript knows: input has merge_request_iid (required)
            const { action: _action, project_id, merge_request_iid, ...body } = input;

            return gitlab.put(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/merge`,
              { body, contentType: "form" }
            );
          }

          /* istanbul ignore next -- unreachable with Zod discriminatedUnion */
          default:
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
        }
      },
    },
  ],

  // ============================================================================
  // manage_mr_discussion - CQRS Command Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "manage_mr_discussion",
    {
      name: "manage_mr_discussion",
      description:
        'MANAGE MR discussions and suggestions. Actions: "comment" adds comment, "thread" starts discussion, "reply" responds to thread, "update" modifies note, "apply_suggestion" applies single code suggestion, "apply_suggestions" batch applies multiple suggestions.',
      inputSchema: z.toJSONSchema(ManageMrDiscussionSchema),
      gate: { envVar: "USE_MRS", defaultValue: true },
      handler: async (args: unknown) => {
        const input = ManageMrDiscussionSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("manage_mr_discussion", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for manage_mr_discussion tool`);
        }

        switch (input.action) {
          case "comment": {
            // TypeScript knows: input has noteable_type (required), noteable_id (required), body (required)
            const {
              project_id,
              noteable_type,
              noteable_id,
              body: noteBody,
              created_at,
              confidential,
            } = input;

            const body: Record<string, unknown> = { body: noteBody };
            if (created_at) body.created_at = created_at;
            if (confidential !== undefined) body.confidential = confidential;

            const resourceType = noteable_type === "merge_request" ? "merge_requests" : "issues";

            return gitlab.post(
              `projects/${normalizeProjectId(project_id)}/${resourceType}/${noteable_id}/notes`,
              { body, contentType: "form" }
            );
          }

          case "thread": {
            // TypeScript knows: input has merge_request_iid (required), body (required)
            const { project_id, merge_request_iid, body: noteBody, position, commit_id } = input;

            const body: Record<string, unknown> = { body: noteBody };
            if (position) body.position = JSON.stringify(position);
            if (commit_id) body.commit_id = commit_id;

            return gitlab.post(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/discussions`,
              { body, contentType: "form" }
            );
          }

          case "reply": {
            // TypeScript knows: input has merge_request_iid (required), discussion_id (required), body (required)
            const {
              project_id,
              merge_request_iid,
              discussion_id,
              body: noteBody,
              created_at,
            } = input;

            const body: Record<string, unknown> = { body: noteBody };
            if (created_at) body.created_at = created_at;

            return gitlab.post(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/discussions/${discussion_id}/notes`,
              { body, contentType: "form" }
            );
          }

          case "update": {
            // TypeScript knows: input has merge_request_iid (required), note_id (required), body (required)
            const { project_id, merge_request_iid, note_id, body: noteBody } = input;

            return gitlab.put(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/notes/${note_id}`,
              { body: { body: noteBody }, contentType: "form" }
            );
          }

          case "apply_suggestion": {
            // TypeScript knows: input has suggestion_id (required), commit_message (optional)
            const { project_id, merge_request_iid, suggestion_id, commit_message } = input;

            const body: Record<string, unknown> = {};
            if (commit_message) {
              body.commit_message = commit_message;
            }

            return gitlab.put(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/suggestions/${suggestion_id}/apply`,
              { body: Object.keys(body).length > 0 ? body : undefined, contentType: "json" }
            );
          }

          case "apply_suggestions": {
            // TypeScript knows: input has suggestion_ids (required), commit_message (optional)
            const { project_id, merge_request_iid, suggestion_ids, commit_message } = input;

            const body: Record<string, unknown> = {
              ids: suggestion_ids,
            };
            if (commit_message) {
              body.commit_message = commit_message;
            }

            return gitlab.put(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/suggestions/batch_apply`,
              { body, contentType: "json" }
            );
          }

          /* istanbul ignore next -- unreachable with Zod discriminatedUnion */
          default:
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
        }
      },
    },
  ],

  // ============================================================================
  // manage_draft_notes - CQRS Command Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "manage_draft_notes",
    {
      name: "manage_draft_notes",
      description:
        'MANAGE draft notes. Actions: "create" creates draft note, "update" modifies draft, "publish" publishes single draft, "publish_all" publishes all drafts, "delete" removes draft.',
      inputSchema: z.toJSONSchema(ManageDraftNotesSchema),
      gate: { envVar: "USE_MRS", defaultValue: true },
      handler: async (args: unknown) => {
        const input = ManageDraftNotesSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("manage_draft_notes", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for manage_draft_notes tool`);
        }

        switch (input.action) {
          case "create": {
            // TypeScript knows: input has note (required), position, in_reply_to_discussion_id, commit_id (optional)
            const {
              project_id,
              merge_request_iid,
              note,
              position,
              in_reply_to_discussion_id,
              commit_id,
            } = input;

            const body: Record<string, unknown> = { note };
            if (position) body.position = JSON.stringify(position);
            if (in_reply_to_discussion_id)
              body.in_reply_to_discussion_id = in_reply_to_discussion_id;
            if (commit_id) body.commit_id = commit_id;

            return gitlab.post(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/draft_notes`,
              { body, contentType: "form" }
            );
          }

          case "update": {
            // TypeScript knows: input has draft_note_id (required), note (required)
            const { project_id, merge_request_iid, draft_note_id, note, position } = input;

            const body: Record<string, unknown> = { note };
            if (position) body.position = JSON.stringify(position);

            return gitlab.put(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/draft_notes/${draft_note_id}`,
              { body, contentType: "form" }
            );
          }

          case "publish": {
            // TypeScript knows: input has draft_note_id (required)
            const { project_id, merge_request_iid, draft_note_id } = input;

            const result = await gitlab.put<void>(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/draft_notes/${draft_note_id}/publish`
            );
            // PUT publish returns 204 No Content (undefined) on success
            return result ?? { published: true };
          }

          case "publish_all": {
            // TypeScript knows: input has project_id (required), merge_request_iid (required)
            const { project_id, merge_request_iid } = input;

            const result = await gitlab.post<void>(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/draft_notes/bulk_publish`
            );
            // POST bulk_publish returns 204 No Content (undefined) on success
            return result ?? { published: true };
          }

          case "delete": {
            // TypeScript knows: input has draft_note_id (required)
            const { project_id, merge_request_iid, draft_note_id } = input;

            await gitlab.delete<void>(
              `projects/${normalizeProjectId(project_id)}/merge_requests/${merge_request_iid}/draft_notes/${draft_note_id}`
            );
            return { success: true, message: "Draft note deleted successfully" };
          }

          /* istanbul ignore next -- unreachable with Zod discriminatedUnion */
          default:
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
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
