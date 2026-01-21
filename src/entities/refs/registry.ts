import * as z from "zod";
import { BrowseRefsSchema } from "./schema-readonly";
import { ManageRefSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";
import { isActionDenied } from "../../config";

/**
 * Refs tools registry - 2 CQRS tools
 *
 * browse_refs (Query): list_branches, get_branch, list_tags, get_tag,
 *                      list_protected_branches, get_protected_branch, list_protected_tags
 * manage_ref (Command): create_branch, delete_branch, protect_branch, unprotect_branch,
 *                       update_branch_protection, create_tag, delete_tag, protect_tag, unprotect_tag
 */
export const refsToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // browse_refs - CQRS Query Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "browse_refs",
    {
      name: "browse_refs",
      description:
        'BROWSE Git refs (branches and tags). Actions: "list_branches" lists all branches, "get_branch" gets branch details, "list_tags" lists all tags, "get_tag" gets tag details, "list_protected_branches" shows protected branches, "get_protected_branch" gets protection rules, "list_protected_tags" shows protected tags.',
      inputSchema: z.toJSONSchema(BrowseRefsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const input = BrowseRefsSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("browse_refs", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for browse_refs tool`);
        }

        const encodedProjectId = encodeURIComponent(input.project_id);

        switch (input.action) {
          case "list_branches": {
            const { action: _action, project_id: _projectId, ...queryOptions } = input;
            return gitlab.get(`projects/${encodedProjectId}/repository/branches`, {
              query: toQuery(queryOptions, []),
            });
          }

          case "get_branch": {
            const { branch } = input;
            const encodedBranch = encodeURIComponent(branch);
            return gitlab.get(`projects/${encodedProjectId}/repository/branches/${encodedBranch}`);
          }

          case "list_tags": {
            const { action: _action, project_id: _projectId, ...queryOptions } = input;
            return gitlab.get(`projects/${encodedProjectId}/repository/tags`, {
              query: toQuery(queryOptions, []),
            });
          }

          case "get_tag": {
            const { tag_name } = input;
            const encodedTagName = encodeURIComponent(tag_name);
            return gitlab.get(`projects/${encodedProjectId}/repository/tags/${encodedTagName}`);
          }

          case "list_protected_branches": {
            const { action: _action, project_id: _projectId, ...queryOptions } = input;
            return gitlab.get(`projects/${encodedProjectId}/protected_branches`, {
              query: toQuery(queryOptions, []),
            });
          }

          case "get_protected_branch": {
            const { name } = input;
            const encodedName = encodeURIComponent(name);
            return gitlab.get(`projects/${encodedProjectId}/protected_branches/${encodedName}`);
          }

          case "list_protected_tags": {
            const { action: _action, project_id: _projectId, ...queryOptions } = input;
            return gitlab.get(`projects/${encodedProjectId}/protected_tags`, {
              query: toQuery(queryOptions, []),
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
  // manage_ref - CQRS Command Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "manage_ref",
    {
      name: "manage_ref",
      description:
        'MANAGE Git refs (branches and tags). Actions: "create_branch" creates branch from ref, "delete_branch" removes branch, "protect_branch" adds protection, "unprotect_branch" removes protection, "update_branch_protection" modifies rules, "create_tag" creates tag, "delete_tag" removes tag, "protect_tag" adds tag protection (Premium), "unprotect_tag" removes tag protection.',
      inputSchema: z.toJSONSchema(ManageRefSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const input = ManageRefSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("manage_ref", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for manage_ref tool`);
        }

        const encodedProjectId = encodeURIComponent(input.project_id);

        switch (input.action) {
          case "create_branch": {
            const { branch, ref } = input;
            return gitlab.post(`projects/${encodedProjectId}/repository/branches`, {
              body: { branch, ref },
              contentType: "json",
            });
          }

          case "delete_branch": {
            const { branch } = input;
            const encodedBranch = encodeURIComponent(branch);
            await gitlab.delete(
              `projects/${encodedProjectId}/repository/branches/${encodedBranch}`
            );
            return { deleted: true, branch };
          }

          case "protect_branch": {
            const {
              action: _action,
              project_id: _projectId,
              name,
              push_access_level,
              merge_access_level,
              unprotect_access_level,
              allow_force_push,
              allowed_to_push,
              allowed_to_merge,
              allowed_to_unprotect,
              code_owner_approval_required,
            } = input;

            const body: Record<string, unknown> = { name };

            if (push_access_level !== undefined) body.push_access_level = push_access_level;
            if (merge_access_level !== undefined) body.merge_access_level = merge_access_level;
            if (unprotect_access_level !== undefined)
              body.unprotect_access_level = unprotect_access_level;
            if (allow_force_push !== undefined) body.allow_force_push = allow_force_push;
            if (allowed_to_push !== undefined) body.allowed_to_push = allowed_to_push;
            if (allowed_to_merge !== undefined) body.allowed_to_merge = allowed_to_merge;
            if (allowed_to_unprotect !== undefined)
              body.allowed_to_unprotect = allowed_to_unprotect;
            if (code_owner_approval_required !== undefined)
              body.code_owner_approval_required = code_owner_approval_required;

            return gitlab.post(`projects/${encodedProjectId}/protected_branches`, {
              body,
              contentType: "json",
            });
          }

          case "unprotect_branch": {
            const { name } = input;
            const encodedName = encodeURIComponent(name);
            await gitlab.delete(`projects/${encodedProjectId}/protected_branches/${encodedName}`);
            return { unprotected: true, name };
          }

          case "update_branch_protection": {
            const {
              action: _action,
              project_id: _projectId,
              name,
              allow_force_push,
              allowed_to_push,
              allowed_to_merge,
              allowed_to_unprotect,
              code_owner_approval_required,
            } = input;

            const encodedName = encodeURIComponent(name);
            const body: Record<string, unknown> = {};

            if (allow_force_push !== undefined) body.allow_force_push = allow_force_push;
            if (allowed_to_push !== undefined) body.allowed_to_push = allowed_to_push;
            if (allowed_to_merge !== undefined) body.allowed_to_merge = allowed_to_merge;
            if (allowed_to_unprotect !== undefined)
              body.allowed_to_unprotect = allowed_to_unprotect;
            if (code_owner_approval_required !== undefined)
              body.code_owner_approval_required = code_owner_approval_required;

            return gitlab.patch(`projects/${encodedProjectId}/protected_branches/${encodedName}`, {
              body,
              contentType: "json",
            });
          }

          case "create_tag": {
            const { tag_name, ref, message } = input;
            const body: Record<string, unknown> = { tag_name, ref };

            if (message !== undefined) body.message = message;

            return gitlab.post(`projects/${encodedProjectId}/repository/tags`, {
              body,
              contentType: "json",
            });
          }

          case "delete_tag": {
            const { tag_name } = input;
            const encodedTagName = encodeURIComponent(tag_name);
            await gitlab.delete(`projects/${encodedProjectId}/repository/tags/${encodedTagName}`);
            return { deleted: true, tag_name };
          }

          case "protect_tag": {
            const {
              action: _action,
              project_id: _projectId,
              name,
              create_access_level,
              allowed_to_create,
            } = input;

            const body: Record<string, unknown> = { name };

            if (create_access_level !== undefined) body.create_access_level = create_access_level;
            if (allowed_to_create !== undefined) body.allowed_to_create = allowed_to_create;

            return gitlab.post(`projects/${encodedProjectId}/protected_tags`, {
              body,
              contentType: "json",
            });
          }

          case "unprotect_tag": {
            const { name } = input;
            const encodedName = encodeURIComponent(name);
            await gitlab.delete(`projects/${encodedProjectId}/protected_tags/${encodedName}`);
            return { unprotected: true, name };
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
export function getRefsReadOnlyToolNames(): string[] {
  return ["browse_refs"];
}

/**
 * Get all tool definitions from the registry
 */
export function getRefsToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(refsToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredRefsTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getRefsReadOnlyToolNames();
    return Array.from(refsToolRegistry.values()).filter(tool => readOnlyNames.includes(tool.name));
  }
  return getRefsToolDefinitions();
}
