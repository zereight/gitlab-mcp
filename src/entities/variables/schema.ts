import { z } from "zod";
import { flexibleBoolean } from "../utils";

// ============================================================================
// manage_variable - CQRS Command Tool (flat schema for Claude API compatibility)
// Actions: create, update, delete
// NOTE: Uses flat z.object() with .refine() instead of z.discriminatedUnion()
// because Claude API doesn't support oneOf/allOf/anyOf at JSON Schema root level.
// ============================================================================

// Helper for variable type validation with intelligent coercion
const flexibleVariableType = z.preprocess(
  val => {
    if (typeof val === "string") {
      const normalized = val.toLowerCase().trim();
      if (["env_var", "env", "environment", "var", "variable"].includes(normalized)) {
        return "env_var";
      }
      if (["file", "file_var"].includes(normalized)) {
        return "file";
      }
    }
    return val;
  },
  z.enum(["env_var", "file"])
);

export const ManageVariableSchema = z
  .object({
    action: z.enum(["create", "update", "delete"]).describe("Action to perform"),
    namespace: z.string().describe("Namespace path (group or project)"),
    // Variable identification - required for all actions
    key: z
      .string()
      .describe(
        "The key of the CI/CD variable. Maximum 255 characters, only alphanumeric and underscore characters allowed."
      ),
    // create/update fields
    value: z
      .string()
      .optional()
      .describe(
        "The value of the CI/CD variable. Required for 'create' action. For file type variables, this is the file content."
      ),
    variable_type: flexibleVariableType
      .optional()
      .describe(
        'The type of variable: "env_var" for environment variables (default) or "file" for file variables.'
      ),
    environment_scope: z
      .string()
      .optional()
      .describe(
        'The environment scope. Use "*" for all environments (default), or specify like "production", "staging".'
      ),
    protected: flexibleBoolean
      .optional()
      .describe(
        "Whether this variable is protected. Protected variables are only available to protected branches/tags."
      ),
    masked: flexibleBoolean
      .optional()
      .describe(
        "Whether this variable should be masked in job logs. MASKING REQUIREMENTS: Value must be at least 8 characters, single line with no spaces, only A-Z a-z 0-9 + / = . ~ - _ @ : characters."
      ),
    raw: flexibleBoolean
      .optional()
      .describe(
        "Whether variable expansion is disabled. When true, variables like $OTHER_VAR in the value will NOT be expanded."
      ),
    description: z
      .string()
      .optional()
      .describe("Optional description explaining the purpose of this variable (GitLab 16.2+)."),
    // Filter for update/delete with environment scope
    filter: z
      .object({
        environment_scope: z
          .string()
          .optional()
          .describe(
            "Filter to specify which environment scope variant to update/delete when multiple variables exist with the same key."
          ),
      })
      .optional()
      .describe(
        "Filter parameters to identify the specific variable (for 'update' and 'delete' actions)"
      ),
  })
  .refine(data => data.action !== "create" || data.value !== undefined, {
    message: "value is required for 'create' action",
    path: ["value"],
  });

// ============================================================================
// Type exports
// ============================================================================

export type ManageVariableInput = z.infer<typeof ManageVariableSchema>;
