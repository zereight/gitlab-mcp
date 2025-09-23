import { milestonesToolRegistry, getMilestonesReadOnlyToolNames, getMilestonesToolDefinitions, getFilteredMilestonesTools } from '../../../../src/entities/milestones/registry';
import { enhancedFetch } from '../../../../src/utils/fetch';

// Mock enhancedFetch to avoid actual API calls
jest.mock('../../../../src/utils/fetch', () => ({
  enhancedFetch: jest.fn()
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
  // Reset the mock for proper isolation
  mockEnhancedFetch.mockReset();
});

describe('Milestones Registry', () => {
  describe('Registry Structure', () => {
    it('should be a Map instance', () => {
      expect(milestonesToolRegistry instanceof Map).toBe(true);
    });

    it('should contain expected milestone tools', () => {
      const toolNames = Array.from(milestonesToolRegistry.keys());

      // Check for read-only tools
      expect(toolNames).toContain('list_milestones');
      expect(toolNames).toContain('get_milestone');
      expect(toolNames).toContain('get_milestone_issue');
      expect(toolNames).toContain('get_milestone_merge_requests');
      expect(toolNames).toContain('get_milestone_burndown_events');

      // Check for write tools
      expect(toolNames).toContain('create_milestone');
      expect(toolNames).toContain('edit_milestone');
      expect(toolNames).toContain('delete_milestone');
      expect(toolNames).toContain('promote_milestone');
    });

    it('should have tools with valid structure', () => {
      const toolEntries = Array.from(milestonesToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('handler');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.inputSchema).toBe('object');
        expect(typeof tool.handler).toBe('function');
      });
    });

    it('should have unique tool names', () => {
      const toolNames = Array.from(milestonesToolRegistry.keys());
      const uniqueNames = new Set(toolNames);
      expect(toolNames.length).toBe(uniqueNames.size);
    });

    it('should have exactly 9 milestone tools', () => {
      expect(milestonesToolRegistry.size).toBe(9);
    });
  });

  describe('Tool Definitions', () => {
    it('should have proper list_milestones tool', () => {
      const tool = milestonesToolRegistry.get('list_milestones');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('list_milestones');
      expect(tool!.description).toContain('Browse release milestones');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper get_milestone tool', () => {
      const tool = milestonesToolRegistry.get('get_milestone');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('get_milestone');
      expect(tool!.description).toContain('Retrieve comprehensive milestone');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper get_milestone_issue tool', () => {
      const tool = milestonesToolRegistry.get('get_milestone_issue');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('get_milestone_issue');
      expect(tool!.description).toContain('List all issues targeted');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper get_milestone_merge_requests tool', () => {
      const tool = milestonesToolRegistry.get('get_milestone_merge_requests');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('get_milestone_merge_requests');
      expect(tool!.description).toContain('List merge requests scheduled');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper get_milestone_burndown_events tool', () => {
      const tool = milestonesToolRegistry.get('get_milestone_burndown_events');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('get_milestone_burndown_events');
      expect(tool!.description).toContain('Track milestone progress');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper create_milestone tool', () => {
      const tool = milestonesToolRegistry.get('create_milestone');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('create_milestone');
      expect(tool!.description).toContain('Define a new release milestone');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper edit_milestone tool', () => {
      const tool = milestonesToolRegistry.get('edit_milestone');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('edit_milestone');
      expect(tool!.description).toContain('Update milestone properties');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper delete_milestone tool', () => {
      const tool = milestonesToolRegistry.get('delete_milestone');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('delete_milestone');
      expect(tool!.description).toContain('Remove a milestone permanently');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper promote_milestone tool', () => {
      const tool = milestonesToolRegistry.get('promote_milestone');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('promote_milestone');
      expect(tool!.description).toContain('Elevate project milestone to group');
      expect(tool!.inputSchema).toBeDefined();
    });
  });

  describe('Read-Only Tools Function', () => {
    it('should return an array of read-only tool names', () => {
      const readOnlyTools = getMilestonesReadOnlyToolNames();
      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it('should include expected read-only tools', () => {
      const readOnlyTools = getMilestonesReadOnlyToolNames();
      expect(readOnlyTools).toContain('list_milestones');
      expect(readOnlyTools).toContain('get_milestone');
      expect(readOnlyTools).toContain('get_milestone_issue');
      expect(readOnlyTools).toContain('get_milestone_merge_requests');
      expect(readOnlyTools).toContain('get_milestone_burndown_events');
    });

    it('should not include write tools', () => {
      const readOnlyTools = getMilestonesReadOnlyToolNames();
      expect(readOnlyTools).not.toContain('create_milestone');
      expect(readOnlyTools).not.toContain('edit_milestone');
      expect(readOnlyTools).not.toContain('delete_milestone');
      expect(readOnlyTools).not.toContain('promote_milestone');
    });

    it('should return exactly 5 read-only tools', () => {
      const readOnlyTools = getMilestonesReadOnlyToolNames();
      expect(readOnlyTools.length).toBe(5);
    });

    it('should return tools that exist in the registry', () => {
      const readOnlyTools = getMilestonesReadOnlyToolNames();
      readOnlyTools.forEach(toolName => {
        expect(milestonesToolRegistry.has(toolName)).toBe(true);
      });
    });
  });

  describe('Milestones Tool Definitions Function', () => {
    it('should return an array of tool definitions', () => {
      const toolDefinitions = getMilestonesToolDefinitions();
      expect(Array.isArray(toolDefinitions)).toBe(true);
      expect(toolDefinitions.length).toBe(9);
    });

    it('should return all tools from registry', () => {
      const toolDefinitions = getMilestonesToolDefinitions();
      const registrySize = milestonesToolRegistry.size;
      expect(toolDefinitions.length).toBe(registrySize);
    });

    it('should return tool definitions with proper structure', () => {
      const toolDefinitions = getMilestonesToolDefinitions();

      toolDefinitions.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('handler');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.inputSchema).toBe('object');
      });
    });
  });

  describe('Filtered Milestones Tools Function', () => {
    it('should return all tools in normal mode', () => {
      const filteredTools = getFilteredMilestonesTools(false);
      expect(filteredTools.length).toBe(9);
    });

    it('should return only read-only tools in read-only mode', () => {
      const filteredTools = getFilteredMilestonesTools(true);
      const readOnlyTools = getMilestonesReadOnlyToolNames();
      expect(filteredTools.length).toBe(readOnlyTools.length);
    });

    it('should filter tools correctly in read-only mode', () => {
      const filteredTools = getFilteredMilestonesTools(true);
      const toolNames = filteredTools.map(tool => tool.name);

      expect(toolNames).toContain('list_milestones');
      expect(toolNames).toContain('get_milestone');
      expect(toolNames).toContain('get_milestone_issue');
      expect(toolNames).toContain('get_milestone_merge_requests');
      expect(toolNames).toContain('get_milestone_burndown_events');
      expect(toolNames).not.toContain('create_milestone');
      expect(toolNames).not.toContain('edit_milestone');
      expect(toolNames).not.toContain('delete_milestone');
      expect(toolNames).not.toContain('promote_milestone');
    });

    it('should not include write tools in read-only mode', () => {
      const filteredTools = getFilteredMilestonesTools(true);
      const toolNames = filteredTools.map(tool => tool.name);
      const writeTools = ['create_milestone', 'edit_milestone', 'delete_milestone', 'promote_milestone'];

      writeTools.forEach(toolName => {
        expect(toolNames).not.toContain(toolName);
      });
    });

    it('should return exactly 5 tools in read-only mode', () => {
      const filteredTools = getFilteredMilestonesTools(true);
      expect(filteredTools.length).toBe(5);
    });
  });

  describe('Tool Handlers', () => {
    it('should have handlers that are async functions', () => {
      const toolEntries = Array.from(milestonesToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(typeof tool.handler).toBe('function');
        expect(tool.handler.constructor.name).toBe('AsyncFunction');
      });
    });

    it('should have handlers that accept arguments', () => {
      const toolEntries = Array.from(milestonesToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(tool.handler.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Registry Consistency', () => {
    it('should have all expected milestone tools', () => {
      const expectedTools = [
        'list_milestones',
        'get_milestone',
        'get_milestone_issue',
        'get_milestone_merge_requests',
        'get_milestone_burndown_events',
        'create_milestone',
        'edit_milestone',
        'delete_milestone',
        'promote_milestone'
      ];

      expectedTools.forEach(toolName => {
        expect(milestonesToolRegistry.has(toolName)).toBe(true);
      });
    });

    it('should have consistent tool count between functions', () => {
      const registrySize = milestonesToolRegistry.size;
      const toolDefinitions = getMilestonesToolDefinitions();
      const filteredTools = getFilteredMilestonesTools(false);

      expect(toolDefinitions.length).toBe(registrySize);
      expect(filteredTools.length).toBe(registrySize);
    });

    it('should have more tools than just read-only ones', () => {
      const totalTools = milestonesToolRegistry.size;
      const readOnlyTools = getMilestonesReadOnlyToolNames();

      expect(totalTools).toBeGreaterThan(readOnlyTools.length);
    });
  });

  describe('Tool Input Schemas', () => {
    it('should have valid JSON schema structure for all tools', () => {
      const toolEntries = Array.from(milestonesToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      });
    });

    it('should have consistent schema format', () => {
      const toolEntries = Array.from(milestonesToolRegistry.values());

      toolEntries.forEach(tool => {
        // Each schema should be a valid JSON Schema object
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      });
    });
  });

  describe('Milestone Tool Specifics', () => {
    it('should support both project and group milestones', () => {
      const listMilestonesTool = milestonesToolRegistry.get('list_milestones');
      expect(listMilestonesTool).toBeDefined();
      expect(listMilestonesTool!.inputSchema).toBeDefined();

      // The tool should handle both project and group contexts
      expect(listMilestonesTool!.description).toContain('Group milestones apply');
    });

    it('should mention milestone management context in descriptions', () => {
      const toolEntries = Array.from(milestonesToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(tool.description.toLowerCase()).toMatch(/milestone/);
      });
    });

    it('should have milestone-specific tools for issues and merge requests', () => {
      expect(milestonesToolRegistry.has('get_milestone_issue')).toBe(true);
      expect(milestonesToolRegistry.has('get_milestone_merge_requests')).toBe(true);
      expect(milestonesToolRegistry.has('get_milestone_burndown_events')).toBe(true);
    });

    it('should have promote milestone tool for project-to-group promotion', () => {
      const promoteTool = milestonesToolRegistry.get('promote_milestone');
      expect(promoteTool).toBeDefined();
      expect(promoteTool!.description).toContain('Elevate project milestone to group level');
    });
  });

  describe('Handler Functions', () => {
    const mockResponse = (data: any, ok = true, status = 200) => ({
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: jest.fn().mockResolvedValue(data)
    });

    describe('list_milestones handler', () => {
      it('should list project milestones', async () => {
        const mockMilestones = [
          { id: 1, title: 'Sprint 1', state: 'active', project_id: 123 },
          { id: 2, title: 'Sprint 2', state: 'closed', project_id: 123 }
        ];

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual list milestones API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestones) as any);

        const tool = milestonesToolRegistry.get('list_milestones')!;
        const result = await tool.handler({
          namespace: 'test/project',
          state: 'active'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockMilestones);
      });

      it('should list group milestones', async () => {
        const mockMilestones = [{ id: 1, title: 'Group Milestone', state: 'active', group_id: 456 }];

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 456, name: 'test-group' })
        } as any);

        // Mock actual list milestones API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestones) as any);

        const tool = milestonesToolRegistry.get('list_milestones')!;
        await tool.handler({
          namespace: 'test-group',
          state: 'closed',
          per_page: 50
        });

        const call = mockEnhancedFetch.mock.calls[1]; // Second call is the actual API call
        const url = call[0] as string;
        expect(url).toContain('api/v4/groups/test-group/milestones');
        expect(url).toContain('state=closed');
        expect(url).toContain('per_page=50');
      });

      it('should handle API errors', async () => {
        // Mock namespace detection call (succeeds)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'nonexistent-project' })
        } as any);

        // Mock actual API call (fails)
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as any);

        const tool = milestonesToolRegistry.get('list_milestones')!;

        await expect(tool.handler({
          namespace: 'nonexistent/project'
        })).rejects.toThrow('GitLab API error: 404 Error');
      });
    });

    describe('get_milestone handler', () => {
      it('should get project milestone by ID', async () => {
        const mockMilestone = {
          id: 1,
          iid: 1,
          title: 'Sprint 1',
          description: 'First sprint milestone',
          state: 'active',
          project_id: 123
        };

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual get milestone API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestone) as any);

        const tool = milestonesToolRegistry.get('get_milestone')!;
        const result = await tool.handler({
          namespace: 'test/project',
          milestone_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/milestones/1',
          {
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockMilestone);
      });

      it('should get group milestone by ID', async () => {
        const mockMilestone = { id: 2, title: 'Group Milestone', group_id: 456 };

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 456, name: 'test-group' })
        } as any);

        // Mock actual get milestone API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestone) as any);

        const tool = milestonesToolRegistry.get('get_milestone')!;
        await tool.handler({
          namespace: 'test-group',
          milestone_id: 2
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/groups/test-group/milestones/2',
          expect.any(Object)
        );
      });
    });

    describe('get_milestone_issue handler', () => {
      it('should get issues for project milestone', async () => {
        const mockIssues = [
          { id: 1, iid: 1, title: 'Issue 1', milestone: { id: 1 } },
          { id: 2, iid: 2, title: 'Issue 2', milestone: { id: 1 } }
        ];

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual get milestone issues API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockIssues) as any);

        const tool = milestonesToolRegistry.get('get_milestone_issue')!;
        const result = await tool.handler({
          namespace: 'test/project',
          milestone_id: 1,
          state: 'opened'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining('https://gitlab.example.com/api/v4/projects/test%2Fproject/milestones/1/issues'),
          expect.any(Object)
        );
        expect(result).toEqual(mockIssues);
      });

      it('should get issues for group milestone', async () => {
        const mockIssues = [{ id: 1, title: 'Group Issue' }];

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 456, name: 'test-group' })
        } as any);

        // Mock actual get milestone issues API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockIssues) as any);

        const tool = milestonesToolRegistry.get('get_milestone_issue')!;
        await tool.handler({
          namespace: 'test-group',
          milestone_id: 1,
          per_page: 20
        });

        const call = mockEnhancedFetch.mock.calls[1]; // Second call is the actual API call
        const url = call[0] as string;
        expect(url).toContain('api/v4/groups/test-group/milestones/1/issues');
      });
    });

    describe('get_milestone_merge_requests handler', () => {
      it('should get merge requests for milestone', async () => {
        const mockMRs = [
          { id: 1, iid: 1, title: 'MR 1', milestone: { id: 1 } },
          { id: 2, iid: 2, title: 'MR 2', milestone: { id: 1 } }
        ];

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual get milestone merge requests API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMRs) as any);

        const tool = milestonesToolRegistry.get('get_milestone_merge_requests')!;
        const result = await tool.handler({
          namespace: 'test/project',
          milestone_id: 1,
          state: 'merged'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining('https://gitlab.example.com/api/v4/projects/test%2Fproject/milestones/1/merge_requests'),
          expect.any(Object)
        );
        expect(result).toEqual(mockMRs);
      });
    });

    describe('get_milestone_burndown_events handler', () => {
      it('should get burndown events for milestone', async () => {
        const mockEvents = [
          { created_at: '2024-01-01T00:00:00Z', weight: 5, action: 'add' },
          { created_at: '2024-01-02T00:00:00Z', weight: 3, action: 'remove' }
        ];

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual get milestone burndown events API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockEvents) as any);

        const tool = milestonesToolRegistry.get('get_milestone_burndown_events')!;
        const result = await tool.handler({
          namespace: 'test/project',
          milestone_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/milestones/1/burndown_events',
          {
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockEvents);
      });
    });

    describe('create_milestone handler', () => {
      it('should create project milestone', async () => {
        const mockMilestone = {
          id: 3,
          iid: 3,
          title: 'New Sprint',
          description: 'A new sprint milestone',
          state: 'active'
        };

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual create milestone API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestone) as any);

        const tool = milestonesToolRegistry.get('create_milestone')!;
        const result = await tool.handler({
          namespace: 'test/project',
          title: 'New Sprint',
          description: 'A new sprint milestone',
          due_date: '2024-12-31',
          start_date: '2024-12-01'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/milestones',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/json'
            },
            body: expect.stringContaining('"title":"New Sprint"')
          }
        );

        const call = mockEnhancedFetch.mock.calls[1]; // Second call is the actual API call
        const body = JSON.parse(call[1]?.body as string);
        expect(body).toEqual({
          title: 'New Sprint',
          description: 'A new sprint milestone',
          due_date: '2024-12-31',
          start_date: '2024-12-01'
        });
        expect(result).toEqual(mockMilestone);
      });

      it('should create group milestone', async () => {
        const mockMilestone = { id: 4, title: 'Group Milestone', group_id: 456 };

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 456, name: 'test-group' })
        } as any);

        // Mock actual create milestone API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestone) as any);

        const tool = milestonesToolRegistry.get('create_milestone')!;
        await tool.handler({
          namespace: 'test-group',
          title: 'Group Milestone'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/groups/test-group/milestones',
          expect.any(Object)
        );
      });
    });

    describe('edit_milestone handler', () => {
      it('should edit project milestone', async () => {
        const mockMilestone = {
          id: 1,
          title: 'Updated Sprint',
          description: 'Updated description',
          state: 'closed'
        };

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual edit milestone API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestone) as any);

        const tool = milestonesToolRegistry.get('edit_milestone')!;
        const result = await tool.handler({
          namespace: 'test/project',
          milestone_id: 1,
          title: 'Updated Sprint',
          description: 'Updated description',
          state_event: 'close'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/milestones/1',
          {
            method: 'PUT',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/json'
            },
            body: expect.stringContaining('"title":"Updated Sprint"')
          }
        );
        expect(result).toEqual(mockMilestone);
      });
    });

    describe('delete_milestone handler', () => {
      it('should delete project milestone', async () => {
        const mockResult = { message: 'Milestone deleted' };

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual delete milestone API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockResult) as any);

        const tool = milestonesToolRegistry.get('delete_milestone')!;
        const result = await tool.handler({
          namespace: 'test/project',
          milestone_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/milestones/1',
          {
            method: 'DELETE',
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockResult);
      });

      it('should delete group milestone', async () => {
        const mockResult = { message: 'Group milestone deleted' };

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 456, name: 'test-group' })
        } as any);

        // Mock actual delete milestone API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockResult) as any);

        const tool = milestonesToolRegistry.get('delete_milestone')!;
        await tool.handler({
          namespace: 'test-group',
          milestone_id: 2
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/groups/test-group/milestones/2',
          expect.any(Object)
        );
      });
    });

    describe('promote_milestone handler', () => {
      it('should promote project milestone to group', async () => {
        const mockMilestone = {
          id: 1,
          title: 'Promoted Milestone',
          group_id: 456,
          project_id: null
        };

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual promote milestone API call
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestone) as any);

        const tool = milestonesToolRegistry.get('promote_milestone')!;
        const result = await tool.handler({
          namespace: 'test/project',
          milestone_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/milestones/1/promote',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockMilestone);
      });

      it('should require namespace for promotion', async () => {
        const tool = milestonesToolRegistry.get('promote_milestone')!;

        // Test with empty namespace which should fail validation
        await expect(tool.handler({
          namespace: '',
          milestone_id: 1
        })).rejects.toThrow('Milestone promotion is only available for projects');
      });
    });

    describe('Error handling', () => {
      it('should handle validation errors', async () => {
        const tool = milestonesToolRegistry.get('get_milestone')!;

        // Test with invalid input that should fail Zod validation
        await expect(tool.handler({
          namespace: 123, // Should be string
          milestone_id: 'not-a-number'
        })).rejects.toThrow();
      });

      it('should handle API errors with proper error messages', async () => {
        // Mock namespace detection call (succeeds)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'private-project' })
        } as any);

        // Mock actual API call (fails)
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 403) as any);

        const tool = milestonesToolRegistry.get('list_milestones')!;

        await expect(tool.handler({
          namespace: 'private/project'
        })).rejects.toThrow('GitLab API error: 403 Error');
      });

      it('should handle network errors', async () => {
        // Mock namespace detection call (succeeds)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual API call (network error)
        mockEnhancedFetch.mockRejectedValueOnce(new Error('Network timeout'));

        const tool = milestonesToolRegistry.get('create_milestone')!;

        await expect(tool.handler({
          namespace: 'test/project',
          title: 'Test Milestone'
        })).rejects.toThrow('Network timeout');
      });
    });
  });
});