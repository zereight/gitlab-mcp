import { pipelinesToolRegistry, getPipelinesReadOnlyToolNames, getPipelinesToolDefinitions, getFilteredPipelinesTools } from '../../../../src/entities/pipelines/registry';
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

describe('Pipelines Registry', () => {
  describe('Registry Structure', () => {
    it('should be a Map instance', () => {
      expect(pipelinesToolRegistry instanceof Map).toBe(true);
    });

    it('should contain expected pipeline tools', () => {
      const toolNames = Array.from(pipelinesToolRegistry.keys());

      // Check for read-only tools
      expect(toolNames).toContain('list_pipelines');
      expect(toolNames).toContain('get_pipeline');
      expect(toolNames).toContain('list_pipeline_jobs');
      expect(toolNames).toContain('list_pipeline_trigger_jobs');
      expect(toolNames).toContain('get_pipeline_job');
      expect(toolNames).toContain('get_pipeline_job_output');

      // Check for write tools
      expect(toolNames).toContain('create_pipeline');
      expect(toolNames).toContain('retry_pipeline');
      expect(toolNames).toContain('cancel_pipeline');
      expect(toolNames).toContain('play_pipeline_job');
      expect(toolNames).toContain('retry_pipeline_job');
      expect(toolNames).toContain('cancel_pipeline_job');
    });

    it('should have tools with valid structure', () => {
      const toolEntries = Array.from(pipelinesToolRegistry.values());

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
      const toolNames = Array.from(pipelinesToolRegistry.keys());
      const uniqueNames = new Set(toolNames);
      expect(toolNames.length).toBe(uniqueNames.size);
    });

    it('should have exactly 12 pipeline tools', () => {
      expect(pipelinesToolRegistry.size).toBe(12);
    });
  });

  describe('Tool Definitions', () => {
    it('should have proper list_pipelines tool', () => {
      const tool = pipelinesToolRegistry.get('list_pipelines');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('list_pipelines');
      expect(tool!.description).toContain('Search and monitor CI/CD pipelines');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper get_pipeline tool', () => {
      const tool = pipelinesToolRegistry.get('get_pipeline');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('get_pipeline');
      expect(tool!.description).toContain('Get comprehensive details');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper list_pipeline_jobs tool', () => {
      const tool = pipelinesToolRegistry.get('list_pipeline_jobs');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('list_pipeline_jobs');
      expect(tool!.description).toContain('Get all CI/CD jobs');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper create_pipeline tool', () => {
      const tool = pipelinesToolRegistry.get('create_pipeline');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('create_pipeline');
      expect(tool!.description).toContain('Trigger a new CI/CD pipeline');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper retry_pipeline tool', () => {
      const tool = pipelinesToolRegistry.get('retry_pipeline');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('retry_pipeline');
      expect(tool!.description).toContain('Re-run a previously failed');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper cancel_pipeline tool', () => {
      const tool = pipelinesToolRegistry.get('cancel_pipeline');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('cancel_pipeline');
      expect(tool!.description).toContain('Stop a currently executing pipeline');
      expect(tool!.inputSchema).toBeDefined();
    });

    it('should have proper job management tools', () => {
      const playTool = pipelinesToolRegistry.get('play_pipeline_job');
      const retryTool = pipelinesToolRegistry.get('retry_pipeline_job');
      const cancelTool = pipelinesToolRegistry.get('cancel_pipeline_job');
      const getTool = pipelinesToolRegistry.get('get_pipeline_job');
      const outputTool = pipelinesToolRegistry.get('get_pipeline_job_output');

      expect(playTool).toBeDefined();
      expect(retryTool).toBeDefined();
      expect(cancelTool).toBeDefined();
      expect(getTool).toBeDefined();
      expect(outputTool).toBeDefined();

      expect(playTool!.description).toContain('Trigger a manual job');
      expect(retryTool!.description).toContain('Re-run a specific failed');
      expect(cancelTool!.description).toContain('Stop a specific running job');
      expect(getTool!.description).toContain('Get detailed information');
      expect(outputTool!.description).toContain('Fetch console output');
    });
  });

  describe('Read-Only Tools Function', () => {
    it('should return an array of read-only tool names', () => {
      const readOnlyTools = getPipelinesReadOnlyToolNames();
      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it('should include expected read-only tools', () => {
      const readOnlyTools = getPipelinesReadOnlyToolNames();
      expect(readOnlyTools).toContain('list_pipelines');
      expect(readOnlyTools).toContain('get_pipeline');
      expect(readOnlyTools).toContain('list_pipeline_jobs');
      expect(readOnlyTools).toContain('list_pipeline_trigger_jobs');
      expect(readOnlyTools).toContain('get_pipeline_job');
      expect(readOnlyTools).toContain('get_pipeline_job_output');
    });

    it('should not include write tools', () => {
      const readOnlyTools = getPipelinesReadOnlyToolNames();
      expect(readOnlyTools).not.toContain('create_pipeline');
      expect(readOnlyTools).not.toContain('retry_pipeline');
      expect(readOnlyTools).not.toContain('cancel_pipeline');
      expect(readOnlyTools).not.toContain('play_pipeline_job');
      expect(readOnlyTools).not.toContain('retry_pipeline_job');
      expect(readOnlyTools).not.toContain('cancel_pipeline_job');
    });

    it('should return exactly 6 read-only tools', () => {
      const readOnlyTools = getPipelinesReadOnlyToolNames();
      expect(readOnlyTools.length).toBe(6);
    });

    it('should return tools that exist in the registry', () => {
      const readOnlyTools = getPipelinesReadOnlyToolNames();
      readOnlyTools.forEach(toolName => {
        expect(pipelinesToolRegistry.has(toolName)).toBe(true);
      });
    });
  });

  describe('Pipelines Tool Definitions Function', () => {
    it('should return an array of tool definitions', () => {
      const toolDefinitions = getPipelinesToolDefinitions();
      expect(Array.isArray(toolDefinitions)).toBe(true);
      expect(toolDefinitions.length).toBe(12);
    });

    it('should return all tools from registry', () => {
      const toolDefinitions = getPipelinesToolDefinitions();
      const registrySize = pipelinesToolRegistry.size;
      expect(toolDefinitions.length).toBe(registrySize);
    });

    it('should return tool definitions with proper structure', () => {
      const toolDefinitions = getPipelinesToolDefinitions();

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

  describe('Filtered Pipelines Tools Function', () => {
    it('should return all tools in normal mode', () => {
      const filteredTools = getFilteredPipelinesTools(false);
      expect(filteredTools.length).toBe(12);
    });

    it('should return only read-only tools in read-only mode', () => {
      const filteredTools = getFilteredPipelinesTools(true);
      const readOnlyTools = getPipelinesReadOnlyToolNames();
      expect(filteredTools.length).toBe(readOnlyTools.length);
    });

    it('should filter tools correctly in read-only mode', () => {
      const filteredTools = getFilteredPipelinesTools(true);
      const toolNames = filteredTools.map(tool => tool.name);

      expect(toolNames).toContain('list_pipelines');
      expect(toolNames).toContain('get_pipeline');
      expect(toolNames).toContain('list_pipeline_jobs');
      expect(toolNames).toContain('list_pipeline_trigger_jobs');
      expect(toolNames).toContain('get_pipeline_job');
      expect(toolNames).toContain('get_pipeline_job_output');

      expect(toolNames).not.toContain('create_pipeline');
      expect(toolNames).not.toContain('retry_pipeline');
      expect(toolNames).not.toContain('cancel_pipeline');
      expect(toolNames).not.toContain('play_pipeline_job');
      expect(toolNames).not.toContain('retry_pipeline_job');
      expect(toolNames).not.toContain('cancel_pipeline_job');
    });

    it('should not include write tools in read-only mode', () => {
      const filteredTools = getFilteredPipelinesTools(true);
      const toolNames = filteredTools.map(tool => tool.name);
      const writeTools = [
        'create_pipeline', 'retry_pipeline', 'cancel_pipeline',
        'play_pipeline_job', 'retry_pipeline_job', 'cancel_pipeline_job'
      ];

      writeTools.forEach(toolName => {
        expect(toolNames).not.toContain(toolName);
      });
    });

    it('should return exactly 6 tools in read-only mode', () => {
      const filteredTools = getFilteredPipelinesTools(true);
      expect(filteredTools.length).toBe(6);
    });
  });

  describe('Tool Handlers', () => {
    it('should have handlers that are async functions', () => {
      const toolEntries = Array.from(pipelinesToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(typeof tool.handler).toBe('function');
        expect(tool.handler.constructor.name).toBe('AsyncFunction');
      });
    });

    it('should have handlers that accept arguments', () => {
      const toolEntries = Array.from(pipelinesToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(tool.handler.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Registry Consistency', () => {
    it('should have all expected pipeline tools', () => {
      const expectedTools = [
        'list_pipelines', 'get_pipeline', 'list_pipeline_jobs', 'list_pipeline_trigger_jobs',
        'get_pipeline_job', 'get_pipeline_job_output', 'create_pipeline', 'retry_pipeline',
        'cancel_pipeline', 'play_pipeline_job', 'retry_pipeline_job', 'cancel_pipeline_job'
      ];

      expectedTools.forEach(toolName => {
        expect(pipelinesToolRegistry.has(toolName)).toBe(true);
      });
    });

    it('should have consistent tool count between functions', () => {
      const registrySize = pipelinesToolRegistry.size;
      const toolDefinitions = getPipelinesToolDefinitions();
      const filteredTools = getFilteredPipelinesTools(false);

      expect(toolDefinitions.length).toBe(registrySize);
      expect(filteredTools.length).toBe(registrySize);
    });

    it('should have more tools than just read-only ones', () => {
      const totalTools = pipelinesToolRegistry.size;
      const readOnlyTools = getPipelinesReadOnlyToolNames();

      expect(totalTools).toBeGreaterThan(readOnlyTools.length);
    });
  });

  describe('Tool Input Schemas', () => {
    it('should have valid JSON schema structure for all tools', () => {
      const toolEntries = Array.from(pipelinesToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      });
    });

    it('should have consistent schema format', () => {
      const toolEntries = Array.from(pipelinesToolRegistry.values());

      toolEntries.forEach(tool => {
        // Each schema should be a valid JSON Schema object
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      });
    });
  });

  describe('Pipeline Tool Specifics', () => {
    it('should support pipeline operations', () => {
      const listTool = pipelinesToolRegistry.get('list_pipelines');
      expect(listTool).toBeDefined();
      expect(listTool!.inputSchema).toBeDefined();

      // The tool should handle pipeline listing
      expect(listTool!.description).toContain('Search and monitor CI/CD pipelines');
    });

    it('should mention pipeline context in descriptions', () => {
      const toolEntries = Array.from(pipelinesToolRegistry.values());

      toolEntries.forEach(tool => {
        const description = tool.description.toLowerCase();
        // Each tool should mention pipeline or job
        expect(description).toMatch(/pipeline|job/);
      });
    });

    it('should have comprehensive job management', () => {
      const jobTools = [
        'list_pipeline_jobs', 'get_pipeline_job', 'get_pipeline_job_output',
        'play_pipeline_job', 'retry_pipeline_job', 'cancel_pipeline_job'
      ];

      jobTools.forEach(toolName => {
        expect(pipelinesToolRegistry.has(toolName)).toBe(true);
      });
    });

    it('should have pipeline lifecycle management', () => {
      expect(pipelinesToolRegistry.has('create_pipeline')).toBe(true);
      expect(pipelinesToolRegistry.has('retry_pipeline')).toBe(true);
      expect(pipelinesToolRegistry.has('cancel_pipeline')).toBe(true);
    });

    it('should have trigger job support', () => {
      expect(pipelinesToolRegistry.has('list_pipeline_trigger_jobs')).toBe(true);

      const triggerTool = pipelinesToolRegistry.get('list_pipeline_trigger_jobs');
      expect(triggerTool!.description).toContain('List jobs that trigger');
    });
  });

  describe('Handler Functions', () => {
    const mockResponse = (data: any, ok = true, status = 200) => ({
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: jest.fn().mockResolvedValue(data),
      text: jest.fn().mockResolvedValue(data)
    });

    describe('list_pipelines handler', () => {
      it('should list pipelines with basic parameters', async () => {
        const mockPipelines = [
          { id: 1, status: 'success', ref: 'main', sha: 'abc123' },
          { id: 2, status: 'running', ref: 'feature-branch', sha: 'def456' }
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipelines) as any);

        const tool = pipelinesToolRegistry.get('list_pipelines')!;
        const result = await tool.handler({
          project_id: 'test/project'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining('https://gitlab.example.com/api/v4/projects/test%2Fproject/pipelines'),
          {
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockPipelines);
      });

      it('should list pipelines with filtering options', async () => {
        const mockPipelines = [{ id: 1, status: 'success', ref: 'main' }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipelines) as any);

        const tool = pipelinesToolRegistry.get('list_pipelines')!;
        await tool.handler({
          project_id: 'test/project',
          status: 'success',
          ref: 'main',
          per_page: 50,
          page: 1
        });

        const call = mockEnhancedFetch.mock.calls[0];
        const url = call[0] as string;
        expect(url).toContain('status=success');
        expect(url).toContain('ref=main');
        expect(url).toContain('per_page=50');
        expect(url).toContain('page=1');
      });

      it('should handle API errors', async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as any);

        const tool = pipelinesToolRegistry.get('list_pipelines')!;

        await expect(tool.handler({
          project_id: 'nonexistent/project'
        })).rejects.toThrow('GitLab API error: 404 Error');
      });
    });

    describe('get_pipeline handler', () => {
      it('should get pipeline by ID', async () => {
        const mockPipeline = {
          id: 1,
          iid: 1,
          status: 'success',
          ref: 'main',
          sha: 'abc123',
          web_url: 'https://gitlab.example.com/test/project/-/pipelines/1'
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipeline) as any);

        const tool = pipelinesToolRegistry.get('get_pipeline')!;
        const result = await tool.handler({
          project_id: 'test/project',
          pipeline_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/pipelines/1',
          {
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockPipeline);
      });

      it('should handle pipeline not found', async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as any);

        const tool = pipelinesToolRegistry.get('get_pipeline')!;

        await expect(tool.handler({
          project_id: 'test/project',
          pipeline_id: 999
        })).rejects.toThrow('GitLab API error: 404 Error');
      });
    });

    describe('list_pipeline_jobs handler', () => {
      it('should list jobs in pipeline', async () => {
        const mockJobs = [
          { id: 1, name: 'build', status: 'success', stage: 'build' },
          { id: 2, name: 'test', status: 'failed', stage: 'test' }
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJobs) as any);

        const tool = pipelinesToolRegistry.get('list_pipeline_jobs')!;
        const result = await tool.handler({
          project_id: 'test/project',
          pipeline_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining('https://gitlab.example.com/api/v4/projects/test%2Fproject/pipelines/1/jobs'),
          expect.any(Object)
        );
        expect(result).toEqual(mockJobs);
      });

      it('should list jobs with scope filter', async () => {
        const mockJobs = [{ id: 1, name: 'build', status: 'failed' }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJobs) as any);

        const tool = pipelinesToolRegistry.get('list_pipeline_jobs')!;
        await tool.handler({
          project_id: 'test/project',
          pipeline_id: 1,
          scope: ['failed']
        });

        const call = mockEnhancedFetch.mock.calls[0];
        const url = call[0] as string;
        expect(url).toContain('scope=failed');
      });
    });

    describe('list_pipeline_trigger_jobs handler', () => {
      it('should list trigger jobs (bridges)', async () => {
        const mockBridges = [
          { id: 1, name: 'trigger-downstream', status: 'success', downstream_pipeline: { id: 2 } }
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockBridges) as any);

        const tool = pipelinesToolRegistry.get('list_pipeline_trigger_jobs')!;
        const result = await tool.handler({
          project_id: 'test/project',
          pipeline_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining('https://gitlab.example.com/api/v4/projects/test%2Fproject/pipelines/1/bridges'),
          expect.any(Object)
        );
        expect(result).toEqual(mockBridges);
      });
    });

    describe('get_pipeline_job handler', () => {
      it('should get job details', async () => {
        const mockJob = {
          id: 1,
          name: 'build',
          status: 'success',
          stage: 'build',
          pipeline: { id: 1 },
          web_url: 'https://gitlab.example.com/test/project/-/jobs/1'
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJob) as any);

        const tool = pipelinesToolRegistry.get('get_pipeline_job')!;
        const result = await tool.handler({
          project_id: 'test/project',
          job_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/jobs/1',
          {
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockJob);
      });
    });

    describe('get_pipeline_job_output handler', () => {
      it('should get job trace without limit', async () => {
        const mockTrace = 'Running build...\nBuild successful\nTests passed';
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: jest.fn().mockResolvedValue(mockTrace)
        } as any);

        const tool = pipelinesToolRegistry.get('get_pipeline_job_output')!;
        const result = await tool.handler({
          project_id: 'test/project',
          job_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/jobs/1/trace',
          {
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual({ trace: mockTrace });
      });

      it('should truncate long job trace when limit is provided', async () => {
        const longTrace = Array(100).fill('Very long line with lots of content here').join('\n');
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: jest.fn().mockResolvedValue(longTrace)
        } as any);

        const tool = pipelinesToolRegistry.get('get_pipeline_job_output')!;
        const result = await tool.handler({
          project_id: 'test/project',
          job_id: 1,
          limit: 500
        });

        expect(result).toHaveProperty('trace');
        expect((result as any).trace).toContain('lines truncated');
        expect((result as any).trace.length).toBeLessThan(longTrace.length);
      });
    });

    describe('create_pipeline handler', () => {
      it('should create pipeline for branch', async () => {
        const mockPipeline = {
          id: 3,
          iid: 3,
          status: 'pending',
          ref: 'main',
          sha: 'new123'
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipeline) as any);

        const tool = pipelinesToolRegistry.get('create_pipeline')!;
        const result = await tool.handler({
          project_id: 'test/project',
          ref: 'main'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/pipeline?ref=main',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockPipeline);
      });

      it('should create pipeline with variables', async () => {
        const mockPipeline = { id: 4, status: 'pending', ref: 'feature' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipeline) as any);

        const tool = pipelinesToolRegistry.get('create_pipeline')!;
        await tool.handler({
          project_id: 'test/project',
          ref: 'feature',
          variables: [
            { key: 'BUILD_TYPE', value: 'release' },
            { key: 'DEPLOY', value: 'true' }
          ]
        });

        const call = mockEnhancedFetch.mock.calls[0];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.variables).toEqual([
          { key: 'BUILD_TYPE', value: 'release' },
          { key: 'DEPLOY', value: 'true' }
        ]);
      });
    });

    describe('retry_pipeline handler', () => {
      it('should retry failed pipeline', async () => {
        const mockPipeline = {
          id: 1,
          status: 'running',
          ref: 'main'
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipeline) as any);

        const tool = pipelinesToolRegistry.get('retry_pipeline')!;
        const result = await tool.handler({
          project_id: 'test/project',
          pipeline_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/pipelines/1/retry',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockPipeline);
      });
    });

    describe('cancel_pipeline handler', () => {
      it('should cancel running pipeline', async () => {
        const mockPipeline = {
          id: 1,
          status: 'canceled',
          ref: 'main'
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockPipeline) as any);

        const tool = pipelinesToolRegistry.get('cancel_pipeline')!;
        const result = await tool.handler({
          project_id: 'test/project',
          pipeline_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/pipelines/1/cancel',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockPipeline);
      });
    });

    describe('play_pipeline_job handler', () => {
      it('should play manual job', async () => {
        const mockJob = {
          id: 1,
          name: 'deploy',
          status: 'running'
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJob) as any);

        const tool = pipelinesToolRegistry.get('play_pipeline_job')!;
        const result = await tool.handler({
          project_id: 'test/project',
          job_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/jobs/1/play',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/json'
            },
            body: '{}'
          }
        );
        expect(result).toEqual(mockJob);
      });

      it('should play job with job variables', async () => {
        const mockJob = { id: 1, name: 'deploy', status: 'running' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJob) as any);

        const tool = pipelinesToolRegistry.get('play_pipeline_job')!;
        await tool.handler({
          project_id: 'test/project',
          job_id: 1,
          job_variables_attributes: [
            { key: 'ENVIRONMENT', value: 'production' }
          ]
        });

        const call = mockEnhancedFetch.mock.calls[0];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.job_variables_attributes).toEqual([
          { key: 'ENVIRONMENT', value: 'production' }
        ]);
      });
    });

    describe('retry_pipeline_job handler', () => {
      it('should retry failed job', async () => {
        const mockJob = {
          id: 1,
          name: 'test',
          status: 'running'
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJob) as any);

        const tool = pipelinesToolRegistry.get('retry_pipeline_job')!;
        const result = await tool.handler({
          project_id: 'test/project',
          job_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/jobs/1/retry',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockJob);
      });
    });

    describe('cancel_pipeline_job handler', () => {
      it('should cancel running job', async () => {
        const mockJob = {
          id: 1,
          name: 'build',
          status: 'canceled'
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockJob) as any);

        const tool = pipelinesToolRegistry.get('cancel_pipeline_job')!;
        const result = await tool.handler({
          project_id: 'test/project',
          job_id: 1
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/jobs/1/cancel',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockJob);
      });
    });

    describe('Error handling', () => {
      it('should handle validation errors', async () => {
        const tool = pipelinesToolRegistry.get('get_pipeline')!;

        // Test with invalid input that should fail Zod validation
        await expect(tool.handler({
          project_id: 123, // Should be string
          pipeline_id: 'not-a-number'
        })).rejects.toThrow();
      });

      it('should handle API errors with proper error messages', async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 403) as any);

        const tool = pipelinesToolRegistry.get('list_pipelines')!;

        await expect(tool.handler({
          project_id: 'private/project'
        })).rejects.toThrow('GitLab API error: 403 Error');
      });

      it('should handle network errors', async () => {
        mockEnhancedFetch.mockRejectedValueOnce(new Error('Connection timeout'));

        const tool = pipelinesToolRegistry.get('create_pipeline')!;

        await expect(tool.handler({
          project_id: 'test/project',
          ref: 'main'
        })).rejects.toThrow('Connection timeout');
      });
    });
  });
});