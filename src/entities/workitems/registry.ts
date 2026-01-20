import * as z from "zod";
import { BrowseWorkItemsSchema } from "./schema-readonly";
import { ManageWorkItemSchema } from "./schema";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";
import { ConnectionManager } from "../../services/ConnectionManager";
import { isActionDenied } from "../../config";
import { getWorkItemTypes } from "../../utils/workItemTypes";
import {
  cleanWorkItemResponse,
  toGid,
  toGids,
  type GitLabWorkItem,
} from "../../utils/idConversion";

// Define interface for work item type objects
interface WorkItemType {
  id: string;
  name: string;
}

import {
  CREATE_WORK_ITEM_WITH_WIDGETS,
  WorkItemCreateInput,
  GET_NAMESPACE_WORK_ITEMS,
  GET_WORK_ITEM,
  UPDATE_WORK_ITEM,
  DELETE_WORK_ITEM,
  WorkItemUpdateInput,
  WorkItem as GraphQLWorkItem,
} from "../../graphql/workItems";

// Types for work item structure - flexible widget interface for runtime processing
interface FlexibleWorkItemWidget {
  type: string;
  assignees?: {
    nodes?: Array<{
      id: string;
      username: string;
      name: string;
    }>;
  };
  labels?: {
    nodes?: Array<{
      id: string;
      title: string;
      color: string;
    }>;
  };
  milestone?: {
    id: string;
    title: string;
    state: string;
  };
  parent?: {
    id: string;
    iid: string;
    title: string;
    workItemType: string;
  };
  hasChildren?: boolean;
}

interface SimplifiedWorkItem {
  id: string;
  iid: string;
  title: string;
  state: string;
  workItemType: string;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  widgets?: Array<{
    type: string;
    assignees?: Array<{
      id: string;
      username: string;
      name: string;
    }>;
    labels?: Array<{
      id: string;
      title: string;
      color: string;
    }>;
    milestone?: {
      id: string;
      title: string;
      state: string;
    };
    parent?: {
      id: string;
      iid: string;
      title: string;
      workItemType: string;
    } | null;
    hasChildren?: boolean;
  }>;
}

// Function to simplify work item structure for agent consumption
const simplifyWorkItem = (
  workItem: GraphQLWorkItem,
  simple: boolean
): GraphQLWorkItem | SimplifiedWorkItem => {
  if (!simple) return workItem;

  const simplified: SimplifiedWorkItem = {
    id: workItem.id,
    iid: workItem.iid,
    title: workItem.title,
    state: workItem.state,
    workItemType:
      typeof workItem.workItemType === "string"
        ? workItem.workItemType
        : workItem.workItemType?.name || "Unknown",
    webUrl: workItem.webUrl,
    createdAt: workItem.createdAt,
    updatedAt: workItem.updatedAt,
  };

  // Add description if it exists and is not too long
  if (workItem.description && typeof workItem.description === "string") {
    simplified.description =
      workItem.description.length > 200
        ? workItem.description.substring(0, 200) + "..."
        : workItem.description;
  }

  // Extract essential widgets only
  if (workItem.widgets && Array.isArray(workItem.widgets)) {
    const essentialWidgets: SimplifiedWorkItem["widgets"] = [];

    for (const widget of workItem.widgets) {
      // Use type assertion to access widget properties dynamically
      const flexWidget = widget as unknown as FlexibleWorkItemWidget;

      switch (flexWidget.type) {
        case "ASSIGNEES":
          if (flexWidget.assignees?.nodes && flexWidget.assignees.nodes.length > 0) {
            essentialWidgets.push({
              type: "ASSIGNEES",
              assignees: flexWidget.assignees.nodes.map(assignee => ({
                id: assignee.id,
                username: assignee.username,
                name: assignee.name,
              })),
            });
          }
          break;
        case "LABELS":
          if (flexWidget.labels?.nodes && flexWidget.labels.nodes.length > 0) {
            essentialWidgets.push({
              type: "LABELS",
              labels: flexWidget.labels.nodes.map(label => ({
                id: label.id,
                title: label.title,
                color: label.color,
              })),
            });
          }
          break;
        case "MILESTONE":
          if (flexWidget.milestone) {
            essentialWidgets.push({
              type: "MILESTONE",
              milestone: {
                id: flexWidget.milestone.id,
                title: flexWidget.milestone.title,
                state: flexWidget.milestone.state,
              },
            });
          }
          break;
        case "HIERARCHY":
          if (flexWidget.parent || flexWidget.hasChildren) {
            essentialWidgets.push({
              type: "HIERARCHY",
              parent: flexWidget.parent
                ? {
                    id: flexWidget.parent.id,
                    iid: flexWidget.parent.iid,
                    title: flexWidget.parent.title,
                    workItemType: flexWidget.parent.workItemType,
                  }
                : null,
              hasChildren: flexWidget.hasChildren,
            });
          }
          break;
      }
    }

    if (essentialWidgets && essentialWidgets.length > 0) {
      simplified.widgets = essentialWidgets;
    }
  }

  return simplified;
};

/**
 * Work items tools registry - 2 CQRS tools replacing 5 individual tools
 *
 * browse_work_items (Query): list, get
 * manage_work_item (Command): create, update, delete
 */
export const workitemsToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // browse_work_items - CQRS Query Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "browse_work_items",
    {
      name: "browse_work_items",
      description:
        'BROWSE work items. Actions: "list" shows work items with filtering (groups return epics, projects return issues/tasks), "get" retrieves single work item by ID with full widget details.',
      inputSchema: z.toJSONSchema(BrowseWorkItemsSchema),
      gate: { envVar: "USE_WORKITEMS", defaultValue: true },
      handler: async (args: unknown): Promise<unknown> => {
        const input = BrowseWorkItemsSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("browse_work_items", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for browse_work_items tool`);
        }

        switch (input.action) {
          case "list": {
            // TypeScript knows: input has namespace (required), types, state, first, after, simple (optional)
            const { namespace, types, state, first, after, simple } = input;
            const namespacePath = namespace;

            console.log("browse_work_items list called with:", {
              namespace: namespacePath,
              types,
              state,
              first,
              after,
              simple,
            });

            // Get GraphQL client from ConnectionManager
            const connectionManager = ConnectionManager.getInstance();
            const client = connectionManager.getClient();

            // For the work items GraphQL query, use type names as-is (GraphQL expects enum values)
            const resolvedTypes: string[] | undefined = types;

            // Query the namespace (works for both groups and projects)
            const workItemsResponse = await client.request(GET_NAMESPACE_WORK_ITEMS, {
              namespacePath,
              types: resolvedTypes,
              first: first || 20,
              after: after,
            });

            // Extract work items and pagination info from namespace response
            const workItemsData = workItemsResponse.namespace?.workItems;
            const allItems = workItemsData?.nodes ?? [];
            const pageInfo = {
              hasNextPage: workItemsData?.pageInfo?.hasNextPage ?? false,
              endCursor: workItemsData?.pageInfo?.endCursor ?? null,
            };
            const namespaceType = workItemsResponse.namespace?.__typename ?? "Unknown";

            console.log(`Found ${allItems.length} work items from ${namespaceType} query`);

            // Apply state filtering (client-side since GitLab API doesn't support it reliably)
            const filteredItems = allItems.filter((item: GraphQLWorkItem) => {
              return state.includes(item.state as "OPEN" | "CLOSED");
            });

            console.log(
              `State filtering: ${allItems.length} -> ${filteredItems.length} items (keeping: ${state.join(", ")})`
            );

            // Apply simplification if requested and clean GIDs
            const finalResults = filteredItems.map((item: GraphQLWorkItem) => {
              const cleanedItem = cleanWorkItemResponse(item as unknown as GitLabWorkItem);
              return simplifyWorkItem(cleanedItem as GraphQLWorkItem, simple);
            });

            console.log("Final result - total work items found:", finalResults.length);

            // Return object with items and server-side pagination info
            return {
              items: finalResults,
              hasMore: pageInfo.hasNextPage ?? false,
              endCursor: pageInfo.endCursor ?? null,
            };
          }

          case "get": {
            // TypeScript knows: input has id (required)
            const workItemId = input.id;

            // Get GraphQL client from ConnectionManager
            const connectionManager = ConnectionManager.getInstance();
            const client = connectionManager.getClient();

            // Convert simple ID to GID for API call
            const workItemGid = toGid(workItemId, "WorkItem");

            // Use GraphQL query for getting work item details
            const response = await client.request(GET_WORK_ITEM, { id: workItemGid });

            if (!response.workItem) {
              throw new Error(`Work item with ID "${workItemId}" not found`);
            }

            return cleanWorkItemResponse(response.workItem as unknown as GitLabWorkItem);
          }

          /* istanbul ignore next -- unreachable with Zod discriminatedUnion */
          default:
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
        }
      },
    },
  ],

  // ============================================================================
  // manage_work_item - CQRS Command Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "manage_work_item",
    {
      name: "manage_work_item",
      description:
        'MANAGE work items. Actions: "create" creates new work item (Epics need GROUP namespace, Issues/Tasks need PROJECT), "update" modifies properties/widgets, "delete" permanently removes.',
      inputSchema: z.toJSONSchema(ManageWorkItemSchema),
      gate: { envVar: "USE_WORKITEMS", defaultValue: true },
      handler: async (args: unknown): Promise<unknown> => {
        const input = ManageWorkItemSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("manage_work_item", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for manage_work_item tool`);
        }

        switch (input.action) {
          case "create": {
            // TypeScript knows: input has namespace, title, workItemType (required), description, assigneeIds, labelIds, milestoneId (optional)
            const {
              namespace,
              title,
              workItemType,
              description,
              assigneeIds,
              labelIds,
              milestoneId,
            } = input;
            const namespacePath = namespace;
            const workItemTitle = title;
            const workItemTypeName = workItemType;

            // Get GraphQL client from ConnectionManager
            const connectionManager = ConnectionManager.getInstance();
            const client = connectionManager.getClient();

            // Convert simple type name to work item type GID
            const workItemTypes = await getWorkItemTypes(namespacePath);
            const workItemTypeObj = workItemTypes.find(
              (t: WorkItemType) =>
                t.name.toUpperCase().replace(/\s+/g, "_") ===
                workItemTypeName.toUpperCase().replace(/\s+/g, "_")
            );

            if (!workItemTypeObj) {
              throw new Error(
                `Work item type "${workItemTypeName}" not found in namespace "${namespacePath}". Available types: ${workItemTypes.map(t => t.name).join(", ")}`
              );
            }

            // Build input with widgets support for GitLab 18.3 API
            const createInput: WorkItemCreateInput = {
              namespacePath,
              title: workItemTitle,
              workItemTypeId: workItemTypeObj.id,
            };

            // Add optional description
            if (description !== undefined) {
              createInput.description = description;
            }

            // Add widgets only if data is provided
            if (assigneeIds !== undefined && assigneeIds.length > 0) {
              createInput.assigneesWidget = { assigneeIds: toGids(assigneeIds, "User") };
            }

            if (labelIds !== undefined && labelIds.length > 0) {
              createInput.labelsWidget = { labelIds: toGids(labelIds, "Label") };
            }

            if (milestoneId !== undefined) {
              createInput.milestoneWidget = { milestoneId: toGid(milestoneId, "Milestone") };
            }

            // Use comprehensive mutation with widgets support
            const response = await client.request(CREATE_WORK_ITEM_WITH_WIDGETS, {
              input: createInput,
            });

            if (
              response.workItemCreate?.errors?.length &&
              response.workItemCreate.errors.length > 0
            ) {
              throw new Error(
                `GitLab GraphQL errors: ${response.workItemCreate.errors.join(", ")}`
              );
            }

            if (!response.workItemCreate?.workItem) {
              throw new Error("Work item creation failed - no work item returned");
            }

            return cleanWorkItemResponse(
              response.workItemCreate.workItem as unknown as GitLabWorkItem
            );
          }

          case "update": {
            // TypeScript knows: input has id (required), title, description, state, assigneeIds, labelIds, milestoneId (optional)
            const { id, title, description, state, assigneeIds, labelIds, milestoneId } = input;
            const workItemId = id;

            // Get GraphQL client from ConnectionManager
            const connectionManager = ConnectionManager.getInstance();
            const client = connectionManager.getClient();

            // Convert simple ID to GID for API call
            const workItemGid = toGid(workItemId, "WorkItem");

            // Build dynamic input object based on provided values
            const updateInput: WorkItemUpdateInput = { id: workItemGid };

            // Add basic properties if provided
            if (title !== undefined) updateInput.title = title;
            if (state !== undefined) updateInput.stateEvent = state;

            // Add widget objects only if data is provided
            if (description !== undefined) {
              updateInput.descriptionWidget = { description };
            }

            if (assigneeIds !== undefined) {
              // Convert assignee IDs to GIDs (empty array clears assignees)
              updateInput.assigneesWidget = { assigneeIds: toGids(assigneeIds, "User") };
            }

            if (labelIds !== undefined) {
              // Convert label IDs to GIDs (empty array clears labels)
              updateInput.labelsWidget = { addLabelIds: toGids(labelIds, "Label") };
            }

            if (milestoneId !== undefined) {
              // Convert milestone ID to GID
              updateInput.milestoneWidget = { milestoneId: toGid(milestoneId, "Milestone") };
            }

            // Use single GraphQL mutation with dynamic input
            const response = await client.request(UPDATE_WORK_ITEM, { input: updateInput });

            if (
              response.workItemUpdate?.errors?.length &&
              response.workItemUpdate.errors.length > 0
            ) {
              throw new Error(
                `GitLab GraphQL errors: ${response.workItemUpdate.errors.join(", ")}`
              );
            }

            if (!response.workItemUpdate?.workItem) {
              throw new Error("Work item update failed - no work item returned");
            }

            return cleanWorkItemResponse(
              response.workItemUpdate.workItem as unknown as GitLabWorkItem
            );
          }

          case "delete": {
            // TypeScript knows: input has id (required)
            const workItemId = input.id;

            // Get GraphQL client from ConnectionManager
            const connectionManager = ConnectionManager.getInstance();
            const client = connectionManager.getClient();

            // Convert simple ID to GID for API call
            const workItemGid = toGid(workItemId, "WorkItem");

            // Use GraphQL mutation for deleting work item
            const response = await client.request(DELETE_WORK_ITEM, { id: workItemGid });

            if (
              response.workItemDelete?.errors?.length &&
              response.workItemDelete.errors.length > 0
            ) {
              throw new Error(
                `GitLab GraphQL errors: ${response.workItemDelete.errors.join(", ")}`
              );
            }

            // Return success indicator for deletion
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
export function getWorkitemsReadOnlyToolNames(): string[] {
  return ["browse_work_items"];
}

/**
 * Get all tool definitions from the registry
 */
export function getWorkitemsToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(workitemsToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredWorkitemsTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getWorkitemsReadOnlyToolNames();
    return Array.from(workitemsToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getWorkitemsToolDefinitions();
}
