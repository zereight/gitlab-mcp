import { z } from "zod";
import {
  WorkItemIdSchema,
  WorkItemTypeEnumSchema,
  WorkItemStateEventSchema,
} from "./schema-readonly";

// ============================================================================
// manage_work_item - CQRS Command Tool (flat schema for Claude API compatibility)
// Actions: create, update, delete
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

/**
 * CRITICAL: GitLab Work Items Hierarchy Rules for MCP Agents
 *
 * Work items in GitLab have STRICT level restrictions that CANNOT be violated:
 *
 * GROUP LEVEL ONLY (use group path in namespace):
 * - Epic work items - ONLY exist at group level, NEVER at project level
 * - Use namespace like "my-group" or "parent-group/sub-group"
 *
 * PROJECT LEVEL ONLY (use project path in namespace):
 * - Issue work items - ONLY exist at project level, NEVER at group level
 * - Task work items - ONLY exist at project level, NEVER at group level
 * - Bug work items - ONLY exist at project level, NEVER at group level
 * - Use namespace like "group/project" or "group/subgroup/project"
 *
 * FORBIDDEN PATTERNS (will always fail):
 * - Creating Epic with project namespace
 * - Creating Issue/Task/Bug with group namespace
 *
 * EXAMPLES:
 * Epic: namespace="my-group", workItemType="EPIC"
 * Issue: namespace="my-group/my-project", workItemType="ISSUE"
 * Task: namespace="my-group/my-project", workItemType="TASK"
 * Epic: namespace="my-group/my-project" (WRONG - will fail)
 * Issue: namespace="my-group" (WRONG - will fail)
 */

export const ManageWorkItemSchema = z
  .object({
    action: z.enum(["create", "update", "delete"]).describe("Action to perform"),
    // create action fields
    namespace: z
      .string()
      .optional()
      .describe(
        'CRITICAL: Namespace path (group OR project). For Epics use GROUP path (e.g. "my-group"). For Issues/Tasks use PROJECT path (e.g. "my-group/my-project"). Required for "create" action.'
      ),
    workItemType: WorkItemTypeEnumSchema.optional().describe(
      "Type of work item. Required for 'create' action."
    ),
    // shared create/update fields
    title: z.string().optional().describe("Title of the work item. Required for 'create' action."),
    description: z.string().optional().describe("Description of the work item"),
    assigneeIds: z.array(z.string()).optional().describe("Array of assignee user IDs"),
    labelIds: z.array(z.string()).optional().describe("Array of label IDs"),
    milestoneId: z.string().optional().describe("Milestone ID"),
    // update action fields
    state: WorkItemStateEventSchema.optional().describe(
      "State event for the work item (CLOSE, REOPEN). Only for 'update' action."
    ),
    // update/delete action fields
    id: WorkItemIdSchema.optional().describe(
      "Work item ID. Required for 'update' and 'delete' actions."
    ),
  })
  .refine(data => data.action !== "create" || data.namespace !== undefined, {
    message: "namespace is required for 'create' action",
    path: ["namespace"],
  })
  .refine(data => data.action !== "create" || data.title !== undefined, {
    message: "title is required for 'create' action",
    path: ["title"],
  })
  .refine(data => data.action !== "create" || data.workItemType !== undefined, {
    message: "workItemType is required for 'create' action",
    path: ["workItemType"],
  })
  .refine(data => data.action === "create" || data.id !== undefined, {
    message: "id is required for 'update' and 'delete' actions",
    path: ["id"],
  });

// ============================================================================
// Type exports
// ============================================================================

export type ManageWorkItemInput = z.infer<typeof ManageWorkItemSchema>;
