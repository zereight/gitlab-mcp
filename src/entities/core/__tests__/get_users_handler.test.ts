import { coreToolRegistry } from '../registry';
import { smartUserSearch } from '../../../utils/smart-user-search';
import { enhancedFetch } from '../../../utils/fetch';

// Mock dependencies
jest.mock('../../../utils/smart-user-search', () => ({
  smartUserSearch: jest.fn(),
}));

jest.mock('../../../utils/fetch', () => ({
  enhancedFetch: jest.fn(),
}));

const mockSmartUserSearch = smartUserSearch as jest.MockedFunction<typeof smartUserSearch>;
const mockEnhancedFetch = enhancedFetch as jest.MockedFunction<typeof enhancedFetch>;

// Mock environment variables
const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    GITLAB_API_URL: 'https://gitlab.example.com',
    GITLAB_TOKEN: 'test-token-12345',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  mockSmartUserSearch.mockReset();
  mockEnhancedFetch.mockReset();
});

describe('get_users handler smart search logic', () => {
  const getUsersHandler = coreToolRegistry.get('get_users')?.handler;

  if (!getUsersHandler) {
    throw new Error('get_users handler not found in registry');
  }

  const mockApiResponse = (users: unknown[]) => {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(users),
    } as any);
  };

  const mockSmartSearchResult = {
    users: [{ id: 1, username: 'testuser' }],
    searchMetadata: {
      query: 'test',
      pattern: { type: 'username' as const, hasTransliteration: false, originalQuery: 'test' },
      searchPhases: [],
      totalApiCalls: 1,
    },
  };

  describe('AUTO-ENABLED smart search scenarios', () => {
    it('should auto-enable smart search when only "search" parameter provided', async () => {
      mockSmartUserSearch.mockResolvedValueOnce(mockSmartSearchResult);

      await getUsersHandler({ search: 'ivan' });

      expect(mockSmartUserSearch).toHaveBeenCalledWith('ivan', { per_page: 20 });
      expect(mockEnhancedFetch).not.toHaveBeenCalled();
    });

    it('should auto-enable smart search for search with other filter params', async () => {
      mockSmartUserSearch.mockResolvedValueOnce(mockSmartSearchResult);

      await getUsersHandler({
        search: 'ivan',
        active: true,
        humans: true,
        page: 1,
        per_page: 10,
      });

      expect(mockSmartUserSearch).toHaveBeenCalledWith('ivan', {
        active: true,
        humans: true,
        page: 1,
        per_page: 10,
      });
      expect(mockEnhancedFetch).not.toHaveBeenCalled();
    });
  });

  describe('LEGACY behavior scenarios', () => {
    it('should use legacy API when only "username" parameter provided', async () => {
      const mockUsers = [{ id: 1, username: 'ivan' }];
      mockEnhancedFetch.mockResolvedValueOnce(mockApiResponse(mockUsers));

      const result = await getUsersHandler({ username: 'ivan' });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining('username=ivan'),
        expect.any(Object),
      );
      expect(mockSmartUserSearch).not.toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });

    it('should use legacy API when only "public_email" parameter provided', async () => {
      const mockUsers = [{ id: 1, email: 'test@example.com' }];
      mockEnhancedFetch.mockResolvedValueOnce(mockApiResponse(mockUsers));

      const result = await getUsersHandler({ public_email: 'test@example.com' });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining('public_email=test%40example.com'),
        expect.any(Object),
      );
      expect(mockSmartUserSearch).not.toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });

    it('should use legacy API when both "search" and "username" provided', async () => {
      const mockUsers = [{ id: 1, username: 'ivan' }];
      mockEnhancedFetch.mockResolvedValueOnce(mockApiResponse(mockUsers));

      await getUsersHandler({ search: 'ivan', username: 'exact_user' });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=ivan'),
        expect.any(Object),
      );
      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining('username=exact_user'),
        expect.any(Object),
      );
      expect(mockSmartUserSearch).not.toHaveBeenCalled();
    });

    it('should use legacy API when both "search" and "public_email" provided', async () => {
      const mockUsers = [{ id: 1, email: 'test@example.com' }];
      mockEnhancedFetch.mockResolvedValueOnce(mockApiResponse(mockUsers));

      await getUsersHandler({
        search: 'ivan',
        public_email: 'test@example.com',
      });

      expect(mockEnhancedFetch).toHaveBeenCalled();
      expect(mockSmartUserSearch).not.toHaveBeenCalled();
    });
  });

  describe('EXPLICIT smart_search parameter scenarios', () => {
    it('should disable smart search when search + smart_search=false', async () => {
      const mockUsers = [{ id: 1, username: 'ivan' }];
      mockEnhancedFetch.mockResolvedValueOnce(mockApiResponse(mockUsers));

      await getUsersHandler({
        search: 'ivan',
        smart_search: false,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=ivan'),
        expect.any(Object),
      );
      expect(mockSmartUserSearch).not.toHaveBeenCalled();
    });

    it('should enable smart search when username + smart_search=true', async () => {
      mockSmartUserSearch.mockResolvedValueOnce(mockSmartSearchResult);

      await getUsersHandler({
        username: 'ivan',
        smart_search: true,
      });

      expect(mockSmartUserSearch).toHaveBeenCalledWith('ivan', { per_page: 20 });
      expect(mockEnhancedFetch).not.toHaveBeenCalled();
    });

    it('should enable smart search when public_email + smart_search=true', async () => {
      mockSmartUserSearch.mockResolvedValueOnce(mockSmartSearchResult);

      await getUsersHandler({
        public_email: 'test@example.com',
        smart_search: true,
      });

      expect(mockSmartUserSearch).toHaveBeenCalledWith('test@example.com', { per_page: 20 });
      expect(mockEnhancedFetch).not.toHaveBeenCalled();
    });

    it('should enable smart search when search + smart_search=true (explicit)', async () => {
      mockSmartUserSearch.mockResolvedValueOnce(mockSmartSearchResult);

      await getUsersHandler({
        search: 'ivan',
        smart_search: true,
      });

      expect(mockSmartUserSearch).toHaveBeenCalledWith('ivan', { per_page: 20 });
      expect(mockEnhancedFetch).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should use legacy API when no search parameters provided', async () => {
      const mockUsers = [{ id: 1, username: 'user1' }];
      mockEnhancedFetch.mockResolvedValueOnce(mockApiResponse(mockUsers));

      await getUsersHandler({ active: true, humans: true });

      expect(mockEnhancedFetch).toHaveBeenCalled();
      expect(mockSmartUserSearch).not.toHaveBeenCalled();
    });

    it('should filter out smart_search parameter from legacy API calls', async () => {
      const mockUsers = [{ id: 1, username: 'ivan' }];
      mockEnhancedFetch.mockResolvedValueOnce(mockApiResponse(mockUsers));

      await getUsersHandler({
        username: 'ivan',
        smart_search: false,
        active: true,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.not.stringContaining('smart_search'),
        expect.any(Object),
      );
      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining('username=ivan'),
        expect.any(Object),
      );
      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining('active=true'),
        expect.any(Object),
      );
    });

    it('should pass through additional parameters to smart search', async () => {
      mockSmartUserSearch.mockResolvedValueOnce(mockSmartSearchResult);

      await getUsersHandler({
        search: 'ivan',
        active: true,
        humans: true,
        created_after: '2024-01-01T00:00:00Z',
      });

      expect(mockSmartUserSearch).toHaveBeenCalledWith('ivan', {
        active: true,
        humans: true,
        created_after: '2024-01-01T00:00:00Z',
        per_page: 20,
      });
    });
  });
});
