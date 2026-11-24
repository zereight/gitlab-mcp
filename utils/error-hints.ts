const NEXT_PREFIX = "\nNext: ";

// Shared with the lookups that already know a group was not found (see withRecoveryHint).
export const GROUP_NOT_FOUND_HINT =
  "check group_id (numeric ID or URL-encoded path such as parent%2Fchild) and that the token can read the group.";

export function hasRecoveryHint(message: string): boolean {
  return message.includes(NEXT_PREFIX);
}

export function recoveryHintFor(message: string): string | undefined {
  if (/^Access denied:/i.test(message)) {
    return undefined;
  }
  if (/is not available on this server/i.test(message)) {
    if (/slim tool profile/i.test(message) || /cannot activate/i.test(message)) {
      return undefined;
    }
    if (/discover_tools|GITLAB_TOOLSETS|GITLAB_TOOLS/.test(message)) {
      return "call discover_tools with the category, or add it to GITLAB_TOOLSETS.";
    }
  }
  if (/\b401\b/.test(message) || /unauthorized/i.test(message)) {
    return "set GITLAB_PERSONAL_ACCESS_TOKEN (or run `zereight-mcp-gitlab auth`) and retry.";
  }
  if (/rate limit/i.test(message)) {
    return "wait and retry; lower per_page or paginate if the client is bursting.";
  }
  if (
    /\b403\b/.test(message) ||
    /forbidden/i.test(message) ||
    /insufficient_scope/i.test(message)
  ) {
    return "check token scopes and GITLAB_PERMISSION_MODE; grant read_user or User:Read for whoami.";
  }
  if (/\b404\b/.test(message) || /404 not found/i.test(message)) {
    // GitLab's body names the missing group ("404 Group Not Found"). Group tools take
    // group_id, so the project_id hint below would name the wrong argument.
    if (/404 Group Not Found/i.test(message)) {
      return GROUP_NOT_FOUND_HINT;
    }
    return "check project_id (numeric ID or group%2Fproject) and the resource iid.";
  }
  return undefined;
}

/**
 * Adds a site-specific hint to a message on the same "\nNext: " line that
 * appendRecoveryHint adds at the tool-call boundary. The message stays a prefix
 * of the result, and a message that already has a hint comes back unchanged.
 */
export function withRecoveryHint(message: string, hint: string): string {
  if (hasRecoveryHint(message)) {
    return message;
  }
  return `${message}${NEXT_PREFIX}${hint}`;
}

export function appendRecoveryHint(message: string): string {
  if (hasRecoveryHint(message)) {
    return message;
  }
  const hint = recoveryHintFor(message);
  if (hint === undefined) {
    return message;
  }
  return `${message}${NEXT_PREFIX}${hint}`;
}
