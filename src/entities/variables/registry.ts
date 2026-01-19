import * as z from "zod";
import { BrowseVariablesSchema } from "./schema-readonly";
import { ManageVariableSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { resolveNamespaceForAPI } from "../../utils/namespace";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";
import { assertDefined } from "../utils";

/**
 * Variables tools registry - 2 CQRS tools replacing 5 individual tools
 *
 * browse_variables (Query): list, get
 * manage_variable (Command): create, update, delete
 */
export const variablesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // browse_variables - CQRS Query Tool
  // ============================================================================
  [
    "browse_variables",
    {
      name: "browse_variables",
      description:
        'BROWSE CI/CD variables. Actions: "list" shows all variables in project/group with pagination, "get" retrieves single variable details by key with optional environment scope filter.',
      inputSchema: z.toJSONSchema(BrowseVariablesSchema),
      handler: async (args: unknown) => {
        const input = BrowseVariablesSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(input.namespace);

        switch (input.action) {
          case "list": {
            const {
              action: _action,
              namespace: _namespace,
              key: _key,
              filter: _filter,
              ...rest
            } = input;
            const query = toQuery(rest, []);

            return gitlab.get(`${entityType}/${encodedPath}/variables`, { query });
          }

          case "get": {
            // key is required for get action (validated by .refine())
            assertDefined(input.key, "key");
            const query: Record<string, string | undefined> = {};
            if (input.filter?.environment_scope) {
              query["filter[environment_scope]"] = input.filter.environment_scope;
            }

            return gitlab.get(
              `${entityType}/${encodedPath}/variables/${encodeURIComponent(input.key)}`,
              { query }
            );
          }

          /* istanbul ignore next -- unreachable with Zod validation */
          default:
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
        }
      },
    },
  ],

  // ============================================================================
  // manage_variable - CQRS Command Tool
  // ============================================================================
  [
    "manage_variable",
    {
      name: "manage_variable",
      description:
        'MANAGE CI/CD variables. Actions: "create" adds new variable (requires key and value), "update" modifies existing variable, "delete" removes variable permanently. Supports environment scoping and protection settings.',
      inputSchema: z.toJSONSchema(ManageVariableSchema),
      handler: async (args: unknown) => {
        const input = ManageVariableSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(input.namespace);

        switch (input.action) {
          case "create": {
            // value is required for create action (validated by .refine())
            assertDefined(input.value, "value");

            const { action: _action, namespace: _namespace, filter: _filter, ...body } = input;

            return gitlab.post(`${entityType}/${encodedPath}/variables`, {
              body,
              contentType: "json",
            });
          }

          case "update": {
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

          /* istanbul ignore next -- unreachable with Zod validation */
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
