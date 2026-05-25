function isShaNullish(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * Normalize optional merge request thread position input before Zod validation.
 * Omits position only when it was not provided or all commit SHAs are nullish (MCP null injection).
 * Partial or invalid SHA sets are passed through so schema validation can reject them.
 */
export function omitIncompleteMergeRequestPosition(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const { base_sha, head_sha, start_sha } = record;

  const hasAllRequiredShas =
    typeof base_sha === "string" &&
    typeof head_sha === "string" &&
    typeof start_sha === "string";

  if (hasAllRequiredShas) {
    return value;
  }

  const allShasNullish =
    isShaNullish(base_sha) && isShaNullish(head_sha) && isShaNullish(start_sha);

  if (allShasNullish) {
    return undefined;
  }

  return value;
}
