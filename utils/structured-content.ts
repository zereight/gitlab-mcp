/**
 * MCP `CallToolResult.structuredContent` must be a JSON object when present
 * (SDK schema: `z.record(z.string(), z.unknown()).optional()`). A validating
 * client rejects the whole tools/call response otherwise, e.g.
 * `expected record, received array` (issue #675). No tool here declares an
 * outputSchema, so a non-object payload is dropped rather than wrapped; the
 * text content block is left untouched.
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function omitInvalidStructuredContent<T extends Record<string, unknown>>(result: T): T {
  if (!("structuredContent" in result) || isJsonObject(result.structuredContent)) {
    return result;
  }
  const { structuredContent: _dropped, ...rest } = result;
  return rest as T;
}
