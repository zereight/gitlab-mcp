/**
 * File-Based Session Storage Backend
 *
 * Persists sessions to a JSON file for survival across server restarts.
 * Suitable for single-instance deployments without external database.
 *
 * Features:
 * - Automatic save on changes (debounced)
 * - Periodic auto-save interval
 * - Atomic file writes (write to temp, then rename)
 * - Data version migration support
 */

import * as fs from "fs";
import * as path from "path";
import { OAuthSession, DeviceFlowState, AuthCodeFlowState, AuthorizationCode } from "../types";
import {
  SessionStorageBackend,
  SessionStorageStats,
  StorageData,
  STORAGE_DATA_VERSION,
} from "./types";
import { MemoryStorageBackend } from "./memory";
import { logger } from "../../logger";

export interface FileStorageOptions {
  /** Path to the storage file */
  filePath: string;
  /** Auto-save interval in milliseconds (default: 30000 = 30 seconds) */
  saveInterval?: number;
  /** Pretty print JSON for debugging (default: false) */
  prettyPrint?: boolean;
  /** Debounce delay for change-triggered saves (default: 1000ms) */
  saveDebounce?: number;
}

export class FileStorageBackend implements SessionStorageBackend {
  readonly type = "file" as const;

  private memory: MemoryStorageBackend;
  private filePath: string;
  private saveInterval: number;
  private prettyPrint: boolean;
  private saveDebounce: number;
  private saveIntervalId: ReturnType<typeof setInterval> | null = null;
  private saveDebounceId: ReturnType<typeof setTimeout> | null = null;
  private pendingSave = false;
  private initialized = false;

  constructor(options: FileStorageOptions) {
    // Use memory backend internally as cache, but suppress its logging
    this.memory = new MemoryStorageBackend({ silent: true });
    this.filePath = options.filePath;
    this.saveInterval = options.saveInterval ?? 30000;
    this.prettyPrint = options.prettyPrint ?? false;
    this.saveDebounce = options.saveDebounce ?? 1000;
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    let dirCreated = false;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      dirCreated = true;
      logger.info({ dir }, "Created storage directory");
    }

    // Load existing data if file exists
    const fileExists = fs.existsSync(this.filePath);
    if (fileExists) {
      const stats = fs.statSync(this.filePath);
      logger.info(
        { filePath: this.filePath, size: stats.size, mtime: stats.mtime.toISOString() },
        "Found existing session file"
      );
      await this.loadFromFile();
    } else {
      logger.info(
        { filePath: this.filePath },
        "No existing session file, will create on first save"
      );
    }

    // Verify we can write to the file
    try {
      const testPath = `${this.filePath}.test`;
      fs.writeFileSync(testPath, "test", "utf-8");
      fs.unlinkSync(testPath);
      logger.debug({ filePath: this.filePath }, "Write access verified");
    } catch (error) {
      logger.error(
        { err: error as Error, filePath: this.filePath },
        "Cannot write to storage file path - sessions will NOT persist!"
      );
      throw new Error(`File storage path not writable: ${this.filePath}`);
    }

    // Initialize memory backend (starts cleanup interval)
    await this.memory.initialize();

    // Start auto-save interval
    this.startSaveInterval();

    this.initialized = true;
    logger.info(
      { filePath: this.filePath, dirCreated, fileExisted: fileExists },
      "File storage backend initialized"
    );
  }

  private async loadFromFile(): Promise<void> {
    try {
      const content = fs.readFileSync(this.filePath, "utf-8");
      const data = JSON.parse(content) as StorageData;

      // Validate version
      if (data.version !== STORAGE_DATA_VERSION) {
        logger.warn(
          { fileVersion: data.version, currentVersion: STORAGE_DATA_VERSION },
          "Storage file version mismatch, migrating data"
        );
        // Future: add migration logic here
      }

      // Filter expired data before import
      const now = Date.now();
      const validSessions = data.sessions.filter(s => {
        // Sessions are valid for 7 days
        const maxAge = 7 * 24 * 60 * 60 * 1000;
        return s.createdAt + maxAge > now;
      });

      const validDeviceFlows = data.deviceFlows.filter(d => d.flow.expiresAt > now);
      const validAuthCodeFlows = data.authCodeFlows.filter(a => a.flow.expiresAt > now);
      const validAuthCodes = data.authCodes.filter(a => a.expiresAt > now);

      // Import into memory
      this.memory.importData({
        sessions: validSessions,
        deviceFlows: validDeviceFlows,
        authCodeFlows: validAuthCodeFlows,
        authCodes: validAuthCodes,
        mcpSessionMappings: data.mcpSessionMappings,
      });

      const stats = await this.memory.getStats();
      logger.info(
        {
          loadedSessions: stats.sessions,
          expiredSessions: data.sessions.length - validSessions.length,
          loadedDeviceFlows: stats.deviceFlows,
          loadedAuthCodes: stats.authCodes,
        },
        "Loaded sessions from file"
      );
    } catch (error) {
      logger.error(
        { err: error as Error, filePath: this.filePath },
        "Failed to load sessions from file"
      );
      // Start fresh on load error
    }
  }

  private async saveToFile(): Promise<void> {
    if (!this.initialized) return;

    try {
      const exportedData = this.memory.exportData();

      const data: StorageData = {
        version: STORAGE_DATA_VERSION,
        exportedAt: Date.now(),
        sessions: exportedData.sessions,
        deviceFlows: exportedData.deviceFlows,
        authCodeFlows: exportedData.authCodeFlows,
        authCodes: exportedData.authCodes,
        mcpSessionMappings: exportedData.mcpSessionMappings,
      };

      // Atomic write: write to temp file, then rename
      const tempPath = `${this.filePath}.tmp`;
      const content = this.prettyPrint ? JSON.stringify(data, null, 2) : JSON.stringify(data);

      fs.writeFileSync(tempPath, content, "utf-8");
      fs.renameSync(tempPath, this.filePath);

      logger.debug(
        {
          sessions: data.sessions.length,
          deviceFlows: data.deviceFlows.length,
          authCodes: data.authCodes.length,
        },
        "Saved sessions to file"
      );
    } catch (error) {
      logger.error(
        { err: error as Error, filePath: this.filePath },
        "Failed to save sessions to file"
      );
    }
  }

  private scheduleSave(): void {
    // Mark as pending
    this.pendingSave = true;

    // Debounce: cancel previous scheduled save
    if (this.saveDebounceId) {
      clearTimeout(this.saveDebounceId);
    }

    // Schedule save after debounce delay
    this.saveDebounceId = setTimeout(() => {
      if (this.pendingSave) {
        this.pendingSave = false;
        this.saveToFile().catch(err => logger.error({ err }, "Failed to save to file"));
      }
    }, this.saveDebounce);
  }

  private startSaveInterval(): void {
    this.saveIntervalId = setInterval(() => {
      this.saveToFile().catch(err => logger.error({ err }, "Failed to save to file"));
    }, this.saveInterval);

    if (this.saveIntervalId.unref) {
      this.saveIntervalId.unref();
    }
  }

  // Session operations - delegate to memory with save scheduling
  async createSession(session: OAuthSession): Promise<void> {
    await this.memory.createSession(session);
    this.scheduleSave();
  }

  async getSession(sessionId: string): Promise<OAuthSession | undefined> {
    return this.memory.getSession(sessionId);
  }

  async getSessionByToken(token: string): Promise<OAuthSession | undefined> {
    return this.memory.getSessionByToken(token);
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<OAuthSession | undefined> {
    return this.memory.getSessionByRefreshToken(refreshToken);
  }

  async updateSession(sessionId: string, updates: Partial<OAuthSession>): Promise<boolean> {
    const result = await this.memory.updateSession(sessionId, updates);
    if (result) this.scheduleSave();
    return result;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await this.memory.deleteSession(sessionId);
    if (result) this.scheduleSave();
    return result;
  }

  async getAllSessions(): Promise<OAuthSession[]> {
    return this.memory.getAllSessions();
  }

  // Device flow operations
  async storeDeviceFlow(state: string, flow: DeviceFlowState): Promise<void> {
    await this.memory.storeDeviceFlow(state, flow);
    this.scheduleSave();
  }

  async getDeviceFlow(state: string): Promise<DeviceFlowState | undefined> {
    return this.memory.getDeviceFlow(state);
  }

  async getDeviceFlowByDeviceCode(deviceCode: string): Promise<DeviceFlowState | undefined> {
    return this.memory.getDeviceFlowByDeviceCode(deviceCode);
  }

  async deleteDeviceFlow(state: string): Promise<boolean> {
    const result = await this.memory.deleteDeviceFlow(state);
    if (result) this.scheduleSave();
    return result;
  }

  // Auth code flow operations
  async storeAuthCodeFlow(internalState: string, flow: AuthCodeFlowState): Promise<void> {
    await this.memory.storeAuthCodeFlow(internalState, flow);
    this.scheduleSave();
  }

  async getAuthCodeFlow(internalState: string): Promise<AuthCodeFlowState | undefined> {
    return this.memory.getAuthCodeFlow(internalState);
  }

  async deleteAuthCodeFlow(internalState: string): Promise<boolean> {
    const result = await this.memory.deleteAuthCodeFlow(internalState);
    if (result) this.scheduleSave();
    return result;
  }

  // Authorization code operations
  async storeAuthCode(code: AuthorizationCode): Promise<void> {
    await this.memory.storeAuthCode(code);
    this.scheduleSave();
  }

  async getAuthCode(code: string): Promise<AuthorizationCode | undefined> {
    return this.memory.getAuthCode(code);
  }

  async deleteAuthCode(code: string): Promise<boolean> {
    const result = await this.memory.deleteAuthCode(code);
    if (result) this.scheduleSave();
    return result;
  }

  // MCP session mapping
  async associateMcpSession(mcpSessionId: string, oauthSessionId: string): Promise<void> {
    await this.memory.associateMcpSession(mcpSessionId, oauthSessionId);
    this.scheduleSave();
  }

  async getSessionByMcpSessionId(mcpSessionId: string): Promise<OAuthSession | undefined> {
    return this.memory.getSessionByMcpSessionId(mcpSessionId);
  }

  async removeMcpSessionAssociation(mcpSessionId: string): Promise<boolean> {
    const result = await this.memory.removeMcpSessionAssociation(mcpSessionId);
    if (result) this.scheduleSave();
    return result;
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.memory.cleanup();
    await this.saveToFile();
  }

  async close(): Promise<void> {
    // Stop intervals
    if (this.saveIntervalId) {
      clearInterval(this.saveIntervalId);
      this.saveIntervalId = null;
    }
    if (this.saveDebounceId) {
      clearTimeout(this.saveDebounceId);
      this.saveDebounceId = null;
    }

    // Final save
    await this.saveToFile();

    // Close memory backend
    await this.memory.close();

    logger.info("File storage backend closed");
  }

  async getStats(): Promise<SessionStorageStats> {
    return this.memory.getStats();
  }

  /** Force immediate save (for graceful shutdown) */
  async forceSave(): Promise<void> {
    if (this.saveDebounceId) {
      clearTimeout(this.saveDebounceId);
      this.saveDebounceId = null;
    }
    this.pendingSave = false;
    await this.saveToFile();
  }
}
