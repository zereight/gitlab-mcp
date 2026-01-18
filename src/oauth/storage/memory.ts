/**
 * In-Memory Session Storage Backend
 *
 * Default storage for development and single-instance deployments.
 * Sessions are lost on server restart.
 */

import { OAuthSession, DeviceFlowState, AuthCodeFlowState, AuthorizationCode } from "../types";
import { SessionStorageBackend, SessionStorageStats } from "./types";
import { logger } from "../../logger";

export interface MemoryStorageOptions {
  /** Suppress initialization logging (used when wrapped by FileStorage) */
  silent?: boolean;
}

export class MemoryStorageBackend implements SessionStorageBackend {
  readonly type = "memory" as const;

  private sessions = new Map<string, OAuthSession>();
  private deviceFlows = new Map<string, DeviceFlowState>();
  private authCodeFlows = new Map<string, AuthCodeFlowState>();
  private authCodes = new Map<string, AuthorizationCode>();
  private tokenToSession = new Map<string, string>();
  private refreshTokenToSession = new Map<string, string>();
  private mcpSessionToOAuthSession = new Map<string, string>();
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;
  private silent: boolean;

  constructor(options?: MemoryStorageOptions) {
    this.silent = options?.silent ?? false;
  }

  async initialize(): Promise<void> {
    this.startCleanupInterval();
    if (!this.silent) {
      logger.info("Memory storage backend initialized");
    }
  }

  // Session operations
  async createSession(session: OAuthSession): Promise<void> {
    this.sessions.set(session.id, session);
    if (session.mcpAccessToken) {
      this.tokenToSession.set(session.mcpAccessToken, session.id);
    }
    if (session.mcpRefreshToken) {
      this.refreshTokenToSession.set(session.mcpRefreshToken, session.id);
    }
    logger.debug({ sessionId: session.id, userId: session.gitlabUserId }, "Session created");
  }

  async getSession(sessionId: string): Promise<OAuthSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async getSessionByToken(token: string): Promise<OAuthSession | undefined> {
    const sessionId = this.tokenToSession.get(token);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<OAuthSession | undefined> {
    const sessionId = this.refreshTokenToSession.get(refreshToken);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  async updateSession(sessionId: string, updates: Partial<OAuthSession>): Promise<boolean> {
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

    Object.assign(session, updates, { updatedAt: Date.now() });
    logger.debug({ sessionId }, "Session updated");
    return true;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

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

  async getAllSessions(): Promise<OAuthSession[]> {
    return Array.from(this.sessions.values());
  }

  // Device flow operations
  async storeDeviceFlow(state: string, flow: DeviceFlowState): Promise<void> {
    this.deviceFlows.set(state, flow);
    logger.debug({ state, userCode: flow.userCode }, "Device flow stored");
  }

  async getDeviceFlow(state: string): Promise<DeviceFlowState | undefined> {
    return this.deviceFlows.get(state);
  }

  async getDeviceFlowByDeviceCode(deviceCode: string): Promise<DeviceFlowState | undefined> {
    for (const flow of this.deviceFlows.values()) {
      if (flow.deviceCode === deviceCode) return flow;
    }
    return undefined;
  }

  async deleteDeviceFlow(state: string): Promise<boolean> {
    const deleted = this.deviceFlows.delete(state);
    if (deleted) logger.debug({ state }, "Device flow deleted");
    return deleted;
  }

  // Auth code flow operations
  async storeAuthCodeFlow(internalState: string, flow: AuthCodeFlowState): Promise<void> {
    this.authCodeFlows.set(internalState, flow);
    logger.debug({ internalState: internalState.substring(0, 8) + "..." }, "Auth code flow stored");
  }

  async getAuthCodeFlow(internalState: string): Promise<AuthCodeFlowState | undefined> {
    return this.authCodeFlows.get(internalState);
  }

  async deleteAuthCodeFlow(internalState: string): Promise<boolean> {
    const deleted = this.authCodeFlows.delete(internalState);
    if (deleted) {
      logger.debug(
        { internalState: internalState.substring(0, 8) + "..." },
        "Auth code flow deleted"
      );
    }
    return deleted;
  }

  // Authorization code operations
  async storeAuthCode(code: AuthorizationCode): Promise<void> {
    this.authCodes.set(code.code, code);
    logger.debug({ code: code.code.substring(0, 8) + "..." }, "Auth code stored");
  }

  async getAuthCode(code: string): Promise<AuthorizationCode | undefined> {
    return this.authCodes.get(code);
  }

  async deleteAuthCode(code: string): Promise<boolean> {
    const deleted = this.authCodes.delete(code);
    if (deleted) logger.debug({ code: code.substring(0, 8) + "..." }, "Auth code deleted");
    return deleted;
  }

  // MCP session mapping
  async associateMcpSession(mcpSessionId: string, oauthSessionId: string): Promise<void> {
    this.mcpSessionToOAuthSession.set(mcpSessionId, oauthSessionId);
    logger.debug(
      { mcpSessionId, oauthSessionId: oauthSessionId.substring(0, 8) + "..." },
      "MCP session associated with OAuth session"
    );
  }

  async getSessionByMcpSessionId(mcpSessionId: string): Promise<OAuthSession | undefined> {
    const oauthSessionId = this.mcpSessionToOAuthSession.get(mcpSessionId);
    if (!oauthSessionId) return undefined;
    return this.sessions.get(oauthSessionId);
  }

  async removeMcpSessionAssociation(mcpSessionId: string): Promise<boolean> {
    const deleted = this.mcpSessionToOAuthSession.delete(mcpSessionId);
    if (deleted) logger.debug({ mcpSessionId }, "MCP session association removed");
    return deleted;
  }

  // Cleanup
  async cleanup(): Promise<void> {
    const now = Date.now();
    let expiredSessions = 0;
    let expiredDeviceFlows = 0;
    let expiredAuthCodeFlows = 0;
    let expiredAuthCodes = 0;

    // Clean up expired sessions (7 days max age)
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    for (const [id, session] of this.sessions) {
      if (session.createdAt + maxAge < now) {
        await this.deleteSession(id);
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

    // Clean up expired auth code flows
    for (const [state, flow] of this.authCodeFlows) {
      if (flow.expiresAt < now) {
        this.authCodeFlows.delete(state);
        expiredAuthCodeFlows++;
      }
    }

    // Clean up expired auth codes
    for (const [code, auth] of this.authCodes) {
      if (auth.expiresAt < now) {
        this.authCodes.delete(code);
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
        "Memory storage cleanup completed"
      );
    }
  }

  async close(): Promise<void> {
    this.stopCleanupInterval();
    if (!this.silent) {
      logger.info("Memory storage backend closed");
    }
  }

  async getStats(): Promise<SessionStorageStats> {
    return {
      sessions: this.sessions.size,
      deviceFlows: this.deviceFlows.size,
      authCodeFlows: this.authCodeFlows.size,
      authCodes: this.authCodes.size,
      mcpSessionMappings: this.mcpSessionToOAuthSession.size,
    };
  }

  private startCleanupInterval(): void {
    this.cleanupIntervalId = setInterval(
      () => {
        this.cleanup().catch(err => logger.error({ err }, "Cleanup error"));
      },
      5 * 60 * 1000
    );

    if (this.cleanupIntervalId.unref) {
      this.cleanupIntervalId.unref();
    }
  }

  private stopCleanupInterval(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /** Export all data for file persistence */
  exportData(): {
    sessions: OAuthSession[];
    deviceFlows: Array<{ state: string; flow: DeviceFlowState }>;
    authCodeFlows: Array<{ internalState: string; flow: AuthCodeFlowState }>;
    authCodes: AuthorizationCode[];
    mcpSessionMappings: Array<{ mcpSessionId: string; oauthSessionId: string }>;
  } {
    return {
      sessions: Array.from(this.sessions.values()),
      deviceFlows: Array.from(this.deviceFlows.entries()).map(([state, flow]) => ({ state, flow })),
      authCodeFlows: Array.from(this.authCodeFlows.entries()).map(([internalState, flow]) => ({
        internalState,
        flow,
      })),
      authCodes: Array.from(this.authCodes.values()),
      mcpSessionMappings: Array.from(this.mcpSessionToOAuthSession.entries()).map(
        ([mcpSessionId, oauthSessionId]) => ({ mcpSessionId, oauthSessionId })
      ),
    };
  }

  /** Import data from file persistence */
  importData(data: {
    sessions?: OAuthSession[];
    deviceFlows?: Array<{ state: string; flow: DeviceFlowState }>;
    authCodeFlows?: Array<{ internalState: string; flow: AuthCodeFlowState }>;
    authCodes?: AuthorizationCode[];
    mcpSessionMappings?: Array<{ mcpSessionId: string; oauthSessionId: string }>;
  }): void {
    // Clear existing data
    this.sessions.clear();
    this.deviceFlows.clear();
    this.authCodeFlows.clear();
    this.authCodes.clear();
    this.tokenToSession.clear();
    this.refreshTokenToSession.clear();
    this.mcpSessionToOAuthSession.clear();

    // Import sessions
    if (data.sessions) {
      for (const session of data.sessions) {
        this.sessions.set(session.id, session);
        if (session.mcpAccessToken) {
          this.tokenToSession.set(session.mcpAccessToken, session.id);
        }
        if (session.mcpRefreshToken) {
          this.refreshTokenToSession.set(session.mcpRefreshToken, session.id);
        }
      }
    }

    // Import device flows
    if (data.deviceFlows) {
      for (const { state, flow } of data.deviceFlows) {
        this.deviceFlows.set(state, flow);
      }
    }

    // Import auth code flows
    if (data.authCodeFlows) {
      for (const { internalState, flow } of data.authCodeFlows) {
        this.authCodeFlows.set(internalState, flow);
      }
    }

    // Import auth codes
    if (data.authCodes) {
      for (const code of data.authCodes) {
        this.authCodes.set(code.code, code);
      }
    }

    // Import MCP session mappings
    if (data.mcpSessionMappings) {
      for (const { mcpSessionId, oauthSessionId } of data.mcpSessionMappings) {
        this.mcpSessionToOAuthSession.set(mcpSessionId, oauthSessionId);
      }
    }

    logger.info(
      {
        sessions: this.sessions.size,
        deviceFlows: this.deviceFlows.size,
        authCodeFlows: this.authCodeFlows.size,
        authCodes: this.authCodes.size,
      },
      "Data imported into memory storage"
    );
  }
}
