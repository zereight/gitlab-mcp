/**
 * Normalize optional merge request thread position input before Zod validation.
 * Keeps position only when base_sha, head_sha, and start_sha are all present.
 */
export function omitIncompleteMergeRequestPosition(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const hasRequiredShas =
    typeof record.base_sha === "string" &&
    typeof record.head_sha === "string" &&
    typeof record.start_sha === "string";

  if (!hasRequiredShas) {
    return undefined;
  }

  return value;
}
