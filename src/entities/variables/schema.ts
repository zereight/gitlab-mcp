import { z } from 'zod';
import { flexibleBoolean } from '../utils';

// WRITE OPERATION SCHEMAS for GitLab CI/CD Variables

// Helper for variable type validation with intelligent coercion
const flexibleVariableType = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      const normalized = val.toLowerCase().trim();
      if (['env_var', 'env', 'environment', 'var', 'variable'].includes(normalized)) {
        return 'env_var';
      }
      if (['file', 'file_var'].includes(normalized)) {
        return 'file';
      }
    }
    return val;
  },
  z.enum(['env_var', 'file']),
);

// Helper for variable key validation with preprocessing
const variableKey = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      return val.trim().replace(/[^a-zA-Z0-9_]/g, '');
    }
    return val;
  },
  z
    .string()
    .max(255)
    .regex(/^[a-zA-Z0-9_]+$/, 'Key must contain only alphanumeric characters and underscores'),
);

// Create variable schema (write)
export const CreateVariableSchema = z.object({
  namespacePath: z.string().describe('Namespace path (group or project) to create variable in'),
  key: variableKey.describe(
    'The unique key for the CI/CD variable. Maximum 255 characters, only alphanumeric and underscore characters allowed. Used to reference the variable in CI/CD pipelines (e.g., $MY_API_KEY)',
  ),
  value: z
    .string()
    .describe(
      'The value of the CI/CD variable. This is the actual content that will be available in your CI/CD pipeline. For file type variables, this should be the file content',
    ),
  variable_type: flexibleVariableType
    .optional()
    .default('env_var')
    .describe(
      'The type of variable: "env_var" for environment variables (default) or "file" for file variables. File variables create temporary files with the variable content during pipeline execution',
    ),
  environment_scope: z
    .string()
    .optional()
    .default('*')
    .describe(
      'The environment scope for this variable. Use "*" for all environments (default), or specify environment names like "production", "staging", "review/*" for environment-specific values',
    ),
  protected: flexibleBoolean
    .optional()
    .default(false)
    .describe(
      'Whether this variable is protected. Protected variables are only available to protected branches/tags (typically main/master). Enhances security for sensitive production variables',
    ),
  masked: flexibleBoolean
    .optional()
    .default(false)
    .describe(
      'Whether this variable should be masked in job logs. Masked variables have their values hidden in pipeline output for security. Variable value must meet masking requirements (minimum 8 characters, base64-compatible)',
    ),
  raw: flexibleBoolean
    .optional()
    .default(false)
    .describe(
      'Whether variable expansion is disabled. When true, variables like $OTHER_VAR in the value will NOT be expanded/substituted. Useful for values containing literal dollar signs',
    ),
  description: z
    .string()
    .optional()
    .describe(
      'Optional description explaining the purpose and usage of this variable. Helps team members understand what this variable is for and how it should be used (Available in GitLab 16.2+)',
    ),
});

// Update variable schema (write)
export const UpdateVariableSchema = z.object({
  namespacePath: z.string().describe('Namespace path (group or project) containing the variable'),
  key: z
    .string()
    .describe(
      'The key of the existing CI/CD variable to update. Must match an existing variable key exactly',
    ),
  value: z
    .string()
    .describe(
      'The new value for the CI/CD variable. This will replace the current value completely',
    ),
  variable_type: flexibleVariableType
    .optional()
    .describe(
      'Update the variable type: "env_var" for environment variables or "file" for file variables. Changing type may affect how the variable is used in pipelines',
    ),
  environment_scope: z
    .string()
    .optional()
    .describe(
      'Update the environment scope. Use "*" for all environments, or specify environment names. Changing scope may create a new variable instance',
    ),
  protected: flexibleBoolean
    .optional()
    .describe(
      'Update the protected status. Protected variables are only available to protected branches/tags for enhanced security',
    ),
  masked: flexibleBoolean
    .optional()
    .describe(
      'Update the masked status. Masked variables have their values hidden in job logs. Value must meet masking requirements if enabling',
    ),
  raw: flexibleBoolean
    .optional()
    .describe(
      'Update the raw status. When true, disables variable expansion (no substitution of $OTHER_VAR patterns)',
    ),
  description: z
    .string()
    .optional()
    .describe(
      'Update the description of this variable to help team members understand its purpose (Available in GitLab 16.2+)',
    ),
  filter: z
    .object({
      environment_scope: z
        .string()
        .optional()
        .describe(
          'Filter to specify which environment scope variant to update when multiple variables exist with the same key',
        ),
    })
    .optional()
    .describe('Filter parameters to identify the specific variable to update'),
});

// Delete variable schema (write)
export const DeleteVariableSchema = z.object({
  namespacePath: z.string().describe('Namespace path (group or project) containing the variable'),
  key: z
    .string()
    .describe(
      'The key of the CI/CD variable to delete. This will permanently remove the variable from the project',
    ),
  filter: z
    .object({
      environment_scope: z
        .string()
        .optional()
        .describe(
          'Filter to specify which environment scope variant to delete when multiple variables exist with the same key. If not specified, deletes the "*" (all environments) variant',
        ),
    })
    .optional()
    .describe('Filter parameters to identify the specific variable to delete'),
});

// Export type definitions
export type CreateVariableOptions = z.infer<typeof CreateVariableSchema>;
export type UpdateVariableOptions = z.infer<typeof UpdateVariableSchema>;
export type DeleteVariableOptions = z.infer<typeof DeleteVariableSchema>;
