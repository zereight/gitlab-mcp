import * as z from "zod";
import { ListLabelsSchema, GetLabelSchema } from "./schema-readonly";
import { CreateLabelSchema, UpdateLabelSchema, DeleteLabelSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { resolveNamespaceForAPI } from "../../utils/namespace";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Labels tools registry - unified registry containing all labels tools with their handlers
 */
export const labelsToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  [
    "list_labels",
    {
      name: "list_labels",
      description:
        "DISCOVER FIRST: Browse all existing labels in a project or group - RUN THIS BEFORE creating new labels! Use when: Choosing labels for issues/MRs, Understanding established taxonomy, Avoiding duplicate label creation. Returns label names, colors, descriptions, and priorities. Group labels are inherited by all projects. See also: create_label (only after checking existing labels).",
      inputSchema: z.toJSONSchema(ListLabelsSchema),
      handler: async (args: unknown) => {
        const options = ListLabelsSchema.parse(args);
        const { namespace } = options;
        const entityType = namespace.includes("/") ? "projects" : "groups";

        return gitlab.get(`${entityType}/${encodeURIComponent(namespace)}/labels`, {
          query: toQuery(options, ["namespace"]),
        });
      },
    },
  ],
  [
    "get_label",
    {
      name: "get_label",
      description:
        "READ: Retrieve details of a specific label by ID or name. Use when: Getting full label information including color and description, Checking label usage statistics, Validating label properties. Works for both project-specific and group-inherited labels. See also: list_labels to browse all available labels first.",
      inputSchema: z.toJSONSchema(GetLabelSchema),
      handler: async (args: unknown) => {
        const options = GetLabelSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        return gitlab.get(
          `${entityType}/${encodedPath}/labels/${encodeURIComponent(options.label_id)}`
        );
      },
    },
  ],
  [
    "create_label",
    {
      name: "create_label",
      description:
        "CREATE CAREFULLY: Add a new label ONLY after running list_labels to check existing taxonomy! Use when: Existing labels do not fit your needs, Establishing new project taxonomy. AVOID: Creating duplicates of existing labels with slight variations. Requires name and color (hex format like #FF0000). Group labels automatically become available to all child projects. See also: list_labels (run first to discover existing labels).",
      inputSchema: z.toJSONSchema(CreateLabelSchema),
      handler: async (args: unknown) => {
        const options = CreateLabelSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        return gitlab.post(`${entityType}/${encodedPath}/labels`, {
          body: {
            name: options.name,
            color: options.color,
            description: options.description,
            priority: options.priority,
          },
        });
      },
    },
  ],
  [
    "update_label",
    {
      name: "update_label",
      description:
        "UPDATE: Modify label properties including name, color, description, or priority. Use when: Refining categorization system, Updating label appearance, Standardizing label naming. Changes apply immediately to all tagged items. Renaming updates all existing references automatically. See also: list_labels to understand current taxonomy before changes.",
      inputSchema: z.toJSONSchema(UpdateLabelSchema),
      handler: async (args: unknown) => {
        const options = UpdateLabelSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        const { namespace: _namespace, label_id, ...body } = options;
        return gitlab.put(`${entityType}/${encodedPath}/labels/${encodeURIComponent(label_id)}`, {
          body,
        });
      },
    },
  ],
  [
    "delete_label",
    {
      name: "delete_label",
      description:
        "DELETE: Remove a label permanently from project or group. Use when: Cleaning up unused labels, Reorganizing taxonomy. WARNING: Removes label from all issues and MRs without replacement. Consider updating items before deletion. Cannot be undone. See also: list_labels to check label usage before deletion.",
      inputSchema: z.toJSONSchema(DeleteLabelSchema),
      handler: async (args: unknown) => {
        const options = DeleteLabelSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        await gitlab.delete(
          `${entityType}/${encodedPath}/labels/${encodeURIComponent(options.label_id)}`
        );
        return { success: true, message: "Label deleted successfully" };
      },
    },
  ],
]);

export function getLabelsReadOnlyToolNames(): string[] {
  return ["list_labels", "get_label"];
}

export function getLabelsToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(labelsToolRegistry.values());
}

export function getFilteredLabelsTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getLabelsReadOnlyToolNames();
    return Array.from(labelsToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getLabelsToolDefinitions();
}
