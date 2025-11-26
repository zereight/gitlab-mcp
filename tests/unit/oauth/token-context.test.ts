/**
 * Unit tests for OAuth token context
 * Tests AsyncLocalStorage-based per-request token context
 */

import {
  runWithTokenContext,
  getTokenContext,
  getGitLabTokenFromContext,
  getGitLabUserIdFromContext,
  getGitLabUsernameFromContext,
  getSessionIdFromContext,
  isInOAuthContext,
} from '../../../src/oauth/token-context';
import { TokenContext } from '../../../src/oauth/types';

describe('OAuth Token Context', () => {
  // Helper function to create a test token context
  const createTestContext = (overrides: Partial<TokenContext> = {}): TokenContext => ({
    gitlabToken: 'test-gitlab-token-123',
    gitlabUserId: 12345,
    gitlabUsername: 'testuser',
    sessionId: 'session-abc-123',
    ...overrides,
  });

  describe('runWithTokenContext', () => {
    it('should execute function with provided context', () => {
      const context = createTestContext();
      let capturedContext: TokenContext | undefined;

      runWithTokenContext(context, () => {
        capturedContext = getTokenContext();
      });

      expect(capturedContext).toEqual(context);
    });

    it('should return synchronous function result', () => {
      const context = createTestContext();
      const result = runWithTokenContext(context, () => 'sync-result');

      expect(result).toBe('sync-result');
    });

    it('should return async function result', async () => {
      const context = createTestContext();
      const result = await runWithTokenContext(context, async () => {
        await Promise.resolve();
        return 'async-result';
      });

      expect(result).toBe('async-result');
    });

    it('should maintain context through async operations', async () => {
      const context = createTestContext({ gitlabToken: 'async-token' });
      let capturedToken: string | undefined;

      await runWithTokenContext(context, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        capturedToken = getTokenContext()?.gitlabToken;
      });

      expect(capturedToken).toBe('async-token');
    });

    it('should isolate nested contexts', () => {
      const outerContext = createTestContext({ sessionId: 'outer-session' });
      const innerContext = createTestContext({ sessionId: 'inner-session' });
      const capturedSessionIds: string[] = [];

      runWithTokenContext(outerContext, () => {
        capturedSessionIds.push(getSessionIdFromContext() || 'undefined');

        runWithTokenContext(innerContext, () => {
          capturedSessionIds.push(getSessionIdFromContext() || 'undefined');
        });

        capturedSessionIds.push(getSessionIdFromContext() || 'undefined');
      });

      expect(capturedSessionIds).toEqual(['outer-session', 'inner-session', 'outer-session']);
    });
  });

  describe('getTokenContext', () => {
    it('should return undefined outside of context', () => {
      const context = getTokenContext();
      expect(context).toBeUndefined();
    });

    it('should return context inside runWithTokenContext', () => {
      const testContext = createTestContext();

      runWithTokenContext(testContext, () => {
        const context = getTokenContext();
        expect(context).toBeDefined();
        expect(context?.gitlabToken).toBe('test-gitlab-token-123');
      });
    });

    it('should return full context object', () => {
      const testContext = createTestContext({
        gitlabToken: 'token-xyz',
        gitlabUserId: 99999,
        gitlabUsername: 'customuser',
        sessionId: 'session-xyz',
      });

      runWithTokenContext(testContext, () => {
        const context = getTokenContext();
        expect(context).toEqual(testContext);
      });
    });
  });

  describe('getGitLabTokenFromContext', () => {
    it('should throw error outside of context', () => {
      expect(() => getGitLabTokenFromContext()).toThrow(
        'No OAuth token context available - this code must be called within an authenticated request'
      );
    });

    it('should return token inside context', () => {
      const testContext = createTestContext({ gitlabToken: 'my-gitlab-token' });

      runWithTokenContext(testContext, () => {
        const token = getGitLabTokenFromContext();
        expect(token).toBe('my-gitlab-token');
      });
    });
  });

  describe('getGitLabUserIdFromContext', () => {
    it('should return undefined outside of context', () => {
      const userId = getGitLabUserIdFromContext();
      expect(userId).toBeUndefined();
    });

    it('should return user ID inside context', () => {
      const testContext = createTestContext({ gitlabUserId: 67890 });

      runWithTokenContext(testContext, () => {
        const userId = getGitLabUserIdFromContext();
        expect(userId).toBe(67890);
      });
    });
  });

  describe('getGitLabUsernameFromContext', () => {
    it('should return undefined outside of context', () => {
      const username = getGitLabUsernameFromContext();
      expect(username).toBeUndefined();
    });

    it('should return username inside context', () => {
      const testContext = createTestContext({ gitlabUsername: 'myusername' });

      runWithTokenContext(testContext, () => {
        const username = getGitLabUsernameFromContext();
        expect(username).toBe('myusername');
      });
    });
  });

  describe('getSessionIdFromContext', () => {
    it('should return undefined outside of context', () => {
      const sessionId = getSessionIdFromContext();
      expect(sessionId).toBeUndefined();
    });

    it('should return session ID inside context', () => {
      const testContext = createTestContext({ sessionId: 'my-session-id' });

      runWithTokenContext(testContext, () => {
        const sessionId = getSessionIdFromContext();
        expect(sessionId).toBe('my-session-id');
      });
    });
  });

  describe('isInOAuthContext', () => {
    it('should return false outside of context', () => {
      expect(isInOAuthContext()).toBe(false);
    });

    it('should return true inside context', () => {
      const testContext = createTestContext();

      runWithTokenContext(testContext, () => {
        expect(isInOAuthContext()).toBe(true);
      });
    });
  });

  describe('Context Isolation', () => {
    it('should not leak context between parallel async operations', async () => {
      const context1 = createTestContext({ gitlabToken: 'token-1', sessionId: 'session-1' });
      const context2 = createTestContext({ gitlabToken: 'token-2', sessionId: 'session-2' });

      const results: { token: string; session: string }[] = [];

      await Promise.all([
        runWithTokenContext(context1, async () => {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
          results.push({
            token: getTokenContext()?.gitlabToken || '',
            session: getSessionIdFromContext() || '',
          });
        }),
        runWithTokenContext(context2, async () => {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
          results.push({
            token: getTokenContext()?.gitlabToken || '',
            session: getSessionIdFromContext() || '',
          });
        }),
      ]);

      // Each context should have maintained its own values
      const result1 = results.find((r) => r.session === 'session-1');
      const result2 = results.find((r) => r.session === 'session-2');

      expect(result1?.token).toBe('token-1');
      expect(result2?.token).toBe('token-2');
    });

    it('should clear context after function completes', () => {
      const testContext = createTestContext();

      runWithTokenContext(testContext, () => {
        expect(isInOAuthContext()).toBe(true);
      });

      expect(isInOAuthContext()).toBe(false);
      expect(getTokenContext()).toBeUndefined();
    });

    it('should clear context even if function throws', () => {
      const testContext = createTestContext();

      expect(() => {
        runWithTokenContext(testContext, () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      expect(isInOAuthContext()).toBe(false);
      expect(getTokenContext()).toBeUndefined();
    });
  });
});
