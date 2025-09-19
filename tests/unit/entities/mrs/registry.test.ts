import { mrsToolRegistry, getMrsReadOnlyToolNames, getMrsToolDefinitions, getFilteredMrsTools } from '../../../../src/entities/mrs/registry';
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
  // Ensure mockEnhancedFetch is properly reset
  mockEnhancedFetch.mockReset();
});

describe('MRS Registry', () => {
  describe('Registry Structure', () => {
    it('should be a Map instance', () => {
      expect(mrsToolRegistry instanceof Map).toBe(true);
    });

    it('should contain expected merge request tools', () => {
      const toolNames = Array.from(mrsToolRegistry.keys());

      // Check for read-only tools
      expect(toolNames).toContain('get_branch_diffs');
      expect(toolNames).toContain('get_merge_request');
      expect(toolNames).toContain('list_merge_requests');
      expect(toolNames).toContain('get_merge_request_diffs');
      expect(toolNames).toContain('list_merge_request_diffs');
      expect(toolNames).toContain('mr_discussions');
      expect(toolNames).toContain('get_draft_note');
      expect(toolNames).toContain('list_draft_notes');

      // Check for write tools
      expect(toolNames).toContain('create_merge_request');
      expect(toolNames).toContain('merge_merge_request');
      expect(toolNames).toContain('create_note');
      expect(toolNames).toContain('create_draft_note');
      expect(toolNames).toContain('publish_draft_note');
      expect(toolNames).toContain('bulk_publish_draft_notes');
      expect(toolNames).toContain('update_merge_request');
      expect(toolNames).toContain('create_merge_request_thread');
      expect(toolNames).toContain('update_merge_request_note');
      expect(toolNames).toContain('create_merge_request_note');
      expect(toolNames).toContain('update_draft_note');
      expect(toolNames).toContain('delete_draft_note');
    });

    it('should have tools with valid structure', () => {
      const toolEntries = Array.from(mrsToolRegistry.values());

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
      const toolNames = Array.from(mrsToolRegistry.keys());
      const uniqueNames = new Set(toolNames);
      expect(toolNames.length).toBe(uniqueNames.size);
    });

    it('should have exactly 20 merge request tools', () => {
      expect(mrsToolRegistry.size).toBe(20);
    });
  });

  describe('Tool Definitions', () => {
    it('should have proper get_branch_diffs tool', () => {
      const tool = mrsToolRegistry.get('get_branch_diffs');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('get_branch_diffs');
      expect(tool!.description).toContain('COMPARE');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper get_merge_request tool', () => {
      const tool = mrsToolRegistry.get('get_merge_request');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('get_merge_request');
      expect(tool!.description).toContain('Get comprehensive details');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper list_merge_requests tool', () => {
      const tool = mrsToolRegistry.get('list_merge_requests');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('list_merge_requests');
      expect(tool!.description).toContain('List merge requests');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper create_merge_request tool', () => {
      const tool = mrsToolRegistry.get('create_merge_request');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('create_merge_request');
      expect(tool!.description).toContain('Create a new merge request');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper merge_merge_request tool', () => {
      const tool = mrsToolRegistry.get('merge_merge_request');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('merge_merge_request');
      expect(tool!.description).toContain('Merge an approved merge request');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper draft note tools', () => {
      const createTool = mrsToolRegistry.get('create_draft_note');
      const getTool = mrsToolRegistry.get('get_draft_note');
      const listTool = mrsToolRegistry.get('list_draft_notes');
      const publishTool = mrsToolRegistry.get('publish_draft_note');
      const bulkPublishTool = mrsToolRegistry.get('bulk_publish_draft_notes');
      const updateTool = mrsToolRegistry.get('update_draft_note');
      const deleteTool = mrsToolRegistry.get('delete_draft_note');

      expect(createTool).toBeDefined();
      expect(getTool).toBeDefined();
      expect(listTool).toBeDefined();
      expect(publishTool).toBeDefined();
      expect(bulkPublishTool).toBeDefined();
      expect(updateTool).toBeDefined();
      expect(deleteTool).toBeDefined();

      expect(createTool!.description).toContain('Create a draft note');
      expect(getTool!.description).toContain('Retrieve a specific draft note');
      expect(listTool!.description).toContain('List all draft notes');
      expect(publishTool!.description).toContain('Publish a previously created draft note');
      expect(bulkPublishTool!.description).toContain('Publish all pending draft notes');
      expect(updateTool!.description).toContain('Modify a draft note');
      expect(deleteTool!.description).toContain('Remove a draft note');
    });
  });

  describe('Read-Only Tools Function', () => {
    it('should return an array of read-only tool names', () => {
      const readOnlyTools = getMrsReadOnlyToolNames();
      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it('should include expected read-only tools', () => {
      const readOnlyTools = getMrsReadOnlyToolNames();
      expect(readOnlyTools).toContain('get_branch_diffs');
      expect(readOnlyTools).toContain('get_merge_request');
      expect(readOnlyTools).toContain('get_merge_request_diffs');
      expect(readOnlyTools).toContain('list_merge_request_diffs');
      expect(readOnlyTools).toContain('mr_discussions');
      expect(readOnlyTools).toContain('get_draft_note');
      expect(readOnlyTools).toContain('list_draft_notes');
      expect(readOnlyTools).toContain('list_merge_requests');
    });

    it('should not include write tools', () => {
      const readOnlyTools = getMrsReadOnlyToolNames();
      expect(readOnlyTools).not.toContain('create_merge_request');
      expect(readOnlyTools).not.toContain('merge_merge_request');
      expect(readOnlyTools).not.toContain('create_note');
      expect(readOnlyTools).not.toContain('create_draft_note');
      expect(readOnlyTools).not.toContain('update_merge_request');
    });

    it('should return exactly 8 read-only tools', () => {
      const readOnlyTools = getMrsReadOnlyToolNames();
      expect(readOnlyTools.length).toBe(8);
    });

    it('should return tools that exist in the registry', () => {
      const readOnlyTools = getMrsReadOnlyToolNames();
      readOnlyTools.forEach(toolName => {
        expect(mrsToolRegistry.has(toolName)).toBe(true);
      });
    });
  });

  describe('MRS Tool Definitions Function', () => {
    it('should return an array of tool definitions', () => {
      const toolDefinitions = getMrsToolDefinitions();
      expect(Array.isArray(toolDefinitions)).toBe(true);
      expect(toolDefinitions.length).toBe(20);
    });

    it('should return all tools from registry', () => {
      const toolDefinitions = getMrsToolDefinitions();
      const registrySize = mrsToolRegistry.size;
      expect(toolDefinitions.length).toBe(registrySize);
    });

    it('should return tool definitions with proper structure', () => {
      const toolDefinitions = getMrsToolDefinitions();

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

  describe('Filtered MRS Tools Function', () => {
    it('should return all tools in normal mode', () => {
      const filteredTools = getFilteredMrsTools(false);
      expect(filteredTools.length).toBe(20);
    });

    it('should return only read-only tools in read-only mode', () => {
      const filteredTools = getFilteredMrsTools(true);
      const readOnlyTools = getMrsReadOnlyToolNames();
      expect(filteredTools.length).toBe(readOnlyTools.length);
    });

    it('should filter tools correctly in read-only mode', () => {
      const filteredTools = getFilteredMrsTools(true);
      const toolNames = filteredTools.map(tool => tool.name);

      expect(toolNames).toContain('get_branch_diffs');
      expect(toolNames).toContain('get_merge_request');
      expect(toolNames).toContain('list_merge_requests');
      expect(toolNames).toContain('get_merge_request_diffs');
      expect(toolNames).toContain('list_merge_request_diffs');
      expect(toolNames).toContain('mr_discussions');
      expect(toolNames).toContain('get_draft_note');
      expect(toolNames).toContain('list_draft_notes');

      expect(toolNames).not.toContain('create_merge_request');
      expect(toolNames).not.toContain('merge_merge_request');
      expect(toolNames).not.toContain('create_note');
      expect(toolNames).not.toContain('create_draft_note');
    });

    it('should not include write tools in read-only mode', () => {
      const filteredTools = getFilteredMrsTools(true);
      const toolNames = filteredTools.map(tool => tool.name);
      const writeTools = [
        'create_merge_request', 'merge_merge_request', 'create_note', 'create_draft_note',
        'publish_draft_note', 'bulk_publish_draft_notes', 'update_merge_request',
        'create_merge_request_thread', 'update_merge_request_note', 'create_merge_request_note',
        'update_draft_note', 'delete_draft_note'
      ];

      writeTools.forEach(toolName => {
        expect(toolNames).not.toContain(toolName);
      });
    });

    it('should return exactly 8 tools in read-only mode', () => {
      const filteredTools = getFilteredMrsTools(true);
      expect(filteredTools.length).toBe(8);
    });
  });

  describe('Tool Handlers', () => {
    it('should have handlers that are async functions', () => {
      const toolEntries = Array.from(mrsToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(typeof tool.handler).toBe('function');
        expect(tool.handler.constructor.name).toBe('AsyncFunction');
      });
    });

    it('should have handlers that accept arguments', () => {
      const toolEntries = Array.from(mrsToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(tool.handler.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Registry Consistency', () => {
    it('should have all expected merge request tools', () => {
      const expectedTools = [
        'get_branch_diffs', 'get_merge_request', 'list_merge_requests', 'get_merge_request_diffs',
        'list_merge_request_diffs', 'mr_discussions', 'get_draft_note', 'list_draft_notes',
        'create_merge_request', 'merge_merge_request', 'create_note', 'create_draft_note',
        'publish_draft_note', 'bulk_publish_draft_notes', 'update_merge_request',
        'create_merge_request_thread', 'update_merge_request_note', 'create_merge_request_note',
        'update_draft_note', 'delete_draft_note'
      ];

      expectedTools.forEach(toolName => {
        expect(mrsToolRegistry.has(toolName)).toBe(true);
      });
    });

    it('should have consistent tool count between functions', () => {
      const registrySize = mrsToolRegistry.size;
      const toolDefinitions = getMrsToolDefinitions();
      const filteredTools = getFilteredMrsTools(false);

      expect(toolDefinitions.length).toBe(registrySize);
      expect(filteredTools.length).toBe(registrySize);
    });

    it('should have more tools than just read-only ones', () => {
      const totalTools = mrsToolRegistry.size;
      const readOnlyTools = getMrsReadOnlyToolNames();

      expect(totalTools).toBeGreaterThan(readOnlyTools.length);
    });
  });

  describe('Tool Input Schemas', () => {
    it('should have valid JSON schema structure for all tools', () => {
      const toolEntries = Array.from(mrsToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      });
    });

    it('should have consistent schema format', () => {
      const toolEntries = Array.from(mrsToolRegistry.values());

      toolEntries.forEach(tool => {
        // Each schema should be a valid JSON Schema object
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      });
    });
  });

  describe('MRS Tool Specifics', () => {
    it('should support merge request operations', () => {
      const getMRTool = mrsToolRegistry.get('get_merge_request');
      expect(getMRTool).toBeDefined();
      expect(getMRTool!.inputSchema).toBeDefined();

      // The tool should handle merge request identification
      expect(getMRTool!.description).toContain('merge request');
    });

    it('should mention merge request context in descriptions', () => {
      const toolEntries = Array.from(mrsToolRegistry.values());

      toolEntries.forEach(tool => {
        const description = tool.description.toLowerCase();
        // Each tool should mention merge request, branch, diff, or draft
        expect(description).toMatch(/merge request|branch|diff|draft|note/);
      });
    });

    it('should have comprehensive draft note management', () => {
      const draftNoteTools = [
        'create_draft_note', 'get_draft_note', 'list_draft_notes',
        'publish_draft_note', 'bulk_publish_draft_notes', 'update_draft_note', 'delete_draft_note'
      ];

      draftNoteTools.forEach(toolName => {
        expect(mrsToolRegistry.has(toolName)).toBe(true);
      });
    });

    it('should have diff and comparison tools', () => {
      expect(mrsToolRegistry.has('get_branch_diffs')).toBe(true);
      expect(mrsToolRegistry.has('get_merge_request_diffs')).toBe(true);
      expect(mrsToolRegistry.has('list_merge_request_diffs')).toBe(true);
    });

    it('should have discussion and note tools', () => {
      expect(mrsToolRegistry.has('mr_discussions')).toBe(true);
      expect(mrsToolRegistry.has('create_note')).toBe(true);
      expect(mrsToolRegistry.has('create_merge_request_note')).toBe(true);
      expect(mrsToolRegistry.has('update_merge_request_note')).toBe(true);
      expect(mrsToolRegistry.has('create_merge_request_thread')).toBe(true);
    });
  });

  describe('Handler Functions', () => {
    const mockResponse = (data: any, ok = true, status = 200) => ({
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: jest.fn().mockResolvedValue(data)
    });

    describe('get_branch_diffs handler', () => {
      it('should make correct API call for branch comparison', async () => {
        const mockData = { commits: [], diffs: [] };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockData) as any);

        const tool = mrsToolRegistry.get('get_branch_diffs')!;
        const result = await tool.handler({
          project_id: 'test/project',
          from: 'main',
          to: 'feature-branch',
          straight: true
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/repository/compare?from=main&to=feature-branch&straight=true',
          {
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockData);
      });

      it('should handle API errors', async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as any);

        const tool = mrsToolRegistry.get('get_branch_diffs')!;

        await expect(tool.handler({
          project_id: 'test/project',
          from: 'main',
          to: 'nonexistent'
        })).rejects.toThrow('GitLab API error: 404 Error');
      });

      it('should handle optional straight parameter', async () => {
        const mockData = { commits: [], diffs: [] };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockData) as any);

        const tool = mrsToolRegistry.get('get_branch_diffs')!;
        await tool.handler({
          project_id: 'test/project',
          from: 'main',
          to: 'feature-branch'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/repository/compare?from=main&to=feature-branch&',
          expect.any(Object)
        );
      });
    });

    describe('get_merge_request handler', () => {
      it('should get MR by IID', async () => {
        const mockMR = { id: 1, iid: 1, title: 'Test MR' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMR) as any);

        const tool = mrsToolRegistry.get('get_merge_request')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1',
          expect.any(Object)
        );
        expect(result).toEqual(mockMR);
      });

      it('should get MR by branch name', async () => {
        const mockMRs = [{ id: 1, iid: 1, title: 'Test MR', source_branch: 'feature' }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMRs) as any);

        const tool = mrsToolRegistry.get('get_merge_request')!;
        const result = await tool.handler({
          project_id: 'test/project',
          branch_name: 'feature'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests?source_branch=feature',
          expect.any(Object)
        );
        expect(result).toEqual(mockMRs[0]);
      });

      it('should throw error when no MR found by branch', async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse([]) as any);

        const tool = mrsToolRegistry.get('get_merge_request')!;

        await expect(tool.handler({
          project_id: 'test/project',
          branch_name: 'nonexistent'
        })).rejects.toThrow('No merge request found for branch');
      });

      it('should require either merge_request_iid or branch_name', async () => {
        const tool = mrsToolRegistry.get('get_merge_request')!;

        await expect(tool.handler({
          project_id: 'test/project'
        })).rejects.toThrow('Either merge_request_iid or branch_name must be provided');
      });
    });

    describe('list_merge_requests handler', () => {
      it('should list MRs for specific project', async () => {
        const mockMRs = [{ id: 1, iid: 1, title: 'Test MR' }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMRs) as any);

        const tool = mrsToolRegistry.get('list_merge_requests')!;
        const result = await tool.handler({
          project_id: 'test/project',
          state: 'opened'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining('https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests'),
          expect.any(Object)
        );
        expect(result).toEqual(mockMRs);
      });

      it('should use global endpoint when no project_id', async () => {
        const mockMRs = [{ id: 1, iid: 1, title: 'Test MR' }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMRs) as any);

        const tool = mrsToolRegistry.get('list_merge_requests')!;
        await tool.handler({ state: 'opened' });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining('https://gitlab.example.com/api/v4/merge_requests'),
          expect.any(Object)
        );
      });
    });

    describe('create_merge_request handler', () => {
      it('should create new MR with basic data', async () => {
        const mockMR = { id: 1, iid: 1, title: 'New MR' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMR) as any);

        const tool = mrsToolRegistry.get('create_merge_request')!;
        const result = await tool.handler({
          project_id: 'test/project',
          source_branch: 'feature',
          target_branch: 'main',
          title: 'New MR'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: expect.stringContaining('source_branch=feature&target_branch=main&title=New+MR')
          }
        );
        expect(result).toEqual(mockMR);
      });

      it('should handle array parameters', async () => {
        const mockMR = { id: 1, iid: 1, title: 'New MR' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMR) as any);

        const tool = mrsToolRegistry.get('create_merge_request')!;
        await tool.handler({
          project_id: 'test/project',
          source_branch: 'feature',
          target_branch: 'main',
          title: 'New MR',
          assignee_ids: ['1', '2']
        });

        const call = mockEnhancedFetch.mock.calls[0];
        const body = call[1]?.body as string;
        expect(body).toContain('assignee_ids=1%2C2');
      });
    });

    describe('merge_merge_request handler', () => {
      it('should merge MR with options', async () => {
        const mockResult = { state: 'merged' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockResult) as any);

        const tool = mrsToolRegistry.get('merge_merge_request')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1,
          merge_commit_message: 'Custom merge message',
          should_remove_source_branch: true
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/merge',
          {
            method: 'PUT',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: expect.stringContaining('merge_commit_message=Custom+merge+message&should_remove_source_branch=true')
          }
        );
        expect(result).toEqual(mockResult);
      });
    });

    describe('draft note handlers', () => {
      it('should create draft note', async () => {
        const mockNote = { id: 1, note: 'Draft comment' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockNote) as any);

        const tool = mrsToolRegistry.get('create_draft_note')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1,
          note: 'Draft comment'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/draft_notes',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'note=Draft+comment'
          }
        );
        expect(result).toEqual(mockNote);
      });

      it('should get draft note', async () => {
        const mockNote = { id: 1, note: 'Draft comment' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockNote) as any);

        const tool = mrsToolRegistry.get('get_draft_note')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1,
          draft_note_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/draft_notes/1',
          expect.any(Object)
        );
        expect(result).toEqual(mockNote);
      });

      it('should list draft notes', async () => {
        const mockNotes = [{ id: 1, note: 'Draft 1' }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockNotes) as any);

        const tool = mrsToolRegistry.get('list_draft_notes')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1
        });

        expect(result).toEqual(mockNotes);
      });

      it('should publish draft note', async () => {
        const mockResult = { success: true };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockResult) as any);

        const tool = mrsToolRegistry.get('publish_draft_note')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1,
          draft_note_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/draft_notes/1/publish',
          {
            method: 'PUT',
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockResult);
      });

      it('should bulk publish draft notes', async () => {
        const mockResult = { published_count: 3 };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockResult) as any);

        const tool = mrsToolRegistry.get('bulk_publish_draft_notes')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/draft_notes/bulk_publish',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockResult);
      });

      it('should update draft note', async () => {
        const mockNote = { id: 1, note: 'Updated draft' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockNote) as any);

        const tool = mrsToolRegistry.get('update_draft_note')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1,
          draft_note_id: 1,
          note: 'Updated draft'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/draft_notes/1',
          {
            method: 'PUT',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'note=Updated+draft'
          }
        );
        expect(result).toEqual(mockNote);
      });

      it('should delete draft note', async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse({}) as any);

        const tool = mrsToolRegistry.get('delete_draft_note')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1,
          draft_note_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/draft_notes/1',
          {
            method: 'DELETE',
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual({ success: true, message: 'Draft note deleted successfully' });
      });
    });

    describe('note and discussion handlers', () => {
      it('should create note for merge request', async () => {
        const mockNote = { id: 1, body: 'Test comment' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockNote) as any);

        const tool = mrsToolRegistry.get('create_note')!;
        const result = await tool.handler({
          project_id: 'test/project',
          noteable_type: 'merge_request',
          noteable_id: 1,
          body: 'Test comment'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/notes',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'body=Test+comment'
          }
        );
        expect(result).toEqual(mockNote);
      });

      it('should create note for issue', async () => {
        const mockNote = { id: 1, body: 'Test comment' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockNote) as any);

        const tool = mrsToolRegistry.get('create_note')!;
        await tool.handler({
          project_id: 'test/project',
          noteable_type: 'issue',
          noteable_id: 1,
          body: 'Test comment'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/issues/1/notes',
          expect.any(Object)
        );
      });

      it('should create MR thread', async () => {
        const mockDiscussion = { id: 'abc123', notes: [] };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockDiscussion) as any);

        const tool = mrsToolRegistry.get('create_merge_request_thread')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1,
          body: 'Thread comment'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/discussions',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'body=Thread+comment'
          }
        );
        expect(result).toEqual(mockDiscussion);
      });

      it('should create MR note in thread', async () => {
        const mockNote = { id: 1, body: 'Reply comment' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockNote) as any);

        const tool = mrsToolRegistry.get('create_merge_request_note')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1,
          discussion_id: 'abc123',
          body: 'Reply comment'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/discussions/abc123/notes',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'body=Reply+comment'
          }
        );
        expect(result).toEqual(mockNote);
      });

      it('should update MR note', async () => {
        const mockNote = { id: 1, body: 'Updated comment' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockNote) as any);

        const tool = mrsToolRegistry.get('update_merge_request_note')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1,
          note_id: 1,
          body: 'Updated comment'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/notes/1',
          {
            method: 'PUT',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'body=Updated+comment'
          }
        );
        expect(result).toEqual(mockNote);
      });

      it('should list MR discussions', async () => {
        const mockDiscussions = [{ id: 'abc123', notes: [] }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockDiscussions) as any);

        const tool = mrsToolRegistry.get('mr_discussions')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining('https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/discussions'),
          expect.any(Object)
        );
        expect(result).toEqual(mockDiscussions);
      });
    });

    describe('MR diff handlers', () => {
      it('should get MR diffs', async () => {
        const mockDiffs = { changes: [] };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockDiffs) as any);

        const tool = mrsToolRegistry.get('get_merge_request_diffs')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1,
          page: 1,
          per_page: 20
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/changes?page=1&per_page=20',
          expect.any(Object)
        );
        expect(result).toEqual(mockDiffs);
      });

      it('should list MR diffs with pagination', async () => {
        const mockDiffs = [{ diff: 'diff content' }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockDiffs) as any);

        const tool = mrsToolRegistry.get('list_merge_request_diffs')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1,
          page: 2,
          per_page: 10
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1/diffs?page=2&per_page=10',
          expect.any(Object)
        );
        expect(result).toEqual(mockDiffs);
      });
    });

    describe('update_merge_request handler', () => {
      it('should update MR with all fields', async () => {
        const mockMR = { id: 1, iid: 1, title: 'Updated MR' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMR) as any);

        const tool = mrsToolRegistry.get('update_merge_request')!;
        const result = await tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1,
          title: 'Updated MR',
          description: 'Updated description',
          target_branch: 'develop',
          labels: ['bug', 'urgent']
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/merge_requests/1',
          {
            method: 'PUT',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: expect.stringContaining('title=Updated+MR')
          }
        );
        expect(result).toEqual(mockMR);
      });
    });

    describe('Error handling', () => {
      it('should handle validation errors', async () => {
        const tool = mrsToolRegistry.get('get_merge_request')!;

        // Test with invalid input that should fail Zod validation
        await expect(tool.handler({
          project_id: 123, // Should be string
          merge_request_iid: 'not-a-number'
        })).rejects.toThrow();
      });

      it('should handle API errors with proper error messages', async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 500) as any);

        const tool = mrsToolRegistry.get('list_merge_requests')!;

        await expect(tool.handler({
          project_id: 'test/project'
        })).rejects.toThrow('GitLab API error: 500 Error');
      });

      it('should handle network errors', async () => {
        mockEnhancedFetch.mockRejectedValueOnce(new Error('Network error'));

        const tool = mrsToolRegistry.get('get_merge_request')!;

        await expect(tool.handler({
          project_id: 'test/project',
          merge_request_iid: 1
        })).rejects.toThrow('Network error');
      });
    });
  });
});