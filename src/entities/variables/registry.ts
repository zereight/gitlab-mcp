/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as z from "zod";
import { ListVariablesSchema, GetVariableSchema } from "./schema-readonly";
import { CreateVariableSchema, UpdateVariableSchema, DeleteVariableSchema } from "./schema";
import { enhancedFetch } from "../../utils/fetch";
import { cleanGidsFromObject } from "../../utils/idConversion";

// GitLab API error response interface
interface GitLabErrorResponse {
  message?: string | { value?: string[] };
  error?: string;
  errors?: Record<string, string | string[]>;
}
import { resolveNamespaceForAPI } from "../../utils/namespace";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Variables tools registry - unified registry containing all variable operation tools with their handlers
 */
export const variablesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // Read-only tools
  [
    "list_variables",
    {
      name: "list_variables",
      description:
        "View all CI/CD environment variables configured for pipelines. Use to audit secrets, review configuration, or understand pipeline environment. Shows variable keys (values are masked for security). Returns protection status, masking, and environment scopes. Group variables are inherited by all projects.",
      inputSchema: z.toJSONSchema(ListVariablesSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListVariablesSchema.parse(args);
        const { namespace } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/variables`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          let errorMessage = `GitLab API error: ${response.status} ${response.statusText}`;
          try {
            const text = await response.text();
            if (!text.trim()) {
              throw new Error(errorMessage);
            }
            const errorResponse = JSON.parse(text) as GitLabErrorResponse;
            if (errorResponse.message) {
              if (typeof errorResponse.message === "string") {
                errorMessage += ` - ${errorResponse.message}`;
              } else if (
                errorResponse.message.value &&
                Array.isArray(errorResponse.message.value)
              ) {
                errorMessage += ` - ${errorResponse.message.value.join(", ")}`;
              } else {
                errorMessage += ` - ${JSON.stringify(errorResponse.message)}`;
              }
            }
            if (errorResponse.error) {
              errorMessage += ` - ${errorResponse.error}`;
            }
          } catch {
            // If error response can't be parsed, use the basic message
          }
          throw new Error(errorMessage);
        }

        const variables = await response.json();
        return cleanGidsFromObject(variables);
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
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetVariableSchema.parse(args);
        const { namespace, key, filter } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const queryParams = new URLSearchParams();
        if (filter?.environment_scope) {
          queryParams.set("filter[environment_scope]", filter.environment_scope);
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/variables/${encodeURIComponent(key)}?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          let errorMessage = `GitLab API error: ${response.status} ${response.statusText}`;
          try {
            const text = await response.text();
            if (!text.trim()) {
              throw new Error(errorMessage);
            }
            const errorResponse = JSON.parse(text) as GitLabErrorResponse;
            if (errorResponse.message) {
              if (typeof errorResponse.message === "string") {
                errorMessage += ` - ${errorResponse.message}`;
              } else if (
                errorResponse.message.value &&
                Array.isArray(errorResponse.message.value)
              ) {
                errorMessage += ` - ${errorResponse.message.value.join(", ")}`;
              } else {
                errorMessage += ` - ${JSON.stringify(errorResponse.message)}`;
              }
            }
            if (errorResponse.error) {
              errorMessage += ` - ${errorResponse.error}`;
            }
          } catch {
            // If error response can't be parsed, use the basic message
          }
          throw new Error(errorMessage);
        }

        const variable = await response.json();
        return cleanGidsFromObject(variable);
      },
    },
  ],
  // Write tools
  [
    "create_variable",
    {
      name: "create_variable",
      description:
        "Add new CI/CD environment variable for pipeline configuration, secrets, or deployment settings. Use for API keys, database URLs, feature flags. Supports masking sensitive values, protection for specific branches, environment scoping, and file type for certificates/configs. Group variables apply to all child projects.",
      inputSchema: z.toJSONSchema(CreateVariableSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateVariableSchema.parse(args);
        const { namespace } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const body: Record<string, unknown> = {};
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== "namespace") {
            body[key] = value;
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/variables`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let errorMessage = `GitLab API error: ${response.status} ${response.statusText}`;
          try {
            const text = await response.text();
            if (!text.trim()) {
              throw new Error(errorMessage);
            }
            const errorResponse = JSON.parse(text) as GitLabErrorResponse;
            if (errorResponse.message) {
              if (typeof errorResponse.message === "string") {
                errorMessage += ` - ${errorResponse.message}`;
              } else if (
                errorResponse.message.value &&
                Array.isArray(errorResponse.message.value)
              ) {
                errorMessage += ` - ${errorResponse.message.value.join(", ")}`;
              } else {
                errorMessage += ` - ${JSON.stringify(errorResponse.message)}`;
              }
            }
            if (errorResponse.error) {
              errorMessage += ` - ${errorResponse.error}`;
            }
          } catch {
            // If error response can't be parsed, use the basic message
          }
          throw new Error(errorMessage);
        }

        const variable = await response.json();
        return cleanGidsFromObject(variable);
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
      handler: async (args: unknown): Promise<unknown> => {
        const options = UpdateVariableSchema.parse(args);
        const { namespace, key, filter } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const body: Record<string, unknown> = {};
        Object.entries(options).forEach(([k, value]) => {
          if (
            value !== undefined &&
            value !== null &&
            k !== "namespace" &&
            k !== "key" &&
            k !== "filter"
          ) {
            body[k] = value;
          }
        });

        // Add filter as query parameter if provided
        const queryParams = new URLSearchParams();
        if (filter?.environment_scope) {
          queryParams.set("filter[environment_scope]", filter.environment_scope);
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/variables/${encodeURIComponent(key)}?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let errorMessage = `GitLab API error: ${response.status} ${response.statusText}`;
          try {
            const text = await response.text();
            if (!text.trim()) {
              throw new Error(errorMessage);
            }
            const errorResponse = JSON.parse(text) as GitLabErrorResponse;
            if (errorResponse.message) {
              if (typeof errorResponse.message === "string") {
                errorMessage += ` - ${errorResponse.message}`;
              } else if (
                errorResponse.message.value &&
                Array.isArray(errorResponse.message.value)
              ) {
                errorMessage += ` - ${errorResponse.message.value.join(", ")}`;
              } else {
                errorMessage += ` - ${JSON.stringify(errorResponse.message)}`;
              }
            }
            if (errorResponse.error) {
              errorMessage += ` - ${errorResponse.error}`;
            }
          } catch {
            // If error response can't be parsed, use the basic message
          }
          throw new Error(errorMessage);
        }

        const variable = await response.json();
        return cleanGidsFromObject(variable);
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
      handler: async (args: unknown): Promise<unknown> => {
        const options = DeleteVariableSchema.parse(args);
        const { namespace, key, filter } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        // Add filter as query parameter if provided
        const queryParams = new URLSearchParams();
        if (filter?.environment_scope) {
          queryParams.set("filter[environment_scope]", filter.environment_scope);
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/variables/${encodeURIComponent(key)}?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          let errorMessage = `GitLab API error: ${response.status} ${response.statusText}`;
          try {
            const text = await response.text();
            if (!text.trim()) {
              throw new Error(errorMessage);
            }
            const errorResponse = JSON.parse(text) as GitLabErrorResponse;
            if (errorResponse.message) {
              if (typeof errorResponse.message === "string") {
                errorMessage += ` - ${errorResponse.message}`;
              } else if (
                errorResponse.message.value &&
                Array.isArray(errorResponse.message.value)
              ) {
                errorMessage += ` - ${errorResponse.message.value.join(", ")}`;
              } else {
                errorMessage += ` - ${JSON.stringify(errorResponse.message)}`;
              }
            }
            if (errorResponse.error) {
              errorMessage += ` - ${errorResponse.error}`;
            }
          } catch {
            // If error response can't be parsed, use the basic message
          }
          throw new Error(errorMessage);
        }

        // DELETE returns 204 No Content on success
        const result = response.status === 204 ? { deleted: true } : await response.json();
        return cleanGidsFromObject(result);
      },
    },
  ],
]);

/**
 * Get read-only tool names from the registry
 */
export function getVariablesReadOnlyToolNames(): string[] {
  return ["list_variables", "get_variable"];
}

/**
 * Get all tool definitions from the registry (for backward compatibility)
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
