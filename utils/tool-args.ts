function omitIncompletePositionArgument(args: Record<string, unknown>): void {
  const position = args.position;
  if (!position || typeof position !== "object" || Array.isArray(position)) {
    return;
  }

  const record = position as Record<string, unknown>;
  const hasRequiredShas =
    typeof record.base_sha === "string" &&
    typeof record.head_sha === "string" &&
    typeof record.start_sha === "string";

  if (!hasRequiredShas) {
    delete args.position;
  }
}

/**
 * Remove null/undefined keys from MCP tool arguments before Zod validation.
 * MCP clients sometimes inject optional fields as null instead of omitting them.
 */
export function stripNullishToolArguments(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .map(item => stripNullishToolArguments(item))
      .filter(item => item !== null && item !== undefined);
    return cleaned;
  }

  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(input)) {
      if (nested === null || nested === undefined) {
        continue;
      }

      const cleaned = stripNullishToolArguments(nested);

      if (cleaned === null || cleaned === undefined) {
        continue;
      }

      if (
        typeof cleaned === "object" &&
        !Array.isArray(cleaned) &&
        Object.keys(cleaned as Record<string, unknown>).length === 0
      ) {
        continue;
      }

      result[key] = cleaned;
    }

    omitIncompletePositionArgument(result);
    return result;
  }

  return value;
}
