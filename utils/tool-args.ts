function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmptyPlainObject(value: unknown): boolean {
  return isPlainObject(value) && Object.keys(value).length === 0;
}

function hasMergeRequestPositionShas(position: Record<string, unknown>): boolean {
  return (
    typeof position.base_sha === "string" &&
    typeof position.head_sha === "string" &&
    typeof position.start_sha === "string"
  );
}

function omitIncompletePositionArgument(args: Record<string, unknown>): void {
  const position = args.position;
  if (!isPlainObject(position) || hasMergeRequestPositionShas(position)) {
    return;
  }
  delete args.position;
}

function stripObjectEntries(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(input)) {
    if (isNullish(nested)) {
      continue;
    }

    const cleaned = stripNullishToolArguments(nested);
    if (isNullish(cleaned) || isEmptyPlainObject(cleaned)) {
      continue;
    }

    result[key] = cleaned;
  }

  omitIncompletePositionArgument(result);
  return result;
}

/**
 * Remove null/undefined keys from MCP tool arguments before Zod validation.
 * MCP clients sometimes inject optional fields as null instead of omitting them.
 */
export function stripNullishToolArguments(value: unknown): unknown {
  if (isNullish(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stripNullishToolArguments).filter(item => !isNullish(item));
  }

  if (isPlainObject(value)) {
    return stripObjectEntries(value);
  }

  return value;
}
