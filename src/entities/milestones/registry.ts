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
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { resolveNamespaceForAPI } from "../../utils/namespace";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Milestones tools registry - unified registry containing all milestone operation tools with their handlers
 */
export const milestonesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  [
    "list_milestones",
    {
      name: "list_milestones",
      description:
        "Browse release milestones for planning and tracking. Use to see upcoming releases, sprint cycles, or project phases. Supports filtering by state (active/closed) and timeframe. Returns milestone titles, dates, progress statistics. Group milestones apply across all projects.",
      inputSchema: z.toJSONSchema(ListProjectMilestonesSchema),
      handler: async (args: unknown) => {
        const options = ListProjectMilestonesSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        return gitlab.get(`${entityType}/${encodedPath}/milestones`, {
          query: toQuery(options, ["namespace"]),
        });
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
      handler: async (args: unknown) => {
        const options = GetProjectMilestoneSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        return gitlab.get(`${entityType}/${encodedPath}/milestones/${options.milestone_id}`);
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
      handler: async (args: unknown) => {
        const options = GetMilestoneIssuesSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        return gitlab.get(
          `${entityType}/${encodedPath}/milestones/${options.milestone_id}/issues`,
          { query: toQuery(options, ["namespace", "milestone_id"]) }
        );
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
      handler: async (args: unknown) => {
        const options = GetMilestoneMergeRequestsSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        return gitlab.get(
          `${entityType}/${encodedPath}/milestones/${options.milestone_id}/merge_requests`,
          { query: toQuery(options, ["namespace", "milestone_id"]) }
        );
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
      handler: async (args: unknown) => {
        const options = GetMilestoneBurndownEventsSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        return gitlab.get(
          `${entityType}/${encodedPath}/milestones/${options.milestone_id}/burndown_events`,
          { query: toQuery(options, ["namespace", "milestone_id"]) }
        );
      },
    },
  ],
  [
    "create_milestone",
    {
      name: "create_milestone",
      description:
        "Define a new release milestone or sprint cycle. Use to establish delivery targets, organize work phases, or plan releases. Set title, description, start/due dates. Group milestones coordinate releases across multiple projects.",
      inputSchema: z.toJSONSchema(CreateProjectMilestoneSchema),
      handler: async (args: unknown) => {
        const options = CreateProjectMilestoneSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);
        const { namespace: _namespace, ...body } = options;

        return gitlab.post(`${entityType}/${encodedPath}/milestones`, {
          body,
          contentType: "json",
        });
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
      handler: async (args: unknown) => {
        const options = EditProjectMilestoneSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);
        const { namespace: _namespace, milestone_id, ...body } = options;

        return gitlab.put(`${entityType}/${encodedPath}/milestones/${milestone_id}`, {
          body,
          contentType: "json",
        });
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
      handler: async (args: unknown) => {
        const options = DeleteProjectMilestoneSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        await gitlab.delete(`${entityType}/${encodedPath}/milestones/${options.milestone_id}`);
        return { deleted: true };
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
      handler: async (args: unknown) => {
        const options = PromoteProjectMilestoneSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(options.namespace);

        if (entityType !== "projects") {
          throw new Error("Milestone promotion is only available for projects, not groups");
        }

        return gitlab.post(
          `projects/${encodedPath}/milestones/${encodeURIComponent(options.milestone_id)}/promote`
        );
      },
    },
  ],
]);

export function getMilestonesReadOnlyToolNames(): string[] {
  return [
    "list_milestones",
    "get_milestone",
    "get_milestone_issue",
    "get_milestone_merge_requests",
    "get_milestone_burndown_events",
  ];
}

export function getMilestonesToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(milestonesToolRegistry.values());
}

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
