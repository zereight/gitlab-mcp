/**
 * Unit tests for OAuth session store
 * Tests session CRUD operations, device flows, auth codes, and cleanup
 */

import { SessionStore } from '../../../src/oauth/session-store';
import { OAuthSession, DeviceFlowState, AuthorizationCode } from '../../../src/oauth/types';

describe('OAuth Session Store', () => {
  let store: SessionStore;

  // Helper function to create a test session
  const createTestSession = (overrides: Partial<OAuthSession> = {}): OAuthSession => ({
    id: `session-${Date.now()}`,
    mcpAccessToken: 'mcp-token-123',
    mcpRefreshToken: 'mcp-refresh-123',
    mcpTokenExpiry: Date.now() + 3600000,
    gitlabAccessToken: 'gitlab-token-123',
    gitlabRefreshToken: 'gitlab-refresh-123',
    gitlabTokenExpiry: Date.now() + 7200000,
    gitlabUserId: 12345,
    gitlabUsername: 'testuser',
    clientId: 'test-client',
    scopes: ['mcp:tools', 'mcp:resources'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  // Helper function to create a test device flow
  const createTestDeviceFlow = (overrides: Partial<DeviceFlowState> = {}): DeviceFlowState => ({
    deviceCode: 'device-code-123',
    userCode: 'ABCD-1234',
    verificationUri: 'https://gitlab.example.com/oauth/authorize',
    verificationUriComplete: 'https://gitlab.example.com/oauth/authorize?user_code=ABCD-1234',
    expiresAt: Date.now() + 600000,
    interval: 5,
    clientId: 'test-client',
    codeChallenge: 'challenge-123',
    codeChallengeMethod: 'S256',
    state: 'state-123',
    redirectUri: 'https://callback.example.com',
    ...overrides,
  });

  // Helper function to create a test auth code
  const createTestAuthCode = (overrides: Partial<AuthorizationCode> = {}): AuthorizationCode => ({
    code: 'auth-code-123',
    sessionId: 'session-456',
    clientId: 'test-client',
    codeChallenge: 'challenge-123',
    codeChallengeMethod: 'S256',
    redirectUri: 'https://callback.example.com',
    expiresAt: Date.now() + 600000,
    ...overrides,
  });

  beforeEach(() => {
    store = new SessionStore();
  });

  describe('Session Operations', () => {
    describe('createSession', () => {
      it('should create a new session', () => {
        const session = createTestSession();
        store.createSession(session);

        const retrieved = store.getSession(session.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(session.id);
      });

      it('should index session by access token', () => {
        const session = createTestSession();
        store.createSession(session);

        const retrieved = store.getSessionByToken(session.mcpAccessToken);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(session.id);
      });
    });

    describe('getSession', () => {
      it('should return undefined for non-existent session', () => {
        const session = store.getSession('non-existent-id');
        expect(session).toBeUndefined();
      });

      it('should return existing session', () => {
        const session = createTestSession();
        store.createSession(session);

        const retrieved = store.getSession(session.id);
        expect(retrieved).toEqual(session);
      });
    });

    describe('getSessionByToken', () => {
      it('should return undefined for non-existent token', () => {
        const session = store.getSessionByToken('non-existent-token');
        expect(session).toBeUndefined();
      });

      it('should return session by access token', () => {
        const session = createTestSession({ mcpAccessToken: 'unique-token-123' });
        store.createSession(session);

        const retrieved = store.getSessionByToken('unique-token-123');
        expect(retrieved?.id).toBe(session.id);
      });
    });

    describe('updateSession', () => {
      it('should update session fields', () => {
        const session = createTestSession();
        store.createSession(session);

        store.updateSession(session.id, {
          gitlabAccessToken: 'new-gitlab-token',
          gitlabRefreshToken: 'new-gitlab-refresh',
        });

        const updated = store.getSession(session.id);
        expect(updated?.gitlabAccessToken).toBe('new-gitlab-token');
        expect(updated?.gitlabRefreshToken).toBe('new-gitlab-refresh');
      });

      it('should update updatedAt timestamp', () => {
        const session = createTestSession({ updatedAt: 1000 });
        store.createSession(session);

        const beforeUpdate = Date.now();
        store.updateSession(session.id, { gitlabAccessToken: 'new-token' });

        const updated = store.getSession(session.id);
        expect(updated?.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
      });

      it('should update token index when access token changes', () => {
        const session = createTestSession({ mcpAccessToken: 'old-token' });
        store.createSession(session);

        store.updateSession(session.id, { mcpAccessToken: 'new-token' });

        // Old token should not find session
        expect(store.getSessionByToken('old-token')).toBeUndefined();
        // New token should find session
        expect(store.getSessionByToken('new-token')?.id).toBe(session.id);
      });

      it('should do nothing for non-existent session', () => {
        // Should not throw
        expect(() => store.updateSession('non-existent', { gitlabAccessToken: 'new' })).not.toThrow();
      });
    });

    describe('deleteSession', () => {
      it('should delete existing session', () => {
        const session = createTestSession();
        store.createSession(session);

        store.deleteSession(session.id);

        expect(store.getSession(session.id)).toBeUndefined();
      });

      it('should remove token index', () => {
        const session = createTestSession();
        store.createSession(session);

        store.deleteSession(session.id);

        expect(store.getSessionByToken(session.mcpAccessToken)).toBeUndefined();
      });

      it('should do nothing for non-existent session', () => {
        // Should not throw
        expect(() => store.deleteSession('non-existent')).not.toThrow();
      });
    });
  });

  describe('Device Flow Operations', () => {
    describe('storeDeviceFlow', () => {
      it('should store device flow by state', () => {
        const flow = createTestDeviceFlow();
        store.storeDeviceFlow('flow-state-123', flow);

        const retrieved = store.getDeviceFlow('flow-state-123');
        expect(retrieved).toBeDefined();
        expect(retrieved?.deviceCode).toBe(flow.deviceCode);
      });
    });

    describe('getDeviceFlow', () => {
      it('should return undefined for non-existent flow', () => {
        const flow = store.getDeviceFlow('non-existent');
        expect(flow).toBeUndefined();
      });

      it('should return existing flow', () => {
        const flow = createTestDeviceFlow();
        store.storeDeviceFlow('test-state', flow);

        const retrieved = store.getDeviceFlow('test-state');
        expect(retrieved).toEqual(flow);
      });
    });

    describe('getDeviceFlowByDeviceCode', () => {
      it('should return undefined for non-existent device code', () => {
        const flow = store.getDeviceFlowByDeviceCode('non-existent');
        expect(flow).toBeUndefined();
      });

      it('should return flow by device code', () => {
        const flow = createTestDeviceFlow({ deviceCode: 'unique-device-code' });
        store.storeDeviceFlow('test-state', flow);

        const retrieved = store.getDeviceFlowByDeviceCode('unique-device-code');
        expect(retrieved?.userCode).toBe(flow.userCode);
      });
    });

    describe('deleteDeviceFlow', () => {
      it('should delete existing flow', () => {
        const flow = createTestDeviceFlow();
        store.storeDeviceFlow('test-state', flow);

        store.deleteDeviceFlow('test-state');

        expect(store.getDeviceFlow('test-state')).toBeUndefined();
      });

      it('should do nothing for non-existent flow', () => {
        expect(() => store.deleteDeviceFlow('non-existent')).not.toThrow();
      });
    });
  });

  describe('Authorization Code Operations', () => {
    describe('storeAuthCode', () => {
      it('should store authorization code', () => {
        const authCode = createTestAuthCode();
        store.storeAuthCode(authCode);

        const retrieved = store.getAuthCode(authCode.code);
        expect(retrieved).toBeDefined();
        expect(retrieved?.sessionId).toBe(authCode.sessionId);
      });
    });

    describe('getAuthCode', () => {
      it('should return undefined for non-existent code', () => {
        const code = store.getAuthCode('non-existent');
        expect(code).toBeUndefined();
      });

      it('should return existing code', () => {
        const authCode = createTestAuthCode({ code: 'unique-code-123' });
        store.storeAuthCode(authCode);

        const retrieved = store.getAuthCode('unique-code-123');
        expect(retrieved).toEqual(authCode);
      });
    });

    describe('deleteAuthCode', () => {
      it('should delete existing code', () => {
        const authCode = createTestAuthCode();
        store.storeAuthCode(authCode);

        store.deleteAuthCode(authCode.code);

        expect(store.getAuthCode(authCode.code)).toBeUndefined();
      });

      it('should do nothing for non-existent code', () => {
        expect(() => store.deleteAuthCode('non-existent')).not.toThrow();
      });
    });
  });

  describe('Cleanup Operations', () => {
    describe('cleanup', () => {
      it('should remove expired sessions', () => {
        // Session expiration is based on createdAt + 7 days
        const sevenDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago (expired)
        const expiredSession = createTestSession({
          id: 'expired-session',
          createdAt: sevenDaysAgo,
        });
        const validSession = createTestSession({
          id: 'valid-session',
          createdAt: Date.now(), // Just created (not expired)
        });

        store.createSession(expiredSession);
        store.createSession(validSession);

        store.cleanup();

        expect(store.getSession('expired-session')).toBeUndefined();
        expect(store.getSession('valid-session')).toBeDefined();
      });

      it('should remove expired device flows', () => {
        const expiredFlow = createTestDeviceFlow({
          expiresAt: Date.now() - 1000, // Expired
        });
        const validFlow = createTestDeviceFlow({
          expiresAt: Date.now() + 600000, // Not expired
        });

        store.storeDeviceFlow('expired-flow', expiredFlow);
        store.storeDeviceFlow('valid-flow', validFlow);

        store.cleanup();

        expect(store.getDeviceFlow('expired-flow')).toBeUndefined();
        expect(store.getDeviceFlow('valid-flow')).toBeDefined();
      });

      it('should remove expired auth codes', () => {
        const expiredCode = createTestAuthCode({
          code: 'expired-code',
          expiresAt: Date.now() - 1000, // Expired
        });
        const validCode = createTestAuthCode({
          code: 'valid-code',
          expiresAt: Date.now() + 600000, // Not expired
        });

        store.storeAuthCode(expiredCode);
        store.storeAuthCode(validCode);

        store.cleanup();

        expect(store.getAuthCode('expired-code')).toBeUndefined();
        expect(store.getAuthCode('valid-code')).toBeDefined();
      });
    });
  });

  describe('Session Enumeration', () => {
    describe('getAllSessions', () => {
      it('should return empty iterator when no sessions', () => {
        const sessions = Array.from(store.getAllSessions());
        expect(sessions).toEqual([]);
      });

      it('should return all sessions', () => {
        const session1 = createTestSession({ id: 'session-1' });
        const session2 = createTestSession({ id: 'session-2' });

        store.createSession(session1);
        store.createSession(session2);

        const sessions = Array.from(store.getAllSessions());
        expect(sessions).toHaveLength(2);
        expect(sessions.map(s => s.id)).toContain('session-1');
        expect(sessions.map(s => s.id)).toContain('session-2');
      });
    });

    describe('getSessionByRefreshToken', () => {
      it('should return undefined for non-existent refresh token', () => {
        const session = store.getSessionByRefreshToken('non-existent');
        expect(session).toBeUndefined();
      });

      it('should return session by refresh token', () => {
        const session = createTestSession({ mcpRefreshToken: 'unique-refresh-token' });
        store.createSession(session);

        const retrieved = store.getSessionByRefreshToken('unique-refresh-token');
        expect(retrieved?.id).toBe(session.id);
      });
    });
  });
});
