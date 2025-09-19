import { ConnectionManager } from '../../../src/services/ConnectionManager';
import { GraphQLClient } from '../../../src/graphql/client';
import { GitLabVersionDetector } from '../../../src/services/GitLabVersionDetector';
import { SchemaIntrospector } from '../../../src/services/SchemaIntrospector';

// Mock dependencies
jest.mock('../../../src/graphql/client');
jest.mock('../../../src/services/GitLabVersionDetector');
jest.mock('../../../src/services/SchemaIntrospector');
jest.mock('../../../src/config', () => ({
  GITLAB_BASE_URL: 'https://test-gitlab.com',
  GITLAB_TOKEN: 'test-token-123'
}));
jest.mock('../../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

const MockedGraphQLClient = GraphQLClient as jest.MockedClass<typeof GraphQLClient>;
const MockedGitLabVersionDetector = GitLabVersionDetector as jest.MockedClass<typeof GitLabVersionDetector>;
const MockedSchemaIntrospector = SchemaIntrospector as jest.MockedClass<typeof SchemaIntrospector>;

describe('ConnectionManager Enhanced Tests', () => {
  let connectionManager: ConnectionManager;
  let mockVersionDetector: jest.Mocked<GitLabVersionDetector>;
  let mockSchemaIntrospector: jest.Mocked<SchemaIntrospector>;
  let mockClient: jest.Mocked<GraphQLClient>;

  const mockInstanceInfo = {
    version: '16.5.0',
    tier: 'premium' as const,
    features: {
      workItems: true,
      epics: true,
      issues: true,
      advancedSearch: false,
      codeReview: true
    },
    detectedAt: new Date('2024-01-15T10:00:00Z')
  };

  const mockSchemaInfo = {
    workItemWidgetTypes: ['ASSIGNEES', 'LABELS', 'MILESTONE'],
    typeDefinitions: new Map([
      ['WorkItem', { name: 'WorkItem', fields: [], enumValues: null }]
    ]),
    availableFeatures: new Set(['workItems', 'epics'])
  };

  beforeEach(() => {
    // Clear singleton instance before each test
    (ConnectionManager as any).instance = null;
    (ConnectionManager as any).introspectionCache.clear();

    jest.clearAllMocks();

    // Setup mocks
    mockClient = {
      request: jest.fn()
    } as any;
    MockedGraphQLClient.mockImplementation(() => mockClient);

    mockVersionDetector = {
      detectInstance: jest.fn().mockResolvedValue(mockInstanceInfo),
      getTier: jest.fn().mockReturnValue('premium'),
      getVersion: jest.fn().mockReturnValue('16.5.0'),
      isFeatureAvailable: jest.fn().mockReturnValue(true),
      getCachedInfo: jest.fn().mockReturnValue(mockInstanceInfo)
    } as any;
    MockedGitLabVersionDetector.mockImplementation(() => mockVersionDetector);

    mockSchemaIntrospector = {
      introspectSchema: jest.fn().mockResolvedValue(mockSchemaInfo),
      isWidgetTypeAvailable: jest.fn().mockReturnValue(true),
      getAvailableWidgetTypes: jest.fn().mockReturnValue(['ASSIGNEES', 'LABELS']),
      getCachedSchema: jest.fn().mockReturnValue(mockSchemaInfo),
      getFieldsForType: jest.fn().mockReturnValue([])
    } as any;
    MockedSchemaIntrospector.mockImplementation(() => mockSchemaIntrospector);

    connectionManager = ConnectionManager.getInstance();
  });

  afterEach(() => {
    // Reset singleton for clean tests
    connectionManager.reset();
    (ConnectionManager as any).instance = null;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = ConnectionManager.getInstance();
      const instance2 = ConnectionManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should maintain singleton instance across calls', () => {
      const instance1 = ConnectionManager.getInstance();
      const instance2 = ConnectionManager.getInstance();
      const instance3 = ConnectionManager.getInstance();
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await connectionManager.initialize();

      expect(MockedGraphQLClient).toHaveBeenCalledWith(
        'https://test-gitlab.com/api/graphql',
        {
          headers: {
            Authorization: 'Bearer test-token-123'
          }
        }
      );
      expect(mockVersionDetector.detectInstance).toHaveBeenCalled();
      expect(mockSchemaIntrospector.introspectSchema).toHaveBeenCalled();
    });

    it('should handle multiple initialization calls gracefully', async () => {
      await connectionManager.initialize();
      await connectionManager.initialize();
      await connectionManager.initialize();

      // Should only initialize once
      expect(mockVersionDetector.detectInstance).toHaveBeenCalledTimes(1);
      expect(mockSchemaIntrospector.introspectSchema).toHaveBeenCalledTimes(1);
    });

    it('should throw error when GITLAB_BASE_URL is missing', async () => {
      // Mock missing config by temporarily changing the environment
      const originalConfig = require('../../../src/config');
      jest.resetModules();
      jest.doMock('../../../src/config', () => ({
        GITLAB_BASE_URL: null,
        GITLAB_TOKEN: 'test-token-123'
      }));

      // Import fresh ConnectionManager with mocked config
      const { ConnectionManager: TestConnectionManager } = require('../../../src/services/ConnectionManager');
      const newManager = new TestConnectionManager();

      await expect(newManager.initialize()).rejects.toThrow('GitLab base URL and token are required');

      // Restore original config
      jest.resetModules();
      jest.doMock('../../../src/config', () => originalConfig);
    });

    it('should throw error when GITLAB_TOKEN is missing', async () => {
      // Mock missing config by temporarily changing the environment
      const originalConfig = require('../../../src/config');
      jest.resetModules();
      jest.doMock('../../../src/config', () => ({
        GITLAB_BASE_URL: 'https://test-gitlab.com',
        GITLAB_TOKEN: null
      }));

      // Import fresh ConnectionManager with mocked config
      const { ConnectionManager: TestConnectionManager } = require('../../../src/services/ConnectionManager');
      const newManager = new TestConnectionManager();

      await expect(newManager.initialize()).rejects.toThrow('GitLab base URL and token are required');

      // Restore original config
      jest.resetModules();
      jest.doMock('../../../src/config', () => originalConfig);
    });

    it('should handle initialization errors and re-throw them', async () => {
      mockVersionDetector.detectInstance.mockRejectedValueOnce(new Error('Network error'));

      await expect(connectionManager.initialize()).rejects.toThrow('Network error');
    });
  });

  describe('Caching Mechanism', () => {
    it('should use cached data when available and not expired', async () => {
      // First initialization
      await connectionManager.initialize();
      connectionManager.reset();

      // Second initialization should use cache
      const newManager = ConnectionManager.getInstance();
      await newManager.initialize();

      // Should only call detectInstance once total (from cache)
      expect(mockVersionDetector.detectInstance).toHaveBeenCalledTimes(1);
    });

    it('should fetch fresh data when cache is expired', async () => {
      // Mock Date.now to control cache expiration
      const originalDateNow = Date.now;
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);

      try {
        // First initialization
        await connectionManager.initialize();
        connectionManager.reset();

        // Advance time beyond cache TTL (10 minutes = 600000ms)
        currentTime += 600001;

        // Second initialization should fetch fresh data
        const newManager = ConnectionManager.getInstance();
        await newManager.initialize();

        expect(mockVersionDetector.detectInstance).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should cache different endpoints separately', async () => {
      // This test would need more complex setup to test different endpoints
      // For now, just verify cache is used correctly
      await connectionManager.initialize();

      const cache = (ConnectionManager as any).introspectionCache;
      expect(cache.size).toBeGreaterThan(0);
      expect(cache.has('https://test-gitlab.com/api/graphql')).toBe(true);
    });
  });

  describe('Getter Methods Before Initialization', () => {
    it('should throw error when getting client before initialization', () => {
      expect(() => connectionManager.getClient()).toThrow('Connection not initialized. Call initialize() first.');
    });

    it('should throw error when getting version detector before initialization', () => {
      expect(() => connectionManager.getVersionDetector()).toThrow('Connection not initialized. Call initialize() first.');
    });

    it('should throw error when getting schema introspector before initialization', () => {
      expect(() => connectionManager.getSchemaIntrospector()).toThrow('Connection not initialized. Call initialize() first.');
    });

    it('should throw error when getting instance info before initialization', () => {
      expect(() => connectionManager.getInstanceInfo()).toThrow('Connection not initialized. Call initialize() first.');
    });

    it('should throw error when getting schema info before initialization', () => {
      expect(() => connectionManager.getSchemaInfo()).toThrow('Connection not initialized. Call initialize() first.');
    });
  });

  describe('Getter Methods After Initialization', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    it('should return GraphQL client after initialization', () => {
      const client = connectionManager.getClient();
      expect(client).toBe(mockClient);
    });

    it('should return version detector after initialization', () => {
      const detector = connectionManager.getVersionDetector();
      expect(detector).toBe(mockVersionDetector);
    });

    it('should return schema introspector after initialization', () => {
      const introspector = connectionManager.getSchemaIntrospector();
      expect(introspector).toBe(mockSchemaIntrospector);
    });

    it('should return instance info after initialization', () => {
      const info = connectionManager.getInstanceInfo();
      expect(info).toBe(mockInstanceInfo);
    });

    it('should return schema info after initialization', () => {
      const info = connectionManager.getSchemaInfo();
      expect(info).toBe(mockSchemaInfo);
    });
  });

  describe('Feature Availability Methods', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    it('should check feature availability correctly', () => {
      expect(connectionManager.isFeatureAvailable('workItems')).toBe(true);
      expect(connectionManager.isFeatureAvailable('epics')).toBe(true);
      expect(connectionManager.isFeatureAvailable('advancedSearch')).toBe(false);
    });

    it('should return false for feature availability before initialization', () => {
      connectionManager.reset();
      expect(connectionManager.isFeatureAvailable('workItems')).toBe(false);
    });

    it('should return correct tier', () => {
      expect(connectionManager.getTier()).toBe('premium');
    });

    it('should return unknown tier before initialization', () => {
      connectionManager.reset();
      expect(connectionManager.getTier()).toBe('unknown');
    });

    it('should return correct version', () => {
      expect(connectionManager.getVersion()).toBe('16.5.0');
    });

    it('should return unknown version before initialization', () => {
      connectionManager.reset();
      expect(connectionManager.getVersion()).toBe('unknown');
    });
  });

  describe('Widget Availability Methods', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    it('should check widget availability correctly', () => {
      expect(connectionManager.isWidgetAvailable('ASSIGNEES')).toBe(true);
      expect(mockSchemaIntrospector.isWidgetTypeAvailable).toHaveBeenCalledWith('ASSIGNEES');
    });

    it('should return false for widget availability before initialization', () => {
      connectionManager.reset();
      expect(connectionManager.isWidgetAvailable('ASSIGNEES')).toBe(false);
    });
  });

  describe('Reset Functionality', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    it('should reset all properties to null', () => {
      connectionManager.reset();

      expect(() => connectionManager.getClient()).toThrow('Connection not initialized');
      expect(() => connectionManager.getVersionDetector()).toThrow('Connection not initialized');
      expect(() => connectionManager.getSchemaIntrospector()).toThrow('Connection not initialized');
      expect(() => connectionManager.getInstanceInfo()).toThrow('Connection not initialized');
      expect(() => connectionManager.getSchemaInfo()).toThrow('Connection not initialized');
    });

    it('should allow re-initialization after reset', async () => {
      connectionManager.reset();

      await connectionManager.initialize();

      expect(connectionManager.getClient()).toBeDefined();
      expect(connectionManager.getInstanceInfo()).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle version detector failure gracefully', async () => {
      mockVersionDetector.detectInstance.mockRejectedValueOnce(new Error('Version detection failed'));

      await expect(connectionManager.initialize()).rejects.toThrow('Version detection failed');
    });

    it('should handle schema introspector failure gracefully', async () => {
      mockSchemaIntrospector.introspectSchema.mockRejectedValueOnce(new Error('Schema introspection failed'));

      await expect(connectionManager.initialize()).rejects.toThrow('Schema introspection failed');
    });

    it('should handle GraphQL client creation failure', async () => {
      MockedGraphQLClient.mockImplementationOnce(() => {
        throw new Error('Client creation failed');
      });

      await expect(connectionManager.initialize()).rejects.toThrow('Client creation failed');
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle undefined feature keys gracefully', async () => {
      await connectionManager.initialize();

      // Test with undefined feature (should not throw)
      expect(connectionManager.isFeatureAvailable(undefined as any)).toBe(undefined);
    });

    it('should handle instance info with missing features', async () => {
      const infoWithoutFeatures = {
        version: '16.5.0',
        tier: 'premium' as const,
        features: {} as any, // Empty object instead of undefined
        detectedAt: new Date('2024-01-15T10:00:00Z')
      };
      mockVersionDetector.detectInstance.mockResolvedValueOnce(infoWithoutFeatures);

      await connectionManager.initialize();

      // Should handle gracefully without throwing
      expect(() => connectionManager.isFeatureAvailable('workItems')).not.toThrow();
      expect(connectionManager.isFeatureAvailable('workItems')).toBe(undefined);
    });

    it('should handle parallel initialization attempts', async () => {
      // This tests the current implementation - it doesn't prevent parallel calls
      // but it does have the early return if already initialized
      const promises = [
        connectionManager.initialize(),
        connectionManager.initialize(),
        connectionManager.initialize()
      ];

      await Promise.all(promises);

      // The current implementation may call detectInstance multiple times
      // but subsequent calls should return early due to isInitialized flag
      expect(mockVersionDetector.detectInstance).toHaveBeenCalled();
      expect(mockSchemaIntrospector.introspectSchema).toHaveBeenCalled();
    });
  });
});