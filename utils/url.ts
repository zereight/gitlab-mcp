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

/** Project id from `projects/:id` or `projects/:id/...`. Other paths return undefined. */
export function readProjectIdFromApiRelativePath(relativePath: string): string | undefined {
  const match = /^projects\/([^/]+)(?:\/|$)/.exec(relativePath);
  if (!match) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    throw new Error("GitLab API path has an invalid project id encoding");
  }
}
