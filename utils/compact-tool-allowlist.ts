/** Tool names that compact oversized replies even when global compact mode is off. */
export function parseCompactToolAllowlist(raw: string | undefined): ReadonlySet<string> {
  if (raw === undefined || raw.trim() === "") {
    return new Set();
  }
  const names = raw
    .split(",")
    .map(name => name.trim().toLowerCase())
    .filter(name => name.length > 0);
  return new Set(names);
}

export function shouldCompactToolResult(
  toolName: string,
  globalEnabled: boolean,
  allowlist: ReadonlySet<string>
): boolean {
  return globalEnabled || allowlist.has(toolName);
}
