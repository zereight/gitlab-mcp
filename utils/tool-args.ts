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

export type IdUsernameOptionPair = readonly [idKey: string, usernameKey: string];

/** Pairs where GitLab rejects sending both *_id and *_username query params. */
export const LIST_ISSUES_ID_USERNAME_PAIRS: readonly IdUsernameOptionPair[] = [
  ["author_id", "author_username"],
  ["assignee_id", "assignee_username"],
];

export const LIST_MERGE_REQUESTS_ID_USERNAME_PAIRS: readonly IdUsernameOptionPair[] = [
  ...LIST_ISSUES_ID_USERNAME_PAIRS,
  ["reviewer_id", "reviewer_username"],
];

/**
 * When both id and username filters are set, GitLab returns 400. Prefer username and drop id.
 */
export function cleanMutuallyExclusiveIdUsernameOptions<T extends Record<string, unknown>>(
  options: T,
  pairs: readonly IdUsernameOptionPair[] = LIST_ISSUES_ID_USERNAME_PAIRS
): T {
  const cleaned = { ...options };

  for (const [idKey, usernameKey] of pairs) {
    if (cleaned[idKey] && cleaned[usernameKey]) {
      delete cleaned[idKey];
    }
  }

  return cleaned;
}
