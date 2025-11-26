/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as z from "zod";
import {
  ListProjectMilestonesSchema,
  GetProjectMilestoneSchema,
  GetMilestoneIssuesSchema,
  GetMilestoneMergeRequestsSchema,
  GetMilestoneBurndownEventsSchema,
} from "./schema-readonly";
import {
  CreateProjectMilestoneSchema,
  EditProjectMilestoneSchema,
  DeleteProjectMilestoneSchema,
  PromoteProjectMilestoneSchema,
} from "./schema";
import { enhancedFetch } from "../../utils/fetch";
import { resolveNamespaceForAPI } from "../../utils/namespace";
import { cleanGidsFromObject } from "../../utils/idConversion";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Milestones tools registry - unified registry containing all milestone operation tools with their handlers
 */
export const milestonesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // Read-only tools
  [
    "list_milestones",
    {
      name: "list_milestones",
      description:
        "Browse release milestones for planning and tracking. Use to see upcoming releases, sprint cycles, or project phases. Supports filtering by state (active/closed) and timeframe. Returns milestone titles, dates, progress statistics. Group milestones apply across all projects.",
      inputSchema: z.toJSONSchema(ListProjectMilestonesSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = ListProjectMilestonesSchema.parse(args);
        const { namespace } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== "namespace") {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/milestones?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const milestones = await response.json();
        return cleanGidsFromObject(milestones);
      },
    },
  ],
  [
    "get_milestone",
    {
      name: "get_milestone",
      description:
        "Retrieve comprehensive milestone information including dates, description, and progress metrics. Use to track release status, see associated work, or analyze milestone completion. Shows open/closed issue counts and completion percentage.",
      inputSchema: z.toJSONSchema(GetProjectMilestoneSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetProjectMilestoneSchema.parse(args);
        const { namespace, milestone_id } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/milestones/${milestone_id}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const milestone = await response.json();
        return cleanGidsFromObject(milestone);
      },
    },
  ],
  [
    "get_milestone_issue",
    {
      name: "get_milestone_issue",
      description:
        "List all issues targeted for a milestone release. Use to track milestone progress, identify blockers, or plan work. Returns issue details with status, assignees, and labels. Essential for release management and sprint planning.",
      inputSchema: z.toJSONSchema(GetMilestoneIssuesSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetMilestoneIssuesSchema.parse(args);
        const { namespace, milestone_id } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (
            value !== undefined &&
            value !== null &&
            key !== "namespace" &&
            key !== "milestone_id"
          ) {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/milestones/${milestone_id}/issues?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const issues = await response.json();
        return cleanGidsFromObject(issues);
      },
    },
  ],
  [
    "get_milestone_merge_requests",
    {
      name: "get_milestone_merge_requests",
      description:
        "List merge requests scheduled for a milestone. Use to track feature completion, review code changes for release, or identify pending work. Shows MR status, approvals, and pipeline status. Critical for release readiness assessment.",
      inputSchema: z.toJSONSchema(GetMilestoneMergeRequestsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetMilestoneMergeRequestsSchema.parse(args);
        const { namespace, milestone_id } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const queryParams = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
          if (
            value !== undefined &&
            value !== null &&
            key !== "namespace" &&
            key !== "milestone_id"
          ) {
            queryParams.set(key, String(value));
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/milestones/${milestone_id}/merge_requests?${queryParams}`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const mergeRequests = await response.json();
        return cleanGidsFromObject(mergeRequests);
      },
    },
  ],
  [
    "get_milestone_burndown_events",
    {
      name: "get_milestone_burndown_events",
      description:
        "Track milestone progress with burndown chart data. Use for agile metrics, velocity tracking, and sprint analysis. Returns time-series events showing work completion rate. Premium/Ultimate feature for advanced project analytics.",
      inputSchema: z.toJSONSchema(GetMilestoneBurndownEventsSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = GetMilestoneBurndownEventsSchema.parse(args);
        const { namespace, milestone_id } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/milestones/${milestone_id}/burndown_events`;
        const response = await enhancedFetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const burndownEvents = await response.json();
        return cleanGidsFromObject(burndownEvents);
      },
    },
  ],
  // Write tools
  [
    "create_milestone",
    {
      name: "create_milestone",
      description:
        "Define a new release milestone or sprint cycle. Use to establish delivery targets, organize work phases, or plan releases. Set title, description, start/due dates. Group milestones coordinate releases across multiple projects.",
      inputSchema: z.toJSONSchema(CreateProjectMilestoneSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = CreateProjectMilestoneSchema.parse(args);
        const { namespace } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const body: Record<string, unknown> = {};
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== "namespace") {
            body[key] = value;
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/milestones`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const milestone = await response.json();
        return cleanGidsFromObject(milestone);
      },
    },
  ],
  [
    "edit_milestone",
    {
      name: "edit_milestone",
      description:
        "Update milestone properties like dates, description, or state. Use to adjust release schedules, extend sprints, or close completed milestones. Changes apply immediately to all associated issues and MRs.",
      inputSchema: z.toJSONSchema(EditProjectMilestoneSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = EditProjectMilestoneSchema.parse(args);
        const { namespace, milestone_id } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const body: Record<string, unknown> = {};
        Object.entries(options).forEach(([key, value]) => {
          if (
            value !== undefined &&
            value !== null &&
            key !== "namespace" &&
            key !== "milestone_id"
          ) {
            body[key] = value;
          }
        });

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/milestones/${milestone_id}`;
        const response = await enhancedFetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const milestone = await response.json();
        return cleanGidsFromObject(milestone);
      },
    },
  ],
  [
    "delete_milestone",
    {
      name: "delete_milestone",
      description:
        "Remove a milestone permanently. Use to clean up cancelled releases or obsolete milestones. Warning: removes milestone association from all issues and MRs. Consider closing instead of deleting for historical tracking.",
      inputSchema: z.toJSONSchema(DeleteProjectMilestoneSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = DeleteProjectMilestoneSchema.parse(args);
        const { namespace, milestone_id } = options;

        // Resolve namespace type and get proper API path
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodedPath}/milestones/${milestone_id}`;
        const response = await enhancedFetch(apiUrl, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        return cleanGidsFromObject(result);
      },
    },
  ],
  [
    "promote_milestone",
    {
      name: "promote_milestone",
      description:
        "Elevate project milestone to group level for cross-project coordination. Use when a milestone needs to span multiple projects. Consolidates related project milestones into single group milestone. Useful for organizational release planning.",
      inputSchema: z.toJSONSchema(PromoteProjectMilestoneSchema),
      handler: async (args: unknown): Promise<unknown> => {
        const options = PromoteProjectMilestoneSchema.parse(args);
        const { namespace, milestone_id } = options;

        // Resolve namespace - for promote, we need to ensure it's a project
        const { entityType, encodedPath } = await resolveNamespaceForAPI(namespace);

        if (entityType !== "projects") {
          throw new Error("Milestone promotion is only available for projects, not groups");
        }

        const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/projects/${encodedPath}/milestones/${encodeURIComponent(milestone_id)}/promote`;
        const response = await enhancedFetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
        }

        const milestone = await response.json();
        return cleanGidsFromObject(milestone);
      },
    },
  ],
]);

/**
 * Get read-only tool names from the registry
 */
export function getMilestonesReadOnlyToolNames(): string[] {
  return [
    "list_milestones",
    "get_milestone",
    "get_milestone_issue",
    "get_milestone_merge_requests",
    "get_milestone_burndown_events",
  ];
}

/**
 * Get all tool definitions from the registry (for backward compatibility)
 */
export function getMilestonesToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(milestonesToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredMilestonesTools(
  readOnlyMode: boolean = false
): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getMilestonesReadOnlyToolNames();
    return Array.from(milestonesToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getMilestonesToolDefinitions();
}
