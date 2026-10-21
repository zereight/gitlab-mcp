import { splitCommaSeparatedUrls, stripUrlUserinfo } from "./redact-url.js";

/**
 * Smart URL handling for GitLab API
 *
 * @param {string | undefined} url - Input GitLab API URL
 * @returns {string} Normalized GitLab API URL with /api/v4 path
 */
export function normalizeGitLabApiUrl(url: string): string {
  if (!url) {
    return "https://gitlab.com/api/v4";
  }
  let normalizedUrl = url.trim();
  if (normalizedUrl.endsWith("/")) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }
  if (!normalizedUrl.endsWith("/api/v4")) {
    normalizedUrl = `${normalizedUrl}/api/v4`;
  }
  return normalizedUrl;
}

/**
 * Startup warning for a configured API URL that had userinfo. `source` names
 * where the URL came from. The advice stays generic: a remote-authorization or
 * MCP OAuth deployment must not be told to add a server token.
 */
export function apiUrlUserinfoWarning(source: ApiUrlSource): string {
  return (
    `${source} contains a username or password before the host. It is ignored: requests ` +
    "go to the URL without it. Use a token or OAuth configuration to authenticate instead."
  );
}

export type ApiUrlSource = "--api-url" | "GITLAB_API_URL";

const HIDDEN_VALUE_NOTE = "(value not shown: it may contain a password)";
const COMMA_IN_PASSWORD_HINT = "write a comma inside a username or password as %2C";

/**
 * Startup error for one entry of a comma-separated URL or host list. The entry
 * is named by its position only. A comma inside a password splits the list
 * there ("http://alice:p,http://w@host" gives "http://alice:p"), and an entry
 * that does not parse has no host that is safe to show: any of its text can
 * be part of the password.
 */
export function invalidListEntryError(
  source: string,
  index: number,
  total: number,
  problem: string
): string {
  return `${source} entry ${index + 1} of ${total} ${problem} ${HIDDEN_VALUE_NOTE}`;
}

/** Follows the entry errors of a list that had more than one entry. */
export function commaSplitHint(source: string): string {
  return `${source} is split at commas: ${COMMA_IN_PASSWORD_HINT}`;
}

/**
 * Startup errors for a configured GITLAB_API_URL list, one per bad entry, and
 * none of them echo the entry. Each entry must be an http or https URL:
 * fetch() cannot use another scheme, and a value without "//" such as
 * "alice:p,w@host" parses as a URL whose scheme is the username. The scheme
 * is checked, not the "//": fetch() also accepts "https:/host".
 */
export function configuredApiUrlErrors(source: ApiUrlSource, value: string): string[] {
  const entries = splitCommaSeparatedUrls(value);
  const errors: string[] = [];
  let hasInvalidEntry = false;
  entries.forEach((entry, index) => {
    if (entry.length === 0) {
      errors.push(`${source} entry ${index + 1} of ${entries.length} is empty`);
      return;
    }
    const problem = apiUrlProblem(entry);
    if (problem !== null) {
      hasInvalidEntry = true;
      errors.push(invalidListEntryError(source, index, entries.length, problem));
    }
  });
  // With only empty entries wrong, the list has an extra comma ("a,,b" or a
  // trailing one), and the hint about a comma inside a password would mislead.
  if (hasInvalidEntry && entries.length > 1) {
    errors.push(commaSplitHint(source));
  }
  return errors;
}

/**
 * The error for one API URL that is not split at commas (the `auth` command),
 * or null when it is an http or https URL.
 */
export function apiUrlError(source: ApiUrlSource, url: string): string | null {
  const problem = apiUrlProblem(url.trim());
  if (problem === null) {
    return null;
  }
  const hint = url.includes(",") ? `; ${COMMA_IN_PASSWORD_HINT}` : "";
  return `${source} ${problem} ${HIDDEN_VALUE_NOTE}${hint}`;
}

function apiUrlProblem(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "is not a valid URL";
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:"
    ? null
    : "is not an http or https URL";
}

export interface ConfiguredGitLabApiUrls {
  readonly urls: string[];
  /** True when at least one entry had userinfo; see apiUrlUserinfoWarning. */
  readonly hadUserinfo: boolean;
}

/**
 * Split a comma-separated GITLAB_API_URL, drop userinfo from each entry, and
 * normalize it. fetch() refuses a URL with credentials, so a URL that kept
 * them would fail every request and echo the password in the error.
 */
export function parseConfiguredGitLabApiUrls(value: string): ConfiguredGitLabApiUrls {
  const entries = splitCommaSeparatedUrls(value).map(stripUrlUserinfo);
  return {
    urls: entries.map(entry => normalizeGitLabApiUrl(entry.url)),
    hadUserinfo: entries.some(entry => entry.hadUserinfo),
  };
}

/**
 * The host name of a configured API URL, for the startup log. A password with a
 * literal comma can be split into two URLs, and "http://alice:12" then reads
 * the start of the password as a port, which text redaction keeps. The port,
 * userinfo, path, and query are left out. An IPv6 host keeps its brackets.
 * An "@" after the host means the host can be part of a password
 * ("http://sec/ret@host" from "alice:12,http://sec/ret@host"), so it is not shown.
 */
export function apiUrlHostnameForLog(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "<invalid>";
  }
  const atAfterHost =
    parsed.pathname.includes("@") || parsed.search.includes("@") || parsed.hash.includes("@");
  return parsed.hostname.length === 0 || atAfterHost ? "<invalid>" : parsed.hostname;
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * True when the URL is plain `http://` to a non-loopback host, i.e. credentials sent
 * to it would cross the network in cleartext. Unparseable URLs return false (they are
 * rejected by the config validation instead).
 */
export function isCleartextRemoteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" && !LOOPBACK_HOSTNAMES.has(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Dot segments anywhere in a decoded value, including after a percent-encoded
 * separator ("..%2F..%2Fuser" decodes to a path-traversal sequence).
 */
const DOT_SEGMENT_PATTERN = /(^|[\\/])\.\.?([\\/]|$)/;

/** A decoded value that starts with a path separator (absolute-path payload). */
const LEADING_SEPARATOR_PATTERN = /^[\\/]/;

/** NUL, newline and the other control characters: never valid in a path segment. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

/**
 * How many times a value is percent-decoded before the checks run. A payload can be
 * encoded more than once ("%252E%252E%252Fuser" only becomes "../user" after two
 * decodes), so the checks run on the form the receiving server may eventually see.
 */
const MAX_DECODE_PASSES = 5;

const INVALID_SEGMENT_MESSAGE =
  "Cannot use value as a GitLab URL path segment: it is or decodes to a '.'/'..' path segment, " +
  "a control character such as NUL, or an absolute path";

const INVALID_PATH_MESSAGE =
  "Cannot use value as a GitLab URL path: it is empty or it has an empty, leading or trailing segment";

/**
 * A percent escape that actually decodes to a byte: `%` followed by two hex digits.
 *
 * `decodeURIComponent` also throws for a `%` that starts no escape, and a literal
 * percent sign is valid in a file or branch name ("report-100%.pdf"), so the two
 * failures have to be told apart before either is treated as a broken payload.
 */
const VALID_ESCAPE_PATTERN = /%[0-9a-fA-F]{2}/;

/**
 * Percent-decode a value until decoding stops changing it.
 *
 * Returns null when the value cannot be reduced to a form that can be validated:
 * a malformed escape next to a valid one, or more encoding layers than
 * {@link MAX_DECODE_PASSES}. A guard must not treat "could not inspect the value"
 * as "safe", so both cases are rejected by the callers rather than passed through.
 *
 * A `%` that starts no valid escape is a literal character instead: the value is
 * returned as it is and the encoder turns the sign into `%25`, so
 * `get_file_contents("report-100%.pdf")` keeps working. Only a value that mixes a
 * real escape with a broken one cannot be inspected, and that form is rejected.
 */
function decodeFully(value: string): string | null {
  let current = value;

  for (let pass = 0; pass < MAX_DECODE_PASSES; pass++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      // Undecodable. With a valid escape left in it the value cannot be inspected
      // reliably (the escape may still hide a separator or a dot segment), so it
      // fails closed; without one every `%` is literal and `current` — already
      // decoded as far as it can be — is the form the server will see.
      return VALID_ESCAPE_PATTERN.test(current) ? null : current;
    }

    if (decoded === current) {
      return current;
    }
    current = decoded;
  }

  return null;
}

/**
 * Encode a single value for use as one GitLab URL path segment.
 *
 * Rejects values that are, decode to, or start with dot segments or an absolute
 * path, so a caller-supplied id cannot escape the intended route prefix.
 * Percent-encoded separators are decoded before the check because the receiving
 * server may treat them as separators; a value may be encoded any number of times
 * and is still validated in its fully decoded form.
 *
 * @throws {Error} when the value is a dot segment, contains one, contains a control
 * character, starts with a separator, or is not valid percent-encoding
 */
export function encodeGitLabPathSegment(value: unknown): string {
  const segment = String(value);
  const decodedSegment = decodeFully(segment);

  if (
    decodedSegment === null ||
    DOT_SEGMENT_PATTERN.test(decodedSegment) ||
    LEADING_SEPARATOR_PATTERN.test(decodedSegment) ||
    CONTROL_CHARACTER_PATTERN.test(decodedSegment)
  ) {
    throw new Error(INVALID_SEGMENT_MESSAGE);
  }

  return encodeURIComponent(decodedSegment);
}

/**
 * Encode a slash-separated path so each segment is encoded and validated
 * individually. Legitimate encoded separators (for example a tag such as
 * "release%2F1.0") stay allowed; dot segments are rejected.
 *
 * An empty path, or one with an empty, leading or trailing segment, is rejected
 * rather than silently collapsed: `"/etc/passwd"` would otherwise encode to a
 * leading-separator path instead of the intended relative one.
 *
 * @throws {Error} when the path is empty or has an empty segment, or when any
 * segment is a dot segment or contains one
 */
export function encodeGitLabPath(value: string): string {
  const segments = value.split("/");
  if (segments.some(segment => segment === "")) {
    throw new Error(INVALID_PATH_MESSAGE);
  }

  return segments.map(encodeGitLabPathSegment).join("/");
}

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function looksLikeAbsoluteApiReference(value: string): boolean {
  return value.includes("://") || value.startsWith("//") || ABSOLUTE_URL_PATTERN.test(value);
}

/**
 * Normalize a caller path so it can only name a resource under `/api/v4`.
 * Rejects absolute URLs, protocol-relative hosts, backslashes, dot segments
 * (including percent-encoded ones), and control characters. A single leading
 * or trailing slash is removed so `/projects/1` and `projects/1` are the same
 * relative path.
 */
export function normalizeGitLabApiRelativePath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (trimmed.length === 0) {
    throw new Error("GitLab API path is empty");
  }
  if (
    CONTROL_CHARACTER_PATTERN.test(trimmed) ||
    trimmed.includes("\\") ||
    looksLikeAbsoluteApiReference(trimmed)
  ) {
    throw new Error(
      "GitLab API path must be a relative path under /api/v4 (absolute URLs, protocol-relative hosts, backslashes, and control characters are rejected)"
    );
  }

  const withoutLeadingSlash = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const relative = withoutLeadingSlash.endsWith("/")
    ? withoutLeadingSlash.slice(0, -1)
    : withoutLeadingSlash;
  if (relative.length === 0 || relative.startsWith("/")) {
    throw new Error("GitLab API path must be a relative path under /api/v4");
  }

  const decoded = decodeFully(relative);
  if (
    decoded === null ||
    CONTROL_CHARACTER_PATTERN.test(decoded) ||
    decoded.includes("\\") ||
    looksLikeAbsoluteApiReference(decoded)
  ) {
    throw new Error(
      "GitLab API path must be a relative path under /api/v4 (absolute URLs, protocol-relative hosts, backslashes, and control characters are rejected)"
    );
  }

  // encodeGitLabPath rejects `.` / `..` segments, including percent-encoded forms.
  encodeGitLabPath(relative);
  return relative;
}

/**
 * Resolve `rawPath` against the configured GitLab API base (`.../api/v4`).
 * The result is the same origin and stays under that base path.
 */
export function resolveGitLabApiRequestUrl(apiBase: string, rawPath: string): URL {
  const relative = normalizeGitLabApiRelativePath(rawPath);
  const encoded = encodeGitLabPath(relative);
  const base = new URL(apiBase.endsWith("/") ? apiBase : `${apiBase}/`);
  const resolved = new URL(encoded, base);

  if (resolved.origin !== base.origin || resolved.username !== "" || resolved.password !== "") {
    throw new Error("GitLab API path escapes the configured API origin");
  }

  const basePath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
  const staysUnderBase =
    resolved.pathname === base.pathname.replace(/\/$/, "") ||
    resolved.pathname.startsWith(basePath);
  if (!staysUnderBase || resolved.search !== "" || resolved.hash !== "") {
    throw new Error("GitLab API path escapes the configured /api/v4 base");
  }

  return resolved;
}

function decodeApiPathSegment(segment: string): string {
  const decoded = decodeFully(segment);
  if (decoded === null) {
    throw new Error("GitLab API path has an invalid project id encoding");
  }
  return decoded;
}

/**
 * Project id from `projects/:id` or `projects/:id/...`.
 *
 * Segments are percent-decoded until stable, the same way the outgoing request
 * is built. An encoded `projects` prefix still selects this route. A slash
 * encoded inside the id (`group%2Fproj`) stays part of that one id.
 * Other paths return undefined.
 */
export function readProjectIdFromApiRelativePath(relativePath: string): string | undefined {
  const segments = relativePath.split("/");
  if (segments.length < 2) {
    return undefined;
  }
  if (decodeApiPathSegment(segments[0]) !== "projects") {
    return undefined;
  }
  const projectId = decodeApiPathSegment(segments[1]);
  if (projectId.length === 0) {
    return undefined;
  }
  return projectId;
}
