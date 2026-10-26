const DEFAULT_NPM_REGISTRY = "https://registry.npmjs.org";
const PACKAGE_LATEST_PATH = "@zereight/mcp-gitlab/latest";
const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * An operator-set registry (`GITLAB_VERSION_CHECK_REGISTRY`) is only used when
 * it parses as an https URL with a hostname and no userinfo. A query or
 * fragment is rejected too: the package path is appended to this value with
 * plain string concatenation below, so a query string like "?tenant=a" would
 * swallow the appended path instead of the request reaching the intended
 * endpoint.
 */
function isUsableRegistryUrl(registry: string): boolean {
  try {
    const parsed = new URL(registry);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname !== "" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.search === "" &&
      parsed.hash === ""
    );
  } catch {
    return false;
  }
}

function readVersionField(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  if (!("version" in data)) return null;
  const version = data.version;
  return typeof version === "string" ? version : null;
}

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

/**
 * Looks up the latest published version anonymously: no `.npmrc`, npm config,
 * or credentials are consulted. `registry` replaces the public registry only
 * when it is a usable https URL.
 */
export async function fetchLatestVersion(
  fetchFn: FetchLike = fetch,
  timeoutMs = 3000,
  registry?: string
): Promise<string | null> {
  try {
    const configured = registry?.trim().replace(/\/$/, "");
    const base = configured && isUsableRegistryUrl(configured) ? configured : DEFAULT_NPM_REGISTRY;
    const response = await fetchFn(`${base}/${PACKAGE_LATEST_PATH}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return readVersionField(await response.json());
  } catch {
    // Fail silent: the update check must never break or delay server startup
    // (offline machines, air-gapped networks, registry outages).
    return null;
  }
}

/** Returns the latest published version when it is newer than `currentVersion`, otherwise null. */
export async function checkForNewVersion(
  currentVersion: string,
  fetchFn: FetchLike = fetch,
  registry?: string
): Promise<string | null> {
  if (!RELEASE_VERSION_PATTERN.test(currentVersion)) return null;
  const latest = await fetchLatestVersion(fetchFn, 3000, registry);
  if (!latest || !RELEASE_VERSION_PATTERN.test(latest)) return null;
  return isNewerVersion(latest, currentVersion) ? latest : null;
}
