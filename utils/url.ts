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
 * Percent-decode a value until decoding stops changing it.
 *
 * Returns null when the value cannot be reduced to a form that can be validated:
 * a malformed escape sequence, or more encoding layers than {@link MAX_DECODE_PASSES}.
 * A guard must not treat "could not inspect the value" as "safe", so both cases are
 * rejected by the callers rather than passed through.
 */
function decodeFully(value: string): string | null {
  let current = value;

  for (let pass = 0; pass < MAX_DECODE_PASSES; pass++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return null;
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
