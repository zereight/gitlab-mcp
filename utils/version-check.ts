const NPM_REGISTRY_LATEST_URL = "https://registry.npmjs.org/@zereight/mcp-gitlab/latest";
const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (version: string) => version.split(".").map(part => Number.parseInt(part, 10));
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < 3; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) return false;
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export async function fetchLatestVersion(
  fetchFn: typeof fetch = fetch,
  timeoutMs = 3000
): Promise<string | null> {
  try {
    const response = await fetchFn(NPM_REGISTRY_LATEST_URL, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    // Fail silent: the update check must never break or delay server startup
    // (offline machines, air-gapped networks, registry outages).
    return null;
  }
}

/** Returns the latest published version when it is newer than `currentVersion`, otherwise null. */
export async function checkForNewVersion(
  currentVersion: string,
  fetchFn: typeof fetch = fetch
): Promise<string | null> {
  if (!RELEASE_VERSION_PATTERN.test(currentVersion)) return null;
  const latest = await fetchLatestVersion(fetchFn);
  if (!latest || !RELEASE_VERSION_PATTERN.test(latest)) return null;
  return isNewerVersion(latest, currentVersion) ? latest : null;
}
