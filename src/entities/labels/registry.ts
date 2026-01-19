import * as z from "zod";
import { BrowseLabelsSchema } from "./schema-readonly";
import { ManageLabelSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { resolveNamespaceForAPI } from "../../utils/namespace";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";
import { isActionDenied } from "../../config";

/**
 * Labels tools registry - 2 CQRS tools replacing 5 individual tools
 *
 * browse_labels (Query): list, get
 * manage_label (Command): create, update, delete
 */
export const labelsToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // browse_labels - CQRS Query Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "browse_labels",
    {
      name: "browse_labels",
      description:
        'BROWSE labels. Actions: "list" shows all labels in project/group with filtering, "get" retrieves single label details by ID or name.',
      inputSchema: z.toJSONSchema(BrowseLabelsSchema),
      handler: async (args: unknown) => {
        const input = BrowseLabelsSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("browse_labels", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for browse_labels tool`);
        }

        const { entityType, encodedPath } = await resolveNamespaceForAPI(input.namespace);

        switch (input.action) {
          case "list": {
            // TypeScript knows: input has search, with_counts, include_ancestor_groups, per_page, page (optional)
            const { action: _action, namespace: _namespace, ...rest } = input;
            const query = toQuery(rest, []);

            return gitlab.get(`${entityType}/${encodedPath}/labels`, { query });
          }

          case "get": {
            // TypeScript knows: input has label_id (required), include_ancestor_groups (optional)
            const query = input.include_ancestor_groups
              ? toQuery({ include_ancestor_groups: input.include_ancestor_groups }, [])
              : undefined;

            return gitlab.get(
              `${entityType}/${encodedPath}/labels/${encodeURIComponent(input.label_id)}`,
              { query }
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
  // manage_label - CQRS Command Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "manage_label",
    {
      name: "manage_label",
      description:
        'MANAGE labels. Actions: "create" adds new label (requires name and color), "update" modifies existing label, "delete" removes label permanently.',
      inputSchema: z.toJSONSchema(ManageLabelSchema),
      handler: async (args: unknown) => {
        const input = ManageLabelSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("manage_label", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for manage_label tool`);
        }

        const { entityType, encodedPath } = await resolveNamespaceForAPI(input.namespace);

        switch (input.action) {
          case "create": {
            // TypeScript knows: input has name, color (required), description, priority (optional)
            return gitlab.post(`${entityType}/${encodedPath}/labels`, {
              body: {
                name: input.name,
                color: input.color,
                description: input.description,
                priority: input.priority,
              },
              contentType: "json",
            });
          }

          case "update": {
            // TypeScript knows: input has label_id (required), name, new_name, color, description, priority (optional)
            const {
              action: _action,
              namespace: _namespace,
              label_id,
              name: _name,
              ...body
            } = input;

            return gitlab.put(
              `${entityType}/${encodedPath}/labels/${encodeURIComponent(label_id)}`,
              { body, contentType: "json" }
            );
          }

          case "delete": {
            // TypeScript knows: input has label_id (required)
            await gitlab.delete(
              `${entityType}/${encodedPath}/labels/${encodeURIComponent(input.label_id)}`
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
export function getLabelsReadOnlyToolNames(): string[] {
  return ["browse_labels"];
}

/**
 * Get all tool definitions from the registry
 */
export function getLabelsToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(labelsToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredLabelsTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getLabelsReadOnlyToolNames();
    return Array.from(labelsToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getLabelsToolDefinitions();
}
