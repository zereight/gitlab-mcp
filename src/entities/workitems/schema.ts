import { z } from "zod";
import {
  WorkItemIdSchema,
  WorkItemTypeEnumSchema,
  WorkItemStateEventSchema,
} from "./schema-readonly";

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
export const CreateWorkItemSchema = z.object({
  namespace: z
    .string()
    .describe(
      'CRITICAL: Namespace path (group OR project). For Epics use GROUP path (e.g. "my-group"). For Issues/Tasks use PROJECT path (e.g. "my-group/my-project"). Wrong level will cause creation to fail.'
    ),
  title: z.string().describe("Title of the work item"),
  workItemType: WorkItemTypeEnumSchema,
  description: z.string().optional().describe("Description of the work item"),
  assigneeIds: z.array(z.string()).optional().describe("Array of assignee user IDs"),
  labelIds: z.array(z.string()).optional().describe("Array of label IDs"),
  milestoneId: z.string().optional().describe("Milestone ID"),
});

export const UpdateWorkItemSchema = z.object({
  id: WorkItemIdSchema,
  title: z.string().optional().describe("New title for the work item"),
  description: z.string().optional().describe("New description for the work item"),
  state: WorkItemStateEventSchema.optional().describe(
    "State event for the work item (CLOSE, REOPEN)"
  ),
  assigneeIds: z.array(z.string()).optional().describe("Array of assignee user IDs"),
  labelIds: z.array(z.string()).optional().describe("Array of label IDs"),
  milestoneId: z.string().optional().describe("Milestone ID"),
});

export const DeleteWorkItemSchema = z.object({
  id: WorkItemIdSchema,
});

// Type exports
export type CreateWorkItemOptions = z.infer<typeof CreateWorkItemSchema>;
export type UpdateWorkItemOptions = z.infer<typeof UpdateWorkItemSchema>;
export type DeleteWorkItemOptions = z.infer<typeof DeleteWorkItemSchema>;
