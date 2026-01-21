import * as z from "zod";
import { BrowseReleasesSchema } from "./schema-readonly";
import { ManageReleaseSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";
import { isActionDenied } from "../../config";

/**
 * Releases tools registry - 2 CQRS tools
 *
 * browse_releases (Query): list, get, assets
 * manage_release (Command): create, update, delete, create_link, delete_link
 */
export const releasesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // browse_releases - CQRS Query Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "browse_releases",
    {
      name: "browse_releases",
      description:
        'BROWSE GitLab project releases. Actions: "list" shows all releases sorted by date, "get" retrieves specific release by tag name, "assets" lists release asset links. Releases are versioned software distributions with changelogs, assets, and milestone associations.',
      inputSchema: z.toJSONSchema(BrowseReleasesSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const input = BrowseReleasesSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("browse_releases", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for browse_releases tool`);
        }

        const encodedProjectId = encodeURIComponent(input.project_id);

        switch (input.action) {
          case "list": {
            const { action: _action, project_id: _projectId, ...queryOptions } = input;
            return gitlab.get(`projects/${encodedProjectId}/releases`, {
              query: toQuery(queryOptions, []),
            });
          }

          case "get": {
            const { tag_name, include_html_description } = input;
            const encodedTagName = encodeURIComponent(tag_name);
            const query = include_html_description ? { include_html_description: true } : {};
            return gitlab.get(`projects/${encodedProjectId}/releases/${encodedTagName}`, {
              query,
            });
          }

          case "assets": {
            const { tag_name, per_page, page } = input;
            const encodedTagName = encodeURIComponent(tag_name);
            return gitlab.get(
              `projects/${encodedProjectId}/releases/${encodedTagName}/assets/links`,
              {
                query: toQuery({ per_page, page }, []),
              }
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
  // manage_release - CQRS Command Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "manage_release",
    {
      name: "manage_release",
      description:
        'MANAGE GitLab releases. Actions: "create" creates release with optional assets, "update" modifies release metadata, "delete" removes release (preserves tag), "create_link" adds asset link, "delete_link" removes asset link.',
      inputSchema: z.toJSONSchema(ManageReleaseSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const input = ManageReleaseSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("manage_release", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for manage_release tool`);
        }

        const encodedProjectId = encodeURIComponent(input.project_id);

        switch (input.action) {
          case "create": {
            const {
              action: _action,
              project_id: _projectId,
              tag_name,
              name,
              description,
              ref,
              tag_message,
              milestones,
              released_at,
              assets,
            } = input;

            const body: Record<string, unknown> = { tag_name };

            if (name !== undefined) body.name = name;
            if (description !== undefined) body.description = description;
            if (ref !== undefined) body.ref = ref;
            if (tag_message !== undefined) body.tag_message = tag_message;
            if (milestones !== undefined) body.milestones = milestones;
            if (released_at !== undefined) body.released_at = released_at;
            if (assets !== undefined) body.assets = assets;

            return gitlab.post(`projects/${encodedProjectId}/releases`, {
              body,
              contentType: "json",
            });
          }

          case "update": {
            const {
              action: _action,
              project_id: _projectId,
              tag_name,
              name,
              description,
              milestones,
              released_at,
            } = input;

            const encodedTagName = encodeURIComponent(tag_name);
            const body: Record<string, unknown> = {};

            if (name !== undefined) body.name = name;
            if (description !== undefined) body.description = description;
            if (milestones !== undefined) body.milestones = milestones;
            if (released_at !== undefined) body.released_at = released_at;

            return gitlab.put(`projects/${encodedProjectId}/releases/${encodedTagName}`, {
              body,
              contentType: "json",
            });
          }

          case "delete": {
            const { tag_name } = input;
            const encodedTagName = encodeURIComponent(tag_name);

            await gitlab.delete(`projects/${encodedProjectId}/releases/${encodedTagName}`);
            return { deleted: true, tag_name };
          }

          case "create_link": {
            const {
              action: _action,
              project_id: _projectId,
              tag_name,
              name,
              url,
              direct_asset_path,
              link_type,
            } = input;

            const encodedTagName = encodeURIComponent(tag_name);
            const body: Record<string, unknown> = { name, url };

            if (direct_asset_path !== undefined) body.direct_asset_path = direct_asset_path;
            if (link_type !== undefined) body.link_type = link_type;

            return gitlab.post(
              `projects/${encodedProjectId}/releases/${encodedTagName}/assets/links`,
              {
                body,
                contentType: "json",
              }
            );
          }

          case "delete_link": {
            const { tag_name, link_id } = input;
            const encodedTagName = encodeURIComponent(tag_name);

            await gitlab.delete(
              `projects/${encodedProjectId}/releases/${encodedTagName}/assets/links/${link_id}`
            );
            return { deleted: true, tag_name, link_id };
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
export function getReleasesReadOnlyToolNames(): string[] {
  return ["browse_releases"];
}

/**
 * Get all tool definitions from the registry
 */
export function getReleasesToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(releasesToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredReleasesTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getReleasesReadOnlyToolNames();
    return Array.from(releasesToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getReleasesToolDefinitions();
}
