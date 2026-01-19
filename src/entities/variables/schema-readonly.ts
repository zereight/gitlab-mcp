import { z } from "zod";

// ============================================================================
// browse_variables - CQRS Query Tool (discriminated union schema)
// Actions: list, get
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Shared fields ---
const namespaceField = z.string().describe("Namespace path (group or project)");
const filterField = z
  .object({
    environment_scope: z
      .string()
      .optional()
      .describe(
        'The environment scope filter. Use "*" for all environments or specific environment name like "production".'
      ),
  })
  .optional()
  .describe("Filter parameters for variable lookup");

// --- Action: list ---
const ListVariablesSchema = z.object({
  action: z.literal("list").describe("List all CI/CD variables"),
  namespace: namespaceField,
  per_page: z.number().optional().describe("Number of items per page"),
  page: z.number().optional().describe("Page number"),
});

// --- Action: get ---
const GetVariableSchema = z.object({
  action: z.literal("get").describe("Get a single CI/CD variable by key"),
  namespace: namespaceField,
  key: z
    .string()
    .describe(
      "The key of the CI/CD variable. Maximum 255 characters, alphanumeric and underscore only."
    ),
  filter: filterField,
});

// --- Discriminated union combining all actions ---
export const BrowseVariablesSchema = z.discriminatedUnion("action", [
  ListVariablesSchema,
  GetVariableSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type BrowseVariablesInput = z.infer<typeof BrowseVariablesSchema>;
