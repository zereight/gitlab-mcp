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
