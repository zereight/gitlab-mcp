/**
 * Unit tests for Memory Storage Backend
 * Tests all session storage operations, cleanup, export/import functionality
 */

import { MemoryStorageBackend } from "../../../../src/oauth/storage/memory";
import {
  OAuthSession,
  DeviceFlowState,
  AuthCodeFlowState,
  AuthorizationCode,
} from "../../../../src/oauth/types";

describe("MemoryStorageBackend", () => {
  let storage: MemoryStorageBackend;

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

  beforeEach(async () => {
    storage = new MemoryStorageBackend({ silent: true });
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe("Initialization and Lifecycle", () => {
    it("should initialize successfully", async () => {
      const newStorage = new MemoryStorageBackend({ silent: true });
      await expect(newStorage.initialize()).resolves.not.toThrow();
      await newStorage.close();
    });

    it("should have correct type identifier", () => {
      expect(storage.type).toBe("memory");
    });

    it("should close without errors", async () => {
      await expect(storage.close()).resolves.not.toThrow();
    });

    it("should initialize with default options", async () => {
      // Test with no options (not silent)
      const defaultStorage = new MemoryStorageBackend();
      await defaultStorage.initialize();
      expect(defaultStorage.type).toBe("memory");
      await defaultStorage.close();
    });
  });

  describe("Session Operations", () => {
    describe("createSession", () => {
      it("should create a new session", async () => {
        const session = createTestSession();
        await storage.createSession(session);

        const retrieved = await storage.getSession(session.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(session.id);
      });

      it("should index session by access token", async () => {
        const session = createTestSession();
        await storage.createSession(session);

        const retrieved = await storage.getSessionByToken(session.mcpAccessToken);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(session.id);
      });

      it("should index session by refresh token", async () => {
        const session = createTestSession();
        await storage.createSession(session);

        const retrieved = await storage.getSessionByRefreshToken(session.mcpRefreshToken);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(session.id);
      });

      it("should handle session without refresh token", async () => {
        const session = createTestSession();
        // Explicitly set undefined
        (session as any).mcpRefreshToken = undefined;
        await storage.createSession(session);

        const retrieved = await storage.getSession(session.id);
        expect(retrieved).toBeDefined();
      });
    });

    describe("getSession", () => {
      it("should return undefined for non-existent session", async () => {
        const session = await storage.getSession("non-existent-id");
        expect(session).toBeUndefined();
      });

      it("should return existing session", async () => {
        const session = createTestSession();
        await storage.createSession(session);

        const retrieved = await storage.getSession(session.id);
        expect(retrieved).toEqual(session);
      });
    });

    describe("getSessionByToken", () => {
      it("should return undefined for non-existent token", async () => {
        const session = await storage.getSessionByToken("non-existent-token");
        expect(session).toBeUndefined();
      });

      it("should return session by access token", async () => {
        const session = createTestSession({ mcpAccessToken: "unique-token-123" });
        await storage.createSession(session);

        const retrieved = await storage.getSessionByToken("unique-token-123");
        expect(retrieved?.id).toBe(session.id);
      });
    });

    describe("getSessionByRefreshToken", () => {
      it("should return undefined for non-existent refresh token", async () => {
        const session = await storage.getSessionByRefreshToken("non-existent");
        expect(session).toBeUndefined();
      });

      it("should return session by refresh token", async () => {
        const session = createTestSession({ mcpRefreshToken: "unique-refresh-token" });
        await storage.createSession(session);

        const retrieved = await storage.getSessionByRefreshToken("unique-refresh-token");
        expect(retrieved?.id).toBe(session.id);
      });
    });

    describe("updateSession", () => {
      it("should update session fields", async () => {
        const session = createTestSession();
        await storage.createSession(session);

        const result = await storage.updateSession(session.id, {
          gitlabAccessToken: "new-gitlab-token",
          gitlabRefreshToken: "new-gitlab-refresh",
        });

        expect(result).toBe(true);
        const updated = await storage.getSession(session.id);
        expect(updated?.gitlabAccessToken).toBe("new-gitlab-token");
        expect(updated?.gitlabRefreshToken).toBe("new-gitlab-refresh");
      });

      it("should update updatedAt timestamp", async () => {
        const session = createTestSession({ updatedAt: 1000 });
        await storage.createSession(session);

        const beforeUpdate = Date.now();
        await storage.updateSession(session.id, { gitlabAccessToken: "new-token" });

        const updated = await storage.getSession(session.id);
        expect(updated?.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
      });

      it("should update token index when access token changes", async () => {
        const session = createTestSession({ mcpAccessToken: "old-token" });
        await storage.createSession(session);

        await storage.updateSession(session.id, { mcpAccessToken: "new-token" });

        // Old token should not find session
        expect(await storage.getSessionByToken("old-token")).toBeUndefined();
        // New token should find session
        const retrieved = await storage.getSessionByToken("new-token");
        expect(retrieved?.id).toBe(session.id);
      });

      it("should update refresh token index when refresh token changes", async () => {
        const session = createTestSession({ mcpRefreshToken: "old-refresh" });
        await storage.createSession(session);

        await storage.updateSession(session.id, { mcpRefreshToken: "new-refresh" });

        // Old refresh token should not find session
        expect(await storage.getSessionByRefreshToken("old-refresh")).toBeUndefined();
        // New refresh token should find session
        const retrieved = await storage.getSessionByRefreshToken("new-refresh");
        expect(retrieved?.id).toBe(session.id);
      });

      it("should return false for non-existent session", async () => {
        const result = await storage.updateSession("non-existent", {
          gitlabAccessToken: "new",
        });
        expect(result).toBe(false);
      });
    });

    describe("deleteSession", () => {
      it("should delete existing session", async () => {
        const session = createTestSession();
        await storage.createSession(session);

        const result = await storage.deleteSession(session.id);

        expect(result).toBe(true);
        expect(await storage.getSession(session.id)).toBeUndefined();
      });

      it("should remove token index", async () => {
        const session = createTestSession();
        await storage.createSession(session);

        await storage.deleteSession(session.id);

        expect(await storage.getSessionByToken(session.mcpAccessToken)).toBeUndefined();
      });

      it("should remove refresh token index", async () => {
        const session = createTestSession();
        await storage.createSession(session);

        await storage.deleteSession(session.id);

        expect(await storage.getSessionByRefreshToken(session.mcpRefreshToken)).toBeUndefined();
      });

      it("should return false for non-existent session", async () => {
        const result = await storage.deleteSession("non-existent");
        expect(result).toBe(false);
      });
    });

    describe("getAllSessions", () => {
      it("should return empty array when no sessions", async () => {
        const sessions = await storage.getAllSessions();
        expect(sessions).toEqual([]);
      });

      it("should return all sessions", async () => {
        const session1 = createTestSession({ id: "session-1" });
        const session2 = createTestSession({ id: "session-2" });

        await storage.createSession(session1);
        await storage.createSession(session2);

        const sessions = await storage.getAllSessions();
        expect(sessions).toHaveLength(2);
        expect(sessions.map(s => s.id)).toContain("session-1");
        expect(sessions.map(s => s.id)).toContain("session-2");
      });
    });
  });

  describe("Device Flow Operations", () => {
    describe("storeDeviceFlow", () => {
      it("should store device flow by state", async () => {
        const flow = createTestDeviceFlow();
        await storage.storeDeviceFlow("flow-state-123", flow);

        const retrieved = await storage.getDeviceFlow("flow-state-123");
        expect(retrieved).toBeDefined();
        expect(retrieved?.deviceCode).toBe(flow.deviceCode);
      });
    });

    describe("getDeviceFlow", () => {
      it("should return undefined for non-existent flow", async () => {
        const flow = await storage.getDeviceFlow("non-existent");
        expect(flow).toBeUndefined();
      });

      it("should return existing flow", async () => {
        const flow = createTestDeviceFlow();
        await storage.storeDeviceFlow("test-state", flow);

        const retrieved = await storage.getDeviceFlow("test-state");
        expect(retrieved).toEqual(flow);
      });
    });

    describe("getDeviceFlowByDeviceCode", () => {
      it("should return undefined for non-existent device code", async () => {
        const flow = await storage.getDeviceFlowByDeviceCode("non-existent");
        expect(flow).toBeUndefined();
      });

      it("should return flow by device code", async () => {
        const flow = createTestDeviceFlow({ deviceCode: "unique-device-code" });
        await storage.storeDeviceFlow("test-state", flow);

        const retrieved = await storage.getDeviceFlowByDeviceCode("unique-device-code");
        expect(retrieved?.userCode).toBe(flow.userCode);
      });

      it("should search through multiple flows", async () => {
        const flow1 = createTestDeviceFlow({ deviceCode: "device-1" });
        const flow2 = createTestDeviceFlow({ deviceCode: "device-2" });
        const flow3 = createTestDeviceFlow({ deviceCode: "target-device" });

        await storage.storeDeviceFlow("state-1", flow1);
        await storage.storeDeviceFlow("state-2", flow2);
        await storage.storeDeviceFlow("state-3", flow3);

        const retrieved = await storage.getDeviceFlowByDeviceCode("target-device");
        expect(retrieved?.deviceCode).toBe("target-device");
      });
    });

    describe("deleteDeviceFlow", () => {
      it("should delete existing flow", async () => {
        const flow = createTestDeviceFlow();
        await storage.storeDeviceFlow("test-state", flow);

        const result = await storage.deleteDeviceFlow("test-state");

        expect(result).toBe(true);
        expect(await storage.getDeviceFlow("test-state")).toBeUndefined();
      });

      it("should return false for non-existent flow", async () => {
        const result = await storage.deleteDeviceFlow("non-existent");
        expect(result).toBe(false);
      });
    });
  });

  describe("Auth Code Flow Operations", () => {
    describe("storeAuthCodeFlow", () => {
      it("should store auth code flow", async () => {
        const flow = createTestAuthCodeFlow();
        await storage.storeAuthCodeFlow(flow.internalState, flow);

        const retrieved = await storage.getAuthCodeFlow(flow.internalState);
        expect(retrieved).toBeDefined();
        expect(retrieved?.clientId).toBe(flow.clientId);
      });
    });

    describe("getAuthCodeFlow", () => {
      it("should return undefined for non-existent flow", async () => {
        const flow = await storage.getAuthCodeFlow("non-existent");
        expect(flow).toBeUndefined();
      });

      it("should return existing flow", async () => {
        const flow = createTestAuthCodeFlow();
        await storage.storeAuthCodeFlow(flow.internalState, flow);

        const retrieved = await storage.getAuthCodeFlow(flow.internalState);
        expect(retrieved).toEqual(flow);
      });
    });

    describe("deleteAuthCodeFlow", () => {
      it("should delete existing flow", async () => {
        const flow = createTestAuthCodeFlow();
        await storage.storeAuthCodeFlow(flow.internalState, flow);

        const result = await storage.deleteAuthCodeFlow(flow.internalState);

        expect(result).toBe(true);
        expect(await storage.getAuthCodeFlow(flow.internalState)).toBeUndefined();
      });

      it("should return false for non-existent flow", async () => {
        const result = await storage.deleteAuthCodeFlow("non-existent");
        expect(result).toBe(false);
      });
    });
  });

  describe("Authorization Code Operations", () => {
    describe("storeAuthCode", () => {
      it("should store authorization code", async () => {
        const authCode = createTestAuthCode();
        await storage.storeAuthCode(authCode);

        const retrieved = await storage.getAuthCode(authCode.code);
        expect(retrieved).toBeDefined();
        expect(retrieved?.sessionId).toBe(authCode.sessionId);
      });
    });

    describe("getAuthCode", () => {
      it("should return undefined for non-existent code", async () => {
        const code = await storage.getAuthCode("non-existent");
        expect(code).toBeUndefined();
      });

      it("should return existing code", async () => {
        const authCode = createTestAuthCode({ code: "unique-code-123" });
        await storage.storeAuthCode(authCode);

        const retrieved = await storage.getAuthCode("unique-code-123");
        expect(retrieved).toEqual(authCode);
      });
    });

    describe("deleteAuthCode", () => {
      it("should delete existing code", async () => {
        const authCode = createTestAuthCode();
        await storage.storeAuthCode(authCode);

        const result = await storage.deleteAuthCode(authCode.code);

        expect(result).toBe(true);
        expect(await storage.getAuthCode(authCode.code)).toBeUndefined();
      });

      it("should return false for non-existent code", async () => {
        const result = await storage.deleteAuthCode("non-existent");
        expect(result).toBe(false);
      });
    });
  });

  describe("MCP Session Mapping Operations", () => {
    describe("associateMcpSession", () => {
      it("should associate MCP session with OAuth session", async () => {
        const session = createTestSession();
        await storage.createSession(session);

        await storage.associateMcpSession("mcp-session-123", session.id);

        const retrieved = await storage.getSessionByMcpSessionId("mcp-session-123");
        expect(retrieved?.id).toBe(session.id);
      });
    });

    describe("getSessionByMcpSessionId", () => {
      it("should return undefined for non-existent MCP session", async () => {
        const session = await storage.getSessionByMcpSessionId("non-existent");
        expect(session).toBeUndefined();
      });

      it("should return undefined if OAuth session does not exist", async () => {
        await storage.associateMcpSession("mcp-session-123", "non-existent-oauth");

        const session = await storage.getSessionByMcpSessionId("mcp-session-123");
        expect(session).toBeUndefined();
      });

      it("should return associated OAuth session", async () => {
        const session = createTestSession();
        await storage.createSession(session);
        await storage.associateMcpSession("mcp-session-123", session.id);

        const retrieved = await storage.getSessionByMcpSessionId("mcp-session-123");
        expect(retrieved?.id).toBe(session.id);
      });
    });

    describe("removeMcpSessionAssociation", () => {
      it("should remove association", async () => {
        const session = createTestSession();
        await storage.createSession(session);
        await storage.associateMcpSession("mcp-session-123", session.id);

        const result = await storage.removeMcpSessionAssociation("mcp-session-123");

        expect(result).toBe(true);
        expect(await storage.getSessionByMcpSessionId("mcp-session-123")).toBeUndefined();
      });

      it("should return false for non-existent association", async () => {
        const result = await storage.removeMcpSessionAssociation("non-existent");
        expect(result).toBe(false);
      });
    });
  });

  describe("Cleanup Operations", () => {
    describe("cleanup", () => {
      it("should remove expired sessions (older than 7 days)", async () => {
        const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
        const expiredSession = createTestSession({
          id: "expired-session",
          createdAt: eightDaysAgo,
        });
        const validSession = createTestSession({
          id: "valid-session",
          createdAt: Date.now(),
        });

        await storage.createSession(expiredSession);
        await storage.createSession(validSession);

        await storage.cleanup();

        expect(await storage.getSession("expired-session")).toBeUndefined();
        expect(await storage.getSession("valid-session")).toBeDefined();
      });

      it("should remove expired device flows", async () => {
        const expiredFlow = createTestDeviceFlow({
          expiresAt: Date.now() - 1000,
        });
        const validFlow = createTestDeviceFlow({
          expiresAt: Date.now() + 600000,
        });

        await storage.storeDeviceFlow("expired-flow", expiredFlow);
        await storage.storeDeviceFlow("valid-flow", validFlow);

        await storage.cleanup();

        expect(await storage.getDeviceFlow("expired-flow")).toBeUndefined();
        expect(await storage.getDeviceFlow("valid-flow")).toBeDefined();
      });

      it("should remove expired auth code flows", async () => {
        const expiredFlow = createTestAuthCodeFlow({
          internalState: "expired-auth-flow",
          expiresAt: Date.now() - 1000,
        });
        const validFlow = createTestAuthCodeFlow({
          internalState: "valid-auth-flow",
          expiresAt: Date.now() + 600000,
        });

        await storage.storeAuthCodeFlow("expired-auth-flow", expiredFlow);
        await storage.storeAuthCodeFlow("valid-auth-flow", validFlow);

        await storage.cleanup();

        expect(await storage.getAuthCodeFlow("expired-auth-flow")).toBeUndefined();
        expect(await storage.getAuthCodeFlow("valid-auth-flow")).toBeDefined();
      });

      it("should remove expired auth codes", async () => {
        const expiredCode = createTestAuthCode({
          code: "expired-code",
          expiresAt: Date.now() - 1000,
        });
        const validCode = createTestAuthCode({
          code: "valid-code",
          expiresAt: Date.now() + 600000,
        });

        await storage.storeAuthCode(expiredCode);
        await storage.storeAuthCode(validCode);

        await storage.cleanup();

        expect(await storage.getAuthCode("expired-code")).toBeUndefined();
        expect(await storage.getAuthCode("valid-code")).toBeDefined();
      });

      it("should handle cleanup with no expired items", async () => {
        const validSession = createTestSession({ createdAt: Date.now() });
        await storage.createSession(validSession);

        await expect(storage.cleanup()).resolves.not.toThrow();
        expect(await storage.getSession(validSession.id)).toBeDefined();
      });
    });
  });

  describe("Statistics", () => {
    describe("getStats", () => {
      it("should return zero counts for empty storage", async () => {
        const stats = await storage.getStats();
        expect(stats.sessions).toBe(0);
        expect(stats.deviceFlows).toBe(0);
        expect(stats.authCodeFlows).toBe(0);
        expect(stats.authCodes).toBe(0);
        expect(stats.mcpSessionMappings).toBe(0);
      });

      it("should return correct counts", async () => {
        // Add sessions
        await storage.createSession(createTestSession({ id: "session-1" }));
        await storage.createSession(createTestSession({ id: "session-2" }));

        // Add device flows
        await storage.storeDeviceFlow("device-1", createTestDeviceFlow());

        // Add auth code flows
        await storage.storeAuthCodeFlow("auth-flow-1", createTestAuthCodeFlow());
        await storage.storeAuthCodeFlow("auth-flow-2", createTestAuthCodeFlow());
        await storage.storeAuthCodeFlow("auth-flow-3", createTestAuthCodeFlow());

        // Add auth codes
        await storage.storeAuthCode(createTestAuthCode({ code: "code-1" }));

        // Add MCP session mappings
        await storage.associateMcpSession("mcp-1", "session-1");
        await storage.associateMcpSession("mcp-2", "session-2");

        const stats = await storage.getStats();
        expect(stats.sessions).toBe(2);
        expect(stats.deviceFlows).toBe(1);
        expect(stats.authCodeFlows).toBe(3);
        expect(stats.authCodes).toBe(1);
        expect(stats.mcpSessionMappings).toBe(2);
      });
    });
  });

  describe("Export and Import Data", () => {
    describe("exportData", () => {
      it("should export empty data", () => {
        const data = storage.exportData();
        expect(data.sessions).toEqual([]);
        expect(data.deviceFlows).toEqual([]);
        expect(data.authCodeFlows).toEqual([]);
        expect(data.authCodes).toEqual([]);
        expect(data.mcpSessionMappings).toEqual([]);
      });

      it("should export all data", async () => {
        const session = createTestSession({ id: "test-session" });
        await storage.createSession(session);

        const deviceFlow = createTestDeviceFlow();
        await storage.storeDeviceFlow("device-state", deviceFlow);

        const authCodeFlow = createTestAuthCodeFlow();
        await storage.storeAuthCodeFlow(authCodeFlow.internalState, authCodeFlow);

        const authCode = createTestAuthCode({ code: "test-auth-code" });
        await storage.storeAuthCode(authCode);

        await storage.associateMcpSession("mcp-123", "test-session");

        const data = storage.exportData();

        expect(data.sessions).toHaveLength(1);
        expect(data.sessions[0].id).toBe("test-session");

        expect(data.deviceFlows).toHaveLength(1);
        expect(data.deviceFlows[0].state).toBe("device-state");
        expect(data.deviceFlows[0].flow.deviceCode).toBe(deviceFlow.deviceCode);

        expect(data.authCodeFlows).toHaveLength(1);
        expect(data.authCodeFlows[0].internalState).toBe(authCodeFlow.internalState);

        expect(data.authCodes).toHaveLength(1);
        expect(data.authCodes[0].code).toBe("test-auth-code");

        expect(data.mcpSessionMappings).toHaveLength(1);
        expect(data.mcpSessionMappings[0].mcpSessionId).toBe("mcp-123");
        expect(data.mcpSessionMappings[0].oauthSessionId).toBe("test-session");
      });
    });

    describe("importData", () => {
      it("should import empty data", () => {
        storage.importData({});

        expect(storage.exportData().sessions).toEqual([]);
      });

      it("should clear existing data on import", async () => {
        // Add some existing data
        await storage.createSession(createTestSession({ id: "existing" }));

        // Import new data (should clear existing)
        storage.importData({
          sessions: [createTestSession({ id: "imported" })],
        });

        const sessions = await storage.getAllSessions();
        expect(sessions).toHaveLength(1);
        expect(sessions[0].id).toBe("imported");
      });

      it("should import sessions with token indexes", async () => {
        const session = createTestSession({
          id: "imported-session",
          mcpAccessToken: "imported-access-token",
          mcpRefreshToken: "imported-refresh-token",
        });

        storage.importData({ sessions: [session] });

        // Verify session is accessible by all indexes
        expect(await storage.getSession("imported-session")).toBeDefined();
        expect(await storage.getSessionByToken("imported-access-token")).toBeDefined();
        expect(await storage.getSessionByRefreshToken("imported-refresh-token")).toBeDefined();
      });

      it("should import device flows", async () => {
        const deviceFlow = createTestDeviceFlow({ deviceCode: "imported-device" });

        storage.importData({
          deviceFlows: [{ state: "imported-state", flow: deviceFlow }],
        });

        const retrieved = await storage.getDeviceFlow("imported-state");
        expect(retrieved?.deviceCode).toBe("imported-device");
      });

      it("should import auth code flows", async () => {
        const authCodeFlow = createTestAuthCodeFlow({ internalState: "imported-internal" });

        storage.importData({
          authCodeFlows: [{ internalState: "imported-internal", flow: authCodeFlow }],
        });

        const retrieved = await storage.getAuthCodeFlow("imported-internal");
        expect(retrieved?.clientId).toBe(authCodeFlow.clientId);
      });

      it("should import auth codes", async () => {
        const authCode = createTestAuthCode({ code: "imported-code" });

        storage.importData({ authCodes: [authCode] });

        const retrieved = await storage.getAuthCode("imported-code");
        expect(retrieved?.sessionId).toBe(authCode.sessionId);
      });

      it("should import MCP session mappings", async () => {
        const session = createTestSession({ id: "mapped-session" });

        storage.importData({
          sessions: [session],
          mcpSessionMappings: [{ mcpSessionId: "imported-mcp", oauthSessionId: "mapped-session" }],
        });

        const retrieved = await storage.getSessionByMcpSessionId("imported-mcp");
        expect(retrieved?.id).toBe("mapped-session");
      });

      it("should handle partial import data", async () => {
        storage.importData({
          sessions: [createTestSession({ id: "only-session" })],
          // No other fields provided
        });

        const sessions = await storage.getAllSessions();
        expect(sessions).toHaveLength(1);
        expect(sessions[0].id).toBe("only-session");

        // Verify other collections are empty
        const stats = await storage.getStats();
        expect(stats.deviceFlows).toBe(0);
        expect(stats.authCodeFlows).toBe(0);
        expect(stats.authCodes).toBe(0);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle session without mcpAccessToken on delete", async () => {
      const session = createTestSession();
      (session as any).mcpAccessToken = undefined;
      await storage.createSession(session);

      const result = await storage.deleteSession(session.id);
      expect(result).toBe(true);
    });

    it("should handle session without mcpRefreshToken on delete", async () => {
      const session = createTestSession();
      (session as any).mcpRefreshToken = undefined;
      await storage.createSession(session);

      const result = await storage.deleteSession(session.id);
      expect(result).toBe(true);
    });

    it("should handle multiple cleanup calls", async () => {
      const expiredSession = createTestSession({
        createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      });
      await storage.createSession(expiredSession);

      await storage.cleanup();
      await storage.cleanup();
      await storage.cleanup();

      expect(await storage.getSession(expiredSession.id)).toBeUndefined();
    });

    it("should handle concurrent operations", async () => {
      const promises: Promise<void>[] = [];

      // Create multiple sessions concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(storage.createSession(createTestSession({ id: `concurrent-${i}` })));
      }

      await Promise.all(promises);

      const sessions = await storage.getAllSessions();
      expect(sessions.length).toBe(10);
    });
  });
});
