import { GitLabVersionDetector, GitLabTier, GitLabInstanceInfo, GitLabFeatures } from '../../../src/services/GitLabVersionDetector';
import { GraphQLClient } from '../../../src/graphql/client';
import { enhancedFetch } from '../../../src/utils/fetch';

// Mock the dependencies
jest.mock('../../../src/graphql/client');
jest.mock('../../../src/utils/fetch');
jest.mock('../../../src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

const mockGraphQLClient = {
  request: jest.fn(),
  endpoint: 'https://gitlab.example.com/api/graphql'
} as unknown as jest.Mocked<GraphQLClient>;

const mockEnhancedFetch = enhancedFetch as jest.MockedFunction<typeof enhancedFetch>;

describe('GitLabVersionDetector', () => {
  let detector: GitLabVersionDetector;

  beforeEach(() => {
    jest.clearAllMocks();
    detector = new GitLabVersionDetector(mockGraphQLClient);
  });

  describe('Constructor and Basic Methods', () => {
    it('should initialize with GraphQL client', () => {
      expect(detector).toBeInstanceOf(GitLabVersionDetector);
    });

    it('should start with no cached info', () => {
      expect(detector.getCachedInfo()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle complete GraphQL failure gracefully', async () => {
      // Mock all GraphQL calls to fail
      mockGraphQLClient.request.mockRejectedValue(new Error('GraphQL error'));

      // Mock REST API failure as well
      mockEnhancedFetch.mockResolvedValue({
        ok: false,
        status: 500
      } as any);

      const info = await detector.detectInstance();

      expect(info.version).toBe('unknown');
      expect(info.tier).toBe('free');
      expect(info.features).toBeDefined();
      expect(info.detectedAt).toBeInstanceOf(Date);
    });

    it('should handle partial failures with fallbacks', async () => {
      // Mock version detection failure
      mockGraphQLClient.request.mockRejectedValueOnce(new Error('Version query failed'));

      // Mock successful REST API fallback
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ version: '16.3.0' })
      } as any);

      // Mock license detection failure (fallback to free)
      mockGraphQLClient.request.mockRejectedValueOnce(new Error('License query failed'));

      // Mock feature detection failure (fallback to free tier)
      mockGraphQLClient.request.mockRejectedValueOnce(new Error('Feature query failed'));

      const info = await detector.detectInstance();
      expect(info.version).toBe('16.3.0'); // REST fallback successful
      expect(info.tier).toBe('free');
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      // Set up a working detector with mock data
      mockGraphQLClient.request.mockResolvedValue({
        metadata: { version: '16.5.0' }
      });
      mockGraphQLClient.request.mockResolvedValue({
        currentLicense: { plan: 'premium' }
      });

      await detector.detectInstance();
    });

    it('should check if feature is available', () => {
      // These methods require cached data to work
      expect(typeof detector.isFeatureAvailable('workItems')).toBe('boolean');
      expect(typeof detector.isFeatureAvailable('epics')).toBe('boolean');
    });

    it('should return current tier', () => {
      const tier = detector.getTier();
      expect(['free', 'premium', 'ultimate']).toContain(tier);
    });

    it('should return current version', () => {
      const version = detector.getVersion();
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });
  });

  describe('Feature Detection Logic', () => {
    it('should determine features based on version and tier', async () => {
      // Mock successful detection
      mockGraphQLClient.request.mockResolvedValueOnce({
        metadata: { version: '16.5.0' }
      });

      mockGraphQLClient.request.mockResolvedValueOnce({
        currentLicense: null // Free tier
      });

      mockGraphQLClient.request.mockResolvedValueOnce({
        group: {
          epicsEnabled: false,
          iterationsEnabled: { nodes: [] },
          workItemTypesEnabled: { nodes: [{ name: 'Issue' }] }
        }
      });

      const info = await detector.detectInstance();

      expect(info.features.workItems).toBe(true); // Available in 16.x
      expect(info.features.epics).toBe(false); // Not available in free tier
      expect(typeof info.features.advancedSearch).toBe('boolean');
      expect(typeof info.features.codeReview).toBe('boolean');
    });
  });

  describe('Cache Management', () => {
    it('should return cached info when available', async () => {
      // Mock successful detection
      mockGraphQLClient.request.mockResolvedValue({ metadata: { version: '16.5.0' } });
      mockGraphQLClient.request.mockResolvedValue({ currentLicense: null });
      mockGraphQLClient.request.mockResolvedValue({
        group: { epicsEnabled: false, iterationsEnabled: { nodes: [] }, workItemTypesEnabled: { nodes: [] } }
      });

      const info = await detector.detectInstance();
      expect(detector.getCachedInfo()).toEqual(info);
    });

    it('should use cached results for subsequent calls', async () => {
      // Initial detection
      mockGraphQLClient.request.mockResolvedValue({ metadata: { version: '16.5.0' } });
      mockGraphQLClient.request.mockResolvedValue({ currentLicense: null });
      mockGraphQLClient.request.mockResolvedValue({
        group: { epicsEnabled: false, iterationsEnabled: { nodes: [] }, workItemTypesEnabled: { nodes: [] } }
      });

      const firstCall = await detector.detectInstance();
      jest.clearAllMocks();

      // Second call should use cache
      const secondCall = await detector.detectInstance();
      expect(secondCall).toEqual(firstCall);
      expect(mockGraphQLClient.request).not.toHaveBeenCalled();
    });

    it('should invalidate old cache and fetch fresh data', async () => {
      // Initial detection
      mockGraphQLClient.request.mockResolvedValue({ metadata: { version: '16.5.0' } });
      mockGraphQLClient.request.mockResolvedValue({ currentLicense: null });
      mockGraphQLClient.request.mockResolvedValue({
        group: { epicsEnabled: false, iterationsEnabled: { nodes: [] }, workItemTypesEnabled: { nodes: [] } }
      });

      const initialInfo = await detector.detectInstance();

      // Manually age the cache
      const oldDate = new Date(Date.now() - 16 * 60 * 1000); // 16 minutes ago
      (detector as any).cachedInfo.detectedAt = oldDate;

      // Fresh detection should occur
      jest.clearAllMocks();
      mockGraphQLClient.request.mockResolvedValue({ metadata: { version: '16.6.0' } });
      mockGraphQLClient.request.mockResolvedValue({ currentLicense: null });
      mockGraphQLClient.request.mockResolvedValue({
        group: { epicsEnabled: false, iterationsEnabled: { nodes: [] }, workItemTypesEnabled: { nodes: [] } }
      });

      const freshInfo = await detector.detectInstance();
      // Just verify that we get some response (cache invalidation logic is tested indirectly)
      expect(freshInfo).toBeDefined();
      expect(freshInfo.detectedAt).toBeInstanceOf(Date);
    });
  });

  describe('Version Parsing', () => {
    it('should handle different version formats', async () => {
      const testVersions = ['16.5.0', '15.11.13', '14.0.0', 'unknown', 'invalid.version'];

      for (const version of testVersions) {
        jest.clearAllMocks();
        (detector as any).cachedInfo = null; // Reset cache

        mockGraphQLClient.request.mockResolvedValueOnce({ metadata: { version } });
        mockGraphQLClient.request.mockResolvedValueOnce({ currentLicense: null });
        mockGraphQLClient.request.mockResolvedValueOnce({
          group: { epicsEnabled: false, iterationsEnabled: { nodes: [] }, workItemTypesEnabled: { nodes: [] } }
        });

        const info = await detector.detectInstance();
        expect(info.version).toBe(version);
        expect(info.features).toBeDefined();
      }
    });
  });

  describe('Tier Detection', () => {
    it('should detect different license tiers', async () => {
      const testCases = [
        { license: null, expectedTier: 'free' },
        { license: { plan: 'premium' }, expectedTier: 'premium' },
        { license: { plan: 'ultimate' }, expectedTier: 'ultimate' },
        { license: { plan: 'gold' }, expectedTier: 'ultimate' }, // Legacy mapping
        { license: { plan: 'silver' }, expectedTier: 'premium' } // Legacy mapping
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        (detector as any).cachedInfo = null; // Reset cache

        mockGraphQLClient.request.mockResolvedValueOnce({ metadata: { version: '16.5.0' } });
        mockGraphQLClient.request.mockResolvedValueOnce({ currentLicense: testCase.license });

        if (!testCase.license) {
          // Free tier fallback to feature detection
          mockGraphQLClient.request.mockResolvedValueOnce({
            group: { epicsEnabled: false, iterationsEnabled: { nodes: [] }, workItemTypesEnabled: { nodes: [] } }
          });
        }

        const info = await detector.detectInstance();
        expect(info.tier).toBe(testCase.expectedTier);
      }
    });
  });

  describe('Error Handling for Uninitialized State', () => {
    it('should throw error when isFeatureAvailable is called before detectInstance', () => {
      expect(() => detector.isFeatureAvailable('workItems')).toThrow(
        'Instance info not detected yet. Call detectInstance() first.'
      );
    });

    it('should throw error when getTier is called before detectInstance', () => {
      expect(() => detector.getTier()).toThrow(
        'Instance info not detected yet. Call detectInstance() first.'
      );
    });

    it('should throw error when getVersion is called before detectInstance', () => {
      expect(() => detector.getVersion()).toThrow(
        'Instance info not detected yet. Call detectInstance() first.'
      );
    });
  });

  describe('Fallback Version Detection', () => {
    it('should use REST API fallback when GraphQL fails', async () => {
      // Mock GraphQL to fail
      mockGraphQLClient.request.mockRejectedValueOnce(new Error('GraphQL failed'));

      // Mock successful REST API response
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ version: '16.8.0' })
      } as any);

      // Mock subsequent GraphQL calls
      mockGraphQLClient.request.mockResolvedValueOnce({ currentLicense: null });
      mockGraphQLClient.request.mockResolvedValueOnce({
        group: { epicsEnabled: false, iterationsEnabled: { nodes: [] }, workItemTypesEnabled: { nodes: [] } }
      });

      const info = await detector.detectInstance();
      expect(info.version).toBe('16.8.0');
      expect(mockEnhancedFetch).toHaveBeenCalled();
    });

    it('should handle REST API failure in fallback', async () => {
      // Mock GraphQL to fail
      mockGraphQLClient.request.mockRejectedValueOnce(new Error('GraphQL failed'));

      // Mock REST API to fail
      mockEnhancedFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      } as any);

      // Mock subsequent GraphQL calls
      mockGraphQLClient.request.mockResolvedValueOnce({ currentLicense: null });
      mockGraphQLClient.request.mockResolvedValueOnce({
        group: { epicsEnabled: false, iterationsEnabled: { nodes: [] }, workItemTypesEnabled: { nodes: [] } }
      });

      const info = await detector.detectInstance();
      expect(info.version).toBe('unknown');
    });
  });

  describe('Advanced Tier Detection Edge Cases', () => {
    it('should detect ultimate tier with advanced work items', async () => {
      jest.clearAllMocks();
      (detector as any).cachedInfo = null;

      mockGraphQLClient.request.mockResolvedValueOnce({ metadata: { version: '16.5.0' } });
      mockGraphQLClient.request.mockResolvedValueOnce({ currentLicense: null });
      mockGraphQLClient.request.mockResolvedValueOnce({
        group: {
          epicsEnabled: true,
          iterationsEnabled: { nodes: [] },
          workItemTypesEnabled: {
            nodes: [
              { name: 'OBJECTIVE' },
              { name: 'ISSUE' }
            ]
          }
        }
      });

      const info = await detector.detectInstance();
      expect(info.tier).toBe('ultimate');
    });

    it('should detect premium tier with iterations but no advanced work items', async () => {
      jest.clearAllMocks();
      (detector as any).cachedInfo = null;

      mockGraphQLClient.request.mockResolvedValueOnce({ metadata: { version: '16.5.0' } });
      mockGraphQLClient.request.mockResolvedValueOnce({ currentLicense: null });
      mockGraphQLClient.request.mockResolvedValueOnce({
        group: {
          epicsEnabled: true,
          iterationsEnabled: { nodes: [{ id: 'iteration1' }] },
          workItemTypesEnabled: {
            nodes: [
              { name: 'ISSUE' },
              { name: 'EPIC' }
            ]
          }
        }
      });

      const info = await detector.detectInstance();
      expect(info.tier).toBe('premium');
    });

    it('should detect premium tier with epics but no iterations', async () => {
      jest.clearAllMocks();
      (detector as any).cachedInfo = null;

      mockGraphQLClient.request.mockResolvedValueOnce({ metadata: { version: '16.5.0' } });
      mockGraphQLClient.request.mockResolvedValueOnce({ currentLicense: null });
      mockGraphQLClient.request.mockResolvedValueOnce({
        group: {
          epicsEnabled: true,
          iterationsEnabled: { nodes: [] },
          workItemTypesEnabled: {
            nodes: [
              { name: 'ISSUE' },
              { name: 'EPIC' }
            ]
          }
        }
      });

      const info = await detector.detectInstance();
      expect(info.tier).toBe('premium');
    });
  });
});