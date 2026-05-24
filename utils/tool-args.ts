function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitIncompletePositionArgument(args: Record<string, unknown>): void {
  const position = args.position;
  if (!isPlainObject(position)) {
    return;
  }
  if (
    typeof position.base_sha === "string" &&
    typeof position.head_sha === "string" &&
    typeof position.start_sha === "string"
  ) {
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
    if (isNullish(cleaned) || (isPlainObject(cleaned) && Object.keys(cleaned).length === 0)) {
      continue;
    }

    result[key] = cleaned;
  }

  omitIncompletePositionArgument(result);
  return result;
}

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
