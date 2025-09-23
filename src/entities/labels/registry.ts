/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { zodToJsonSchema } from "zod-to-json-schema";
import { ListLabelsSchema, GetLabelSchema } from "./schema-readonly";
import { CreateLabelSchema, UpdateLabelSchema, DeleteLabelSchema } from "./schema";
import { enhancedFetch } from "../../utils/fetch";
import { resolveNamespaceForAPI } from "../../utils/namespace";
import { cleanGidsFromObject } from "../../utils/idConversion";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Labels tools registry - unified registry containing all labels tools with their handlers
 */
export const labelsToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // Read-only tools
  [
    "list_labels",
    {
      name: "list_labels",
      description:
        "DISCOVER FIRST: Browse all existing labels in a project or group - RUN THIS BEFORE creating new labels! Use when: Choosing labels for issues/MRs, Understanding established taxonomy, Avoiding duplicate label creation. Returns label names, colors, descriptions, and priorities. Group labels are inherited by all projects. See also: create_label (only after checking existing labels).",
      inputSchema: zodToJsonSchema(ListLabelsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListLabelsSchema.parse(args);
        const { namespace } = options;

        // Try to auto-detect if it's a project or group by checking for presence of a project
        // If it contains a slash, it's likely a project path (group/project)
        // If no slash, it's likely a group path
        const isProject = namespace.includes("/");
        const entityType = isProject ? "projects" : "groups";

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "namespace") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodeURIComponent(namespace)}/labels?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const labels = await response.json();
        return cleanGidsFromObject(labels);
      },
    },
  ],
  [
    "get_label",
    {
      name: "get_label",
      description:
        "READ: Retrieve details of a specific label by ID or name. Use when: Getting full label information including color and description, Checking label usage statistics, Validating label properties. Works for both project-specific and group-inherited labels. See also: list_labels to browse all available labels first.",
      inputSchema: zodToJsonSchema(GetLabelSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetLabelSchema.parse(args);
        const { namespace, label_id } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/labels/${encodeURIComponent(label_id)}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const label = await response.json();
        return cleanGidsFromObject(label);
      },
    },
  ],
  // Write tools
  [
    "create_label",
    {
      name: "create_label",
      description:
        "CREATE CAREFULLY: Add a new label ONLY after running list_labels to check existing taxonomy! Use when: Existing labels do not fit your needs, Establishing new project taxonomy. AVOID: Creating duplicates of existing labels with slight variations. Requires name and color (hex format like #FF0000). Group labels automatically become available to all child projects. See also: list_labels (run first to discover existing labels).",
      inputSchema: zodToJsonSchema(CreateLabelSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateLabelSchema.parse(args);
        const { namespace } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const body = new URLSearchParams();
        body.set("name", options.name);
        body.set("color", options.color);
        if (options.description) {
          body.set("description", options.description);
        }
        if (options.priority !== undefined) {
          body.set("priority", String(options.priority));
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/labels`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const label = await response.json();
        return cleanGidsFromObject(label);
      },
    },
  ],
  [
    "update_label",
    {
      name: "update_label",
      description:
        "UPDATE: Modify label properties including name, color, description, or priority. Use when: Refining categorization system, Updating label appearance, Standardizing label naming. Changes apply immediately to all tagged items. Renaming updates all existing references automatically. See also: list_labels to understand current taxonomy before changes.",
      inputSchema: zodToJsonSchema(UpdateLabelSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = UpdateLabelSchema.parse(args);
        const { namespace, label_id } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const body = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && key !== "namespace" && key !== "label_id") {
            body.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/labels/${encodeURIComponent(label_id)}`;
        const response = await enhancedFetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const label = await response.json();
        return cleanGidsFromObject(label);
      },
    },
  ],
  [
    "delete_label",
    {
      name: "delete_label",
      description:
        "DELETE: Remove a label permanently from project or group. Use when: Cleaning up unused labels, Reorganizing taxonomy. WARNING: Removes label from all issues and MRs without replacement. Consider updating items before deletion. Cannot be undone. See also: list_labels to check label usage before deletion.",
      inputSchema: zodToJsonSchema(DeleteLabelSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = DeleteLabelSchema.parse(args);
        const { namespace, label_id } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/labels/${encodeURIComponent(label_id)}`;
        const response = await enhancedFetch(apiUrl, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        return { success: true, message: "Label deleted successfully" };
      },
    },
  ],
]);

/**
 * Get read-only tool names from the registry
 */
export function getLabelsReadOnlyToolNames(): string[] {
  return ["list_labels", "get_label"];
}

/**
 * Get all tool definitions from the registry (for backward compatibility)
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
