import * as z from "zod";
import { ListVariablesSchema, GetVariableSchema } from "./schema-readonly";
import { CreateVariableSchema, UpdateVariableSchema, DeleteVariableSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { resolveNamespaceForAPI } from "../../utils/namespace";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Variables tools registry - unified registry containing all variable operation tools with their handlers
 */
export const variablesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  [
    "list_variables",
    {
      name: "list_variables",
      description:
        "View all CI/CD environment variables configured for pipelines. Use to audit secrets, review configuration, or understand pipeline environment. Shows variable keys (values are masked for security). Returns protection status, masking, and environment scopes. Group variables are inherited by all projects.",
      inputSchema: z.toJSONSchema(ListVariablesSchema),
      handler: async (args: unknown) => {
        const options = ListVariablesSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        return gitlab.get(`${entityType}/${encodedPath}/variables`, {
          query: toQuery(options, ["namespace"]),
        });
      },
    },
  ],
  [
    "get_variable",
    {
      name: "get_variable",
      description:
        "Retrieve specific CI/CD variable details including value (if not masked), type, and security settings. Use for debugging pipeline issues, verifying configuration, or checking environment-specific values. Supports scoped variables for different environments (production/staging).",
      inputSchema: z.toJSONSchema(GetVariableSchema),
      handler: async (args: unknown) => {
        const options = GetVariableSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        const query: Record<string, string | undefined> = {};
        if (options.filter?.environment_scope) {
          query["filter[environment_scope]"] = options.filter.environment_scope;
        }

        return gitlab.get(
          `${entityType}/${encodedPath}/variables/${encodeURIComponent(options.key)}`,
          {
            query,
          }
        );
      },
    },
  ],
  [
    "create_variable",
    {
      name: "create_variable",
      description:
        "Add new CI/CD environment variable for pipeline configuration, secrets, or deployment settings. Use for API keys, database URLs, feature flags. Supports masking sensitive values, protection for specific branches, environment scoping, and file type for certificates/configs. Group variables apply to all child projects.",
      inputSchema: z.toJSONSchema(CreateVariableSchema),
      handler: async (args: unknown) => {
        const options = CreateVariableSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);
        const { namespace: _namespace, ...body } = options;

        return gitlab.post(`${entityType}/${encodedPath}/variables`, {
          body,
          contentType: "json",
        });
      },
    },
  ],
  [
    "update_variable",
    {
      name: "update_variable",
      description:
        "Modify CI/CD variable value or configuration. Use to rotate secrets, update endpoints, change security settings, or adjust environment scopes. Can convert between env_var and file types. Changes take effect in next pipeline run. Be cautious with production variables.",
      inputSchema: z.toJSONSchema(UpdateVariableSchema),
      handler: async (args: unknown) => {
        const options = UpdateVariableSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);
        const { namespace: _namespace, key, filter, ...body } = options;

        const query: Record<string, string | undefined> = {};
        if (filter?.environment_scope) {
          query["filter[environment_scope]"] = filter.environment_scope;
        }

        return gitlab.put(`${entityType}/${encodedPath}/variables/${encodeURIComponent(key)}`, {
          query,
          body,
          contentType: "json",
        });
      },
    },
  ],
  [
    "delete_variable",
    {
      name: "delete_variable",
      description:
        "Delete CI/CD variable permanently from configuration. Use to remove unused secrets, clean up after migrations, or revoke access. Can target specific environment-scoped variants. Warning: may break pipelines depending on the variable. Cannot be undone.",
      inputSchema: z.toJSONSchema(DeleteVariableSchema),
      handler: async (args: unknown) => {
        const options = DeleteVariableSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        const query: Record<string, string | undefined> = {};
        if (options.filter?.environment_scope) {
          query["filter[environment_scope]"] = options.filter.environment_scope;
        }

        await gitlab.delete(
          `${entityType}/${encodedPath}/variables/${encodeURIComponent(options.key)}`,
          {
            query,
          }
        );
        return { deleted: true };
      },
    },
  ],
]);

export function getVariablesReadOnlyToolNames(): string[] {
  return ["list_variables", "get_variable"];
}

export function getVariablesToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(variablesToolRegistry.values());
}

export function getFilteredVariablesTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getVariablesReadOnlyToolNames();
    return Array.from(variablesToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getVariablesToolDefinitions();
}
