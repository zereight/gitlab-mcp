/**
 * Session Store for OAuth
 *
 * Unified interface for OAuth session storage with pluggable backends.
 * Supports in-memory, file-based, and PostgreSQL storage.
 *
 * Configuration via environment variables:
 * - OAUTH_STORAGE_TYPE: "memory" | "file" | "postgresql" (default: "memory")
 * - OAUTH_STORAGE_FILE_PATH: Path for file storage
 * - OAUTH_STORAGE_POSTGRESQL_URL: PostgreSQL connection string
 */

import { OAuthSession, DeviceFlowState, AuthorizationCode, AuthCodeFlowState } from "./types";
import { SessionStorageBackend, createStorageBackend } from "./storage";
import { logger } from "../logger";

/**
 * Session store with pluggable storage backends
 *
 * Provides both sync (for backward compatibility) and async APIs.
 * The sync methods work with in-memory cache and sync to backend.
 */
export class SessionStore {
  private backend: SessionStorageBackend;
  private initialized = false;

  // In-memory cache for sync access (mirrors backend)
  private sessions = new Map<string, OAuthSession>();
  private deviceFlows = new Map<string, DeviceFlowState>();
  private authCodeFlows = new Map<string, AuthCodeFlowState>();
  private authCodes = new Map<string, AuthorizationCode>();
  private tokenToSession = new Map<string, string>();
  private refreshTokenToSession = new Map<string, string>();
  private mcpSessionToOAuthSession = new Map<string, string>();

  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(backend?: SessionStorageBackend) {
    this.backend = backend ?? createStorageBackend();
  }

  /**
   * Initialize the session store and backend
   * Must be called before using async operations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.backend.initialize();

    // Load existing sessions into cache if backend supports it
    if (this.backend.type !== "memory") {
      const sessions = await this.backend.getAllSessions();
      for (const session of sessions) {
        this.sessions.set(session.id, session);
        if (session.mcpAccessToken) {
          this.tokenToSession.set(session.mcpAccessToken, session.id);
        }
        if (session.mcpRefreshToken) {
          this.refreshTokenToSession.set(session.mcpRefreshToken, session.id);
        }
      }
      logger.info({ loadedSessions: sessions.length }, "Loaded sessions from storage backend");
    }

    // Start cleanup interval
    this.startCleanupInterval();

    this.initialized = true;
    logger.info({ backendType: this.backend.type }, "Session store initialized");
  }

  /**
   * Get storage backend type
   */
  getBackendType(): string {
    return this.backend.type;
  }

  // ============================================================
  // Session Operations (sync with async backend sync)
  // ============================================================

  /**
   * Create a new session
   */
  createSession(session: OAuthSession): void {
    this.sessions.set(session.id, session);

    if (session.mcpAccessToken) {
      this.tokenToSession.set(session.mcpAccessToken, session.id);
    }
    if (session.mcpRefreshToken) {
      this.refreshTokenToSession.set(session.mcpRefreshToken, session.id);
    }

    // Async sync to backend (fire and forget for sync API)
    this.backend.createSession(session).catch(err => {
      logger.error({ err, sessionId: session.id }, "Failed to persist session to backend");
    });

    logger.debug({ sessionId: session.id, userId: session.gitlabUserId }, "Session created");
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): OAuthSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get session by MCP access token
   */
  getSessionByToken(token: string): OAuthSession | undefined {
    const sessionId = this.tokenToSession.get(token);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  /**
   * Get session by MCP refresh token
   */
  getSessionByRefreshToken(refreshToken: string): OAuthSession | undefined {
    const sessionId = this.refreshTokenToSession.get(refreshToken);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  /**
   * Update an existing session
   */
  updateSession(sessionId: string, updates: Partial<OAuthSession>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn({ sessionId }, "Attempted to update non-existent session");
      return false;
    }

    // Update token indexes if tokens changed
    if (updates.mcpAccessToken && updates.mcpAccessToken !== session.mcpAccessToken) {
      this.tokenToSession.delete(session.mcpAccessToken);
      this.tokenToSession.set(updates.mcpAccessToken, sessionId);
    }
    if (updates.mcpRefreshToken && updates.mcpRefreshToken !== session.mcpRefreshToken) {
      this.refreshTokenToSession.delete(session.mcpRefreshToken);
      this.refreshTokenToSession.set(updates.mcpRefreshToken, sessionId);
    }

    // Apply updates
    Object.assign(session, updates, { updatedAt: Date.now() });

    // Async sync to backend
    this.backend.updateSession(sessionId, updates).catch(err => {
      logger.error({ err, sessionId }, "Failed to update session in backend");
    });

    logger.debug({ sessionId }, "Session updated");
    return true;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.mcpAccessToken) {
      this.tokenToSession.delete(session.mcpAccessToken);
    }
    if (session.mcpRefreshToken) {
      this.refreshTokenToSession.delete(session.mcpRefreshToken);
    }

    this.sessions.delete(sessionId);

    // Async sync to backend
    this.backend.deleteSession(sessionId).catch(err => {
      logger.error({ err, sessionId }, "Failed to delete session from backend");
    });

    logger.debug({ sessionId }, "Session deleted");
    return true;
  }

  /**
   * Get all sessions (for iteration)
   */
  getAllSessions(): IterableIterator<OAuthSession> {
    return this.sessions.values();
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  // ============================================================
  // Device Flow Operations
  // ============================================================

  /**
   * Store a device flow state
   */
  storeDeviceFlow(state: string, flow: DeviceFlowState): void {
    this.deviceFlows.set(state, flow);

    this.backend.storeDeviceFlow(state, flow).catch(err => {
      logger.error({ err, state }, "Failed to persist device flow to backend");
    });

    logger.debug({ state, userCode: flow.userCode }, "Device flow stored");
  }

  /**
   * Get device flow by state parameter
   */
  getDeviceFlow(state: string): DeviceFlowState | undefined {
    return this.deviceFlows.get(state);
  }

  /**
   * Get device flow by device code
   */
  getDeviceFlowByDeviceCode(deviceCode: string): DeviceFlowState | undefined {
    for (const flow of this.deviceFlows.values()) {
      if (flow.deviceCode === deviceCode) {
        return flow;
      }
    }
    return undefined;
  }

  /**
   * Delete a device flow
   */
  deleteDeviceFlow(state: string): boolean {
    const deleted = this.deviceFlows.delete(state);

    if (deleted) {
      this.backend.deleteDeviceFlow(state).catch(err => {
        logger.error({ err, state }, "Failed to delete device flow from backend");
      });
      logger.debug({ state }, "Device flow deleted");
    }

    return deleted;
  }

  /**
   * Get device flow count
   */
  getDeviceFlowCount(): number {
    return this.deviceFlows.size;
  }

  // ============================================================
  // Authorization Code Flow Operations
  // ============================================================

  /**
   * Store an authorization code flow state
   */
  storeAuthCodeFlow(internalState: string, flow: AuthCodeFlowState): void {
    this.authCodeFlows.set(internalState, flow);

    this.backend.storeAuthCodeFlow(internalState, flow).catch(err => {
      logger.error(
        { err, internalState: internalState.substring(0, 8) + "..." },
        "Failed to persist auth code flow"
      );
    });

    logger.debug({ internalState: internalState.substring(0, 8) + "..." }, "Auth code flow stored");
  }

  /**
   * Get authorization code flow by internal state
   */
  getAuthCodeFlow(internalState: string): AuthCodeFlowState | undefined {
    return this.authCodeFlows.get(internalState);
  }

  /**
   * Delete an authorization code flow
   */
  deleteAuthCodeFlow(internalState: string): boolean {
    const deleted = this.authCodeFlows.delete(internalState);

    if (deleted) {
      this.backend.deleteAuthCodeFlow(internalState).catch(err => {
        logger.error(
          { err, internalState: internalState.substring(0, 8) + "..." },
          "Failed to delete auth code flow"
        );
      });
      logger.debug(
        { internalState: internalState.substring(0, 8) + "..." },
        "Auth code flow deleted"
      );
    }

    return deleted;
  }

  /**
   * Get auth code flow count
   */
  getAuthCodeFlowCount(): number {
    return this.authCodeFlows.size;
  }

  // ============================================================
  // Authorization Code Operations
  // ============================================================

  /**
   * Store an authorization code
   */
  storeAuthCode(code: AuthorizationCode): void {
    this.authCodes.set(code.code, code);

    this.backend.storeAuthCode(code).catch(err => {
      logger.error({ err, code: code.code.substring(0, 8) + "..." }, "Failed to persist auth code");
    });

    logger.debug({ code: code.code.substring(0, 8) + "..." }, "Auth code stored");
  }

  /**
   * Get authorization code
   */
  getAuthCode(code: string): AuthorizationCode | undefined {
    return this.authCodes.get(code);
  }

  /**
   * Delete authorization code (single-use)
   */
  deleteAuthCode(code: string): boolean {
    const deleted = this.authCodes.delete(code);

    if (deleted) {
      this.backend.deleteAuthCode(code).catch(err => {
        logger.error({ err, code: code.substring(0, 8) + "..." }, "Failed to delete auth code");
      });
      logger.debug({ code: code.substring(0, 8) + "..." }, "Auth code deleted");
    }

    return deleted;
  }

  /**
   * Get auth code count
   */
  getAuthCodeCount(): number {
    return this.authCodes.size;
  }

  // ============================================================
  // MCP Session Mapping Operations
  // ============================================================

  /**
   * Associate an MCP session ID with an OAuth session ID
   */
  associateMcpSession(mcpSessionId: string, oauthSessionId: string): void {
    this.mcpSessionToOAuthSession.set(mcpSessionId, oauthSessionId);

    this.backend.associateMcpSession(mcpSessionId, oauthSessionId).catch(err => {
      logger.error({ err, mcpSessionId }, "Failed to persist MCP session association");
    });

    logger.debug(
      { mcpSessionId, oauthSessionId: oauthSessionId.substring(0, 8) + "..." },
      "MCP session associated with OAuth session"
    );
  }

  /**
   * Get OAuth session by MCP session ID
   */
  getSessionByMcpSessionId(mcpSessionId: string): OAuthSession | undefined {
    const oauthSessionId = this.mcpSessionToOAuthSession.get(mcpSessionId);
    if (!oauthSessionId) {
      return undefined;
    }
    return this.sessions.get(oauthSessionId);
  }

  /**
   * Get GitLab token by MCP session ID
   */
  getGitLabTokenByMcpSessionId(mcpSessionId: string): string | undefined {
    const session = this.getSessionByMcpSessionId(mcpSessionId);
    return session?.gitlabAccessToken;
  }

  /**
   * Remove MCP session association
   */
  removeMcpSessionAssociation(mcpSessionId: string): boolean {
    const deleted = this.mcpSessionToOAuthSession.delete(mcpSessionId);

    if (deleted) {
      this.backend.removeMcpSessionAssociation(mcpSessionId).catch(err => {
        logger.error(
          { err, mcpSessionId },
          "Failed to remove MCP session association from backend"
        );
      });
      logger.debug({ mcpSessionId }, "MCP session association removed");
    }

    return deleted;
  }

  // ============================================================
  // Cleanup Operations
  // ============================================================

  /**
   * Clean up all expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let expiredSessions = 0;
    let expiredDeviceFlows = 0;
    let expiredAuthCodeFlows = 0;
    let expiredAuthCodes = 0;

    // Clean up expired sessions (7 days max age)
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    for (const [id, session] of this.sessions) {
      if (session.createdAt + maxAge < now) {
        this.deleteSession(id);
        expiredSessions++;
      }
    }

    // Clean up expired device flows
    for (const [state, flow] of this.deviceFlows) {
      if (flow.expiresAt < now) {
        this.deleteDeviceFlow(state);
        expiredDeviceFlows++;
      }
    }

    // Clean up expired auth code flows
    for (const [state, flow] of this.authCodeFlows) {
      if (flow.expiresAt < now) {
        this.deleteAuthCodeFlow(state);
        expiredAuthCodeFlows++;
      }
    }

    // Clean up expired auth codes
    for (const [code, auth] of this.authCodes) {
      if (auth.expiresAt < now) {
        this.deleteAuthCode(code);
        expiredAuthCodes++;
      }
    }

    if (
      expiredSessions > 0 ||
      expiredDeviceFlows > 0 ||
      expiredAuthCodeFlows > 0 ||
      expiredAuthCodes > 0
    ) {
      logger.debug(
        {
          expiredSessions,
          expiredDeviceFlows,
          expiredAuthCodeFlows,
          expiredAuthCodes,
          remainingSessions: this.sessions.size,
        },
        "Session store cleanup completed"
      );
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupIntervalId = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );

    if (this.cleanupIntervalId.unref) {
      this.cleanupIntervalId.unref();
    }
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.sessions.clear();
    this.deviceFlows.clear();
    this.authCodeFlows.clear();
    this.authCodes.clear();
    this.tokenToSession.clear();
    this.refreshTokenToSession.clear();
    this.mcpSessionToOAuthSession.clear();
    logger.debug("Session store cleared");
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    this.stopCleanupInterval();
    await this.backend.close();
    logger.info("Session store closed");
  }

  /**
   * Get store statistics
   */
  getStats(): {
    sessions: number;
    deviceFlows: number;
    authCodeFlows: number;
    authCodes: number;
  } {
    return {
      sessions: this.sessions.size,
      deviceFlows: this.deviceFlows.size,
      authCodeFlows: this.authCodeFlows.size,
      authCodes: this.authCodes.size,
    };
  }
}

/**
 * Singleton session store instance
 *
 * Note: Must call sessionStore.initialize() before using async features
 */
export const sessionStore = new SessionStore();
