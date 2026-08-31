import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_NPM_REGISTRY = "https://registry.npmjs.org";
const PACKAGE_LATEST_PATH = "@zereight/mcp-gitlab/latest";
const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/** A configured registry is only used when it parses as a valid HTTP(S) URL with a hostname. */
function isUsableRegistryUrl(registry: string): boolean {
  try {
    const parsed = new URL(registry);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname !== "";
  } catch {
    return false;
  }
}

/** Resolves the npm registry to use, honoring `.npmrc` / `npm_config_registry` when available. */
async function resolveConfiguredRegistry(): Promise<string> {
  try {
    // On Windows "npm" resolves to npm.cmd, which execFile can't launch
    // directly — route through cmd.exe instead. Command and args are fixed
    // literals on both platforms, so this doesn't open a shell-injection surface.
    const isWindows = process.platform === "win32";
    const { stdout } = await execFileAsync(
      isWindows ? "cmd.exe" : "npm",
      isWindows ? ["/d", "/s", "/c", "npm", "config", "get", "registry"] : ["config", "get", "registry"],
      { timeout: 5000, windowsHide: true }
    );
    const registry = stdout.trim().replace(/\/$/, "");
    if (registry && registry !== "undefined") return registry;
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
  resolveRegistry: () => string | Promise<string> = resolveConfiguredRegistry
): Promise<string | null> {
  try {
    const resolved = (await resolveRegistry()).replace(/\/$/, "");
    const registry = isUsableRegistryUrl(resolved) ? resolved : DEFAULT_NPM_REGISTRY;
    const registryLatestUrl = `${registry}/${PACKAGE_LATEST_PATH}`;
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
