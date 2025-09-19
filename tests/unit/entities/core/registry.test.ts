import { coreToolRegistry, getCoreReadOnlyToolNames, getCoreToolDefinitions, getFilteredCoreTools } from '../../../../src/entities/core/registry';
import { enhancedFetch } from '../../../../src/utils/fetch';

// Mock the fetch function to avoid actual API calls
jest.mock('../../../../src/utils/fetch', () => ({
  enhancedFetch: jest.fn(),
}));

const mockEnhancedFetch = enhancedFetch as jest.MockedFunction<typeof enhancedFetch>;

// Mock environment variables
const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    GITLAB_API_URL: 'https://gitlab.example.com',
    GITLAB_TOKEN: 'test-token-12345'
  };
});

afterAll(() => {
  process.env = originalEnv;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  mockEnhancedFetch.mockReset();
});

describe('Core Registry', () => {
  describe('Registry Structure', () => {
    it('should be a Map instance', () => {
      expect(coreToolRegistry instanceof Map).toBe(true);
    });

    it('should contain expected core tools', () => {
      const toolNames = Array.from(coreToolRegistry.keys());

      // Check for essential read-only tools
      expect(toolNames).toContain('search_repositories');
      expect(toolNames).toContain('list_projects');
      expect(toolNames).toContain('get_project');
      expect(toolNames).toContain('list_namespaces');
      expect(toolNames).toContain('get_users');

      // Check for write tools
      expect(toolNames).toContain('create_repository');
      expect(toolNames).toContain('fork_repository');
      expect(toolNames).toContain('create_branch');
    });

    it('should have tools with valid structure', () => {
      for (const [toolName, tool] of coreToolRegistry) {
        expect(tool).toHaveProperty('name', toolName);
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('handler');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.handler).toBe('function');
        expect(tool.description.length).toBeGreaterThan(0);
      }
    });

    it('should have unique tool names', () => {
      const toolNames = Array.from(coreToolRegistry.keys());
      const uniqueNames = new Set(toolNames);

      expect(toolNames.length).toBe(uniqueNames.size);
    });

    it('should have substantial number of tools', () => {
      expect(coreToolRegistry.size).toBeGreaterThan(10);
    });
  });

  describe('Tool Definitions', () => {
    it('should have proper search_repositories tool', () => {
      const tool = coreToolRegistry.get('search_repositories');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('search_repositories');
      expect(tool?.description).toContain('DISCOVER projects');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper list_projects tool', () => {
      const tool = coreToolRegistry.get('list_projects');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('list_projects');
      expect(tool?.description).toContain('List GitLab projects with flexible scoping');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper get_project tool', () => {
      const tool = coreToolRegistry.get('get_project');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_project');
      expect(tool?.description).toContain('GET DETAILS');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper create_repository tool', () => {
      const tool = coreToolRegistry.get('create_repository');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('create_repository');
      expect(tool?.description).toContain('CREATE NEW');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper fork_repository tool', () => {
      const tool = coreToolRegistry.get('fork_repository');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('fork_repository');
      expect(tool?.description).toContain('FORK');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper verify_namespace tool', () => {
      const tool = coreToolRegistry.get('verify_namespace');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('verify_namespace');
      expect(tool?.description).toContain('CHECK EXISTS');
      expect(tool?.inputSchema).toBeDefined();
    });
  });

  describe('Read-Only Tools Function', () => {
    it('should return an array of read-only tool names', () => {
      const readOnlyTools = getCoreReadOnlyToolNames();

      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it('should include expected read-only tools', () => {
      const readOnlyTools = getCoreReadOnlyToolNames();

      expect(readOnlyTools).toContain('search_repositories');
      expect(readOnlyTools).toContain('list_projects');
      expect(readOnlyTools).toContain('get_project');
      expect(readOnlyTools).toContain('list_namespaces');
      expect(readOnlyTools).toContain('get_users');
    });

    it('should not include write tools', () => {
      const readOnlyTools = getCoreReadOnlyToolNames();

      expect(readOnlyTools).not.toContain('create_repository');
      expect(readOnlyTools).not.toContain('fork_repository');
      expect(readOnlyTools).not.toContain('create_branch');
    });

    it('should return tools that exist in the registry', () => {
      const readOnlyTools = getCoreReadOnlyToolNames();
      const registryKeys = Array.from(coreToolRegistry.keys());

      for (const toolName of readOnlyTools) {
        expect(registryKeys).toContain(toolName);
      }
    });
  });

  describe('Core Tool Definitions Function', () => {
    it('should return an array of tool definitions', () => {
      const definitions = getCoreToolDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBe(coreToolRegistry.size);
    });

    it('should return all tools from registry', () => {
      const definitions = getCoreToolDefinitions();
      const registrySize = coreToolRegistry.size;

      expect(definitions.length).toBe(registrySize);
    });

    it('should return tool definitions with proper structure', () => {
      const definitions = getCoreToolDefinitions();

      for (const definition of definitions) {
        expect(definition).toHaveProperty('name');
        expect(definition).toHaveProperty('description');
        expect(definition).toHaveProperty('inputSchema');
        expect(definition).toHaveProperty('handler');
      }
    });
  });

  describe('Filtered Core Tools Function', () => {
    it('should return all tools in normal mode', () => {
      const allTools = getFilteredCoreTools(false);
      const allDefinitions = getCoreToolDefinitions();

      expect(allTools.length).toBe(allDefinitions.length);
    });

    it('should return only read-only tools in read-only mode', () => {
      const readOnlyTools = getFilteredCoreTools(true);
      const readOnlyNames = getCoreReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
    });

    it('should filter tools correctly in read-only mode', () => {
      const readOnlyTools = getFilteredCoreTools(true);
      const readOnlyNames = getCoreReadOnlyToolNames();

      for (const tool of readOnlyTools) {
        expect(readOnlyNames).toContain(tool.name);
      }
    });

    it('should not include write tools in read-only mode', () => {
      const readOnlyTools = getFilteredCoreTools(true);
      const writeTools = ['create_repository', 'fork_repository', 'create_branch'];

      for (const tool of readOnlyTools) {
        expect(writeTools).not.toContain(tool.name);
      }
    });
  });

  describe('Tool Handlers', () => {
    it('should have handlers that are async functions', () => {
      for (const [, tool] of coreToolRegistry) {
        expect(tool.handler.constructor.name).toBe('AsyncFunction');
      }
    });

    it('should have handlers that accept arguments', () => {
      for (const [, tool] of coreToolRegistry) {
        expect(tool.handler.length).toBe(1); // Should accept one argument
      }
    });
  });

  describe('Registry Consistency', () => {
    it('should have all expected essential tools', () => {
      const essentialTools = [
        'search_repositories',
        'list_projects',
        'get_project',
        'list_namespaces',
        'get_users',
        'create_repository',
        'fork_repository',
      ];

      for (const toolName of essentialTools) {
        expect(coreToolRegistry.has(toolName)).toBe(true);
      }
    });

    it('should have consistent tool count between functions', () => {
      const allDefinitions = getCoreToolDefinitions();
      const readOnlyNames = getCoreReadOnlyToolNames();
      const readOnlyTools = getFilteredCoreTools(true);

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(allDefinitions.length).toBe(coreToolRegistry.size);
      expect(allDefinitions.length).toBeGreaterThan(readOnlyNames.length);
    });

    it('should have more tools than just read-only ones', () => {
      const totalTools = coreToolRegistry.size;
      const readOnlyCount = getCoreReadOnlyToolNames().length;

      expect(totalTools).toBeGreaterThan(readOnlyCount);
    });
  });

  describe('Tool Input Schemas', () => {
    it('should have valid JSON schema structure for all tools', () => {
      for (const [, tool] of coreToolRegistry) {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
        expect(tool.inputSchema).toHaveProperty('type');
      }
    });

    it('should have consistent schema format', () => {
      for (const [toolName, tool] of coreToolRegistry) {
        expect(tool.inputSchema).toBeDefined();

        // Schema should be an object with type property
        if (typeof tool.inputSchema === 'object' && tool.inputSchema !== null) {
          expect(tool.inputSchema).toHaveProperty('type');
        } else {
          throw new Error(`Tool ${toolName} has invalid inputSchema type`);
        }
      }
    });
  });

  describe('Handler Tests', () => {
    describe('search_repositories Handler', () => {
      it('should return minimal project structure for token efficiency', async () => {
        const mockApiResponse = [
          {
            id: 1,
            name: 'test-project',
            path_with_namespace: 'group/test-project',
            description: 'A test project',
            web_url: 'https://gitlab.example.com/group/test-project',
            visibility: 'private',
            default_branch: 'main',
            last_activity_at: '2025-01-01T00:00:00Z',
            archived: false,
            empty_repo: false,
            namespace: {
              id: 10,
              name: 'Test Group',
              path: 'group',
              kind: 'group',
              full_path: 'group',
              parent_id: null,
              avatar_url: null,
              web_url: 'https://gitlab.example.com/groups/group'
            },
            created_at: '2024-01-01T00:00:00Z',
            _links: { self: 'https://gitlab.example.com/api/v4/projects/1' },
            repository_storage: 'default',
            container_registry_image_prefix: 'registry.example.com/group/test-project',
            ci_default_git_depth: 20,
            permissions: { project_access: null, group_access: { access_level: 50 } }
          }
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse)
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        expect(tool).toBeDefined();

        const result = await tool!.handler({ q: 'test' });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects?search=test&per_page=20&active=true',
          {
            headers: {
              Authorization: 'Bearer test-token-12345',
            },
          }
        );

        expect(result).toEqual([
          {
            id: 1,
            name: 'test-project',
            path_with_namespace: 'group/test-project',
            description: 'A test project',
          }
        ]);
      });

      it('should handle empty results', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([])
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        const result = await tool!.handler({ q: 'nonexistent' });

        expect(result).toEqual([]);
      });

      it('should handle API errors gracefully', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        } as any);

        const tool = coreToolRegistry.get('search_repositories');

        await expect(tool!.handler({ q: 'test' })).rejects.toThrow(
          'GitLab API error: 401 Unauthorized'
        );
      });

      it('should exclude all non-essential fields from response', async () => {
        const mockApiResponse = [
          {
            id: 1,
            name: 'test-project',
            path_with_namespace: 'group/test-project',
            description: 'A test project',
            web_url: 'https://gitlab.example.com/group/test-project',
            visibility: 'private',
            // These fields should be excluded from minimal response
            default_branch: 'main',
            last_activity_at: '2025-01-01T00:00:00Z',
            archived: false,
            empty_repo: false,
            created_at: '2024-01-01T00:00:00Z',
            forks_count: 0,
            star_count: 0,
            namespace: {
              id: 10,
              name: 'Test Group',
              path: 'group',
              kind: 'group'
            },
            _links: { self: 'https://gitlab.example.com/api/v4/projects/1' },
            permissions: { project_access: null },
            ci_default_git_depth: 20,
            repository_storage: 'default'
          }
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse)
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        const result = await tool!.handler({ q: 'test' }) as any[];

        expect(result).toHaveLength(1);
        const project = result[0];

        // Should only have these 4 essential fields
        expect(Object.keys(project)).toEqual([
          'id',
          'name',
          'path_with_namespace',
          'description'
        ]);

        // Should NOT have any other fields
        expect(project).not.toHaveProperty('web_url');
        expect(project).not.toHaveProperty('visibility');
        expect(project).not.toHaveProperty('default_branch');
        expect(project).not.toHaveProperty('last_activity_at');
        expect(project).not.toHaveProperty('archived');
        expect(project).not.toHaveProperty('empty_repo');
        expect(project).not.toHaveProperty('namespace');
        expect(project).not.toHaveProperty('created_at');
        expect(project).not.toHaveProperty('_links');
        expect(project).not.toHaveProperty('permissions');
      });

      it('should pass through search parameters correctly', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([])
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        await tool!.handler({
          with_programming_language: 'javascript',
          order_by: 'updated_at',
          sort: 'desc'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects?with_programming_language=javascript&order_by=updated_at&sort=desc&per_page=20&active=true',
          {
            headers: {
              Authorization: 'Bearer test-token-12345',
            },
          }
        );
      });

      it('should automatically filter out archived and deletion-scheduled projects', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([])
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        await tool!.handler({ q: 'any-search' });

        // Verify that active=true is always added to filter out archived and deletion-scheduled projects
        const expectedUrl = expect.stringContaining('active=true');
        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expectedUrl,
          expect.any(Object)
        );
      });

      it('should return only minimal essential fields for maximum token efficiency', async () => {
        const mockApiResponse = [
          {
            id: 123,
            name: 'minimal-project',
            path_with_namespace: 'org/minimal-project',
            description: 'Essential data only',
            // These should be filtered out
            web_url: 'https://gitlab.example.com/org/minimal-project',
            visibility: 'public',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-12-01T00:00:00Z',
            last_activity_at: '2024-12-01T00:00:00Z',
            default_branch: 'main',
            archived: false,
            forks_count: 5,
            star_count: 10,
            namespace: { id: 1, name: 'org', path: 'org' }
          }
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse)
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        const result = await tool!.handler({ q: 'minimal' }) as any[];

        expect(result).toEqual([
          {
            id: 123,
            name: 'minimal-project',
            path_with_namespace: 'org/minimal-project',
            description: 'Essential data only',
          }
        ]);

        // Verify exactly 4 fields and no more
        expect(Object.keys(result[0])).toHaveLength(4);
      });

      it('should use direct with_programming_language parameter efficiently', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([])
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        await tool!.handler({ with_programming_language: 'javascript' });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects?with_programming_language=javascript&per_page=20&active=true',
          {
            headers: {
              Authorization: 'Bearer test-token-12345',
            },
          }
        );
      });

      it('should parse language: operator from q parameter for backward compatibility', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([])
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        await tool!.handler({ q: 'language:javascript' });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects?with_programming_language=javascript&per_page=20&active=true',
          {
            headers: {
              Authorization: 'Bearer test-token-12345',
            },
          }
        );
      });

      it('should parse language: operator with additional search terms', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([])
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        await tool!.handler({ q: 'language:python test project' });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects?with_programming_language=python&search=test%2Bproject&per_page=20&active=true',
          {
            headers: {
              Authorization: 'Bearer test-token-12345',
            },
          }
        );
      });

      it('should combine with_programming_language parameter with search terms', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([])
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        await tool!.handler({
          q: 'test project',
          with_programming_language: 'python'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects?with_programming_language=python&search=test%2Bproject&per_page=20&active=true',
          {
            headers: {
              Authorization: 'Bearer test-token-12345',
            },
          }
        );
      });

      it('should prioritize direct with_programming_language over q parameter language operator', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([])
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        await tool!.handler({
          q: 'language:javascript test',
          with_programming_language: 'python'
        });

        // Should use python from direct parameter, not javascript from q
        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects?with_programming_language=python&search=language%3Ajavascript%2Btest&per_page=20&active=true',
          {
            headers: {
              Authorization: 'Bearer test-token-12345',
            },
          }
        );
      });

      it('should parse user: operator and convert to owned parameter', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([])
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        await tool!.handler({ q: 'user:johndoe test project' });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects?owned=true&search=test%2Bproject&per_page=20&active=true',
          {
            headers: {
              Authorization: 'Bearer test-token-12345',
            },
          }
        );
      });

      it('should parse topic: operator and convert to topic parameter', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([])
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        await tool!.handler({ q: 'topic:devops test project' });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects?topic=devops&search=test%2Bproject&per_page=20&active=true',
          {
            headers: {
              Authorization: 'Bearer test-token-12345',
            },
          }
        );
      });

      it('should parse multiple topic: operators', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([])
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        await tool!.handler({ q: 'topic:devops topic:kubernetes project' });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects?topic=devops%2Ckubernetes&search=project&per_page=20&active=true',
          {
            headers: {
              Authorization: 'Bearer test-token-12345',
            },
          }
        );
      });

      it('should combine multiple operators efficiently', async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([])
        } as any);

        const tool = coreToolRegistry.get('search_repositories');
        await tool!.handler({ q: 'language:javascript user:johndoe topic:frontend test app' });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects?owned=true&topic=frontend&with_programming_language=javascript&search=test%2Bapp&per_page=20&active=true',
          {
            headers: {
              Authorization: 'Bearer test-token-12345',
            },
          }
        );
      });
    });
  });
});