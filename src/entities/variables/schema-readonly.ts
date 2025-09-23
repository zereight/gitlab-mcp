import { z } from "zod";
import { PaginationOptionsSchema } from "../shared";

// READ-ONLY OPERATION SCHEMAS for GitLab CI/CD Variables

// List project/group variables schema (read-only)
export const ListVariablesSchema = z
  .object({
    namespace: z.string().describe("Namespace path (group or project) to list variables from"),
  })
  .merge(PaginationOptionsSchema);

// Get single variable schema (read-only)
export const GetVariableSchema = z.object({
  namespace: z.string().describe("Namespace path (group or project) containing the variable"),
  key: z
    .string()
    .describe(
      "The key of the CI/CD variable. Maximum 255 characters, alphanumeric and underscore only"
    ),
  filter: z
    .object({
      environment_scope: z
        .string()
        .optional()
        .describe(
          'The environment scope filter for the variable. Use "*" for all environments or specific environment name'
        ),
    })
    .optional()
    .describe("Filter parameters for the variable lookup"),
});

// Export type definitions
export type ListVariablesOptions = z.infer<typeof ListVariablesSchema>;
export type GetVariableOptions = z.infer<typeof GetVariableSchema>;
