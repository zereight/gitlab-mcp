const TOOL_PRESERVE_TOP_LEVEL_NULL_KEYS: Readonly<Record<string, readonly string[]>> = {
  create_label: ["priority"],
  update_label: ["priority"],
};

/**
 * Remove omitted optional fields injected as top-level null/undefined by MCP clients.
 * Does not recurse into nested objects so intentional nulls (diff line numbers, GraphQL variables) stay intact.
 */
export function sanitizeToolArguments(
  toolName: string,
  args: Record<string, unknown>
): Record<string, unknown> {
  const preserveNullKeys = new Set(TOOL_PRESERVE_TOP_LEVEL_NULL_KEYS[toolName] ?? []);
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) {
      continue;
    }

    if (value === null && !preserveNullKeys.has(key)) {
      continue;
    }

    result[key] = value;
  }

  return result;
}
