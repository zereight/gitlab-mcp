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

  // GitLab OAuth2 configuration
  GITLAB_OAUTH2_CLIENT_ID: process.env.GITLAB_OAUTH2_CLIENT_ID,
  GITLAB_OAUTH2_CLIENT_SECRET: process.env.GITLAB_OAUTH2_CLIENT_SECRET,
  GITLAB_OAUTH2_REDIRECT_URL: process.env.GITLAB_OAUTH2_REDIRECT_URL,

  // base url matters for the redirect url, i think?
  GITLAB_OAUTH2_BASE_URL: process.env.GITLAB_OAUTH2_BASE_URL, // http://localhost:3002

  // TODO: maybe thse can be formed based off of the ISSUER_URL? im not sure... (could introduce problems if gitlab ever changes these endpoints, though i doubt they will)
  GITLAB_OAUTH2_TOKEN_URL: process.env.GITLAB_OAUTH2_TOKEN_URL, // https://gitlab.com/oauth/token
  GITLAB_OAUTH2_AUTHORIZATION_URL: process.env.GITLAB_OAUTH2_AUTHORIZATION_URL, // https://gitlab.com/oauth/authorize
  GITLAB_OAUTH2_REVOCATION_URL: process.env.GITLAB_OAUTH2_REVOCATION_URL, // https://gitlab.com/oauth/revoke
  GITLAB_OAUTH2_INTROSPECTION_URL: process.env.GITLAB_OAUTH2_INTROSPECTION_URL, // https://gitlab.com/oauth/introspect
  GITLAB_OAUTH2_REGISTRATION_URL: process.env.GITLAB_OAUTH2_REGISTRATION_URL, // ?

  GITLAB_OAUTH2_ISSUER_URL: process.env.GITLAB_OAUTH2_ISSUER_URL, // https://gitlab.com
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
