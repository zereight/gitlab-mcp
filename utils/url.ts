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

const INVALID_SEGMENT_MESSAGE =
  "Cannot use value as a GitLab URL path segment: it is or contains a '.'/'..' path segment, " +
  "or starts with a path separator";

/**
 * Encode a single value for use as one GitLab URL path segment.
 *
 * Rejects values that are, decode to, or start with dot segments or an absolute
 * path, so a caller-supplied id cannot escape the intended route prefix.
 * Percent-encoded separators are decoded before the check because the receiving
 * server may treat them as separators.
 *
 * @throws {Error} when the value is a dot segment, contains one, or starts with a separator
 */
export function encodeGitLabPathSegment(value: unknown): string {
  const segment = String(value);
  let decodedSegment: string;
  try {
    decodedSegment = decodeURIComponent(segment);
  } catch {
    decodedSegment = segment;
  }

  if (DOT_SEGMENT_PATTERN.test(decodedSegment) || LEADING_SEPARATOR_PATTERN.test(decodedSegment)) {
    throw new Error(INVALID_SEGMENT_MESSAGE);
  }

  return encodeURIComponent(decodedSegment);
}

/**
 * Encode a slash-separated path so each segment is encoded and validated
 * individually. Legitimate encoded separators (for example a tag such as
 * "release%2F1.0") stay allowed; dot segments are rejected.
 *
 * @throws {Error} when any segment is a dot segment or contains one
 */
export function encodeGitLabPath(value: string): string {
  return value.split("/").map(encodeGitLabPathSegment).join("/");
}
