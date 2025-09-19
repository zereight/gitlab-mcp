import { workitemsToolRegistry, getWorkitemsReadOnlyToolNames, getWorkitemsToolDefinitions, getFilteredWorkitemsTools } from '../../../../src/entities/workitems/registry';

// Create mock client
const mockClient = {
  request: jest.fn(),
};

// Mock GraphQL client to avoid actual API calls
jest.mock('../../../../src/services/ConnectionManager', () => ({
  ConnectionManager: {
    getInstance: jest.fn(() => ({
      getClient: jest.fn(() => mockClient),
    })),
  },
}));

// Mock work item types utility
jest.mock('../../../../src/utils/workItemTypes', () => ({
  getWorkItemTypes: jest.fn(() => Promise.resolve([
    { id: 'gid://gitlab/WorkItems::Type/1', name: 'Epic' },
    { id: 'gid://gitlab/WorkItems::Type/2', name: 'Issue' },
    { id: 'gid://gitlab/WorkItems::Type/3', name: 'Task' },
  ]))
}));

describe('Workitems Registry', () => {
  describe('Registry Structure', () => {
    it('should be a Map instance', () => {
      expect(workitemsToolRegistry instanceof Map).toBe(true);
    });

    it('should contain expected workitem tools', () => {
      const toolNames = Array.from(workitemsToolRegistry.keys());

      // Check for read-only tools
      expect(toolNames).toContain('list_work_items');
      expect(toolNames).toContain('get_work_item');

      // Check for write tools
      expect(toolNames).toContain('create_work_item');
      expect(toolNames).toContain('update_work_item');
      expect(toolNames).toContain('delete_work_item');
    });

    it('should have tools with valid structure', () => {
      for (const [toolName, tool] of workitemsToolRegistry) {
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
      const toolNames = Array.from(workitemsToolRegistry.keys());
      const uniqueNames = new Set(toolNames);

      expect(toolNames.length).toBe(uniqueNames.size);
    });

    it('should have exactly 5 workitem tools', () => {
      expect(workitemsToolRegistry.size).toBe(5);
    });
  });

  describe('Tool Definitions', () => {
    it('should have proper list_work_items tool', () => {
      const tool = workitemsToolRegistry.get('list_work_items');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('list_work_items');
      expect(tool?.description).toContain('List work items from a namespace');
      expect(tool?.description).toContain('Returns open items by default');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper get_work_item tool', () => {
      const tool = workitemsToolRegistry.get('get_work_item');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_work_item');
      expect(tool?.description).toContain('Get complete work item details by ID');
      expect(tool?.inputSchema).toBeDefined();
    });


    it('should have proper create_work_item tool', () => {
      const tool = workitemsToolRegistry.get('create_work_item');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('create_work_item');
      expect(tool?.description).toContain('Create work items for issue tracking');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper update_work_item tool', () => {
      const tool = workitemsToolRegistry.get('update_work_item');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('update_work_item');
      expect(tool?.description).toContain('Update work item properties for issue/epic management');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper delete_work_item tool', () => {
      const tool = workitemsToolRegistry.get('delete_work_item');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('delete_work_item');
      expect(tool?.description).toContain('Permanently delete work items');
      expect(tool?.inputSchema).toBeDefined();
    });
  });

  describe('Read-Only Tools Function', () => {
    it('should return an array of read-only tool names', () => {
      const readOnlyTools = getWorkitemsReadOnlyToolNames();

      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it('should include expected read-only tools', () => {
      const readOnlyTools = getWorkitemsReadOnlyToolNames();

      expect(readOnlyTools).toContain('list_work_items');
      expect(readOnlyTools).toContain('get_work_item');
    });

    it('should not include write tools', () => {
      const readOnlyTools = getWorkitemsReadOnlyToolNames();

      expect(readOnlyTools).not.toContain('create_work_item');
      expect(readOnlyTools).not.toContain('update_work_item');
      expect(readOnlyTools).not.toContain('delete_work_item');
    });

    it('should return exactly 2 read-only tools', () => {
      const readOnlyTools = getWorkitemsReadOnlyToolNames();

      expect(readOnlyTools).toEqual(['list_work_items', 'get_work_item']);
    });

    it('should return tools that exist in the registry', () => {
      const readOnlyTools = getWorkitemsReadOnlyToolNames();
      const registryKeys = Array.from(workitemsToolRegistry.keys());

      for (const toolName of readOnlyTools) {
        expect(registryKeys).toContain(toolName);
      }
    });
  });

  describe('Workitems Tool Definitions Function', () => {
    it('should return an array of tool definitions', () => {
      const definitions = getWorkitemsToolDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBe(workitemsToolRegistry.size);
    });

    it('should return all tools from registry', () => {
      const definitions = getWorkitemsToolDefinitions();

      expect(definitions.length).toBe(5);
    });

    it('should return tool definitions with proper structure', () => {
      const definitions = getWorkitemsToolDefinitions();

      for (const definition of definitions) {
        expect(definition).toHaveProperty('name');
        expect(definition).toHaveProperty('description');
        expect(definition).toHaveProperty('inputSchema');
        expect(definition).toHaveProperty('handler');
      }
    });
  });

  describe('Filtered Workitems Tools Function', () => {
    it('should return all tools in normal mode', () => {
      const allTools = getFilteredWorkitemsTools(false);
      const allDefinitions = getWorkitemsToolDefinitions();

      expect(allTools.length).toBe(allDefinitions.length);
    });

    it('should return only read-only tools in read-only mode', () => {
      const readOnlyTools = getFilteredWorkitemsTools(true);
      const readOnlyNames = getWorkitemsReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
    });

    it('should filter tools correctly in read-only mode', () => {
      const readOnlyTools = getFilteredWorkitemsTools(true);
      const readOnlyNames = getWorkitemsReadOnlyToolNames();

      for (const tool of readOnlyTools) {
        expect(readOnlyNames).toContain(tool.name);
      }
    });

    it('should not include write tools in read-only mode', () => {
      const readOnlyTools = getFilteredWorkitemsTools(true);
      const writeTools = ['create_work_item', 'update_work_item', 'delete_work_item'];

      for (const tool of readOnlyTools) {
        expect(writeTools).not.toContain(tool.name);
      }
    });

    it('should return exactly 2 tools in read-only mode', () => {
      const readOnlyTools = getFilteredWorkitemsTools(true);

      expect(readOnlyTools.length).toBe(2);
    });
  });

  describe('Tool Handlers', () => {
    it('should have handlers that are async functions', () => {
      for (const [, tool] of workitemsToolRegistry) {
        expect(tool.handler.constructor.name).toBe('AsyncFunction');
      }
    });

    it('should have handlers that accept arguments', () => {
      for (const [, tool] of workitemsToolRegistry) {
        expect(tool.handler.length).toBe(1); // Should accept one argument
      }
    });
  });

  describe('Registry Consistency', () => {
    it('should have all expected workitem tools', () => {
      const expectedTools = [
        'list_work_items',
        'get_work_item',
        'create_work_item',
        'update_work_item',
        'delete_work_item',
      ];

      for (const toolName of expectedTools) {
        expect(workitemsToolRegistry.has(toolName)).toBe(true);
      }
    });

    it('should have consistent tool count between functions', () => {
      const allDefinitions = getWorkitemsToolDefinitions();
      const readOnlyNames = getWorkitemsReadOnlyToolNames();
      const readOnlyTools = getFilteredWorkitemsTools(true);

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(allDefinitions.length).toBe(workitemsToolRegistry.size);
      expect(allDefinitions.length).toBeGreaterThan(readOnlyNames.length);
    });

    it('should have more tools than just read-only ones', () => {
      const totalTools = workitemsToolRegistry.size;
      const readOnlyCount = getWorkitemsReadOnlyToolNames().length;

      expect(totalTools).toBeGreaterThan(readOnlyCount);
      expect(totalTools).toBe(5);
      expect(readOnlyCount).toBe(2);
    });
  });

  describe('Tool Input Schemas', () => {
    it('should have valid JSON schema structure for all tools', () => {
      for (const [, tool] of workitemsToolRegistry) {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
        expect(tool.inputSchema).toHaveProperty('type');
      }
    });

    it('should have consistent schema format', () => {
      for (const [toolName, tool] of workitemsToolRegistry) {
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

  describe('GitLab Namespace Documentation', () => {
    it('should have proper namespace documentation in list_work_items', () => {
      const tool = workitemsToolRegistry.get('list_work_items');

      expect(tool?.description).toContain('List work items from a namespace');
      expect(tool?.description).toContain('Returns open items by default');
    });
  });

  describe('Handler Tests', () => {
    beforeEach(() => {
      // Only reset the request mock, not the entire ConnectionManager mock structure
      mockClient.request.mockReset();
    });

    // Helper function to create complete mock work items
    const createMockWorkItem = (overrides: any = {}) => ({
      id: 'gid://gitlab/WorkItem/1',
      iid: '1',
      title: 'Test Work Item',
      state: 'OPEN',
      workItemType: { id: 'gid://gitlab/WorkItems::Type/8', name: 'Epic' },
      webUrl: 'https://gitlab.example.com/groups/test/-/epics/1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      description: null,
      widgets: [],
      ...overrides
    });

    // Helper function to create mock project
    const createMockProject = (overrides: any = {}) => ({
      id: 'gid://gitlab/Project/1',
      fullPath: 'test-group/test-project',
      archived: false,
      ...overrides
    });

    describe('list_work_items handler', () => {
      it('should execute successfully with valid namespace path', async () => {
        const mockWorkItems = [
          {
            id: 'gid://gitlab/WorkItem/1',
            iid: '1',
            title: 'Epic 1',
            state: 'OPEN',
            workItemType: { id: 'gid://gitlab/WorkItems::Type/8', name: 'Epic' },
            webUrl: 'https://gitlab.example.com/groups/test/-/epics/1',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            widgets: []
          },
          {
            id: 'gid://gitlab/WorkItem/2',
            iid: '2',
            title: 'Epic 2',
            state: 'OPEN',
            workItemType: { id: 'gid://gitlab/WorkItems::Type/8', name: 'Epic' },
            webUrl: 'https://gitlab.example.com/groups/test/-/epics/2',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            widgets: []
          },
        ];

        // Mock namespace work items query
        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: 'Group',
            workItems: {
              nodes: mockWorkItems,
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          },
        });

        const tool = workitemsToolRegistry.get('list_work_items');
        const result = await tool?.handler({ namespacePath: 'test-group' });

        // Verify namespace query was called
        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          {
            namespacePath: 'test-group',
            types: undefined,
            first: 20,
            after: undefined,
          }
        );

        // With simple=true (default), expect simplified structure with converted IDs and types
        const expectedResult = {
          items: [
            {
              id: '1',  // Converted from GID
              iid: '1',
              title: 'Epic 1',
              state: 'OPEN',
              workItemType: 'Epic',  // Converted from object to string
              webUrl: 'https://gitlab.example.com/groups/test/-/epics/1',
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
            },
            {
              id: '2',  // Converted from GID
              iid: '2',
              title: 'Epic 2',
              state: 'OPEN',
              workItemType: 'Epic',  // Converted from object to string
              webUrl: 'https://gitlab.example.com/groups/test/-/epics/2',
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
            }
          ],
          hasMore: false,
          endCursor: null
        };

        expect(result).toEqual(expectedResult);
      });

      it('should return items array structure', async () => {
        const mockWorkItems = [
          {
            id: 'gid://gitlab/WorkItem/1',
            iid: '1',
            title: 'Epic 1',
            state: 'OPEN',
            workItemType: { id: 'gid://gitlab/WorkItems::Type/8', name: 'Epic' },
            webUrl: 'https://gitlab.example.com/groups/test/-/epics/1',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            description: 'Test epic description',
            widgets: [
              {
                type: 'ASSIGNEES',
                assignees: { nodes: [{ id: 'user1', username: 'test', name: 'Test User' }] }
              }
            ]
          }
        ];

        // Mock namespace work items query
        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: 'Group',
            workItems: {
              nodes: mockWorkItems,
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          },
        });

        const tool = workitemsToolRegistry.get('list_work_items');
        const result = await tool?.handler({ namespacePath: 'test-group', simple: false });

        // Expect items array structure
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('hasMore');
        expect(result).toHaveProperty('endCursor');
        expect(Array.isArray((result as any).items)).toBe(true);
      });

      it('should handle custom pagination parameters', async () => {
        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: 'Group',
            workItems: {
              nodes: [],
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          },
        });

        const tool = workitemsToolRegistry.get('list_work_items');
        await tool?.handler({
          namespacePath: 'test-group',
          first: 50,
          after: 'cursor-123',
        });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          {
            namespacePath: 'test-group',
            types: undefined,
            first: 50,
            after: 'cursor-123',
          }
        );
      });

      it('should return empty array when group has no work items', async () => {
        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: 'Group',
            workItems: {
              nodes: [],
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          }
        });

        const tool = workitemsToolRegistry.get('list_work_items');
        const result = await tool?.handler({ namespacePath: 'empty-group' });

        expect(result).toEqual({
          items: [],
          hasMore: false,
          endCursor: null
        });
      });

      it('should handle types parameter', async () => {
        // Mock the work items query with types
        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: 'Group',
            workItems: {
              nodes: [],
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          }
        });

        const tool = workitemsToolRegistry.get('list_work_items');
        await tool?.handler({
          namespacePath: 'test-group',
          types: ['EPIC', 'ISSUE']
        });

        // Should call GraphQL with enum values (NOT converted to GIDs)
        // GraphQL expects EPIC, ISSUE enum values, not GIDs
        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          {
            namespacePath: 'test-group',
            types: ['EPIC', 'ISSUE'],  // Enum values, not GIDs
            first: 20,
            after: undefined,
          }
        );
      });

      it('should validate required parameters', async () => {
        const tool = workitemsToolRegistry.get('list_work_items');

        // Missing namespacePath should throw validation error
        await expect(tool?.handler({})).rejects.toThrow();
      });

      it('should use simplified structure when simple=true', async () => {
        const mockWorkItem = {
          id: 'gid://gitlab/WorkItem/1',
          iid: '1',
          title: 'Test Work Item',
          state: 'OPEN',
          workItemType: { name: 'Issue' },
          webUrl: 'https://gitlab.com/test/1',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          description: 'Test description',
          widgets: [
            {
              type: 'ASSIGNEES',
              assignees: {
                nodes: [{ id: 'gid://gitlab/User/1', username: 'test', name: 'Test User' }]
              }
            },
            {
              type: 'LABELS',
              labels: {
                nodes: [{ id: 'gid://gitlab/Label/1', title: 'bug', color: '#ff0000' }]
              }
            }
          ]
        };

        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: 'Project',
            workItems: {
              nodes: [mockWorkItem],
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          }
        });

        const tool = workitemsToolRegistry.get('list_work_items');
        const result: any = await tool?.handler({
          namespacePath: 'test-project',
          simple: true
        });

        expect(result.items[0]).toEqual({
          id: '1',
          iid: '1',
          title: 'Test Work Item',
          state: 'OPEN',
          workItemType: 'Issue',
          webUrl: 'https://gitlab.com/test/1',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          description: 'Test description',
          widgets: [
            {
              type: 'ASSIGNEES',
              assignees: [{ id: '1', username: 'test', name: 'Test User' }]
            },
            {
              type: 'LABELS',
              labels: [{ id: '1', title: 'bug', color: '#ff0000' }]
            }
          ]
        });
      });

      it('should truncate long descriptions in simplified mode', async () => {
        const longDescription = 'A'.repeat(250); // 250 characters
        const mockWorkItem = {
          id: 'gid://gitlab/WorkItem/1',
          iid: '1',
          title: 'Test Work Item',
          state: 'OPEN',
          workItemType: { name: 'Issue' },
          webUrl: 'https://gitlab.com/test/1',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          description: longDescription,
          widgets: []
        };

        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: 'Project',
            workItems: {
              nodes: [mockWorkItem],
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          }
        });

        const tool = workitemsToolRegistry.get('list_work_items');
        const result: any = await tool?.handler({
          namespacePath: 'test-project',
          simple: true
        });

        expect(result.items[0].description).toBe('A'.repeat(200) + '...');
      });

    });

    describe('get_work_item handler', () => {
      it('should execute successfully with valid work item ID', async () => {
        const mockWorkItem = {
          id: 'gid://gitlab/WorkItem/1',
          title: 'Test Work Item',
          description: 'Test description',
          workItemType: { name: 'Epic' },
        };

        mockClient.request.mockResolvedValueOnce({
          workItem: mockWorkItem,
        });

        const tool = workitemsToolRegistry.get('get_work_item');
        const result = await tool?.handler({ id: '1' });  // Input: simple ID

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          { id: 'gid://gitlab/WorkItem/1' }  // GraphQL gets GID
        );

        // Expect converted format: simple ID and string workItemType
        const expectedResult = {
          id: '1',  // Converted from GID
          title: 'Test Work Item',
          description: 'Test description',
          workItemType: 'Epic',  // Converted from object to string
        };
        expect(result).toEqual(expectedResult);
      });

      it('should handle non-existent work item', async () => {
        mockClient.request.mockResolvedValueOnce({ workItem: null });

        const tool = workitemsToolRegistry.get('get_work_item');

        await expect(tool?.handler({ id: 'gid://gitlab/WorkItem/999' }))
          .rejects.toThrow('Work item with ID "gid://gitlab/WorkItem/999" not found');
      });
    });


    describe('create_work_item handler', () => {
      it('should execute successfully with valid parameters', async () => {
        // Mock the creation mutation (getWorkItemTypes is already mocked at module level)
        const createdWorkItem = {
          id: 'gid://gitlab/WorkItem/123',
          title: 'New Epic',
          workItemType: { name: 'EPIC' },
        };

        mockClient.request.mockResolvedValueOnce({
          workItemCreate: {
            workItem: createdWorkItem,
            errors: []
          }
        });

        const tool = workitemsToolRegistry.get('create_work_item');
        const result = await tool?.handler({
          namespacePath: 'test-group',
          workItemType: 'EPIC',
          title: 'New Epic',
        });

        expect(mockClient.request).toHaveBeenCalledTimes(1);

        // Expect converted format: simple ID and string workItemType
        const expectedResult = {
          id: '123',  // Converted from GID
          title: 'New Epic',
          workItemType: 'EPIC',  // Converted from object to string
        };
        expect(result).toEqual(expectedResult);
      });

      it('should create work item with description', async () => {
        // Mock creation (getWorkItemTypes is already mocked at module level)
        mockClient.request.mockResolvedValueOnce({
          workItemCreate: {
            workItem: {
              id: 'gid://gitlab/WorkItem/124',
              title: 'Epic with Description',
              description: 'Detailed description',
              workItemType: { name: 'EPIC' },
            },
            errors: []
          }
        });

        const tool = workitemsToolRegistry.get('create_work_item');
        await tool?.handler({
          namespacePath: 'test-group',
          workItemType: 'EPIC',
          title: 'Epic with Description',
          description: 'Detailed description',
        });

        expect(mockClient.request).toHaveBeenCalledTimes(1);
      });

      it('should handle creation errors', async () => {
        const tool = workitemsToolRegistry.get('create_work_item');

        await expect(tool?.handler({
          namespacePath: 'test-group',
          workItemType: 'INVALID_TYPE',
          title: 'Failed Epic',
        })).rejects.toThrow();
      });
    });

    describe('update_work_item handler', () => {
      it('should execute successfully with valid parameters', async () => {
        const updatedWorkItem = {
          id: 'gid://gitlab/WorkItem/123',
          title: 'Updated Epic',
        };

        mockClient.request.mockResolvedValueOnce({
          workItemUpdate: {
            workItem: updatedWorkItem,
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get('update_work_item');
        const result = await tool?.handler({
          id: '123',  // Input: simple ID
          title: 'Updated Epic',
        });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            input: expect.objectContaining({
              id: 'gid://gitlab/WorkItem/123',  // GraphQL gets GID
              title: 'Updated Epic',
            }),
          })
        );

        // Expect converted format: simple ID
        const expectedResult = {
          id: '123',  // Converted from GID
          title: 'Updated Epic',
        };
        expect(result).toEqual(expectedResult);
      });

      it('should handle update with multiple fields', async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemUpdate: {
            workItem: { id: 'gid://gitlab/WorkItem/123' },
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get('update_work_item');
        await tool?.handler({
          id: 'gid://gitlab/WorkItem/123',
          title: 'Updated Title',
          description: 'Updated description',
        });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            input: expect.objectContaining({
              id: 'gid://gitlab/WorkItem/123',
              title: 'Updated Title',
              descriptionWidget: { description: 'Updated description' },
            })
          })
        );
      });
    });

    describe('delete_work_item handler', () => {
      it('should execute successfully with valid work item ID', async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemDelete: { errors: [] },
        });

        const tool = workitemsToolRegistry.get('delete_work_item');
        const result = await tool?.handler({ id: 'gid://gitlab/WorkItem/123' });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          { id: 'gid://gitlab/WorkItem/123' }
        );
        expect(result).toEqual({ deleted: true });
      });

      it('should handle deletion errors', async () => {
        mockClient.request.mockRejectedValueOnce(new Error('Deletion failed'));

        const tool = workitemsToolRegistry.get('delete_work_item');

        await expect(tool?.handler({ id: 'gid://gitlab/WorkItem/123' }))
          .rejects.toThrow('Deletion failed');
      });
    });

    describe('Error Handling', () => {
      it('should handle GraphQL client errors gracefully', async () => {
        mockClient.request.mockRejectedValueOnce(new Error('Network error'));

        const tool = workitemsToolRegistry.get('list_work_items');

        // Should throw the error, not return empty array
        await expect(tool?.handler({ namespacePath: 'test-group' })).rejects.toThrow('Network error');
      });

      it('should handle work item type not found error in create_work_item', async () => {
        const tool = workitemsToolRegistry.get('create_work_item');

        // Use a work item type that passes schema validation but isn't in our mocked getWorkItemTypes
        // Our mock only has Epic, Issue, Task - but INCIDENT is schema-valid
        await expect(tool?.handler({
          namespacePath: 'test-group',
          workItemType: 'INCIDENT',
          title: 'Test Epic',
        })).rejects.toThrow('Work item type "INCIDENT" not found in namespace "test-group"');
      });

      it('should handle GraphQL errors in create_work_item mutation', async () => {
        // Mock creation mutation with errors (getWorkItemTypes is mocked at module level)
        mockClient.request.mockResolvedValueOnce({
          workItemCreate: {
            workItem: null,
            errors: ['Validation failed', 'Title is required']
          }
        });

        const tool = workitemsToolRegistry.get('create_work_item');

        await expect(tool?.handler({
          namespacePath: 'test-group',
          workItemType: 'EPIC',
          title: '',
        })).rejects.toThrow('GitLab GraphQL errors: Validation failed, Title is required');
      });

      it('should handle empty work item creation response', async () => {
        // Mock work item types query
        mockClient.request.mockResolvedValueOnce({
          namespace: {
            workItemTypes: {
              nodes: [{ id: 'gid://gitlab/WorkItems::Type/1', name: 'EPIC' }]
            }
          }
        });

        // Mock creation mutation with no work item returned
        mockClient.request.mockResolvedValueOnce({
          workItemCreate: {
            workItem: null,
            errors: []
          }
        });

        const tool = workitemsToolRegistry.get('create_work_item');

        await expect(tool?.handler({
          namespacePath: 'test-group',
          workItemType: 'EPIC',
          title: 'Test Epic',
        })).rejects.toThrow('Work item creation failed - no work item returned');
      });

      it('should handle GraphQL errors in update_work_item', async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemUpdate: {
            workItem: null,
            errors: ['Permission denied', 'Work item not found']
          }
        });

        const tool = workitemsToolRegistry.get('update_work_item');

        await expect(tool?.handler({
          id: 'gid://gitlab/WorkItem/999',
          title: 'Updated Title',
        })).rejects.toThrow('GitLab GraphQL errors: Permission denied, Work item not found');
      });

      it('should handle empty update response', async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemUpdate: {
            workItem: null,
            errors: []
          }
        });

        const tool = workitemsToolRegistry.get('update_work_item');

        await expect(tool?.handler({
          id: 'gid://gitlab/WorkItem/123',
          title: 'Updated Title',
        })).rejects.toThrow('Work item update failed - no work item returned');
      });

      it('should handle GraphQL errors in delete_work_item', async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemDelete: {
            errors: ['Permission denied', 'Work item cannot be deleted']
          }
        });

        const tool = workitemsToolRegistry.get('delete_work_item');

        await expect(tool?.handler({
          id: 'gid://gitlab/WorkItem/123',
        })).rejects.toThrow('GitLab GraphQL errors: Permission denied, Work item cannot be deleted');
      });

      it('should handle schema validation errors', async () => {
        const tool = workitemsToolRegistry.get('list_work_items');

        // Missing required namespacePath
        await expect(tool?.handler({})).rejects.toThrow();

        // Invalid types format
        await expect(tool?.handler({
          namespacePath: 'test-group',
          types: 'INVALID_FORMAT' // Should be array
        })).rejects.toThrow();

        // Invalid parameter types
        await expect(tool?.handler({ namespacePath: 123 })).rejects.toThrow();
      });
    });

  });
});