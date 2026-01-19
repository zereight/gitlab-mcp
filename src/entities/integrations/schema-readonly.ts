import { z } from "zod";

// ============================================================================
// list_integrations - Read-only tool for listing project integrations
// ============================================================================

export const ListIntegrationsSchema = z.object({
  project_id: z.string().describe("Project ID or URL-encoded path"),
  per_page: z.number().int().min(1).max(100).optional().describe("Number of items per page"),
  page: z.number().int().min(1).optional().describe("Page number"),
});

// ============================================================================
// Type exports
// ============================================================================

export type ListIntegrationsInput = z.infer<typeof ListIntegrationsSchema>;
