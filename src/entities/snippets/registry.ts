import * as z from "zod";
import { ListSnippetsSchema, GetSnippetSchema } from "./schema-readonly";
import { CreateSnippetSchema, UpdateSnippetSchema, DeleteSnippetSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Union schema for manage_snippet action parameter
 */
const ManageSnippetSchema = z.discriminatedUnion("action", [
  GetSnippetSchema,
  CreateSnippetSchema,
  UpdateSnippetSchema,
  DeleteSnippetSchema,
]);

/**
 * Snippets tools registry - unified registry containing all snippet operation tools with their handlers
 */
export const snippetsToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  [
    "list_snippets",
    {
      name: "list_snippets",
      description:
        "List GitLab code snippets with flexible scoping. Use scope='personal' for current user's snippets, scope='project' for project-specific snippets (requires projectId), or scope='public' to discover all public snippets. Filter by visibility level (private/internal/public) and creation date. Snippets are reusable code blocks, configs, or text that support versioning and can be shared.",
      inputSchema: z.toJSONSchema(ListSnippetsSchema),
      handler: async (args: unknown) => {
        const options = ListSnippetsSchema.parse(args);

        // Build the path based on scope
        let path: string;
        if (options.scope === "personal") {
          path = "snippets";
        } else if (options.scope === "public") {
          path = "snippets/public";
        } else {
          // project scope - projectId is validated by schema refine
          if (!options.projectId) {
            throw new Error("projectId is required for project scope");
          }
          const encodedProjectId = encodeURIComponent(options.projectId);
          path = `projects/${encodedProjectId}/snippets`;
        }

        // Use toQuery to build query parameters, excluding scope and projectId
        return gitlab.get(path, {
          query: toQuery(options, ["scope", "projectId"]),
        });
      },
    },
  ],
  [
    "manage_snippet",
    {
      name: "manage_snippet",
      description:
        "Manage GitLab snippets with full CRUD operations via action parameter. action='read': retrieve snippet metadata or raw content. action='create': create new snippet with multiple files, visibility control. action='update': modify title, description, visibility, or files (supports create/update/delete/move file actions). action='delete': permanently remove snippet. Supports both personal and project snippets. Multi-file snippets enable organizing related code in one place.",
      inputSchema: z.toJSONSchema(ManageSnippetSchema),
      handler: async (args: unknown) => {
        const options = ManageSnippetSchema.parse(args);

        // Handle different actions
        switch (options.action) {
          case "read": {
            const encodedId = options.id.toString();
            let path: string;

            if (options.projectId) {
              const encodedProjectId = encodeURIComponent(options.projectId);
              path = `projects/${encodedProjectId}/snippets/${encodedId}`;
            } else {
              path = `snippets/${encodedId}`;
            }

            // If raw content is requested, append /raw to the path
            if (options.raw) {
              path = `${path}/raw`;
            }

            return gitlab.get(path);
          }

          case "create": {
            const body: Record<string, unknown> = {
              title: options.title,
              visibility: options.visibility,
              files: options.files,
            };

            if (options.description) {
              body.description = options.description;
            }

            let path: string;
            if (options.projectId) {
              const encodedProjectId = encodeURIComponent(options.projectId);
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
            const encodedId = options.id.toString();
            const body: Record<string, unknown> = {};

            if (options.title !== undefined) {
              body.title = options.title;
            }
            if (options.description !== undefined) {
              body.description = options.description;
            }
            if (options.visibility !== undefined) {
              body.visibility = options.visibility;
            }
            if (options.files !== undefined) {
              body.files = options.files;
            }

            let path: string;
            if (options.projectId) {
              const encodedProjectId = encodeURIComponent(options.projectId);
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
            const encodedId = options.id.toString();
            let path: string;

            if (options.projectId) {
              const encodedProjectId = encodeURIComponent(options.projectId);
              path = `projects/${encodedProjectId}/snippets/${encodedId}`;
            } else {
              path = `snippets/${encodedId}`;
            }

            await gitlab.delete(path);
            return { deleted: true, id: options.id };
          }

          default:
            // This should never happen due to discriminated union
            throw new Error(`Unknown action: ${(options as { action: string }).action}`);
        }
      },
    },
  ],
]);

export function getSnippetsReadOnlyToolNames(): string[] {
  return ["list_snippets"];
}

export function getSnippetsToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(snippetsToolRegistry.values());
}

export function getFilteredSnippetsTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getSnippetsReadOnlyToolNames();
    return Array.from(snippetsToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getSnippetsToolDefinitions();
}
