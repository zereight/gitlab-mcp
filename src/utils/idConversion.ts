/**
 * Utility functions for converting between simple IDs and GitLab Global IDs (GIDs)
 * This reduces token usage for MCP agents by using simple strings instead of verbose GIDs
 */

// Define interfaces for proper typing
export interface GitLabObject {
  [key: string]: unknown;
}

export interface GitLabWorkItemType {
  id: string;
  name: string;
}

export interface GitLabWorkItem extends GitLabObject {
  id: string;
  iid?: string;
  title?: string;
  description?: string;
  state?: string;
  workItemType?: GitLabWorkItemType | string;
  widgets?: GitLabWidget[];
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string;
  webUrl?: string;
}

export interface GitLabWidget {
  type: string;
  assignees?: {
    nodes?: Array<{ id: string; [key: string]: unknown }>;
  };
  labels?: {
    nodes?: Array<{ id: string; [key: string]: unknown }>;
  };
  milestone?: {
    id: string;
    [key: string]: unknown;
  };
  parent?: {
    id: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Mapping of entity types to their GID prefixes
const GID_PREFIXES = {
  WorkItem: 'gid://gitlab/WorkItem/',
  User: 'gid://gitlab/User/',
  Project: 'gid://gitlab/Project/',
  Group: 'gid://gitlab/Group/',
  Label: 'gid://gitlab/ProjectLabel/',
  Milestone: 'gid://gitlab/Milestone/',
  MergeRequest: 'gid://gitlab/MergeRequest/',
  Pipeline: 'gid://gitlab/Ci::Pipeline/',
  Job: 'gid://gitlab/Ci::Build/',
  Variable: 'gid://gitlab/Ci::Variable/',
  Wiki: 'gid://gitlab/Wiki/',
  Note: 'gid://gitlab/Note/',
  Discussion: 'gid://gitlab/Discussion/',
} as const;

export type EntityType = keyof typeof GID_PREFIXES;

/**
 * Extract simple ID from GitLab Global ID (GID)
 * @param gid - GitLab Global ID like "gid://gitlab/WorkItem/123"
 * @returns Simple ID like "123"
 */
export function extractSimpleId(gid: string): string {
  if (!gid || typeof gid !== 'string') {
    return gid; // Return as-is if not a string
  }
  if (gid.startsWith('gid://gitlab/')) {
    const parts = gid.split('/');
    return parts[parts.length - 1];
  }
  return gid; // If it's already a simple ID, return as-is
}

/**
 * Convert simple ID to GitLab Global ID (GID)
 * @param id - Simple ID like "123"
 * @param entityType - Type of entity (WorkItem, User, Project, etc.)
 * @returns GitLab Global ID like "gid://gitlab/WorkItem/123"
 */
export function toGid(id: string, entityType: EntityType): string {
  // If it's already a GID, return as-is
  if (id.startsWith('gid://gitlab/')) {
    return id;
  }
  return GID_PREFIXES[entityType] + id;
}

/**
 * Convert array of simple IDs to GIDs
 * @param ids - Array of simple IDs like ["123", "456"]
 * @param entityType - Type of entity
 * @returns Array of GIDs like ["gid://gitlab/User/123", "gid://gitlab/User/456"]
 */
export function toGids(ids: string[], entityType: EntityType): string[] {
  return ids.map((id) => toGid(id, entityType));
}

/**
 * Convert array of GIDs to simple IDs
 * @param gids - Array of GIDs like ["gid://gitlab/User/123", "gid://gitlab/User/456"]
 * @returns Array of simple IDs like ["123", "456"]
 */
export function extractSimpleIds(gids: string[]): string[] {
  return gids.map((gid) => extractSimpleId(gid));
}

/**
 * Clean any object by converting all GID properties to simple IDs
 * @param obj - Object that may contain GIDs
 * @returns Object with GIDs converted to simple IDs
 */
export function cleanGidsFromObject<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const cleanedArray: unknown[] = obj.map((item) => cleanGidsFromObject(item));
    return cleanedArray as T;
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === 'string' && value.startsWith('gid://gitlab/')) {
      cleaned[key] = extractSimpleId(value);
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = cleanGidsFromObject(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned as T;
}

/**
 * Clean work item response by converting GIDs to simple IDs
 * @param workItem - Work item response from GitLab API
 * @returns Work item with simple IDs
 */
export function cleanWorkItemResponse(workItem: GitLabWorkItem): GitLabWorkItem {
  if (!workItem) return workItem;

  const result: GitLabWorkItem = {
    ...workItem,
    id: extractSimpleId(workItem.id),
  };

  // Handle workItemType safely - ALWAYS convert to simple string constant for agents
  if (workItem.workItemType) {
    if (typeof workItem.workItemType === 'string') {
      // If workItemType is already a string, keep it as-is
      result.workItemType = workItem.workItemType;
    } else if (workItem.workItemType.name) {
      // If workItemType is an object with name, extract the name for agents
      // This converts GraphQL objects like {id: "gid://...", name: "Epic"} to just "Epic"
      result.workItemType = workItem.workItemType.name;
    } else if (workItem.workItemType.id) {
      // If workItemType only has ID, clean the ID but keep object structure
      result.workItemType = {
        ...workItem.workItemType,
        id: extractSimpleId(workItem.workItemType.id),
      };
    }
  }

  // Clean widgets if they contain GIDs
  if (workItem.widgets) {
    result.widgets = workItem.widgets.map((widget: GitLabWidget) => {
      const cleanedWidget: GitLabWidget = { ...widget };

      // Clean assignee IDs in ASSIGNEES widget
      if (widget.type === 'ASSIGNEES' && widget.assignees?.nodes) {
        cleanedWidget.assignees = {
          ...widget.assignees,
          nodes: widget.assignees.nodes.map((assignee) => ({
            ...assignee,
            id: extractSimpleId(assignee.id),
          })),
        };
      }

      // Clean label IDs in LABELS widget
      if (widget.type === 'LABELS' && widget.labels?.nodes) {
        cleanedWidget.labels = {
          ...widget.labels,
          nodes: widget.labels.nodes.map((label) => ({
            ...label,
            id: extractSimpleId(label.id),
          })),
        };
      }

      // Clean milestone ID in MILESTONE widget
      if (widget.type === 'MILESTONE' && widget.milestone?.id) {
        cleanedWidget.milestone = {
          ...widget.milestone,
          id: extractSimpleId(widget.milestone.id),
        };
      }

      // Clean parent ID in HIERARCHY widget
      if (widget.type === 'HIERARCHY' && widget.parent?.id) {
        cleanedWidget.parent = {
          ...widget.parent,
          id: extractSimpleId(widget.parent.id),
        };
      }

      return cleanedWidget;
    });
  }

  return result;
}

/**
 * Convert simple work item type names to their corresponding GIDs for GraphQL queries
 * @param typeNames - Array of simple type names like ['EPIC', 'ISSUE', 'TASK']
 * @param namespacePath - Namespace path to get work item types from
 * @param getWorkItemTypes - Function to get work item types for the namespace
 * @returns Array of work item type GIDs
 */
export async function convertTypeNamesToGids(
  typeNames: string[],
  namespacePath: string,
  // eslint-disable-next-line no-unused-vars
  getWorkItemTypes: (path: string) => Promise<GitLabWorkItemType[]>,
): Promise<string[]> {
  if (!typeNames || typeNames.length === 0) {
    return [];
  }

  // Get available work item types for this namespace
  const workItemTypes = await getWorkItemTypes(namespacePath);
  const resolvedTypes: string[] = [];

  for (const typeName of typeNames) {
    const workItemTypeObj = workItemTypes.find(
      (t) => t.name.toUpperCase() === typeName.toUpperCase(),
    );

    if (workItemTypeObj) {
      resolvedTypes.push(workItemTypeObj.id);
    } else {
      console.warn(
        `Work item type "${typeName}" not found in namespace "${namespacePath}". Available types: ${workItemTypes.map((t) => t.name).join(', ')}`,
      );
    }
  }

  if (resolvedTypes.length === 0) {
    console.warn('No valid work item types found for filtering. Using no type filter.');
    return [];
  }

  return resolvedTypes;
}
