import { z } from 'zod';

// Base schemas for work items
export const WorkItemIdSchema = z.string().min(1).describe('Work item ID');

export const WorkItemTypeEnumSchema = z
  .string()
  .transform((val) => val.toUpperCase().replace(/\s+/g, '_'))
  .pipe(
    z.enum([
      'EPIC',
      'ISSUE',
      'TASK',
      'INCIDENT',
      'TEST_CASE',
      'REQUIREMENT',
      'OBJECTIVE',
      'KEY_RESULT',
    ]),
  )
  .describe('Type of work item');

export const WorkItemStateSchema = z
  .string()
  .transform((val) => val.toUpperCase())
  .pipe(z.enum(['OPEN', 'CLOSED']))
  .describe('State of work item');

export const WorkItemStateEventSchema = z
  .string()
  .transform((val) => val.toUpperCase())
  .pipe(z.enum(['CLOSE', 'REOPEN']))
  .describe('State event for updating work item');

// Read-only schemas
export const ListWorkItemsSchema = z.object({
  namespacePath: z
    .string()
    .describe(
      'Namespace path (group or project) to list work items from. Returns epics for groups, issues/tasks for projects.',
    ),
  types: z.array(WorkItemTypeEnumSchema).optional().describe('Filter by work item types'),
  state: z
    .array(WorkItemStateSchema)
    .optional()
    .default(['OPEN'])
    .describe(
      'Filter by work item state. Defaults to OPEN items only. Use ["OPEN", "CLOSED"] for all items.',
    ),
  first: z.number().optional().default(20).describe('Number of items to return'),
  after: z
    .string()
    .optional()
    .describe('Cursor for pagination (use endCursor from previous response)'),
  simple: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Return simplified structure with essential fields only (id, title, state, type, assignees, labels). Set false for full details.',
    ),
  active: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Include only active projects and work items (excludes archived and deletion_scheduled projects). Set false to include all.',
    ),
});

export const GetWorkItemSchema = z.object({
  id: WorkItemIdSchema,
});

export const GetWorkItemTypesSchema = z.object({
  namespacePath: z
    .string()
    .describe('Namespace path (group or project) to get work item types for'),
});

// Type exports
export type ListWorkItemsOptions = z.infer<typeof ListWorkItemsSchema>;
export type GetWorkItemOptions = z.infer<typeof GetWorkItemSchema>;
export type GetWorkItemTypesOptions = z.infer<typeof GetWorkItemTypesSchema>;
export type WorkItemTypeEnum = z.infer<typeof WorkItemTypeEnumSchema>;
export type WorkItemState = z.infer<typeof WorkItemStateSchema>;
