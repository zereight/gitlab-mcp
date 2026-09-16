/** A minimal view of the tool registry schema used for managed masking. */
export interface ToolInputSchema {
  properties?: Record<string, unknown>;
  required?: readonly string[];
}

interface JsonSchema {
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function collectDeclaredProjectIds(
  schema: JsonSchema,
  value: unknown,
  projectIds: unknown[]
): void {
  if (!isRecord(value)) return;
  for (const [field, fieldSchema] of Object.entries(schema.properties ?? {})) {
    const fieldValue = value[field];
    if (field === "project_id" || field.endsWith("_project_id")) {
      if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "")
        projectIds.push(fieldValue);
      continue;
    }
    if (Array.isArray(fieldValue) && fieldSchema.items) {
      for (const item of fieldValue) collectDeclaredProjectIds(fieldSchema.items, item, projectIds);
    } else if (fieldSchema.properties) {
      collectDeclaredProjectIds(fieldSchema, fieldValue, projectIds);
    }
  }
}

/**
 * Return project identifiers declared by the tool schema, including nested
 * request objects that the tool can use to access another project. This avoids
 * both accepting undeclared arguments and overlooking a cross-project action.
 */
export function getManagedMaskingProjectIds(
  inputSchema: ToolInputSchema | undefined,
  argumentsValue: unknown,
  getDefaultProjectId?: () => unknown
): { hasProjectScope: boolean; projectIds: unknown[] } {
  const properties = inputSchema?.properties as Record<string, JsonSchema> | undefined;
  if (!properties) return { hasProjectScope: false, projectIds: [] };
  const args = isRecord(argumentsValue) ? argumentsValue : {};
  const projectIds: unknown[] = [];
  collectDeclaredProjectIds({ properties }, args, projectIds);

  const hasPrimaryProjectField = Object.hasOwn(properties, "project_id");
  const primaryProjectIsMissing =
    args.project_id === undefined || args.project_id === null || args.project_id === "";
  // A group-scoped tool may declare project_id as an alternative. Do not turn
  // that absent optional field into the server default when group_id was chosen.
  const hasAlternativeScope =
    primaryProjectIsMissing &&
    Object.keys(properties).some(
      field => (field === "group_id" || field.endsWith("_group_id")) && args[field] !== undefined
    );
  // A project filter on a group query does not establish the scope of all
  // projects contributing to its response.
  if (hasAlternativeScope) return { hasProjectScope: false, projectIds: [] };
  if (hasPrimaryProjectField && primaryProjectIsMissing && getDefaultProjectId) {
    projectIds.unshift(getDefaultProjectId());
  }

  return {
    hasProjectScope:
      projectIds.length > 0 ||
      (inputSchema?.required ?? []).some(
        field => field === "project_id" || field.endsWith("_project_id")
      ),
    projectIds,
  };
}
