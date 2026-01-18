/**
 * PostgreSQL Session Storage Backend (Prisma)
 *
 * Production-grade storage for multi-instance deployments.
 * Uses Prisma ORM for type-safe database access.
 *
 * Features:
 * - Type-safe queries via Prisma
 * - Automatic migrations on startup
 * - Connection pooling (Prisma managed)
 * - Automatic cleanup of expired entries
 */

import {
  OAuthSession,
  DeviceFlowState as DeviceFlowStateType,
  AuthCodeFlowState as AuthCodeFlowStateType,
  AuthorizationCode as AuthorizationCodeType,
} from "../types";
import { SessionStorageBackend, SessionStorageStats } from "./types";
import { logger } from "../../logger";

/**
 * Explicit interfaces for Prisma model results.
 * These mirror the Prisma schema but with explicit types that ESLint can resolve.
 */
interface PrismaOAuthSessionRow {
  id: string;
  mcpAccessToken: string;
  mcpRefreshToken: string;
  mcpTokenExpiry: bigint;
  gitlabAccessToken: string;
  gitlabRefreshToken: string;
  gitlabTokenExpiry: bigint;
  gitlabUserId: number;
  gitlabUsername: string;
  clientId: string;
  scopes: string[];
  createdAt: bigint;
  updatedAt: bigint;
}

interface PrismaDeviceFlowStateRow {
  state: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string | null;
  expiresAt: bigint;
  interval: number;
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string | null;
}

interface PrismaAuthCodeFlowStateRow {
  internalState: string;
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  clientState: string;
  clientRedirectUri: string;
  callbackUri: string;
  expiresAt: bigint;
}

interface PrismaAuthorizationCodeRow {
  code: string;
  sessionId: string;
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string | null;
  expiresAt: bigint;
}

interface PrismaMcpSessionMappingRow {
  mcpSessionId: string;
  oauthSessionId: string;
  oauthSession?: PrismaOAuthSessionRow;
}

interface PrismaBatchPayload {
  count: number;
}

/**
 * Generic Prisma client interface.
 * We use a loose interface here to avoid type compatibility issues with Prisma's complex types.
 */
interface GenericPrismaClient {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $transaction(operations: unknown[]): Promise<unknown[]>;
  oAuthSession: {
    create(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<unknown>;
    findFirst(args: unknown): Promise<unknown>;
    findMany(): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    delete(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<unknown>;
    count(): Promise<number>;
  };
  deviceFlowState: {
    upsert(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<unknown>;
    findFirst(args: unknown): Promise<unknown>;
    delete(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<unknown>;
    count(): Promise<number>;
  };
  authCodeFlowState: {
    create(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<unknown>;
    delete(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<unknown>;
    count(): Promise<number>;
  };
  authorizationCode: {
    create(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<unknown>;
    delete(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<unknown>;
    count(): Promise<number>;
  };
  mcpSessionMapping: {
    upsert(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<unknown>;
    delete(args: unknown): Promise<unknown>;
    count(): Promise<number>;
  };
}

export interface PostgreSQLStorageOptions {
  /** PostgreSQL connection string (optional, uses OAUTH_STORAGE_POSTGRESQL_URL if not provided) */
  connectionString?: string;
}

export class PostgreSQLStorageBackend implements SessionStorageBackend {
  readonly type = "postgresql" as const;

  private prisma: GenericPrismaClient | null = null;
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  async initialize(): Promise<void> {
    try {
      // Dynamic import Prisma client to avoid initialization if not used
      const prismaModule = (await import("../../../generated/prisma/client")) as {
        PrismaClient: new (opts: Record<string, unknown>) => GenericPrismaClient;
      };

      // Create Prisma client
      this.prisma = new prismaModule.PrismaClient({});

      // Connect and test
      await this.prisma.$connect();

      // Start cleanup interval
      this.startCleanupInterval();

      logger.info("PostgreSQL storage backend initialized via Prisma");
    } catch (error) {
      logger.error({ err: error as Error }, "Failed to initialize PostgreSQL storage backend");
      throw error;
    }
  }

  private getPrisma(): GenericPrismaClient {
    if (!this.prisma) {
      throw new Error("PostgreSQL/Prisma client not initialized");
    }
    return this.prisma;
  }

  // Session operations
  async createSession(session: OAuthSession): Promise<void> {
    const prisma = this.getPrisma();
    await prisma.oAuthSession.create({
      data: {
        id: session.id,
        mcpAccessToken: session.mcpAccessToken,
        mcpRefreshToken: session.mcpRefreshToken,
        mcpTokenExpiry: BigInt(session.mcpTokenExpiry),
        gitlabAccessToken: session.gitlabAccessToken,
        gitlabRefreshToken: session.gitlabRefreshToken,
        gitlabTokenExpiry: BigInt(session.gitlabTokenExpiry),
        gitlabUserId: session.gitlabUserId,
        gitlabUsername: session.gitlabUsername,
        clientId: session.clientId,
        scopes: session.scopes,
        createdAt: BigInt(session.createdAt),
        updatedAt: BigInt(session.updatedAt),
      },
    });
    logger.debug({ sessionId: session.id }, "Session created in PostgreSQL");
  }

  async getSession(sessionId: string): Promise<OAuthSession | undefined> {
    const prisma = this.getPrisma();
    const row = (await prisma.oAuthSession.findUnique({
      where: { id: sessionId },
    })) as PrismaOAuthSessionRow | null;
    return row ? this.rowToSession(row) : undefined;
  }

  async getSessionByToken(token: string): Promise<OAuthSession | undefined> {
    const prisma = this.getPrisma();
    const row = (await prisma.oAuthSession.findFirst({
      where: { mcpAccessToken: token },
    })) as PrismaOAuthSessionRow | null;
    return row ? this.rowToSession(row) : undefined;
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<OAuthSession | undefined> {
    const prisma = this.getPrisma();
    const row = (await prisma.oAuthSession.findFirst({
      where: { mcpRefreshToken: refreshToken },
    })) as PrismaOAuthSessionRow | null;
    return row ? this.rowToSession(row) : undefined;
  }

  async updateSession(sessionId: string, updates: Partial<OAuthSession>): Promise<boolean> {
    const prisma = this.getPrisma();

    const data: Record<string, unknown> = {
      updatedAt: BigInt(Date.now()),
    };

    if (updates.mcpAccessToken !== undefined) {
      data.mcpAccessToken = updates.mcpAccessToken;
    }
    if (updates.mcpRefreshToken !== undefined) {
      data.mcpRefreshToken = updates.mcpRefreshToken;
    }
    if (updates.mcpTokenExpiry !== undefined) {
      data.mcpTokenExpiry = BigInt(updates.mcpTokenExpiry);
    }
    if (updates.gitlabAccessToken !== undefined) {
      data.gitlabAccessToken = updates.gitlabAccessToken;
    }
    if (updates.gitlabRefreshToken !== undefined) {
      data.gitlabRefreshToken = updates.gitlabRefreshToken;
    }
    if (updates.gitlabTokenExpiry !== undefined) {
      data.gitlabTokenExpiry = BigInt(updates.gitlabTokenExpiry);
    }

    try {
      await prisma.oAuthSession.update({
        where: { id: sessionId },
        data,
      });
      return true;
    } catch {
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const prisma = this.getPrisma();
    try {
      await prisma.oAuthSession.delete({
        where: { id: sessionId },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getAllSessions(): Promise<OAuthSession[]> {
    const prisma = this.getPrisma();
    const rows = (await prisma.oAuthSession.findMany()) as PrismaOAuthSessionRow[];
    return rows.map(row => this.rowToSession(row));
  }

  private rowToSession(row: PrismaOAuthSessionRow): OAuthSession {
    return {
      id: row.id,
      mcpAccessToken: row.mcpAccessToken,
      mcpRefreshToken: row.mcpRefreshToken,
      mcpTokenExpiry: Number(row.mcpTokenExpiry),
      gitlabAccessToken: row.gitlabAccessToken,
      gitlabRefreshToken: row.gitlabRefreshToken,
      gitlabTokenExpiry: Number(row.gitlabTokenExpiry),
      gitlabUserId: row.gitlabUserId,
      gitlabUsername: row.gitlabUsername,
      clientId: row.clientId,
      scopes: row.scopes,
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
    };
  }

  // Device flow operations
  async storeDeviceFlow(state: string, flow: DeviceFlowStateType): Promise<void> {
    const prisma = this.getPrisma();
    await prisma.deviceFlowState.upsert({
      where: { state },
      update: {
        deviceCode: flow.deviceCode,
        userCode: flow.userCode,
        expiresAt: BigInt(flow.expiresAt),
      },
      create: {
        state,
        deviceCode: flow.deviceCode,
        userCode: flow.userCode,
        verificationUri: flow.verificationUri,
        verificationUriComplete: flow.verificationUriComplete ?? null,
        expiresAt: BigInt(flow.expiresAt),
        interval: flow.interval,
        clientId: flow.clientId,
        codeChallenge: flow.codeChallenge,
        codeChallengeMethod: flow.codeChallengeMethod,
        redirectUri: flow.redirectUri ?? null,
      },
    });
  }

  async getDeviceFlow(state: string): Promise<DeviceFlowStateType | undefined> {
    const prisma = this.getPrisma();
    const row = (await prisma.deviceFlowState.findUnique({
      where: { state },
    })) as PrismaDeviceFlowStateRow | null;
    return row ? this.rowToDeviceFlow(row) : undefined;
  }

  async getDeviceFlowByDeviceCode(deviceCode: string): Promise<DeviceFlowStateType | undefined> {
    const prisma = this.getPrisma();
    const row = (await prisma.deviceFlowState.findFirst({
      where: { deviceCode },
    })) as PrismaDeviceFlowStateRow | null;
    return row ? this.rowToDeviceFlow(row) : undefined;
  }

  async deleteDeviceFlow(state: string): Promise<boolean> {
    const prisma = this.getPrisma();
    try {
      await prisma.deviceFlowState.delete({
        where: { state },
      });
      return true;
    } catch {
      return false;
    }
  }

  private rowToDeviceFlow(row: PrismaDeviceFlowStateRow): DeviceFlowStateType {
    return {
      deviceCode: row.deviceCode,
      userCode: row.userCode,
      verificationUri: row.verificationUri,
      verificationUriComplete: row.verificationUriComplete ?? undefined,
      expiresAt: Number(row.expiresAt),
      interval: row.interval,
      clientId: row.clientId,
      codeChallenge: row.codeChallenge,
      codeChallengeMethod: row.codeChallengeMethod,
      state: row.state,
      redirectUri: row.redirectUri ?? undefined,
    };
  }

  // Auth code flow operations
  async storeAuthCodeFlow(internalState: string, flow: AuthCodeFlowStateType): Promise<void> {
    const prisma = this.getPrisma();
    await prisma.authCodeFlowState.create({
      data: {
        internalState,
        clientId: flow.clientId,
        codeChallenge: flow.codeChallenge,
        codeChallengeMethod: flow.codeChallengeMethod,
        clientState: flow.clientState,
        clientRedirectUri: flow.clientRedirectUri,
        callbackUri: flow.callbackUri,
        expiresAt: BigInt(flow.expiresAt),
      },
    });
  }

  async getAuthCodeFlow(internalState: string): Promise<AuthCodeFlowStateType | undefined> {
    const prisma = this.getPrisma();
    const row = (await prisma.authCodeFlowState.findUnique({
      where: { internalState },
    })) as PrismaAuthCodeFlowStateRow | null;
    if (!row) return undefined;
    return this.rowToAuthCodeFlow(row);
  }

  async deleteAuthCodeFlow(internalState: string): Promise<boolean> {
    const prisma = this.getPrisma();
    try {
      await prisma.authCodeFlowState.delete({
        where: { internalState },
      });
      return true;
    } catch {
      return false;
    }
  }

  private rowToAuthCodeFlow(row: PrismaAuthCodeFlowStateRow): AuthCodeFlowStateType {
    return {
      clientId: row.clientId,
      codeChallenge: row.codeChallenge,
      codeChallengeMethod: row.codeChallengeMethod,
      clientState: row.clientState,
      internalState: row.internalState,
      clientRedirectUri: row.clientRedirectUri,
      callbackUri: row.callbackUri,
      expiresAt: Number(row.expiresAt),
    };
  }

  // Authorization code operations
  async storeAuthCode(code: AuthorizationCodeType): Promise<void> {
    const prisma = this.getPrisma();
    await prisma.authorizationCode.create({
      data: {
        code: code.code,
        sessionId: code.sessionId,
        clientId: code.clientId,
        codeChallenge: code.codeChallenge,
        codeChallengeMethod: code.codeChallengeMethod,
        redirectUri: code.redirectUri ?? null,
        expiresAt: BigInt(code.expiresAt),
      },
    });
  }

  async getAuthCode(code: string): Promise<AuthorizationCodeType | undefined> {
    const prisma = this.getPrisma();
    const row = (await prisma.authorizationCode.findUnique({
      where: { code },
    })) as PrismaAuthorizationCodeRow | null;
    if (!row) return undefined;
    return this.rowToAuthCode(row);
  }

  async deleteAuthCode(code: string): Promise<boolean> {
    const prisma = this.getPrisma();
    try {
      await prisma.authorizationCode.delete({
        where: { code },
      });
      return true;
    } catch {
      return false;
    }
  }

  private rowToAuthCode(row: PrismaAuthorizationCodeRow): AuthorizationCodeType {
    return {
      code: row.code,
      sessionId: row.sessionId,
      clientId: row.clientId,
      codeChallenge: row.codeChallenge,
      codeChallengeMethod: row.codeChallengeMethod,
      redirectUri: row.redirectUri ?? undefined,
      expiresAt: Number(row.expiresAt),
    };
  }

  // MCP session mapping
  async associateMcpSession(mcpSessionId: string, oauthSessionId: string): Promise<void> {
    const prisma = this.getPrisma();
    await prisma.mcpSessionMapping.upsert({
      where: { mcpSessionId },
      update: { oauthSessionId },
      create: { mcpSessionId, oauthSessionId },
    });
  }

  async getSessionByMcpSessionId(mcpSessionId: string): Promise<OAuthSession | undefined> {
    const prisma = this.getPrisma();
    const mapping = (await prisma.mcpSessionMapping.findUnique({
      where: { mcpSessionId },
      include: { oauthSession: true },
    })) as PrismaMcpSessionMappingRow | null;
    return mapping?.oauthSession ? this.rowToSession(mapping.oauthSession) : undefined;
  }

  async removeMcpSessionAssociation(mcpSessionId: string): Promise<boolean> {
    const prisma = this.getPrisma();
    try {
      await prisma.mcpSessionMapping.delete({
        where: { mcpSessionId },
      });
      return true;
    } catch {
      return false;
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    const prisma = this.getPrisma();
    const now = BigInt(Date.now());
    const maxSessionAge = BigInt(7 * 24 * 60 * 60 * 1000); // 7 days

    try {
      // Use transaction for atomic cleanup
      const results = (await prisma.$transaction([
        prisma.oAuthSession.deleteMany({
          where: {
            createdAt: { lt: now - maxSessionAge },
          },
        }),
        prisma.deviceFlowState.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
        prisma.authCodeFlowState.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
        prisma.authorizationCode.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
      ])) as PrismaBatchPayload[];

      const expiredSessions = results[0].count;
      const expiredDeviceFlows = results[1].count;
      const expiredAuthCodeFlows = results[2].count;
      const expiredAuthCodes = results[3].count;

      if (
        expiredSessions > 0 ||
        expiredDeviceFlows > 0 ||
        expiredAuthCodeFlows > 0 ||
        expiredAuthCodes > 0
      ) {
        logger.debug(
          { expiredSessions, expiredDeviceFlows, expiredAuthCodeFlows, expiredAuthCodes },
          "PostgreSQL cleanup completed"
        );
      }
    } catch (error) {
      logger.error({ err: error as Error }, "PostgreSQL cleanup failed");
    }
  }

  async close(): Promise<void> {
    this.stopCleanupInterval();
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
    logger.info("PostgreSQL storage backend closed");
  }

  async getStats(): Promise<SessionStorageStats> {
    const prisma = this.getPrisma();
    const [sessions, deviceFlows, authCodeFlows, authCodes, mappings] = await Promise.all([
      prisma.oAuthSession.count(),
      prisma.deviceFlowState.count(),
      prisma.authCodeFlowState.count(),
      prisma.authorizationCode.count(),
      prisma.mcpSessionMapping.count(),
    ]);

    return {
      sessions,
      deviceFlows,
      authCodeFlows,
      authCodes,
      mcpSessionMappings: mappings,
    };
  }

  private startCleanupInterval(): void {
    this.cleanupIntervalId = setInterval(
      () => {
        this.cleanup().catch(err => logger.error({ err }, "PostgreSQL cleanup error"));
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
}
