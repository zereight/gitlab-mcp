import * as z from "zod";
import { BrowseSnippetsSchema } from "./schema-readonly";
import { ManageSnippetSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";
import { isActionDenied } from "../../config";

/**
 * Snippets tools registry - 2 CQRS tools replacing 5 individual tools
 *
 * browse_snippets (Query): list, get
 * manage_snippet (Command): create, update, delete
 */
export const snippetsToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // browse_snippets - CQRS Query Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "browse_snippets",
    {
      name: "browse_snippets",
      description:
        'BROWSE GitLab code snippets. Actions: "list" shows snippets by scope (personal/project/public) with filtering, "get" retrieves single snippet metadata or raw content. Snippets are reusable code blocks, configs, or text with versioning support.',
      inputSchema: z.toJSONSchema(BrowseSnippetsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const input = BrowseSnippetsSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("browse_snippets", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for browse_snippets tool`);
        }

        switch (input.action) {
          case "list": {
            // TypeScript knows: input has scope (required), projectId, visibility, etc. (optional)
            const { action: _action, scope, projectId, ...queryOptions } = input;

            // Build the path based on scope
            let path: string;
            if (scope === "personal") {
              path = "snippets";
            } else if (scope === "public") {
              path = "snippets/public";
            } else {
              // project scope - requires projectId
              if (!projectId) {
                throw new Error("projectId is required when scope is 'project'");
              }
              const encodedProjectId = encodeURIComponent(projectId);
              path = `projects/${encodedProjectId}/snippets`;
            }

            return gitlab.get(path, {
              query: toQuery(queryOptions, []),
            });
          }

          case "get": {
            // TypeScript knows: input has id (required), projectId, raw (optional)
            const { id, projectId, raw } = input;
            const encodedId = id.toString();
            let path: string;

            if (projectId) {
              const encodedProjectId = encodeURIComponent(projectId);
              path = `projects/${encodedProjectId}/snippets/${encodedId}`;
            } else {
              path = `snippets/${encodedId}`;
            }

            // If raw content is requested, append /raw to the path
            if (raw) {
              path = `${path}/raw`;
            }

            return gitlab.get(path);
          }

          /* istanbul ignore next -- unreachable with Zod discriminatedUnion */
          default:
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
        }
      },
    },
  ],

  // ============================================================================
  // manage_snippet - CQRS Command Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "manage_snippet",
    {
      name: "manage_snippet",
      description:
        'MANAGE GitLab snippets. Actions: "create" creates new snippet with multiple files and visibility control, "update" modifies title/description/visibility/files (supports file create/update/delete/move), "delete" permanently removes snippet. Supports personal and project snippets.',
      inputSchema: z.toJSONSchema(ManageSnippetSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const input = ManageSnippetSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("manage_snippet", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for manage_snippet tool`);
        }

        switch (input.action) {
          case "create": {
            // TypeScript knows: input has title, files (required), projectId, description, visibility (optional)
            const { projectId, title, description, visibility, files } = input;

            const body: Record<string, unknown> = {
              title,
              visibility,
              files,
            };

            if (description) {
              body.description = description;
            }

            let path: string;
            if (projectId) {
              const encodedProjectId = encodeURIComponent(projectId);
              path = `projects/${encodedProjectId}/snippets`;
            } else {
              path = "snippets";
            }

            return gitlab.post(path, {
              body,
              contentType: "json",
            });
          }

          case "update": {
            // TypeScript knows: input has id (required), projectId, title, description, visibility, files (optional)
            const { id, projectId, title, description, visibility, files } = input;
            const encodedId = id.toString();
            const body: Record<string, unknown> = {};

            if (title !== undefined) {
              body.title = title;
            }
            if (description !== undefined) {
              body.description = description;
            }
            if (visibility !== undefined) {
              body.visibility = visibility;
            }
            if (files !== undefined) {
              body.files = files;
            }

            let path: string;
            if (projectId) {
              const encodedProjectId = encodeURIComponent(projectId);
              path = `projects/${encodedProjectId}/snippets/${encodedId}`;
            } else {
              path = `snippets/${encodedId}`;
            }

            return gitlab.put(path, {
              body,
              contentType: "json",
            });
          }

          case "delete": {
            // TypeScript knows: input has id (required), projectId (optional)
            const { id, projectId } = input;
            const encodedId = id.toString();
            let path: string;

            if (projectId) {
              const encodedProjectId = encodeURIComponent(projectId);
              path = `projects/${encodedProjectId}/snippets/${encodedId}`;
            } else {
              path = `snippets/${encodedId}`;
            }

            await gitlab.delete(path);
            return { deleted: true, id };
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
export function getSnippetsReadOnlyToolNames(): string[] {
  return ["browse_snippets"];
}

/**
 * Get all tool definitions from the registry
 */
export function getSnippetsToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(snippetsToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredSnippetsTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getSnippetsReadOnlyToolNames();
    return Array.from(snippetsToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getSnippetsToolDefinitions();
}
