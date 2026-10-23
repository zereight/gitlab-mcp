const NEXT_PREFIX = "\nNext: ";

export function hasRecoveryHint(message: string): boolean {
  return message.includes(NEXT_PREFIX);
}

export function recoveryHintFor(message: string): string | undefined {
  if (
    /is not available on this server/i.test(message) &&
    /discover_tools|GITLAB_TOOLSETS|GITLAB_TOOLS/.test(message)
  ) {
    return "call discover_tools with the category, or add it to GITLAB_TOOLSETS.";
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
  if (/\b404\b/.test(message) || /not found/i.test(message)) {
    return "check project_id (numeric ID or group%2Fproject) and the resource iid.";
  }
  return undefined;
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
