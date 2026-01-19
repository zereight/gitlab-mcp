/**
 * Unit tests for File Storage Backend
 * Tests file persistence, atomic writes, and recovery scenarios
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileStorageBackend } from "../../../../src/oauth/storage/file";
import { STORAGE_DATA_VERSION, StorageData } from "../../../../src/oauth/storage/types";
import {
  OAuthSession,
  DeviceFlowState,
  AuthCodeFlowState,
  AuthorizationCode,
} from "../../../../src/oauth/types";

describe("FileStorageBackend", () => {
  let storage: FileStorageBackend;
  let tempDir: string;
  let filePath: string;

  // Helper function to create a test session
  const createTestSession = (overrides: Partial<OAuthSession> = {}): OAuthSession => ({
    id: `session-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    mcpAccessToken: `mcp-token-${Math.random().toString(36).substring(7)}`,
    mcpRefreshToken: `mcp-refresh-${Math.random().toString(36).substring(7)}`,
    mcpTokenExpiry: Date.now() + 3600000,
    gitlabAccessToken: "gitlab-token-123",
    gitlabRefreshToken: "gitlab-refresh-123",
    gitlabTokenExpiry: Date.now() + 7200000,
    gitlabUserId: 12345,
    gitlabUsername: "testuser",
    clientId: "test-client",
    scopes: ["mcp:tools", "mcp:resources"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  // Helper function to create a test device flow
  const createTestDeviceFlow = (overrides: Partial<DeviceFlowState> = {}): DeviceFlowState => ({
    deviceCode: `device-code-${Math.random().toString(36).substring(7)}`,
    userCode: "ABCD-1234",
    verificationUri: "https://gitlab.example.com/oauth/authorize",
    verificationUriComplete: "https://gitlab.example.com/oauth/authorize?user_code=ABCD-1234",
    expiresAt: Date.now() + 600000,
    interval: 5,
    clientId: "test-client",
    codeChallenge: "challenge-123",
    codeChallengeMethod: "S256",
    state: `state-${Math.random().toString(36).substring(7)}`,
    redirectUri: "https://callback.example.com",
    ...overrides,
  });

  // Helper function to create a test auth code flow
  const createTestAuthCodeFlow = (
    overrides: Partial<AuthCodeFlowState> = {}
  ): AuthCodeFlowState => ({
    clientId: "test-client",
    codeChallenge: "challenge-123",
    codeChallengeMethod: "S256",
    clientState: "client-state-123",
    internalState: `internal-${Math.random().toString(36).substring(7)}`,
    clientRedirectUri: "https://client.example.com/callback",
    callbackUri: "https://server.example.com/callback",
    expiresAt: Date.now() + 600000,
    ...overrides,
  });

  // Helper function to create a test auth code
  const createTestAuthCode = (overrides: Partial<AuthorizationCode> = {}): AuthorizationCode => ({
    code: `auth-code-${Math.random().toString(36).substring(7)}`,
    sessionId: "session-456",
    clientId: "test-client",
    codeChallenge: "challenge-123",
    codeChallengeMethod: "S256",
    redirectUri: "https://callback.example.com",
    expiresAt: Date.now() + 600000,
    ...overrides,
  });

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-storage-test-"));
    filePath = path.join(tempDir, "sessions.json");
  });

  afterEach(async () => {
    // Close storage if initialized
    if (storage) {
      await storage.close();
    }

    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Initialization and Lifecycle", () => {
    it("should initialize with empty file", async () => {
      storage = new FileStorageBackend({ filePath });
      await storage.initialize();

      expect(storage.type).toBe("file");
      const stats = await storage.getStats();
      expect(stats.sessions).toBe(0);
    });

    it("should create directory if it does not exist", async () => {
      const nestedPath = path.join(tempDir, "nested", "dir", "sessions.json");
      storage = new FileStorageBackend({ filePath: nestedPath });
      await storage.initialize();

      expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);
    });

    it("should load existing data from file", async () => {
      // Create a storage file with existing data
      const existingData: StorageData = {
        version: STORAGE_DATA_VERSION,
        exportedAt: Date.now(),
        sessions: [createTestSession({ id: "existing-session" })],
        deviceFlows: [],
        authCodeFlows: [],
        authCodes: [],
        mcpSessionMappings: [],
      };
      fs.writeFileSync(filePath, JSON.stringify(existingData), "utf-8");

      storage = new FileStorageBackend({ filePath });
      await storage.initialize();

      const session = await storage.getSession("existing-session");
      expect(session).toBeDefined();
      expect(session?.id).toBe("existing-session");
    });

    it("should filter expired sessions on load", async () => {
      // Create a storage file with expired and valid sessions
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      const existingData: StorageData = {
        version: STORAGE_DATA_VERSION,
        exportedAt: Date.now(),
        sessions: [
          createTestSession({ id: "expired-session", createdAt: eightDaysAgo }),
          createTestSession({ id: "valid-session", createdAt: Date.now() }),
        ],
        deviceFlows: [],
        authCodeFlows: [],
        authCodes: [],
        mcpSessionMappings: [],
      };
      fs.writeFileSync(filePath, JSON.stringify(existingData), "utf-8");

      storage = new FileStorageBackend({ filePath });
      await storage.initialize();

      expect(await storage.getSession("expired-session")).toBeUndefined();
      expect(await storage.getSession("valid-session")).toBeDefined();
    });

    it("should filter expired device flows on load", async () => {
      const existingData: StorageData = {
        version: STORAGE_DATA_VERSION,
        exportedAt: Date.now(),
        sessions: [],
        deviceFlows: [
          { state: "expired-flow", flow: createTestDeviceFlow({ expiresAt: Date.now() - 1000 }) },
          { state: "valid-flow", flow: createTestDeviceFlow({ expiresAt: Date.now() + 600000 }) },
        ],
        authCodeFlows: [],
        authCodes: [],
        mcpSessionMappings: [],
      };
      fs.writeFileSync(filePath, JSON.stringify(existingData), "utf-8");

      storage = new FileStorageBackend({ filePath });
      await storage.initialize();

      expect(await storage.getDeviceFlow("expired-flow")).toBeUndefined();
      expect(await storage.getDeviceFlow("valid-flow")).toBeDefined();
    });

    it("should filter expired auth code flows on load", async () => {
      const existingData: StorageData = {
        version: STORAGE_DATA_VERSION,
        exportedAt: Date.now(),
        sessions: [],
        deviceFlows: [],
        authCodeFlows: [
          {
            internalState: "expired-flow",
            flow: createTestAuthCodeFlow({ expiresAt: Date.now() - 1000 }),
          },
          {
            internalState: "valid-flow",
            flow: createTestAuthCodeFlow({ expiresAt: Date.now() + 600000 }),
          },
        ],
        authCodes: [],
        mcpSessionMappings: [],
      };
      fs.writeFileSync(filePath, JSON.stringify(existingData), "utf-8");

      storage = new FileStorageBackend({ filePath });
      await storage.initialize();

      expect(await storage.getAuthCodeFlow("expired-flow")).toBeUndefined();
      expect(await storage.getAuthCodeFlow("valid-flow")).toBeDefined();
    });

    it("should filter expired auth codes on load", async () => {
      const existingData: StorageData = {
        version: STORAGE_DATA_VERSION,
        exportedAt: Date.now(),
        sessions: [],
        deviceFlows: [],
        authCodeFlows: [],
        authCodes: [
          createTestAuthCode({ code: "expired-code", expiresAt: Date.now() - 1000 }),
          createTestAuthCode({ code: "valid-code", expiresAt: Date.now() + 600000 }),
        ],
        mcpSessionMappings: [],
      };
      fs.writeFileSync(filePath, JSON.stringify(existingData), "utf-8");

      storage = new FileStorageBackend({ filePath });
      await storage.initialize();

      expect(await storage.getAuthCode("expired-code")).toBeUndefined();
      expect(await storage.getAuthCode("valid-code")).toBeDefined();
    });

    it("should handle corrupted file gracefully", async () => {
      // Write invalid JSON
      fs.writeFileSync(filePath, "not valid json", "utf-8");

      storage = new FileStorageBackend({ filePath });
      // Should not throw - starts fresh
      await storage.initialize();

      const stats = await storage.getStats();
      expect(stats.sessions).toBe(0);
    });

    it("should throw if directory is not writable", async () => {
      // Skip this test on Windows as permission handling differs
      if (process.platform === "win32") {
        return;
      }

      const readOnlyDir = path.join(tempDir, "readonly");
      fs.mkdirSync(readOnlyDir);
      fs.chmodSync(readOnlyDir, 0o444);

      const readOnlyPath = path.join(readOnlyDir, "sessions.json");
      storage = new FileStorageBackend({ filePath: readOnlyPath });

      await expect(storage.initialize()).rejects.toThrow("not writable");

      // Cleanup: make writable again before rmSync
      fs.chmodSync(readOnlyDir, 0o755);
    });

    it("should handle version mismatch on load", async () => {
      const oldVersionData = {
        version: 0, // Old version
        exportedAt: Date.now(),
        sessions: [createTestSession({ id: "migrated-session" })],
        deviceFlows: [],
        authCodeFlows: [],
        authCodes: [],
        mcpSessionMappings: [],
      };
      fs.writeFileSync(filePath, JSON.stringify(oldVersionData), "utf-8");

      storage = new FileStorageBackend({ filePath });
      await storage.initialize();

      // Data should still be loaded (migration happens in place)
      const session = await storage.getSession("migrated-session");
      expect(session).toBeDefined();
    });
  });

  describe("Session Operations with Persistence", () => {
    beforeEach(async () => {
      storage = new FileStorageBackend({
        filePath,
        saveDebounce: 10, // Fast debounce for tests
        saveInterval: 60000, // Long interval to avoid auto-saves
      });
      await storage.initialize();
    });

    it("should persist session creation", async () => {
      const session = createTestSession({ id: "persist-test" });
      await storage.createSession(session);

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify file was written
      expect(fs.existsSync(filePath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].id).toBe("persist-test");
    });

    it("should persist session updates", async () => {
      const session = createTestSession({ id: "update-test" });
      await storage.createSession(session);
      await storage.updateSession("update-test", { gitlabAccessToken: "new-token" });

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 50));

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.sessions[0].gitlabAccessToken).toBe("new-token");
    });

    it("should persist session deletion", async () => {
      const session = createTestSession({ id: "delete-test" });
      await storage.createSession(session);

      // Wait for first save
      await new Promise(resolve => setTimeout(resolve, 50));

      await storage.deleteSession("delete-test");

      // Wait for second save
      await new Promise(resolve => setTimeout(resolve, 50));

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.sessions).toHaveLength(0);
    });
  });

  describe("Device Flow Operations with Persistence", () => {
    beforeEach(async () => {
      storage = new FileStorageBackend({
        filePath,
        saveDebounce: 10,
        saveInterval: 60000,
      });
      await storage.initialize();
    });

    it("should persist device flow", async () => {
      const flow = createTestDeviceFlow({ deviceCode: "persist-device" });
      await storage.storeDeviceFlow("flow-state", flow);

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 50));

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.deviceFlows).toHaveLength(1);
      expect(data.deviceFlows[0].state).toBe("flow-state");
    });

    it("should persist device flow deletion", async () => {
      const flow = createTestDeviceFlow();
      await storage.storeDeviceFlow("delete-flow-state", flow);

      // Wait for first save
      await new Promise(resolve => setTimeout(resolve, 50));

      await storage.deleteDeviceFlow("delete-flow-state");

      // Wait for second save
      await new Promise(resolve => setTimeout(resolve, 50));

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.deviceFlows).toHaveLength(0);
    });
  });

  describe("Auth Code Flow Operations with Persistence", () => {
    beforeEach(async () => {
      storage = new FileStorageBackend({
        filePath,
        saveDebounce: 10,
        saveInterval: 60000,
      });
      await storage.initialize();
    });

    it("should persist auth code flow", async () => {
      const flow = createTestAuthCodeFlow({ internalState: "persist-auth-flow" });
      await storage.storeAuthCodeFlow("persist-auth-flow", flow);

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 50));

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.authCodeFlows).toHaveLength(1);
      expect(data.authCodeFlows[0].internalState).toBe("persist-auth-flow");
    });

    it("should persist auth code flow deletion", async () => {
      const flow = createTestAuthCodeFlow({ internalState: "delete-auth-flow" });
      await storage.storeAuthCodeFlow("delete-auth-flow", flow);

      await new Promise(resolve => setTimeout(resolve, 50));

      await storage.deleteAuthCodeFlow("delete-auth-flow");

      await new Promise(resolve => setTimeout(resolve, 50));

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.authCodeFlows).toHaveLength(0);
    });
  });

  describe("Authorization Code Operations with Persistence", () => {
    beforeEach(async () => {
      storage = new FileStorageBackend({
        filePath,
        saveDebounce: 10,
        saveInterval: 60000,
      });
      await storage.initialize();
    });

    it("should persist auth code", async () => {
      const authCode = createTestAuthCode({ code: "persist-code" });
      await storage.storeAuthCode(authCode);

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 50));

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.authCodes).toHaveLength(1);
      expect(data.authCodes[0].code).toBe("persist-code");
    });

    it("should persist auth code deletion", async () => {
      const authCode = createTestAuthCode({ code: "delete-code" });
      await storage.storeAuthCode(authCode);

      await new Promise(resolve => setTimeout(resolve, 50));

      await storage.deleteAuthCode("delete-code");

      await new Promise(resolve => setTimeout(resolve, 50));

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.authCodes).toHaveLength(0);
    });
  });

  describe("MCP Session Mapping Operations with Persistence", () => {
    beforeEach(async () => {
      storage = new FileStorageBackend({
        filePath,
        saveDebounce: 10,
        saveInterval: 60000,
      });
      await storage.initialize();
    });

    it("should persist MCP session association", async () => {
      const session = createTestSession({ id: "mapped-session" });
      await storage.createSession(session);
      await storage.associateMcpSession("mcp-123", "mapped-session");

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 50));

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.mcpSessionMappings).toHaveLength(1);
      expect(data.mcpSessionMappings[0].mcpSessionId).toBe("mcp-123");
    });

    it("should persist MCP session association removal", async () => {
      const session = createTestSession({ id: "mapped-session-2" });
      await storage.createSession(session);
      await storage.associateMcpSession("mcp-456", "mapped-session-2");

      await new Promise(resolve => setTimeout(resolve, 50));

      await storage.removeMcpSessionAssociation("mcp-456");

      await new Promise(resolve => setTimeout(resolve, 50));

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.mcpSessionMappings).toHaveLength(0);
    });
  });

  describe("Read Operations (No Persistence Needed)", () => {
    beforeEach(async () => {
      storage = new FileStorageBackend({ filePath, saveDebounce: 10, saveInterval: 60000 });
      await storage.initialize();
    });

    it("should get session by ID", async () => {
      const session = createTestSession({ id: "get-test" });
      await storage.createSession(session);

      const retrieved = await storage.getSession("get-test");
      expect(retrieved?.id).toBe("get-test");
    });

    it("should get session by token", async () => {
      const session = createTestSession({ mcpAccessToken: "get-token-test" });
      await storage.createSession(session);

      const retrieved = await storage.getSessionByToken("get-token-test");
      expect(retrieved?.mcpAccessToken).toBe("get-token-test");
    });

    it("should get session by refresh token", async () => {
      const session = createTestSession({ mcpRefreshToken: "get-refresh-test" });
      await storage.createSession(session);

      const retrieved = await storage.getSessionByRefreshToken("get-refresh-test");
      expect(retrieved?.mcpRefreshToken).toBe("get-refresh-test");
    });

    it("should get all sessions", async () => {
      await storage.createSession(createTestSession({ id: "all-1" }));
      await storage.createSession(createTestSession({ id: "all-2" }));

      const sessions = await storage.getAllSessions();
      expect(sessions).toHaveLength(2);
    });

    it("should get device flow", async () => {
      const flow = createTestDeviceFlow();
      await storage.storeDeviceFlow("get-flow", flow);

      const retrieved = await storage.getDeviceFlow("get-flow");
      expect(retrieved?.deviceCode).toBe(flow.deviceCode);
    });

    it("should get device flow by device code", async () => {
      const flow = createTestDeviceFlow({ deviceCode: "search-device" });
      await storage.storeDeviceFlow("search-state", flow);

      const retrieved = await storage.getDeviceFlowByDeviceCode("search-device");
      expect(retrieved?.deviceCode).toBe("search-device");
    });

    it("should get auth code flow", async () => {
      const flow = createTestAuthCodeFlow({ internalState: "get-auth-flow" });
      await storage.storeAuthCodeFlow("get-auth-flow", flow);

      const retrieved = await storage.getAuthCodeFlow("get-auth-flow");
      expect(retrieved?.clientId).toBe(flow.clientId);
    });

    it("should get auth code", async () => {
      const authCode = createTestAuthCode({ code: "get-code" });
      await storage.storeAuthCode(authCode);

      const retrieved = await storage.getAuthCode("get-code");
      expect(retrieved?.code).toBe("get-code");
    });

    it("should get session by MCP session ID", async () => {
      const session = createTestSession({ id: "get-mcp-mapped" });
      await storage.createSession(session);
      await storage.associateMcpSession("get-mcp-id", "get-mcp-mapped");

      const retrieved = await storage.getSessionByMcpSessionId("get-mcp-id");
      expect(retrieved?.id).toBe("get-mcp-mapped");
    });
  });

  describe("Cleanup and Persistence", () => {
    beforeEach(async () => {
      storage = new FileStorageBackend({ filePath, saveDebounce: 10, saveInterval: 60000 });
      await storage.initialize();
    });

    it("should save after cleanup", async () => {
      const expiredSession = createTestSession({
        id: "cleanup-expired",
        createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      });
      const validSession = createTestSession({ id: "cleanup-valid" });

      await storage.createSession(expiredSession);
      await storage.createSession(validSession);

      // Wait for initial save
      await new Promise(resolve => setTimeout(resolve, 50));

      await storage.cleanup();

      // Cleanup triggers immediate save, no need to wait for debounce
      await new Promise(resolve => setTimeout(resolve, 10));

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].id).toBe("cleanup-valid");
    });
  });

  describe("Force Save", () => {
    it("should save immediately on forceSave", async () => {
      storage = new FileStorageBackend({
        filePath,
        saveDebounce: 5000, // Long debounce
        saveInterval: 60000,
      });
      await storage.initialize();

      const session = createTestSession({ id: "force-save-test" });
      await storage.createSession(session);

      // Force save immediately (don't wait for debounce)
      await storage.forceSave();

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].id).toBe("force-save-test");
    });
  });

  describe("Statistics", () => {
    beforeEach(async () => {
      storage = new FileStorageBackend({ filePath, saveDebounce: 10, saveInterval: 60000 });
      await storage.initialize();
    });

    it("should return correct stats", async () => {
      await storage.createSession(createTestSession({ id: "stats-1" }));
      await storage.createSession(createTestSession({ id: "stats-2" }));
      await storage.storeDeviceFlow("stats-flow", createTestDeviceFlow());
      await storage.storeAuthCodeFlow("stats-auth-flow", createTestAuthCodeFlow());
      await storage.storeAuthCode(createTestAuthCode());
      await storage.associateMcpSession("stats-mcp", "stats-1");

      const stats = await storage.getStats();
      expect(stats.sessions).toBe(2);
      expect(stats.deviceFlows).toBe(1);
      expect(stats.authCodeFlows).toBe(1);
      expect(stats.authCodes).toBe(1);
      expect(stats.mcpSessionMappings).toBe(1);
    });
  });

  describe("Pretty Print Option", () => {
    it("should pretty print when enabled", async () => {
      storage = new FileStorageBackend({
        filePath,
        prettyPrint: true,
        saveDebounce: 10,
        saveInterval: 60000,
      });
      await storage.initialize();

      await storage.createSession(createTestSession({ id: "pretty-test" }));
      await storage.forceSave();

      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("\n"); // Pretty printed has newlines
      expect(content).toContain("  "); // Pretty printed has indentation
    });

    it("should not pretty print when disabled", async () => {
      storage = new FileStorageBackend({
        filePath,
        prettyPrint: false,
        saveDebounce: 10,
        saveInterval: 60000,
      });
      await storage.initialize();

      await storage.createSession(createTestSession({ id: "compact-test" }));
      await storage.forceSave();

      const content = fs.readFileSync(filePath, "utf-8");
      // Compact JSON is all on one line
      expect(content.split("\n").length).toBe(1);
    });
  });

  describe("Atomic Writes", () => {
    it("should not leave temp files after successful write", async () => {
      storage = new FileStorageBackend({ filePath, saveDebounce: 10, saveInterval: 60000 });
      await storage.initialize();

      await storage.createSession(createTestSession({ id: "atomic-test" }));
      await storage.forceSave();

      const tempFile = `${filePath}.tmp`;
      expect(fs.existsSync(tempFile)).toBe(false);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe("Close Behavior", () => {
    it("should save on close", async () => {
      storage = new FileStorageBackend({
        filePath,
        saveDebounce: 5000, // Long debounce
        saveInterval: 60000,
      });
      await storage.initialize();

      await storage.createSession(createTestSession({ id: "close-test" }));

      // Close should trigger final save
      await storage.close();

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StorageData;
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].id).toBe("close-test");
    });
  });

  describe("Edge Cases", () => {
    it("should handle update returning false gracefully", async () => {
      storage = new FileStorageBackend({ filePath, saveDebounce: 10, saveInterval: 60000 });
      await storage.initialize();

      // Update non-existent session
      const result = await storage.updateSession("non-existent", { gitlabAccessToken: "new" });
      expect(result).toBe(false);
    });

    it("should handle delete returning false gracefully", async () => {
      storage = new FileStorageBackend({ filePath, saveDebounce: 10, saveInterval: 60000 });
      await storage.initialize();

      // Delete non-existent session
      const result = await storage.deleteSession("non-existent");
      expect(result).toBe(false);
    });

    it("should handle delete device flow returning false gracefully", async () => {
      storage = new FileStorageBackend({ filePath, saveDebounce: 10, saveInterval: 60000 });
      await storage.initialize();

      const result = await storage.deleteDeviceFlow("non-existent");
      expect(result).toBe(false);
    });

    it("should handle delete auth code flow returning false gracefully", async () => {
      storage = new FileStorageBackend({ filePath, saveDebounce: 10, saveInterval: 60000 });
      await storage.initialize();

      const result = await storage.deleteAuthCodeFlow("non-existent");
      expect(result).toBe(false);
    });

    it("should handle delete auth code returning false gracefully", async () => {
      storage = new FileStorageBackend({ filePath, saveDebounce: 10, saveInterval: 60000 });
      await storage.initialize();

      const result = await storage.deleteAuthCode("non-existent");
      expect(result).toBe(false);
    });

    it("should handle remove MCP session returning false gracefully", async () => {
      storage = new FileStorageBackend({ filePath, saveDebounce: 10, saveInterval: 60000 });
      await storage.initialize();

      const result = await storage.removeMcpSessionAssociation("non-existent");
      expect(result).toBe(false);
    });
  });
});
