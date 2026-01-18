/**
 * OAuth Types for gitlab-mcp
 *
 * These types define the data structures used throughout the OAuth implementation
 * for Claude Custom Connector support with GitLab Device Flow authentication.
 */

/**
 * OAuth session representing an authenticated user
 * Stores both MCP tokens (issued by gitlab-mcp) and GitLab tokens (from GitLab OAuth)
 */
export interface OAuthSession {
  /** Unique session identifier (UUID) */
  id: string;

  // MCP tokens (issued by gitlab-mcp to Claude)
  /** JWT access token for MCP requests */
  mcpAccessToken: string;
  /** Refresh token for obtaining new MCP access tokens */
  mcpRefreshToken: string;
  /** MCP token expiry timestamp (milliseconds since epoch) */
  mcpTokenExpiry: number;

  // GitLab tokens (obtained from GitLab OAuth)
  /** GitLab OAuth access token for API calls */
  gitlabAccessToken: string;
  /** GitLab OAuth refresh token */
  gitlabRefreshToken: string;
  /** GitLab token expiry timestamp (milliseconds since epoch) */
  gitlabTokenExpiry: number;

  // User info from GitLab
  /** GitLab user ID */
  gitlabUserId: number;
  /** GitLab username */
  gitlabUsername: string;

  // Session metadata
  /** OAuth client ID that created this session */
  clientId: string;
  /** Granted scopes */
  scopes: string[];
  /** Session creation timestamp (milliseconds since epoch) */
  createdAt: number;
  /** Last update timestamp (milliseconds since epoch) */
  updatedAt: number;
}

/**
 * State for tracking an in-progress Authorization Code Flow
 * Used when redirect_uri is provided (web-based OAuth like Claude.ai)
 */
export interface AuthCodeFlowState {
  /** OAuth client ID */
  clientId: string;
  /** PKCE code challenge */
  codeChallenge: string;
  /** PKCE code challenge method (S256) */
  codeChallengeMethod: string;
  /** OAuth state parameter for CSRF protection (original from client) */
  clientState: string;
  /** Internal state for GitLab callback */
  internalState: string;
  /** Client's redirect URI (where to redirect after GitLab auth) */
  clientRedirectUri: string;
  /** Our callback URI (registered in GitLab OAuth app) */
  callbackUri: string;
  /** Expiry timestamp (milliseconds since epoch) */
  expiresAt: number;
}

/**
 * State for tracking an in-progress device authorization flow
 */
export interface DeviceFlowState {
  /** Device code returned by GitLab */
  deviceCode: string;
  /** User code to display to the user */
  userCode: string;
  /** URL where user should enter the code */
  verificationUri: string;
  /** Optional complete URL with code pre-filled */
  verificationUriComplete?: string;
  /** Expiry timestamp (milliseconds since epoch) */
  expiresAt: number;
  /** Polling interval in seconds */
  interval: number;
  /** OAuth client ID */
  clientId: string;
  /** PKCE code challenge */
  codeChallenge: string;
  /** PKCE code challenge method (S256) */
  codeChallengeMethod: string;
  /** OAuth state parameter for CSRF protection */
  state: string;
  /** Redirect URI for completion */
  redirectUri?: string;
}

/**
 * Authorization code for OAuth code exchange
 */
export interface AuthorizationCode {
  /** The authorization code string */
  code: string;
  /** Associated session ID */
  sessionId: string;
  /** OAuth client ID */
  clientId: string;
  /** PKCE code challenge for verification */
  codeChallenge: string;
  /** PKCE code challenge method */
  codeChallengeMethod: string;
  /** Redirect URI (must match on exchange) */
  redirectUri?: string;
  /** Expiry timestamp (milliseconds since epoch) */
  expiresAt: number;
}

/**
 * GitLab OAuth token response
 */
export interface GitLabTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  created_at: number;
  scope?: string;
}

/**
 * GitLab device authorization response
 */
export interface GitLabDeviceResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

/**
 * Token context for request processing
 * Available via AsyncLocalStorage during OAuth-authenticated requests
 */
export interface TokenContext {
  /** GitLab access token for API calls */
  gitlabToken: string;
  /** GitLab user ID */
  gitlabUserId: number;
  /** GitLab username */
  gitlabUsername: string;
  /** Session ID for tracking */
  sessionId: string;
}

/**
 * GitLab user info response
 */
export interface GitLabUserInfo {
  id: number;
  username: string;
  name?: string;
  email?: string;
}

/**
 * MCP token response (returned to Claude)
 */
export interface MCPTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/**
 * OAuth error response
 */
export interface OAuthErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * Device flow poll status
 */
export type DeviceFlowPollStatus = "pending" | "complete" | "failed" | "expired";

/**
 * Device flow poll response
 */
export interface DeviceFlowPollResponse {
  status: DeviceFlowPollStatus;
  redirect_uri?: string;
  code?: string;
  state?: string;
  error?: string;
}

/**
 * JWT payload for MCP access tokens
 */
export interface MCPTokenPayload {
  /** Issuer (base URL of gitlab-mcp) */
  iss: string;
  /** Subject (GitLab user ID) */
  sub: string;
  /** Audience (OAuth client ID) */
  aud: string;
  /** Session ID */
  sid: string;
  /** Granted scopes */
  scope: string;
  /** GitLab username */
  gitlab_user: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiry timestamp */
  exp: number;
}
