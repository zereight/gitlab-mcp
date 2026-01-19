import * as z from "zod";
import { BrowseMilestonesSchema } from "./schema-readonly";
import { ManageMilestoneSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { resolveNamespaceForAPI } from "../../utils/namespace";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";
import { assertDefined } from "../utils";

/**
 * Milestones tools registry - 2 CQRS tools replacing 9 individual tools
 *
 * browse_milestones (Query): list, get, issues, merge_requests, burndown
 * manage_milestone (Command): create, update, delete, promote
 */
export const milestonesToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // browse_milestones - CQRS Query Tool
  // ============================================================================
  [
    "browse_milestones",
    {
      name: "browse_milestones",
      description:
        'BROWSE milestones. Actions: "list" shows milestones with filtering, "get" retrieves single milestone, "issues" lists issues in milestone, "merge_requests" lists MRs in milestone, "burndown" gets burndown chart data.',
      inputSchema: z.toJSONSchema(BrowseMilestonesSchema),
      handler: async (args: unknown) => {
        const input = BrowseMilestonesSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(input.namespace);

        switch (input.action) {
          case "list": {
            const { action: _action, namespace: _namespace, ...rest } = input;
            const query = toQuery(rest, []);

            return gitlab.get(`${entityType}/${encodedPath}/milestones`, { query });
          }

          case "get": {
            // milestone_id is required for get action (validated by .refine())
            assertDefined(input.milestone_id, "milestone_id");
            return gitlab.get(`${entityType}/${encodedPath}/milestones/${input.milestone_id}`);
          }

          case "issues": {
            // milestone_id is required for issues action (validated by .refine())
            assertDefined(input.milestone_id, "milestone_id");
            const { action: _action, namespace: _namespace, milestone_id, ...rest } = input;
            const query = toQuery(rest, []);

            return gitlab.get(`${entityType}/${encodedPath}/milestones/${milestone_id}/issues`, {
              query,
            });
          }

          case "merge_requests": {
            // milestone_id is required for merge_requests action (validated by .refine())
            assertDefined(input.milestone_id, "milestone_id");
            const { action: _action, namespace: _namespace, milestone_id, ...rest } = input;
            const query = toQuery(rest, []);

            return gitlab.get(
              `${entityType}/${encodedPath}/milestones/${milestone_id}/merge_requests`,
              { query }
            );
          }

          case "burndown": {
            // milestone_id is required for burndown action (validated by .refine())
            assertDefined(input.milestone_id, "milestone_id");
            const { action: _action, namespace: _namespace, milestone_id, ...rest } = input;
            const query = toQuery(rest, []);

            return gitlab.get(
              `${entityType}/${encodedPath}/milestones/${milestone_id}/burndown_events`,
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
  // manage_milestone - CQRS Command Tool
  // ============================================================================
  [
    "manage_milestone",
    {
      name: "manage_milestone",
      description:
        'MANAGE milestones. Actions: "create" creates new milestone, "update" modifies existing milestone, "delete" removes milestone, "promote" elevates project milestone to group level.',
      inputSchema: z.toJSONSchema(ManageMilestoneSchema),
      handler: async (args: unknown) => {
        const input = ManageMilestoneSchema.parse(args);
        const { entityType, encodedPath } = await resolveNamespaceForAPI(input.namespace);

        switch (input.action) {
          case "create": {
            const { action: _action, namespace: _namespace, ...body } = input;

            return gitlab.post(`${entityType}/${encodedPath}/milestones`, {
              body,
              contentType: "json",
            });
          }

          case "update": {
            // milestone_id is required for update action (validated by .refine())
            assertDefined(input.milestone_id, "milestone_id");
            const { action: _action, namespace: _namespace, milestone_id, ...body } = input;

            return gitlab.put(`${entityType}/${encodedPath}/milestones/${milestone_id}`, {
              body,
              contentType: "json",
            });
          }

          case "delete": {
            // milestone_id is required for delete action (validated by .refine())
            assertDefined(input.milestone_id, "milestone_id");

            await gitlab.delete(`${entityType}/${encodedPath}/milestones/${input.milestone_id}`);
            return { deleted: true };
          }

          case "promote": {
            // milestone_id is required for promote action (validated by .refine())
            assertDefined(input.milestone_id, "milestone_id");

            if (entityType !== "projects") {
              throw new Error("Milestone promotion is only available for projects, not groups");
            }

            return gitlab.post(
              `projects/${encodedPath}/milestones/${encodeURIComponent(input.milestone_id)}/promote`
            );
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
export function getMilestonesReadOnlyToolNames(): string[] {
  return ["browse_milestones"];
}

/**
 * Get all tool definitions from the registry
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
