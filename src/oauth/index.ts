/**
 * OAuth Module Index
 *
 * Main entry point for OAuth functionality.
 * Re-exports all OAuth-related modules for easy import.
 */

// Configuration
export {
  loadOAuthConfig,
  validateStaticConfig,
  isOAuthEnabled,
  getAuthModeDescription,
  resetOAuthConfigCache,
} from "./config";
export type { OAuthConfig } from "./config";

// Types
export type {
  OAuthSession,
  DeviceFlowState,
  AuthorizationCode,
  GitLabTokenResponse,
  GitLabDeviceResponse,
  TokenContext,
  GitLabUserInfo,
  MCPTokenResponse,
  OAuthErrorResponse,
  DeviceFlowPollStatus,
  DeviceFlowPollResponse,
  MCPTokenPayload,
} from "./types";

// Session Store
export { sessionStore } from "./session-store";

// Token Context (AsyncLocalStorage)
export {
  runWithTokenContext,
  getTokenContext,
  getGitLabTokenFromContext,
  getGitLabUserIdFromContext,
  getGitLabUsernameFromContext,
  getSessionIdFromContext,
  isInOAuthContext,
} from "./token-context";

// Token Utilities
export {
  createJWT,
  verifyJWT,
  verifyMCPToken,
  generateCodeVerifier,
  generateCodeChallenge,
  verifyCodeChallenge,
  generateRandomString,
  generateUUID,
  generateAuthorizationCode,
  generateSessionId,
  generateRefreshToken,
  isTokenExpiringSoon,
  calculateTokenExpiry,
} from "./token-utils";

// GitLab Device Flow
export {
  initiateDeviceFlow,
  pollDeviceFlowOnce,
  pollForToken,
  refreshGitLabToken,
  getGitLabUser,
  validateGitLabToken,
} from "./gitlab-device-flow";

// OAuth Endpoints
export {
  metadataHandler,
  healthHandler,
  getBaseUrl,
  authorizeHandler,
  pollHandler,
  tokenHandler,
} from "./endpoints/index";
