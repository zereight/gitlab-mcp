/**
 * Unit tests for OAuth configuration
 * Tests configuration loading, validation, and mode detection
 */

// Mock logger before imports
jest.mock('../../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('OAuth Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear all OAuth-related env vars
    delete process.env.OAUTH_ENABLED;
    delete process.env.OAUTH_SESSION_SECRET;
    delete process.env.GITLAB_OAUTH_CLIENT_ID;
    delete process.env.GITLAB_OAUTH_CLIENT_SECRET;
    delete process.env.GITLAB_OAUTH_SCOPES;
    delete process.env.OAUTH_TOKEN_TTL;
    delete process.env.OAUTH_REFRESH_TOKEN_TTL;
    delete process.env.OAUTH_DEVICE_POLL_INTERVAL;
    delete process.env.OAUTH_DEVICE_TIMEOUT;
    delete process.env.GITLAB_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadOAuthConfig', () => {
    it('should return null when OAUTH_ENABLED is not set', async () => {
      const { loadOAuthConfig } = await import('../../../src/oauth/config');
      const config = loadOAuthConfig();
      expect(config).toBeNull();
    });

    it('should return null when OAUTH_ENABLED is false', async () => {
      process.env.OAUTH_ENABLED = 'false';
      const { loadOAuthConfig } = await import('../../../src/oauth/config');
      const config = loadOAuthConfig();
      expect(config).toBeNull();
    });

    it('should throw error when OAUTH_ENABLED but missing required fields', async () => {
      process.env.OAUTH_ENABLED = 'true';
      // Missing OAUTH_SESSION_SECRET and GITLAB_OAUTH_CLIENT_ID

      const { loadOAuthConfig } = await import('../../../src/oauth/config');
      expect(() => loadOAuthConfig()).toThrow('Invalid OAuth configuration');
    });

    it('should throw error when session secret is too short', async () => {
      process.env.OAUTH_ENABLED = 'true';
      process.env.OAUTH_SESSION_SECRET = 'short'; // Less than 32 chars
      process.env.GITLAB_OAUTH_CLIENT_ID = 'test-client-id';

      const { loadOAuthConfig } = await import('../../../src/oauth/config');
      expect(() => loadOAuthConfig()).toThrow('Invalid OAuth configuration');
    });

    it('should return valid config when all required fields are present', async () => {
      process.env.OAUTH_ENABLED = 'true';
      process.env.OAUTH_SESSION_SECRET = 'a'.repeat(32); // Exactly 32 chars
      process.env.GITLAB_OAUTH_CLIENT_ID = 'test-client-id';

      const { loadOAuthConfig } = await import('../../../src/oauth/config');
      const config = loadOAuthConfig();

      expect(config).not.toBeNull();
      expect(config?.enabled).toBe(true);
      expect(config?.sessionSecret).toBe('a'.repeat(32));
      expect(config?.gitlabClientId).toBe('test-client-id');
    });

    it('should use default values for optional fields', async () => {
      process.env.OAUTH_ENABLED = 'true';
      process.env.OAUTH_SESSION_SECRET = 'a'.repeat(32);
      process.env.GITLAB_OAUTH_CLIENT_ID = 'test-client-id';

      const { loadOAuthConfig } = await import('../../../src/oauth/config');
      const config = loadOAuthConfig();

      expect(config?.gitlabScopes).toBe('api,read_user');
      expect(config?.tokenTtl).toBe(3600);
      expect(config?.refreshTokenTtl).toBe(604800);
      expect(config?.devicePollInterval).toBe(5);
      expect(config?.deviceTimeout).toBe(300);
    });

    it('should use custom values when provided', async () => {
      process.env.OAUTH_ENABLED = 'true';
      process.env.OAUTH_SESSION_SECRET = 'a'.repeat(32);
      process.env.GITLAB_OAUTH_CLIENT_ID = 'test-client-id';
      process.env.GITLAB_OAUTH_CLIENT_SECRET = 'test-secret';
      process.env.GITLAB_OAUTH_SCOPES = 'api,read_user,write_repository';
      process.env.OAUTH_TOKEN_TTL = '7200';
      process.env.OAUTH_REFRESH_TOKEN_TTL = '1209600';
      process.env.OAUTH_DEVICE_POLL_INTERVAL = '10';
      process.env.OAUTH_DEVICE_TIMEOUT = '600';

      const { loadOAuthConfig } = await import('../../../src/oauth/config');
      const config = loadOAuthConfig();

      expect(config?.gitlabClientSecret).toBe('test-secret');
      expect(config?.gitlabScopes).toBe('api,read_user,write_repository');
      expect(config?.tokenTtl).toBe(7200);
      expect(config?.refreshTokenTtl).toBe(1209600);
      expect(config?.devicePollInterval).toBe(10);
      expect(config?.deviceTimeout).toBe(600);
    });

    it('should cache config after first load', async () => {
      process.env.OAUTH_ENABLED = 'true';
      process.env.OAUTH_SESSION_SECRET = 'a'.repeat(32);
      process.env.GITLAB_OAUTH_CLIENT_ID = 'test-client-id';

      const { loadOAuthConfig, resetOAuthConfigCache } = await import('../../../src/oauth/config');

      // Reset cache first
      resetOAuthConfigCache();

      const config1 = loadOAuthConfig();
      const config2 = loadOAuthConfig();

      expect(config1).toBe(config2); // Same reference (cached)
    });
  });

  describe('validateStaticConfig', () => {
    it('should throw error when GITLAB_TOKEN is not set', async () => {
      const { validateStaticConfig } = await import('../../../src/oauth/config');
      expect(() => validateStaticConfig()).toThrow('GITLAB_TOKEN is required');
    });

    it('should not throw when GITLAB_TOKEN is set', async () => {
      process.env.GITLAB_TOKEN = 'test-token';
      const { validateStaticConfig } = await import('../../../src/oauth/config');
      expect(() => validateStaticConfig()).not.toThrow();
    });
  });

  describe('isOAuthEnabled', () => {
    it('should return false when OAUTH_ENABLED is not set', async () => {
      const { isOAuthEnabled } = await import('../../../src/oauth/config');
      expect(isOAuthEnabled()).toBe(false);
    });

    it('should return false when OAUTH_ENABLED is false', async () => {
      process.env.OAUTH_ENABLED = 'false';
      const { isOAuthEnabled } = await import('../../../src/oauth/config');
      expect(isOAuthEnabled()).toBe(false);
    });

    it('should return true when valid OAuth config is loaded', async () => {
      process.env.OAUTH_ENABLED = 'true';
      process.env.OAUTH_SESSION_SECRET = 'a'.repeat(32);
      process.env.GITLAB_OAUTH_CLIENT_ID = 'test-client-id';

      const { loadOAuthConfig, isOAuthEnabled, resetOAuthConfigCache } = await import(
        '../../../src/oauth/config'
      );

      resetOAuthConfigCache();
      loadOAuthConfig(); // Load config first
      expect(isOAuthEnabled()).toBe(true);
    });
  });

  describe('getAuthModeDescription', () => {
    it('should return OAuth mode description when OAuth is enabled', async () => {
      process.env.OAUTH_ENABLED = 'true';
      process.env.OAUTH_SESSION_SECRET = 'a'.repeat(32);
      process.env.GITLAB_OAUTH_CLIENT_ID = 'test-client-id';

      const { loadOAuthConfig, getAuthModeDescription, resetOAuthConfigCache } = await import(
        '../../../src/oauth/config'
      );

      resetOAuthConfigCache();
      loadOAuthConfig();
      expect(getAuthModeDescription()).toBe('OAuth mode (per-user authentication via GitLab Device Flow)');
    });

    it('should return static mode description when OAuth is disabled', async () => {
      const { getAuthModeDescription } = await import('../../../src/oauth/config');
      expect(getAuthModeDescription()).toBe('Static token mode (shared GITLAB_TOKEN)');
    });
  });
});
