import { execSync } from "node:child_process";

const DEFAULT_NPM_REGISTRY = "https://registry.npmjs.org";
const PACKAGE_LATEST_PATH = "@zereight/mcp-gitlab/latest";
const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/** Resolves the npm registry to use, honoring `.npmrc` / `npm_config_registry` when available. */
function resolveConfiguredRegistry(): string {
  try {
    const registry = execSync("npm config get registry", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
      windowsHide: true,
    })
      .trim()
      .replace(/\/$/, "");
    if (registry && registry !== "undefined" && /^https?:\/\//.test(registry)) return registry;
  } catch {
    // npm unavailable or the lookup failed — fall back to the public registry.
  }
  return DEFAULT_NPM_REGISTRY;
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

export async function fetchLatestVersion(
  fetchFn: typeof fetch = fetch,
  timeoutMs = 3000,
  resolveRegistry: () => string = resolveConfiguredRegistry
): Promise<string | null> {
  try {
    const registryLatestUrl = `${resolveRegistry().replace(/\/$/, "")}/${PACKAGE_LATEST_PATH}`;
    const response = await fetchFn(registryLatestUrl, {
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
