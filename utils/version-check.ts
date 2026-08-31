import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_NPM_REGISTRY = "https://registry.npmjs.org";
const PACKAGE_LATEST_PATH = "@zereight/mcp-gitlab/latest";
const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const AUTH_TOKEN_KEY_PATTERN =
  /^\/\/[-A-Za-z0-9.]+(?::\d+)?(?:\/[-A-Za-z0-9._]+)*\/:_authToken$/;
const NPMRC_ENV_PATTERN = /\$\{([A-Za-z_]\w*)\}/g;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * A configured registry is only used when it parses as a plain HTTP(S) URL
 * with a hostname. A query or fragment is rejected too: the package path is
 * appended to this value with plain string concatenation below, so a query
 * string like "?tenant=a" would swallow the appended path instead of the
 * request reaching the intended endpoint.
 */
function isUsableRegistryUrl(registry: string): boolean {
  try {
    const parsed = new URL(registry);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname !== "" &&
      parsed.search === "" &&
      parsed.hash === ""
    );
  } catch {
    return false;
  }
}

/** Runs `npm config get <key>` and returns the trimmed value, or null if unavailable/unset. */
async function npmConfigGet(key: string): Promise<string | null> {
  try {
    // On Windows "npm" resolves to npm.cmd, which execFile can't launch
    // directly — route through cmd.exe instead. Command and args are fixed
    // literals (only `key` varies, and only with our own constant inputs), so
    // this doesn't open a shell-injection surface.
    const isWindows = process.platform === "win32";
    const { stdout } = await execFileAsync(
      isWindows ? "cmd.exe" : "npm",
      isWindows ? ["/d", "/s", "/c", "npm", "config", "get", key] : ["config", "get", key],
      { timeout: 5000, windowsHide: true }
    );
    const value = stdout.trim().replace(/\/$/, "");
    return value && value !== "undefined" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the npm registry to use, honoring `.npmrc` / `npm_config_registry`.
 * Package-scoped config (`@zereight:registry`) takes precedence, matching how
 * npm itself resolves the registry for a scoped package like this one.
 */
async function resolveConfiguredRegistry(): Promise<string> {
  const scoped = await npmConfigGet("@zereight:registry");
  if (scoped) return scoped;
  const unscoped = await npmConfigGet("registry");
  if (unscoped) return unscoped;
  return DEFAULT_NPM_REGISTRY;
}

function authTokenConfigKeys(registry: string): string[] {
  if (!isUsableRegistryUrl(registry)) return [];
  const parsed = new URL(registry);
  if (parsed.protocol !== "https:") return [];
  const keys: string[] = [];
  let path = parsed.pathname.replace(/\/$/, "");
  while (true) {
    const key = `//${parsed.host}${path}/:_authToken`;
    if (AUTH_TOKEN_KEY_PATTERN.test(key)) keys.push(key);
    if (path === "") break;
    const slash = path.lastIndexOf("/");
    path = slash <= 0 ? "" : path.slice(0, slash);
  }
  return keys;
}

async function npmrcCandidatePaths(): Promise<string[]> {
  const paths: string[] = [];
  const configuredGlobal = process.env.NPM_CONFIG_GLOBALCONFIG;
  const globalconfig = configuredGlobal || (await npmConfigGet("globalconfig"));
  if (globalconfig) paths.push(globalconfig);
  paths.push(process.env.NPM_CONFIG_USERCONFIG ?? join(homedir(), ".npmrc"));
  paths.push(join(process.cwd(), ".npmrc"));
  return paths;
}

function unquoteNpmrcValue(value: string): string {
  if (value.length >= 2) {
    const start = value[0];
    const end = value[value.length - 1];
    if ((start === '"' && end === '"') || (start === "'" && end === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function expandNpmrcEnv(value: string): string {
  return value.replace(NPMRC_ENV_PATTERN, (_match, name: string) => process.env[name] ?? "");
}

function parseNpmrc(content: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = expandNpmrcEnv(unquoteNpmrcValue(line.slice(separator + 1).trim()));
    entries.set(key, value);
  }
  return entries;
}

async function readNpmrcFile(path: string): Promise<Map<string, string>> {
  try {
    return parseNpmrc(await readFile(path, "utf8"));
  } catch {
    return new Map();
  }
}

/**
 * Reads `//host[:port][/path]/:_authToken` from npmrc files, then walks up
 * parent paths to `//host/:_authToken`, matching npm-registry-fetch.
 * `npm config get` refuses to print protected auth keys, so this parses the
 * files npm itself would consult instead of asking the CLI.
 */
async function resolveRegistryAuthToken(registry: string): Promise<string | null> {
  const keys = authTokenConfigKeys(registry);
  if (keys.length === 0) return null;
  const merged = new Map<string, string>();
  for (const path of await npmrcCandidatePaths()) {
    const entries = await readNpmrcFile(path);
    for (const [entryKey, value] of entries) merged.set(entryKey, value);
  }
  for (const key of keys) {
    const token = merged.get(key);
    if (token) return token;
  }
  return null;
}

function requestIsUnderRegistry(registry: string, requestUrl: string): boolean {
  try {
    const parsedRegistry = new URL(registry);
    const parsedRequest = new URL(requestUrl);
    if (parsedRegistry.protocol !== "https:" || parsedRequest.protocol !== "https:") return false;
    if (parsedRegistry.origin !== parsedRequest.origin) return false;
    const basePath = parsedRegistry.pathname.replace(/\/$/, "");
    if (basePath === "") return true;
    return parsedRequest.pathname === basePath || parsedRequest.pathname.startsWith(`${basePath}/`);
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

export async function fetchLatestVersion(
  fetchFn: FetchLike = fetch,
  timeoutMs = 3000,
  resolveRegistry: () => string | Promise<string> = resolveConfiguredRegistry
): Promise<string | null> {
  try {
    const resolved = (await resolveRegistry()).replace(/\/$/, "");
    const registry = isUsableRegistryUrl(resolved) ? resolved : DEFAULT_NPM_REGISTRY;
    const registryLatestUrl = `${registry}/${PACKAGE_LATEST_PATH}`;
    const headers: Record<string, string> = { accept: "application/json" };
    const init: RequestInit = {
      signal: AbortSignal.timeout(timeoutMs),
      headers,
    };

    const token = await resolveRegistryAuthToken(registry).catch(() => null);
    if (token && requestIsUnderRegistry(registry, registryLatestUrl)) {
      headers.authorization = `Bearer ${token}`;
      // Never follow redirects with a token attached — fetch would otherwise
      // forward Authorization to a different origin.
      init.redirect = "error";
    }

    const response = await fetchFn(registryLatestUrl, init);
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
  fetchFn: FetchLike = fetch
): Promise<string | null> {
  if (!RELEASE_VERSION_PATTERN.test(currentVersion)) return null;
  const latest = await fetchLatestVersion(fetchFn);
  if (!latest || !RELEASE_VERSION_PATTERN.test(latest)) return null;
  return isNewerVersion(latest, currentVersion) ? latest : null;
}
