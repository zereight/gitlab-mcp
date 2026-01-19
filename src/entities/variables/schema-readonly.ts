import { z } from "zod";

// ============================================================================
// browse_variables - CQRS Query Tool (flat schema for Claude API compatibility)
// Actions: list, get
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

export const BrowseVariablesSchema = z
  .object({
    action: z.enum(["list", "get"]).describe("Action to perform"),
    namespace: z.string().describe("Namespace path (group or project)"),
    // get action fields
    key: z
      .string()
      .optional()
      .describe(
        "The key of the CI/CD variable. Required for 'get' action. Maximum 255 characters, alphanumeric and underscore only."
      ),
    // Filter for get action (environment scope)
    filter: z
      .object({
        environment_scope: z
          .string()
          .optional()
          .describe(
            'The environment scope filter. Use "*" for all environments or specific environment name like "production".'
          ),
      })
      .optional()
      .describe("Filter parameters for variable lookup (for 'get' action)"),
    // pagination fields (for list)
    per_page: z.number().optional().describe("Number of items per page"),
    page: z.number().optional().describe("Page number"),
  })
  .refine(data => data.action !== "get" || data.key !== undefined, {
    message: "key is required for 'get' action",
    path: ["key"],
  });

// ============================================================================
// Type exports
// ============================================================================

export type BrowseVariablesInput = z.infer<typeof BrowseVariablesSchema>;
