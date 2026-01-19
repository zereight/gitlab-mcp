import { z } from "zod";
import {
  WorkItemIdSchema,
  WorkItemTypeEnumSchema,
  WorkItemStateEventSchema,
} from "./schema-readonly";

// ============================================================================
// manage_work_item - CQRS Command Tool (discriminated union schema)
// Actions: create, update, delete
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
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

// --- Shared fields ---
const workItemIdField = WorkItemIdSchema.describe("Work item ID");

// --- Action: create ---
const CreateWorkItemSchema = z.object({
  action: z.literal("create").describe("Create a new work item"),
  namespace: z
    .string()
    .describe(
      'CRITICAL: Namespace path (group OR project). For Epics use GROUP path (e.g. "my-group"). For Issues/Tasks use PROJECT path (e.g. "my-group/my-project").'
    ),
  workItemType: WorkItemTypeEnumSchema.describe("Type of work item"),
  title: z.string().describe("Title of the work item"),
  description: z.string().optional().describe("Description of the work item"),
  assigneeIds: z.array(z.string()).optional().describe("Array of assignee user IDs"),
  labelIds: z.array(z.string()).optional().describe("Array of label IDs"),
  milestoneId: z.string().optional().describe("Milestone ID"),
});

// --- Action: update ---
const UpdateWorkItemSchema = z.object({
  action: z.literal("update").describe("Update an existing work item"),
  id: workItemIdField,
  title: z.string().optional().describe("Title of the work item"),
  description: z.string().optional().describe("Description of the work item"),
  assigneeIds: z.array(z.string()).optional().describe("Array of assignee user IDs"),
  labelIds: z.array(z.string()).optional().describe("Array of label IDs"),
  milestoneId: z.string().optional().describe("Milestone ID"),
  state: WorkItemStateEventSchema.optional().describe(
    "State event for the work item (CLOSE, REOPEN)"
  ),
});

// --- Action: delete ---
const DeleteWorkItemSchema = z.object({
  action: z.literal("delete").describe("Delete a work item"),
  id: workItemIdField,
});

// --- Discriminated union combining all actions ---
export const ManageWorkItemSchema = z.discriminatedUnion("action", [
  CreateWorkItemSchema,
  UpdateWorkItemSchema,
  DeleteWorkItemSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ManageWorkItemInput = z.infer<typeof ManageWorkItemSchema>;
