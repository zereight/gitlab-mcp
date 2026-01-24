import { z } from "zod";
import { PaginationOptionsSchema } from "../shared";

// ============================================================================
// list_webhooks - CQRS Query Tool (discriminated union schema)
// Actions: project, group
//
// Uses z.discriminatedUnion() for type-safe action handling.
// Each action has only its relevant ID field:
// - action="project" requires projectId
// - action="group" requires groupId
// ============================================================================

// --- Project action: list webhooks for a project ---
const ListProjectWebhooksSchema = z
  .object({
    action: z.literal("project").describe("List webhooks for a project"),
    projectId: z.string().describe("Project ID or path"),
  })
  .merge(PaginationOptionsSchema);

// --- Group action: list webhooks for a group ---
const ListGroupWebhooksSchema = z
  .object({
    action: z.literal("group").describe("List webhooks for a group"),
    groupId: z.string().describe("Group ID or path"),
  })
  .merge(PaginationOptionsSchema);

// --- Discriminated union combining all actions ---
export const ListWebhooksSchema = z.discriminatedUnion("action", [
  ListProjectWebhooksSchema,
  ListGroupWebhooksSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ListWebhooksOptions = z.infer<typeof ListWebhooksSchema>;
