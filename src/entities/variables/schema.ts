import { z } from "zod";
import { flexibleBoolean } from "../utils";

// ============================================================================
// manage_variable - CQRS Command Tool (discriminated union schema)
// Actions: create, update, delete
// Uses z.discriminatedUnion() for type-safe action handling.
// Schema pipeline flattens to flat JSON Schema for AI clients that don't support oneOf.
// ============================================================================

// --- Helper for variable type validation with intelligent coercion ---
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

// --- Shared fields ---
const namespaceField = z.string().describe("Namespace path (group or project)");
const keyField = z
  .string()
  .describe(
    "The key of the CI/CD variable. Maximum 255 characters, only alphanumeric and underscore characters allowed."
  );
const variableTypeField = flexibleVariableType
  .optional()
  .describe(
    'The type of variable: "env_var" for environment variables (default) or "file" for file variables.'
  );
const environmentScopeField = z
  .string()
  .optional()
  .describe(
    'The environment scope. Use "*" for all environments (default), or specify like "production", "staging".'
  );
const protectedField = flexibleBoolean
  .optional()
  .describe(
    "Whether this variable is protected. Protected variables are only available to protected branches/tags."
  );
const maskedField = flexibleBoolean
  .optional()
  .describe(
    "Whether this variable should be masked in job logs. MASKING REQUIREMENTS: Value must be at least 8 characters, single line with no spaces, only A-Z a-z 0-9 + / = . ~ - _ @ : characters."
  );
const rawField = flexibleBoolean
  .optional()
  .describe(
    "Whether variable expansion is disabled. When true, variables like $OTHER_VAR in the value will NOT be expanded."
  );
const descriptionField = z
  .string()
  .optional()
  .describe("Optional description explaining the purpose of this variable (GitLab 16.2+).");
const filterField = z
  .object({
    environment_scope: z
      .string()
      .optional()
      .describe(
        "Filter to specify which environment scope variant to update/delete when multiple variables exist with the same key."
      ),
  })
  .optional()
  .describe("Filter parameters to identify the specific variable");

// --- Action: create ---
const CreateVariableSchema = z.object({
  action: z.literal("create").describe("Create a new CI/CD variable"),
  namespace: namespaceField,
  key: keyField,
  value: z
    .string()
    .describe(
      "The value of the CI/CD variable. For file type variables, this is the file content."
    ),
  variable_type: variableTypeField,
  environment_scope: environmentScopeField,
  protected: protectedField,
  masked: maskedField,
  raw: rawField,
  description: descriptionField,
});

// --- Action: update ---
const UpdateVariableSchema = z.object({
  action: z.literal("update").describe("Update an existing CI/CD variable"),
  namespace: namespaceField,
  key: keyField,
  value: z
    .string()
    .optional()
    .describe(
      "The value of the CI/CD variable. For file type variables, this is the file content."
    ),
  variable_type: variableTypeField,
  environment_scope: environmentScopeField,
  protected: protectedField,
  masked: maskedField,
  raw: rawField,
  description: descriptionField,
  filter: filterField,
});

// --- Action: delete ---
const DeleteVariableSchema = z.object({
  action: z.literal("delete").describe("Delete a CI/CD variable"),
  namespace: namespaceField,
  key: keyField,
  filter: filterField,
});

// --- Discriminated union combining all actions ---
export const ManageVariableSchema = z.discriminatedUnion("action", [
  CreateVariableSchema,
  UpdateVariableSchema,
  DeleteVariableSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ManageVariableInput = z.infer<typeof ManageVariableSchema>;
