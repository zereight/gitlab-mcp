export const config = {
  GITLAB_PERSONAL_ACCESS_TOKEN : process.env.GITLAB_PERSONAL_ACCESS_TOKEN,
  GITLAB_AUTH_COOKIE_PATH : process.env.GITLAB_AUTH_COOKIE_PATH,
  IS_OLD : process.env.GITLAB_IS_OLD === "true",
  GITLAB_READ_ONLY_MODE : process.env.GITLAB_READ_ONLY_MODE === "true",
  USE_GITLAB_WIKI : process.env.USE_GITLAB_WIKI === "true",
  USE_MILESTONE : process.env.USE_MILESTONE === "true",
  USE_PIPELINE : process.env.USE_PIPELINE === "true",
  // Add proxy configuration
  HTTP_PROXY : process.env.HTTP_PROXY,
  HTTPS_PROXY : process.env.HTTPS_PROXY,
  NODE_TLS_REJECT_UNAUTHORIZED : process.env.NODE_TLS_REJECT_UNAUTHORIZED,
  GITLAB_CA_CERT_PATH : process.env.GITLAB_CA_CERT_PATH,
  // Use the normalizeGitLabApiUrl function to handle various URL formats
  GITLAB_API_URL: normalizeGitLabApiUrl(process.env.GITLAB_API_URL || ""),
  GITLAB_PROJECT_ID: process.env.GITLAB_PROJECT_ID,
}
if (!config.GITLAB_PERSONAL_ACCESS_TOKEN) {
  console.error("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set");
  process.exit(1);
}
/**
 * Smart URL handling for GitLab API
 *
 * @param {string | undefined} url - Input GitLab API URL
 * @returns {string} Normalized GitLab API URL with /api/v4 path
 */
function normalizeGitLabApiUrl(url?: string): string {
  if (!url) {
    return "https://gitlab.com/api/v4";
  }

  // Remove trailing slash if present
  let normalizedUrl = url.endsWith("/") ? url.slice(0, -1) : url;

  // Check if URL already has /api/v4
  if (!normalizedUrl.endsWith("/api/v4") && !normalizedUrl.endsWith("/api/v4/")) {
    // Append /api/v4 if not already present
    normalizedUrl = `${normalizedUrl}/api/v4`;
  }

  return normalizedUrl;
}
