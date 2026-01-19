import { z } from "zod";
import { PaginationOptionsSchema } from "../shared";
import { validateScopeId } from "../utils";

// READ-ONLY WEBHOOKS OPERATION SCHEMAS

/**
 * Schema for listing webhooks (project or group)
 */
export const ListWebhooksSchema = z
  .object({
    scope: z.enum(["project", "group"]).describe("Scope of webhooks to list"),
    projectId: z.string().optional().describe("Project ID or path (required if scope=project)"),
    groupId: z.string().optional().describe("Group ID or path (required if scope=group)"),
  })
  .merge(PaginationOptionsSchema)
  .refine(validateScopeId, {
    message: "projectId is required when scope=project, groupId is required when scope=group",
  });

// Export type definitions
export type ListWebhooksOptions = z.infer<typeof ListWebhooksSchema>;
