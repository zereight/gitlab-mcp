import * as z from "zod";
import { BrowseVariablesSchema } from "./schema-readonly";
import { ManageVariableSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { resolveNamespaceForAPI } from "../../utils/namespace";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";
import { isActionDenied } from "../../config";

/**
 * Variables tools registry - 2 CQRS tools replacing 5 individual tools
 *
 * browse_variables (Query): list, get
 * manage_variable (Command): create, update, delete
 */
export const variablesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // browse_variables - CQRS Query Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "browse_variables",
    {
      name: "browse_variables",
      description:
        'BROWSE CI/CD variables. Actions: "list" shows all variables in project/group with pagination, "get" retrieves single variable details by key with optional environment scope filter.',
      inputSchema: z.toJSONSchema(BrowseVariablesSchema),
      gate: { envVar: "USE_VARIABLES", defaultValue: true },
      handler: async (args: unknown) => {
        const input = BrowseVariablesSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("browse_variables", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for browse_variables tool`);
        }

        const { entityType, encodedPath } = await resolveNamespaceForAPI(input.namespace);

        switch (input.action) {
          case "list": {
            // TypeScript knows: input has per_page, page (optional)
            const { action: _action, namespace: _namespace, ...rest } = input;
            const query = toQuery(rest, []);

            return gitlab.get(`${entityType}/${encodedPath}/variables`, { query });
          }

          case "get": {
            // TypeScript knows: input has key (required), filter (optional)
            const query: Record<string, string | undefined> = {};
            if (input.filter?.environment_scope) {
              query["filter[environment_scope]"] = input.filter.environment_scope;
            }

            return gitlab.get(
              `${entityType}/${encodedPath}/variables/${encodeURIComponent(input.key)}`,
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
  // manage_variable - CQRS Command Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "manage_variable",
    {
      name: "manage_variable",
      description:
        'MANAGE CI/CD variables. Actions: "create" adds new variable (requires key and value), "update" modifies existing variable, "delete" removes variable permanently. Supports environment scoping and protection settings.',
      inputSchema: z.toJSONSchema(ManageVariableSchema),
      gate: { envVar: "USE_VARIABLES", defaultValue: true },
      handler: async (args: unknown) => {
        const input = ManageVariableSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("manage_variable", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for manage_variable tool`);
        }

        const { entityType, encodedPath } = await resolveNamespaceForAPI(input.namespace);

        switch (input.action) {
          case "create": {
            // TypeScript knows: input has key, value (required), variable_type, environment_scope, etc. (optional)
            const { action: _action, namespace: _namespace, ...body } = input;

            return gitlab.post(`${entityType}/${encodedPath}/variables`, {
              body,
              contentType: "json",
            });
          }

          case "update": {
            // TypeScript knows: input has key (required), value, filter, etc. (optional)
            const { action: _action, namespace: _namespace, key, filter, ...body } = input;

            const query: Record<string, string | undefined> = {};
            if (filter?.environment_scope) {
              query["filter[environment_scope]"] = filter.environment_scope;
            }

            return gitlab.put(`${entityType}/${encodedPath}/variables/${encodeURIComponent(key)}`, {
              query,
              body,
              contentType: "json",
            });
          }

          case "delete": {
            // TypeScript knows: input has key (required), filter (optional)
            const query: Record<string, string | undefined> = {};
            if (input.filter?.environment_scope) {
              query["filter[environment_scope]"] = input.filter.environment_scope;
            }

            await gitlab.delete(
              `${entityType}/${encodedPath}/variables/${encodeURIComponent(input.key)}`,
              { query }
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
export function getVariablesReadOnlyToolNames(): string[] {
  return ["browse_variables"];
}

/**
 * Get all tool definitions from the registry
 */
export function getVariablesToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(variablesToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredVariablesTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getVariablesReadOnlyToolNames();
    return Array.from(variablesToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getVariablesToolDefinitions();
}
