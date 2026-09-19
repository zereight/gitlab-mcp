import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { fetch as undiciFetch, type Dispatcher } from "undici";

/** Maximum number of redirect hops an outbound download request may follow. */
export const DEFAULT_MAX_REDIRECTS = 5;

/**
 * Thrown when an outbound request would follow a redirect to a destination the
 * server refuses to reach (non-public address, unsupported scheme, too many hops).
 */
export class UnsafeRedirectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeRedirectError";
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Headers that carry GitLab credentials. They are dropped when a redirect crosses
 * to a different origin, because the HTTP client only strips a fixed set of standard
 * authentication headers (`Authorization`, `Cookie`, `Host`, `Proxy-Authorization`)
 * and would otherwise forward the custom `Private-Token` / `JOB-TOKEN` headers to the
 * redirect target.
 */
export const DEFAULT_CREDENTIAL_HEADER_NAMES: readonly string[] = [
  "private-token",
  "job-token",
  "authorization",
  "cookie",
];

/** Returns a copy of `headers` without any credential header (case-insensitive). */
export function stripCredentialHeaders(
  headers: Record<string, string>,
  credentialHeaderNames: readonly string[] = DEFAULT_CREDENTIAL_HEADER_NAMES
): Record<string, string> {
  const blocked = new Set(credentialHeaderNames.map(name => name.toLowerCase()));
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!blocked.has(key.toLowerCase())) {
      result[key] = value;
    }
  }
  return result;
}

type FetchResponse = Awaited<ReturnType<typeof undiciFetch>>;

/**
 * True for addresses that must never be reached by following a redirect:
 * unspecified, loopback, private, link-local (including cloud instance metadata),
 * CGNAT, benchmarking, multicast and IPv6 unique-local ranges.
 */
export function isNonPublicAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const octets = address.split(".").map(part => Number.parseInt(part, 10));
    if (octets.length !== 4 || octets.some(octet => Number.isNaN(octet))) {
      return true;
    }
    const [first, second] = octets;
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 192 && second === 0) ||
      (first === 198 && (second === 18 || second === 19)) ||
      first >= 224
    );
  }

  if (version === 6) {
    const normalized = address.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
    if (mapped) {
      return isNonPublicAddress(mapped[1]);
    }
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized === "0:0:0:0:0:0:0:0" ||
      normalized === "0:0:0:0:0:0:0:1" ||
      normalized.startsWith("fe80") ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("ff")
    );
  }

  // Not a literal address we understand — treat as unsafe.
  return true;
}

export interface FetchWithValidatedRedirectsOptions {
  headers: Record<string, string>;
  dispatcher?: Dispatcher;
  signal?: AbortSignal;
  fetchImpl?: typeof undiciFetch;
  maxRedirects?: number;
  /**
   * Hosts that may be reached even when they resolve to non-public addresses.
   * Used for operator-declared GitLab hosts (GITLAB_API_URL / GITLAB_ALLOWED_HOSTS),
   * which may legitimately live on a private network.
   */
  isTrustedRedirectHost?: (host: string) => boolean;
  /**
   * Header names treated as credentials and dropped when a redirect crosses to a
   * different origin. Defaults to `DEFAULT_CREDENTIAL_HEADER_NAMES`.
   */
  credentialHeaderNames?: readonly string[];
}

async function assertRedirectTargetAllowed(
  target: URL,
  initialOrigin: string,
  options: FetchWithValidatedRedirectsOptions
): Promise<void> {
  if (target.origin === initialOrigin) {
    return;
  }

  const host = target.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (options.isTrustedRedirectHost?.(host)) {
    return;
  }

  if (isIP(host)) {
    if (isNonPublicAddress(host)) {
      throw new UnsafeRedirectError(
        `Refusing to follow redirect to non-public address: ${host}`
      );
    }
    return;
  }

  let records: Array<{ address: string }>;
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeRedirectError(`Refusing to follow redirect to unresolvable host: ${host}`);
  }

  if (records.length === 0) {
    throw new UnsafeRedirectError(`Refusing to follow redirect to unresolvable host: ${host}`);
  }

  const blocked = records.find(record => isNonPublicAddress(record.address));
  if (blocked) {
    throw new UnsafeRedirectError(
      `Refusing to follow redirect to non-public address ${blocked.address} for host ${host}. ` +
        "Add the host to GITLAB_ALLOWED_HOSTS if the redirect target is trusted."
    );
  }
}

/**
 * Perform a GET request that validates every redirect hop before following it.
 *
 * The HTTP client default follows redirects without re-validating the
 * destination, which lets an upstream response redirect the server to an
 * arbitrary host (including loopback and link-local addresses). This helper
 * fetches with `redirect: "manual"` and re-applies the destination check on
 * each `Location` value, mirroring the redirect policy used by the version check.
 */
export async function fetchWithValidatedRedirects(
  url: string,
  options: FetchWithValidatedRedirectsOptions
): Promise<FetchResponse> {
  const fetchImpl = options.fetchImpl ?? undiciFetch;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const initialOrigin = new URL(url).origin;

  let currentUrl = url;
  let currentHeaders = options.headers;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetchImpl(currentUrl, {
      method: "GET",
      headers: currentHeaders,
      dispatcher: options.dispatcher,
      signal: options.signal,
      redirect: "manual",
    });

    if (!REDIRECT_STATUSES.has(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }

    // Release the redirect response so the connection can be reused.
    try {
      await response.body?.cancel();
    } catch {
      // A body that is already closed needs no cleanup.
    }

    const target = new URL(location, currentUrl);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new UnsafeRedirectError(
        `Refusing to follow redirect to unsupported protocol: ${target.protocol}`
      );
    }

    await assertRedirectTargetAllowed(target, initialOrigin, options);

    // A cross-origin hop must not carry GitLab credentials: the HTTP client strips
    // only standard auth headers, so `Private-Token` and `JOB-TOKEN` would survive.
    if (target.origin !== new URL(currentUrl).origin) {
      currentHeaders = stripCredentialHeaders(currentHeaders, options.credentialHeaderNames);
    }

    currentUrl = target.toString();
  }

  throw new UnsafeRedirectError(`Too many redirects (limit ${maxRedirects})`);
}
