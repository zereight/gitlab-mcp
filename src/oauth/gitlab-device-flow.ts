/**
 * GitLab Device Flow Client
 *
 * Implements the OAuth 2.0 Device Authorization Grant (RFC 8628) for GitLab.
 * This allows authentication on devices without browser access by having
 * users authenticate on a separate device.
 *
 * GitLab Device Flow documentation: https://docs.gitlab.com/api/oauth2/#device-authorization-grant
 */

import { GITLAB_BASE_URL } from "../config";
import { OAuthConfig } from "./config";
import { GitLabDeviceResponse, GitLabTokenResponse, GitLabUserInfo } from "./types";
import { logger } from "../logger";

/**
 * Device flow error types from GitLab
 */
type DeviceFlowError =
  | "authorization_pending"
  | "slow_down"
  | "expired_token"
  | "access_denied"
  | "invalid_grant"
  | "invalid_request";

/**
 * Device flow error response from GitLab
 */
interface DeviceFlowErrorResponse {
  error: DeviceFlowError;
  error_description?: string;
}

/**
 * Initiate the device authorization flow with GitLab
 *
 * This starts the device flow by requesting a device code and user code
 * from GitLab. The user must then visit the verification URI and enter
 * the user code to authorize the application.
 *
 * @param config - OAuth configuration
 * @returns Device authorization response with codes and URIs
 * @throws Error if the request fails
 */
export async function initiateDeviceFlow(config: OAuthConfig): Promise<GitLabDeviceResponse> {
  const url = `${GITLAB_BASE_URL}/oauth/authorize_device`;

  logger.debug({ url, clientId: config.gitlabClientId }, "Initiating GitLab device flow");

  // Convert comma-separated scopes to space-separated (GitLab requirement)
  const scopes = config.gitlabScopes.replace(/,/g, " ");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: config.gitlabClientId,
      scope: scopes,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, "Failed to initiate device flow");
    throw new Error(`Failed to initiate device flow: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as GitLabDeviceResponse;

  logger.info(
    {
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in,
    },
    "Device flow initiated"
  );

  return data;
}

/**
 * Poll GitLab for device authorization completion (single attempt)
 *
 * Makes a single poll request to check if the user has completed authorization.
 * Returns the token response if authorized, null if still pending.
 *
 * @param deviceCode - Device code from initiateDeviceFlow
 * @param config - OAuth configuration
 * @returns Token response if authorized, null if pending
 * @throws Error for terminal errors (expired, denied, etc.)
 */
export async function pollDeviceFlowOnce(
  deviceCode: string,
  config: OAuthConfig
): Promise<GitLabTokenResponse | null> {
  const url = `${GITLAB_BASE_URL}/oauth/token`;

  const params: Record<string, string> = {
    client_id: config.gitlabClientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  };

  // Add client secret if configured (for confidential apps)
  if (config.gitlabClientSecret) {
    params.client_secret = config.gitlabClientSecret;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params),
  });

  if (response.ok) {
    const data = (await response.json()) as GitLabTokenResponse;
    logger.info("Device flow authorization completed successfully");
    return data;
  }

  // Handle error responses
  const error = (await response.json()) as DeviceFlowErrorResponse;

  switch (error.error) {
    case "authorization_pending":
      // User hasn't completed authorization yet - this is normal
      return null;

    case "slow_down":
      // GitLab is asking us to slow down - we should increase the interval
      // The caller should handle this by increasing poll interval
      logger.debug("Device flow: slow_down received, should increase poll interval");
      return null;

    case "expired_token":
      throw new Error("Device code expired. Please start a new authorization.");

    case "access_denied":
      throw new Error("User denied the authorization request.");

    case "invalid_grant":
      throw new Error("Invalid device code or grant.");

    default:
      throw new Error(`Device flow error: ${error.error_description ?? error.error}`);
  }
}

/**
 * Poll GitLab for device authorization completion (with retries)
 *
 * Continuously polls GitLab until the user completes authorization,
 * the device code expires, or the user denies the request.
 *
 * @param deviceCode - Device code from initiateDeviceFlow
 * @param config - OAuth configuration
 * @param onPending - Optional callback called on each pending poll
 * @returns Token response when authorized
 * @throws Error on timeout, expiration, or denial
 */
export async function pollForToken(
  deviceCode: string,
  config: OAuthConfig,
  onPending?: () => void
): Promise<GitLabTokenResponse> {
  const startTime = Date.now();
  const timeout = config.deviceTimeout * 1000;
  let interval = config.devicePollInterval * 1000;

  while (Date.now() - startTime < timeout) {
    // Wait before polling
    await sleep(interval);

    try {
      const result = await pollDeviceFlowOnce(deviceCode, config);

      if (result) {
        return result;
      }

      // Still pending
      onPending?.();
    } catch (error) {
      // Re-throw terminal errors
      if (error instanceof Error) {
        if (
          error.message.includes("expired") ||
          error.message.includes("denied") ||
          error.message.includes("invalid")
        ) {
          throw error;
        }
      }

      // Log but continue for transient errors
      logger.warn({ err: error as Error }, "Device flow poll error, will retry");
    }
  }

  throw new Error(`Device flow timeout after ${config.deviceTimeout} seconds`);
}

/**
 * Refresh a GitLab OAuth token
 *
 * Uses the refresh token to obtain a new access token when the current
 * one is expired or about to expire.
 *
 * @param refreshToken - GitLab refresh token
 * @param config - OAuth configuration
 * @returns New token response
 * @throws Error if refresh fails
 */
export async function refreshGitLabToken(
  refreshToken: string,
  config: OAuthConfig
): Promise<GitLabTokenResponse> {
  const url = `${GITLAB_BASE_URL}/oauth/token`;

  const params: Record<string, string> = {
    client_id: config.gitlabClientId,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  };

  // Add client secret if configured
  if (config.gitlabClientSecret) {
    params.client_secret = config.gitlabClientSecret;
  }

  logger.debug("Refreshing GitLab token");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, "Failed to refresh GitLab token");
    throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as GitLabTokenResponse;
  logger.info("GitLab token refreshed successfully");
  return data;
}

/**
 * Get the current GitLab user's information
 *
 * Uses the access token to fetch the authenticated user's profile.
 *
 * @param accessToken - GitLab access token
 * @returns User information (id and username)
 * @throws Error if the request fails
 */
export async function getGitLabUser(accessToken: string): Promise<GitLabUserInfo> {
  const url = `${GITLAB_BASE_URL}/api/v4/user`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, "Failed to get GitLab user info");
    throw new Error(`Failed to get GitLab user info: ${response.status}`);
  }

  const user = (await response.json()) as GitLabUserInfo;

  logger.debug({ userId: user.id, username: user.username }, "Retrieved GitLab user info");

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
  };
}

/**
 * Validate a GitLab access token
 *
 * Checks if the token is still valid by making a lightweight API call.
 *
 * @param accessToken - GitLab access token to validate
 * @returns true if the token is valid, false otherwise
 */
export async function validateGitLabToken(accessToken: string): Promise<boolean> {
  try {
    const url = `${GITLAB_BASE_URL}/api/v4/user`;

    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Exchange a GitLab authorization code for tokens
 *
 * Used in Authorization Code Flow when GitLab redirects back with a code.
 *
 * @param code - Authorization code from GitLab callback
 * @param redirectUri - The redirect URI that was used in the authorization request
 * @param config - OAuth configuration
 * @returns Token response with access and refresh tokens
 * @throws Error if the exchange fails
 */
export async function exchangeGitLabAuthCode(
  code: string,
  redirectUri: string,
  config: OAuthConfig
): Promise<GitLabTokenResponse> {
  const url = `${GITLAB_BASE_URL}/oauth/token`;

  const params: Record<string, string> = {
    client_id: config.gitlabClientId,
    code: code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  };

  // Add client secret if configured (for confidential apps)
  if (config.gitlabClientSecret) {
    params.client_secret = config.gitlabClientSecret;
  }

  logger.debug({ redirectUri }, "Exchanging GitLab authorization code for tokens");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { status: response.status, error: errorText },
      "Failed to exchange GitLab auth code"
    );
    throw new Error(`Failed to exchange authorization code: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as GitLabTokenResponse;
  logger.info("GitLab authorization code exchanged successfully");
  return data;
}

/**
 * Build GitLab OAuth authorization URL
 *
 * Used to redirect users to GitLab for authorization in the Authorization Code Flow.
 *
 * @param config - OAuth configuration
 * @param redirectUri - URI to redirect back to after authorization
 * @param state - State parameter for CSRF protection
 * @returns Full authorization URL
 */
export function buildGitLabAuthUrl(
  config: OAuthConfig,
  redirectUri: string,
  state: string
): string {
  // Convert comma-separated scopes to space-separated (GitLab requirement)
  const scopes = config.gitlabScopes.replace(/,/g, " ");

  const params = new URLSearchParams({
    client_id: config.gitlabClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state: state,
    scope: scopes,
  });

  return `${GITLAB_BASE_URL}/oauth/authorize?${params.toString()}`;
}

/**
 * Helper function to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
