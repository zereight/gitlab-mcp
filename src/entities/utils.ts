import { z } from "zod";

const DEFAULT_NULL = process.env.DEFAULT_NULL === "true";

export const flexibleBoolean = z.preprocess(val => {
  if (typeof val === "boolean") {
    return val;
  }
  let result = "false";
  try {
    result = String(val).toLowerCase();
  } catch {
    return false;
  }
  return ["true", "t", "1"].includes(result);
}, z.boolean());

export const flexibleBooleanNullable = DEFAULT_NULL
  ? flexibleBoolean.nullable().default(null)
  : flexibleBoolean.nullable();

/**
 * Required ID field that accepts string or number input.
 * Unlike z.coerce.string(), this properly rejects undefined/null values
 * instead of coercing them to the literal string "undefined"/"null".
 */
export const requiredId = z.preprocess(val => val ?? "", z.coerce.string().min(1));

/**
 * Asserts that a value is defined (not undefined).
 * Used for fields validated by Zod .refine() where TypeScript cannot
 * automatically narrow the type after runtime validation.
 *
 * Note: This intentionally only checks for undefined, not empty strings.
 * Empty string validation is handled by Zod schema .refine() checks which
 * run during Schema.parse(args) BEFORE handler code executes. This function
 * exists solely for TypeScript type narrowing after validation passes.
 *
 * @param value - The value to assert
 * @param fieldName - Name of the field for error messages
 * @throws Error if value is undefined
 */
export function assertDefined<T>(value: T | undefined, fieldName: string): asserts value is T {
  if (value === undefined) {
    throw new Error(`${fieldName} is required but was not provided`);
  }
}

/**
 * Validates that the appropriate ID field is provided based on scope.
 * Used by webhook schemas to ensure projectId or groupId is present.
 *
 * @param data - Object containing scope, projectId, and groupId fields
 * @returns true if validation passes
 */
export function validateScopeId(data: {
  scope: "project" | "group";
  projectId?: string;
  groupId?: string;
}): boolean {
  if (data.scope === "project") {
    return !!data.projectId;
  }
  if (data.scope === "group") {
    return !!data.groupId;
  }
  return true;
}
