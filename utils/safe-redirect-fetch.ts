import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { fetch as undiciFetch, type Dispatcher } from "undici";

/** Maximum number of redirect hops an outbound download request may follow. */
export const DEFAULT_MAX_REDIRECTS = 5;

/**
 * Request headers that carry GitLab credentials. They are sent to the origin the
 * request started on and to operator-declared GitLab hosts, but never to any
 * other redirect target (object storage, CDNs, arbitrary public hosts).
 */
export const CREDENTIAL_HEADERS: readonly string[] = [
  "authorization",
  "private-token",
  "job-token",
  "proxy-authorization",
  "cookie",
];

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

type FetchResponse = Awaited<ReturnType<typeof undiciFetch>>;

/** Splits a dotted-quad into its four octets, or null when it is not one. */
function parseIpv4Octets(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number.parseInt(part, 10);
    if (octet > 255) return null;
    octets.push(octet);
  }
  return octets;
}

/**
 * Expands an IPv6 literal into its eight 16-bit groups, handling `::` compression
 * and a trailing dotted-quad. Returns null when the literal cannot be expanded.
 */
function parseIpv6Groups(value: string): number[] | null {
  const normalized = value.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (!normalized.includes(":")) return null;

  const halves = normalized.split("::");
  if (halves.length > 2) return null;

  const toGroups = (text: string): number[] | null => {
    if (!text) return [];
    const tokens = text.split(":");
    const groups: number[] = [];
    for (const [index, token] of tokens.entries()) {
      if (token.includes(".")) {
        // A dotted-quad is only valid as the trailing token of the literal.
        if (index !== tokens.length - 1) return null;
        const octets = parseIpv4Octets(token);
        if (!octets) return null;
        groups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(token)) return null;
      groups.push(Number.parseInt(token, 16));
    }
    return groups;
  };

  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (!head || !tail) return null;

  if (halves.length === 2) {
    const zeroGroups = 8 - head.length - tail.length;
    // `::` stands for at least one group.
    if (zeroGroups < 1) return null;
    return [...head, ...new Array<number>(zeroGroups).fill(0), ...tail];
  }

  return head.length === 8 ? head : null;
}

/**
 * The IPv4 address embedded in an IPv6 transition/translation format, or null when
 * the address does not carry one.
 *
 * These formats are unwrapped so the IPv4 policy below applies to them: the WHATWG
 * URL parser canonicalizes `http://[::ffff:169.254.169.254]/` to the hex form
 * `::ffff:a9fe:a9fe`, which a dotted-quad match alone would miss.
 */
function embeddedIpv4Octets(groups: number[]): number[] | null {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const low32 = (): number[] => [(g6 >> 8) & 0xff, g6 & 0xff, (g7 >> 8) & 0xff, g7 & 0xff];

  const leadingZeroGroups = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0;

  // IPv4-mapped `::ffff:a.b.c.d` and IPv4-translated `::ffff:0:a.b.c.d`.
  if (leadingZeroGroups && g4 === 0 && g5 === 0xffff) return low32();
  if (leadingZeroGroups && g4 === 0xffff && g5 === 0) return low32();
  // IPv4-compatible `::a.b.c.d` (deprecated; `::` and `::1` land here too).
  if (leadingZeroGroups && g4 === 0 && g5 === 0) return low32();
  // NAT64 well-known prefix `64:ff9b::/96` and local-use prefix `64:ff9b:1::/48`.
  if (g0 === 0x64 && g1 === 0xff9b && (g2 === 0 || g2 === 1)) return low32();
  // 6to4 `2002::/16`, which tunnels to the IPv4 address held by the next two groups.
  if (g0 === 0x2002) {
    return [(g1 >> 8) & 0xff, g1 & 0xff, (g2 >> 8) & 0xff, g2 & 0xff];
  }

  return null;
}

/** True for the IPv4 ranges that must never be reached by following a redirect. */
function isNonPublicIpv4Octets(octets: number[]): boolean {
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

/**
 * Classifies by parsed bits rather than by matching prefixes of the compressed
 * string, so `fe80::/10` covers `fea0::` and `febf::`, and every address format
 * carrying an embedded IPv4 address is judged by that address.
 */
function isNonPublicIpv6Groups(groups: number[]): boolean {
  const embedded = embeddedIpv4Octets(groups);
  if (embedded) return isNonPublicIpv4Octets(embedded);

  const [first] = groups;
  return (
    (first & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (first & 0xffc0) === 0xfec0 || // fec0::/10 site-local (deprecated)
    (first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (first & 0xff00) === 0xff00 || // ff00::/8 multicast
    (first & 0xff00) === 0x0000 // 0000::/8 reserved
  );
}

/**
 * True for addresses that must never be reached by following a redirect:
 * unspecified, loopback, private, link-local (including cloud instance metadata),
 * CGNAT, benchmarking, multicast and IPv6 unique-local ranges.
 */
export function isNonPublicAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const octets = parseIpv4Octets(address);
    return octets ? isNonPublicIpv4Octets(octets) : true;
  }

  if (version === 6) {
    const groups = parseIpv6Groups(address);
    // Unparseable addresses fail closed.
    return groups ? isNonPublicIpv6Groups(groups) : true;
  }

  // Not a literal address we understand — treat as unsafe.
  return true;
}

export interface FetchWithValidatedRedirectsOptions {
  headers: Record<string, string>;
  dispatcher?: Dispatcher;
  signal?: AbortSignal;
  /** Client used while the request still carries the credentials. Defaults to undici's. */
  fetchImpl?: typeof undiciFetch;
  /**
   * Client used for the hops whose credentials have been withheld. Defaults to plain
   * `undici`, *not* to {@link fetchImpl}.
   *
   * A client that adds credentials on its own has to be kept out of these hops: the
   * cookie jar attaches the session cookie for the request origin, and the OAuth retry
   * sets a fresh `Authorization` on a `401`, so either would put the secrets back on a
   * URL the redirect target chose — the hop this helper strips them for. Defaulting to
   * the plain client makes a caller that only passes `fetchImpl` fail safe instead of
   * reopening that hole, so pass the wrapped client here only if the hops without
   * credentials are expected to reach it.
   */
  unauthenticatedFetchImpl?: typeof undiciFetch;
  maxRedirects?: number;
  /**
   * Header names withheld from redirect targets outside the initial origin unless
   * the target is a trusted host. Defaults to {@link CREDENTIAL_HEADERS}.
   */
  credentialHeaders?: readonly string[];
  /**
   * Called with `target.host` (host plus a non-default port) — the same key the
   * `GITLAB_API_URL` / `GITLAB_ALLOWED_HOSTS` allowlist is built from, so
   * `gitlab.internal:8443` matches a redirect to that host and port.
   *
   * A trusted host may be reached even when it resolves to a non-public address,
   * because operator-declared GitLab instances and their storage may legitimately
   * live on a private network. Trusted hosts also keep receiving the request
   * credentials.
   */
  isTrustedRedirectHost?: (host: string) => boolean;
}

/**
 * Whether a hop's destination is an operator-declared GitLab host. Such a host is
 * reachable even when it resolves to a private address and keeps receiving the
 * request credentials.
 */
function isTrustedRedirectTarget(
  target: URL,
  options: FetchWithValidatedRedirectsOptions
): boolean {
  return options.isTrustedRedirectHost?.(target.host) === true;
}

/**
 * The request headers stripped of every credential header. Used for redirect hops
 * that leave the origin that issued the credentials, so a GitLab 302 to object
 * storage (or any other host) cannot leak a token.
 */
function withoutCredentialHeaders(
  options: FetchWithValidatedRedirectsOptions
): Record<string, string> {
  const credentialHeaders = new Set(
    (options.credentialHeaders ?? CREDENTIAL_HEADERS).map(name => name.toLowerCase())
  );
  return Object.fromEntries(
    Object.entries(options.headers).filter(([name]) => !credentialHeaders.has(name.toLowerCase()))
  );
}

/**
 * Refuses a hop whose address the server must never reach: anything that resolves
 * to a non-public address, and any name that does not resolve at all. Trusted hosts
 * are exempt, because an operator-declared GitLab instance may live on a private
 * network.
 *
 * Runs on every redirect hop, so an upstream cannot steer the request to loopback,
 * link-local instance metadata, or a private-range host.
 */
async function assertRedirectTargetAllowed(
  target: URL,
  trusted: boolean,
  options: FetchWithValidatedRedirectsOptions
): Promise<void> {
  if (trusted) {
    return;
  }

  const host = target.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (isIP(host)) {
    if (isNonPublicAddress(host)) {
      throw new UnsafeRedirectError(`Refusing to follow redirect to non-public address: ${host}`);
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
 * The HTTP client default follows redirects without re-validating the destination,
 * which lets an upstream response redirect the server to an arbitrary host
 * (including loopback and link-local addresses). This helper fetches with
 * `redirect: "manual"` and re-applies the destination check on each `Location`
 * value, to every address form the URL parser can produce (compressed IPv6,
 * IPv4-mapped, NAT64, ...).
 *
 * Credential headers are withheld from any hop that leaves the initial origin
 * unless the destination is a trusted host, so redirects to object storage or any
 * other host cannot exfiltrate the GitLab token. A later hop to a trusted host gets
 * them back — the allowlist is the policy — and so does a hop that returns to the
 * initial origin after such a trusted hop, because that hop already received them.
 * A hop back to the initial origin while they are still withheld does not: the caller
 * reads that response as the downloaded file, so an authenticated request there would
 * be one the redirect target chose. A hop that would downgrade HTTPS to cleartext HTTP
 * is refused before the credentials are considered at all.
 *
 * Residual risk: the destination host is resolved twice — once for the check and
 * again when the connection is opened — so a DNS name with a short TTL can answer
 * with a public address first and a non-public address on connect. Closing that
 * window needs the connection to use the address that was validated, which is not
 * reachable from here: rewriting the request origin to an IP literal drops the TLS
 * `servername` (`undici` derives it from the request host) and would also bypass the
 * proxy routing that `GitLabClientPool` applies per origin, so downloads through a
 * proxy would break or lose hostname verification. The durable fix is a validating
 * `connect.lookup` on the pool's own `Agent`s, which keeps the hostname as the
 * origin; that covers every outbound request rather than this helper alone. The
 * outbound request stays otherwise unrestricted towards public addresses, which
 * GitLab object storage requires.
 */
export async function fetchWithValidatedRedirects(
  url: string,
  options: FetchWithValidatedRedirectsOptions
): Promise<FetchResponse> {
  const authenticatedFetch = options.fetchImpl ?? undiciFetch;
  // Not `authenticatedFetch`: a caller that passes a client able to add credentials —
  // and forgets this option — must not hand it a hop with the credentials stripped.
  const unauthenticatedFetch = options.unauthenticatedFetchImpl ?? undiciFetch;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const initialOrigin = new URL(url).origin;

  let currentUrl = url;
  let currentProtocol = new URL(url).protocol;
  let currentHeaders = options.headers;
  // Set once a hop outside the origin has been followed without the credentials, so a
  // later hop back to the origin cannot re-attach them.
  let credentialsWithheld = false;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    // A stripped hop must not go through a client that can add credentials again.
    const hopFetch = credentialsWithheld ? unauthenticatedFetch : authenticatedFetch;
    const response = await hopFetch(currentUrl, {
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

    // A downgrade would put the request — including any credential a trusted host
    // keeps — on the wire in cleartext, so it is refused before the destination is
    // evaluated and before any trust decision can re-enable the credentials.
    if (currentProtocol === "https:" && target.protocol === "http:") {
      throw new UnsafeRedirectError(
        `Refusing to follow redirect from ${currentUrl} to cleartext ${target.toString()}`
      );
    }

    // A hop that stays on the originating origin needs no destination check. It keeps
    // the credentials only when they were not withheld on the way here: a target that
    // sends the request back to the origin would otherwise receive an authenticated
    // response — for a URL it chose — that the caller of this helper then reads as the
    // downloaded body. A hop that returns after a *trusted* hop gets them back, because
    // that hop already holds them.
    if (target.origin === initialOrigin) {
      currentHeaders = credentialsWithheld ? withoutCredentialHeaders(options) : options.headers;
    } else {
      const trusted = isTrustedRedirectTarget(target, options);
      await assertRedirectTargetAllowed(target, trusted, options);
      currentHeaders = trusted ? options.headers : withoutCredentialHeaders(options);
      credentialsWithheld = !trusted;
    }

    currentUrl = target.toString();
    currentProtocol = target.protocol;
  }

  throw new UnsafeRedirectError(`Too many redirects (limit ${maxRedirects})`);
}
