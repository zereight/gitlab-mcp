import { z } from "zod";
import { PaginationOptionsSchema } from "../shared";

// ============================================================================
// list_webhooks - CQRS Query Tool (discriminated union schema)
// Actions: project, group
//
// Uses z.discriminatedUnion() for type-safe scope handling.
// Each scope has only its relevant ID field:
// - scope="project" requires projectId
// - scope="group" requires groupId
// ============================================================================

// --- Project scope: list webhooks for a project ---
const ListProjectWebhooksSchema = z
  .object({
    scope: z.literal("project").describe("List webhooks for a project"),
    projectId: z.string().describe("Project ID or path"),
  })
  .merge(PaginationOptionsSchema);

// --- Group scope: list webhooks for a group ---
const ListGroupWebhooksSchema = z
  .object({
    scope: z.literal("group").describe("List webhooks for a group"),
    groupId: z.string().describe("Group ID or path"),
  })
  .merge(PaginationOptionsSchema);

// --- Discriminated union combining all scopes ---
export const ListWebhooksSchema = z.discriminatedUnion("scope", [
  ListProjectWebhooksSchema,
  ListGroupWebhooksSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ListWebhooksOptions = z.infer<typeof ListWebhooksSchema>;
