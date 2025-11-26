/**
 * Session Store for OAuth
 *
 * In-memory storage for OAuth sessions, device flows, and authorization codes.
 * Includes automatic cleanup of expired entries.
 */

import { OAuthSession, DeviceFlowState, AuthorizationCode } from "./types";
import { logger } from "../logger";

/**
 * In-memory session store for OAuth
 *
 * Stores:
 * - Active sessions (authenticated users)
 * - In-progress device flows
 * - Pending authorization codes
 */
export class SessionStore {
  /** Map of session ID to session data */
  private sessions = new Map<string, OAuthSession>();

  /** Map of state parameter to device flow data */
  private deviceFlows = new Map<string, DeviceFlowState>();

  /** Map of authorization code to code data */
  private authCodes = new Map<string, AuthorizationCode>();

  /** Map of MCP access token to session ID for fast lookup */
  private tokenToSession = new Map<string, string>();

  /** Map of MCP refresh token to session ID for fast lookup */
  private refreshTokenToSession = new Map<string, string>();

  /** Cleanup interval ID for clearing expired entries */
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start cleanup interval (every 5 minutes)
    this.startCleanupInterval();
  }

  // ============================================================
  // Session Operations
  // ============================================================

  /**
   * Create a new session
   */
  createSession(session: OAuthSession): void {
    this.sessions.set(session.id, session);

    // Index by tokens for fast lookup
    if (session.mcpAccessToken) {
      this.tokenToSession.set(session.mcpAccessToken, session.id);
    }
    if (session.mcpRefreshToken) {
      this.refreshTokenToSession.set(session.mcpRefreshToken, session.id);
    }

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

    // Remove token indexes
    if (session.mcpAccessToken) {
      this.tokenToSession.delete(session.mcpAccessToken);
    }
    if (session.mcpRefreshToken) {
      this.refreshTokenToSession.delete(session.mcpRefreshToken);
    }

    this.sessions.delete(sessionId);
    logger.debug({ sessionId }, "Session deleted");
    return true;
  }

  /**
   * Get all sessions (for iteration, e.g., finding by refresh token)
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
  // Authorization Code Operations
  // ============================================================

  /**
   * Store an authorization code
   */
  storeAuthCode(code: AuthorizationCode): void {
    this.authCodes.set(code.code, code);
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
  // Cleanup Operations
  // ============================================================

  /**
   * Clean up all expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let expiredSessions = 0;
    let expiredDeviceFlows = 0;
    let expiredAuthCodes = 0;

    // Clean up expired sessions (based on MCP token expiry + grace period)
    // Keep sessions valid for refresh token TTL (7 days by default)
    for (const [id, session] of this.sessions) {
      // Consider session expired if refresh token has expired
      // (We don't have refreshTokenExpiry, so use createdAt + 7 days as estimate)
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
      if (session.createdAt + maxAge < now) {
        this.deleteSession(id);
        expiredSessions++;
      }
    }

    // Clean up expired device flows
    for (const [state, flow] of this.deviceFlows) {
      if (flow.expiresAt < now) {
        this.deviceFlows.delete(state);
        expiredDeviceFlows++;
      }
    }

    // Clean up expired auth codes
    for (const [code, auth] of this.authCodes) {
      if (auth.expiresAt < now) {
        this.authCodes.delete(code);
        expiredAuthCodes++;
      }
    }

    if (expiredSessions > 0 || expiredDeviceFlows > 0 || expiredAuthCodes > 0) {
      logger.debug(
        {
          expiredSessions,
          expiredDeviceFlows,
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
    // Clean up every 5 minutes
    this.cleanupIntervalId = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );

    // Don't prevent process exit
    if (this.cleanupIntervalId.unref) {
      this.cleanupIntervalId.unref();
    }
  }

  /**
   * Stop cleanup interval (for testing)
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
    this.authCodes.clear();
    this.tokenToSession.clear();
    this.refreshTokenToSession.clear();
    logger.debug("Session store cleared");
  }

  /**
   * Get store statistics
   */
  getStats(): {
    sessions: number;
    deviceFlows: number;
    authCodes: number;
  } {
    return {
      sessions: this.sessions.size,
      deviceFlows: this.deviceFlows.size,
      authCodes: this.authCodes.size,
    };
  }
}

/**
 * Singleton session store instance
 */
export const sessionStore = new SessionStore();
