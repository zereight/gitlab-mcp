/**
 * Session Storage Types
 *
 * Interfaces for pluggable session storage backends.
 * Supports in-memory, file-based, and database storage.
 */

import { OAuthSession, DeviceFlowState, AuthCodeFlowState, AuthorizationCode } from "../types";

/**
 * Session storage backend interface
 *
 * All storage backends must implement this interface for session persistence.
 * Operations are async to support network-based storage (PostgreSQL, Redis).
 */

export interface SessionStorageBackend {
  /** Backend type identifier */
  readonly type: "memory" | "file" | "postgresql" | "redis";

  // Session operations
  createSession(session: OAuthSession): Promise<void>;
  getSession(sessionId: string): Promise<OAuthSession | undefined>;
  getSessionByToken(token: string): Promise<OAuthSession | undefined>;
  getSessionByRefreshToken(refreshToken: string): Promise<OAuthSession | undefined>;
  updateSession(sessionId: string, updates: Partial<OAuthSession>): Promise<boolean>;
  deleteSession(sessionId: string): Promise<boolean>;
  getAllSessions(): Promise<OAuthSession[]>;

  // Device flow operations
  storeDeviceFlow(state: string, flow: DeviceFlowState): Promise<void>;
  getDeviceFlow(state: string): Promise<DeviceFlowState | undefined>;
  getDeviceFlowByDeviceCode(deviceCode: string): Promise<DeviceFlowState | undefined>;
  deleteDeviceFlow(state: string): Promise<boolean>;

  // Auth code flow operations
  storeAuthCodeFlow(internalState: string, flow: AuthCodeFlowState): Promise<void>;
  getAuthCodeFlow(internalState: string): Promise<AuthCodeFlowState | undefined>;
  deleteAuthCodeFlow(internalState: string): Promise<boolean>;

  // Authorization code operations
  storeAuthCode(code: AuthorizationCode): Promise<void>;
  getAuthCode(code: string): Promise<AuthorizationCode | undefined>;
  deleteAuthCode(code: string): Promise<boolean>;

  // MCP session mapping
  associateMcpSession(mcpSessionId: string, oauthSessionId: string): Promise<void>;
  getSessionByMcpSessionId(mcpSessionId: string): Promise<OAuthSession | undefined>;
  removeMcpSessionAssociation(mcpSessionId: string): Promise<boolean>;

  // Lifecycle
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  close(): Promise<void>;

  // Statistics
  getStats(): Promise<SessionStorageStats>;
}

/**
 * Storage statistics
 */
export interface SessionStorageStats {
  sessions: number;
  deviceFlows: number;
  authCodeFlows: number;
  authCodes: number;
  mcpSessionMappings?: number;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Storage type: "memory", "file", "postgresql" */
  type: "memory" | "file" | "postgresql";

  /** File storage options */
  file?: {
    /** Path to storage file */
    path: string;
    /** Auto-save interval in milliseconds (default: 30000) */
    saveInterval?: number;
    /** Pretty print JSON (default: false in production) */
    prettyPrint?: boolean;
  };

  /** PostgreSQL storage options */
  postgresql?: {
    /** Connection string */
    connectionString: string;
    /** Table name prefix (default: "oauth_") */
    tablePrefix?: string;
    /** Enable SSL (default: true for production) */
    ssl?: boolean;
  };
}

/**
 * Data export format for file storage
 */
export interface StorageData {
  version: number;
  exportedAt: number;
  sessions: OAuthSession[];
  deviceFlows: Array<{ state: string; flow: DeviceFlowState }>;
  authCodeFlows: Array<{ internalState: string; flow: AuthCodeFlowState }>;
  authCodes: AuthorizationCode[];
  mcpSessionMappings: Array<{ mcpSessionId: string; oauthSessionId: string }>;
}

/** Current storage data format version */
export const STORAGE_DATA_VERSION = 1;
