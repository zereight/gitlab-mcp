import * as z from "zod";
import { BrowseWikiSchema } from "./schema-readonly";
import { ManageWikiSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { resolveNamespaceForAPI } from "../../utils/namespace";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";
import { isActionDenied } from "../../config";

/**
 * Wiki tools registry - 2 CQRS tools replacing 5 individual tools
 *
 * browse_wiki (Query): list, get
 * manage_wiki (Command): create, update, delete
 */
export const wikiToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // browse_wiki - CQRS Query Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "browse_wiki",
    {
      name: "browse_wiki",
      description:
        'BROWSE wiki pages. Actions: "list" shows all wiki pages in project/group, "get" retrieves single wiki page content by slug.',
      inputSchema: z.toJSONSchema(BrowseWikiSchema),
      handler: async (args: unknown) => {
        const input = BrowseWikiSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("browse_wiki", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for browse_wiki tool`);
        }

        const { entityType, encodedPath } = await resolveNamespaceForAPI(input.namespace);

        switch (input.action) {
          case "list": {
            // TypeScript knows: input has with_content, per_page, page (optional)
            const { action: _action, namespace: _namespace, ...rest } = input;
            const query = toQuery(rest, []);

            return gitlab.get(`${entityType}/${encodedPath}/wikis`, { query });
          }

          case "get": {
            // TypeScript knows: input has slug (required)
            return gitlab.get(
              `${entityType}/${encodedPath}/wikis/${encodeURIComponent(input.slug)}`
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
  // manage_wiki - CQRS Command Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "manage_wiki",
    {
      name: "manage_wiki",
      description:
        'MANAGE wiki pages. Actions: "create" adds new wiki page, "update" modifies existing page, "delete" removes wiki page permanently.',
      inputSchema: z.toJSONSchema(ManageWikiSchema),
      handler: async (args: unknown) => {
        const input = ManageWikiSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("manage_wiki", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for manage_wiki tool`);
        }

        const { entityType, encodedPath } = await resolveNamespaceForAPI(input.namespace);

        switch (input.action) {
          case "create": {
            // TypeScript knows: input has title, content (required), format (optional)
            const { action: _action, namespace: _namespace, ...body } = input;

            return gitlab.post(`${entityType}/${encodedPath}/wikis`, {
              body,
              contentType: "json",
            });
          }

          case "update": {
            // TypeScript knows: input has slug (required), title, content, format (optional)
            const { action: _action, namespace: _namespace, slug, ...body } = input;

            return gitlab.put(`${entityType}/${encodedPath}/wikis/${encodeURIComponent(slug)}`, {
              body,
              contentType: "json",
            });
          }

          case "delete": {
            // TypeScript knows: input has slug (required)
            await gitlab.delete(
              `${entityType}/${encodedPath}/wikis/${encodeURIComponent(input.slug)}`
            );
            return { deleted: true };
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
export function getWikiReadOnlyToolNames(): string[] {
  return ["browse_wiki"];
}

/**
 * Get all tool definitions from the registry
 */
export function getWikiToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(wikiToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredWikiTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getWikiReadOnlyToolNames();
    return Array.from(wikiToolRegistry.values()).filter(tool => readOnlyNames.includes(tool.name));
  }
  return getWikiToolDefinitions();
}
