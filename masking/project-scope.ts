/** A minimal view of the tool registry schema used for managed masking. */
export interface ToolInputSchema {
  properties?: Record<string, unknown>;
}

/**
 * Return only declared project identifiers. This prevents an undeclared
 * `project_id` supplied to a global tool from selecting an unrelated policy.
 */
export function getManagedMaskingProjectIds(
  inputSchema: ToolInputSchema | undefined,
  argumentsValue: unknown,
  getDefaultProjectId?: () => unknown
): { hasProjectScope: boolean; projectIds: unknown[] } {
  const properties = inputSchema?.properties;
  if (!properties) return { hasProjectScope: false, projectIds: [] };

  const fields = Object.keys(properties).filter(
    field => field === "project_id" || field.endsWith("_project_id")
  );
  if (fields.length === 0) return { hasProjectScope: false, projectIds: [] };

  const args =
    argumentsValue && typeof argumentsValue === "object" && !Array.isArray(argumentsValue)
      ? (argumentsValue as Record<string, unknown>)
      : {};
  const projectIds = fields.flatMap(field => {
    const value = args[field];
    if (value !== undefined && value !== null && value !== "") return [value];
    // Only the primary project can use the server's configured default.
    if (field === "project_id" && getDefaultProjectId) return [getDefaultProjectId()];
    return [];
  });
  return { hasProjectScope: true, projectIds };
}
