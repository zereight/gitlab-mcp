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
  AuthCodeFlowState,
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
export { sessionStore, SessionStore } from "./session-store";

// Storage Backends
export {
  createStorageBackend,
  getStorageType,
  validateStorageConfig,
  MemoryStorageBackend,
  FileStorageBackend,
  PostgreSQLStorageBackend,
  STORAGE_DATA_VERSION,
} from "./storage";
export type {
  SessionStorageBackend,
  StorageConfig,
  SessionStorageStats,
  StorageData,
} from "./storage";

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

// GitLab OAuth Flows (Device Flow and Authorization Code Flow)
export {
  initiateDeviceFlow,
  pollDeviceFlowOnce,
  pollForToken,
  refreshGitLabToken,
  getGitLabUser,
  validateGitLabToken,
  exchangeGitLabAuthCode,
  buildGitLabAuthUrl,
} from "./gitlab-device-flow";

// OAuth Endpoints
export {
  metadataHandler,
  healthHandler,
  protectedResourceHandler,
  getBaseUrl,
  authorizeHandler,
  pollHandler,
  callbackHandler,
  tokenHandler,
  registerHandler,
  getRegisteredClient,
  isValidRedirectUri,
} from "./endpoints/index";
