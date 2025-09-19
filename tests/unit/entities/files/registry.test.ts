import { filesToolRegistry, getFilesReadOnlyToolNames, getFilesToolDefinitions, getFilteredFilesTools } from '../../../../src/entities/files/registry';
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
  // Ensure mockEnhancedFetch is properly reset
  mockEnhancedFetch.mockReset();
});

describe('Files Registry', () => {
  describe('Registry Structure', () => {
    it('should be a Map instance', () => {
      expect(filesToolRegistry instanceof Map).toBe(true);
    });

    it('should contain expected file tools', () => {
      const toolNames = Array.from(filesToolRegistry.keys());

      // Check for read-only tools
      expect(toolNames).toContain('get_repository_tree');
      expect(toolNames).toContain('get_file_contents');

      // Check for write tools
      expect(toolNames).toContain('create_or_update_file');
      expect(toolNames).toContain('push_files');
      expect(toolNames).toContain('upload_markdown');
    });

    it('should have tools with valid structure', () => {
      for (const [toolName, tool] of filesToolRegistry) {
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
      const toolNames = Array.from(filesToolRegistry.keys());
      const uniqueNames = new Set(toolNames);

      expect(toolNames.length).toBe(uniqueNames.size);
    });
  });

  describe('Tool Definitions', () => {
    it('should have proper get_repository_tree tool', () => {
      const tool = filesToolRegistry.get('get_repository_tree');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_repository_tree');
      expect(tool?.description).toContain('BROWSE');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper get_file_contents tool', () => {
      const tool = filesToolRegistry.get('get_file_contents');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_file_contents');
      expect(tool?.description).toContain('READ');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper create_or_update_file tool', () => {
      const tool = filesToolRegistry.get('create_or_update_file');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('create_or_update_file');
      expect(tool?.description).toContain('SINGLE FILE');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper push_files tool', () => {
      const tool = filesToolRegistry.get('push_files');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('push_files');
      expect(tool?.description).toContain('BATCH');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper upload_markdown tool', () => {
      const tool = filesToolRegistry.get('upload_markdown');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('upload_markdown');
      expect(tool?.description).toContain('UPLOAD ASSET');
      expect(tool?.inputSchema).toBeDefined();
    });
  });

  describe('Read-Only Tools Function', () => {
    it('should return an array of read-only tool names', () => {
      const readOnlyTools = getFilesReadOnlyToolNames();

      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it('should include expected read-only tools', () => {
      const readOnlyTools = getFilesReadOnlyToolNames();

      expect(readOnlyTools).toContain('get_repository_tree');
      expect(readOnlyTools).toContain('get_file_contents');
    });

    it('should not include write tools', () => {
      const readOnlyTools = getFilesReadOnlyToolNames();

      expect(readOnlyTools).not.toContain('create_or_update_file');
      expect(readOnlyTools).not.toContain('push_files');
      expect(readOnlyTools).not.toContain('upload_markdown');
    });

    it('should return tools that exist in the registry', () => {
      const readOnlyTools = getFilesReadOnlyToolNames();
      const registryKeys = Array.from(filesToolRegistry.keys());

      for (const toolName of readOnlyTools) {
        expect(registryKeys).toContain(toolName);
      }
    });
  });

  describe('Tool Handlers', () => {
    it('should have handlers that are async functions', () => {
      for (const [, tool] of filesToolRegistry) {
        expect(tool.handler.constructor.name).toBe('AsyncFunction');
      }
    });

    it('should have handlers that accept arguments', () => {
      for (const [, tool] of filesToolRegistry) {
        expect(tool.handler.length).toBe(1); // Should accept one argument
      }
    });
  });

  describe('Registry Consistency', () => {
    it('should have all tools defined in registry', () => {
      const expectedTools = [
        'get_repository_tree',
        'get_file_contents',
        'create_or_update_file',
        'push_files',
        'upload_markdown',
      ];

      for (const toolName of expectedTools) {
        expect(filesToolRegistry.has(toolName)).toBe(true);
      }
    });

    it('should have consistent tool count', () => {
      const toolCount = filesToolRegistry.size;
      const readOnlyCount = getFilesReadOnlyToolNames().length;

      // Registry should have more tools than just read-only ones
      expect(toolCount).toBeGreaterThan(readOnlyCount);
      // Should have exactly 5 tools as defined above
      expect(toolCount).toBe(5);
    });
  });

  describe('Helper Functions', () => {
    describe('getFilesToolDefinitions', () => {
      it('should return all tool definitions', () => {
        const definitions = getFilesToolDefinitions();
        expect(definitions).toHaveLength(5);
        expect(definitions.every(def => def.name && def.description && def.inputSchema && def.handler)).toBe(true);
      });
    });

    describe('getFilteredFilesTools', () => {
      it('should return all tools when readOnlyMode is false', () => {
        const tools = getFilteredFilesTools(false);
        expect(tools).toHaveLength(5);
      });

      it('should return only read-only tools when readOnlyMode is true', () => {
        const tools = getFilteredFilesTools(true);
        expect(tools).toHaveLength(2);
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('get_repository_tree');
        expect(toolNames).toContain('get_file_contents');
        expect(toolNames).not.toContain('create_or_update_file');
      });
    });
  });

  describe('Handler Functions', () => {
    const mockResponse = (data: any, ok = true, status = 200) => ({
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: jest.fn().mockResolvedValue(data)
    });

    describe('get_repository_tree handler', () => {
      it('should get repository tree with basic params', async () => {
        const mockTree = [
          { id: '1', name: 'file1.txt', type: 'blob', path: 'file1.txt' },
          { id: '2', name: 'folder1', type: 'tree', path: 'folder1' }
        ];

        // Ensure mock is properly set up
        mockEnhancedFetch.mockClear();
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockTree) as any);

        const tool = filesToolRegistry.get('get_repository_tree')!;
        const result = await tool.handler({
          project_id: 'test/project'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining('https://gitlab.example.com/api/v4/projects/test%2Fproject/repository/tree'),
          {
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockTree);
      });

      it('should get repository tree with optional parameters', async () => {
        const mockTree = [{ id: '1', name: 'file1.txt', type: 'blob' }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockTree) as any);

        const tool = filesToolRegistry.get('get_repository_tree')!;
        await tool.handler({
          project_id: 'test/project',
          path: 'src/',
          ref: 'develop',
          recursive: true,
          per_page: 50
        });

        const call = mockEnhancedFetch.mock.calls[0];
        const url = call[0] as string;
        expect(url).toContain('path=src%2F');
        expect(url).toContain('ref=develop');
        expect(url).toContain('recursive=true');
        expect(url).toContain('per_page=50');
      });

      it('should handle API errors', async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as any);

        const tool = filesToolRegistry.get('get_repository_tree')!;

        await expect(tool.handler({
          project_id: 'nonexistent/project'
        })).rejects.toThrow('GitLab API error: 404 Error');
      });
    });

    describe('get_file_contents handler', () => {
      it('should get file contents', async () => {
        const mockFile = {
          file_name: 'README.md',
          file_path: 'README.md',
          size: 1024,
          encoding: 'base64',
          content: 'VGVzdCBjb250ZW50',
          ref: 'main'
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockFile) as any);

        const tool = filesToolRegistry.get('get_file_contents')!;
        const result = await tool.handler({
          project_id: 'test/project',
          file_path: 'README.md'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/repository/files/README.md?',
          {
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockFile);
      });

      it('should get file contents with ref parameter', async () => {
        const mockFile = { file_name: 'config.json', content: 'eyJjb25maWciOiJ0ZXN0In0=' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockFile) as any);

        const tool = filesToolRegistry.get('get_file_contents')!;
        await tool.handler({
          project_id: 'test/project',
          file_path: 'config/config.json',
          ref: 'feature-branch'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/repository/files/config%2Fconfig.json?ref=feature-branch',
          expect.any(Object)
        );
      });

      it('should handle file not found errors', async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as any);

        const tool = filesToolRegistry.get('get_file_contents')!;

        await expect(tool.handler({
          project_id: 'test/project',
          file_path: 'nonexistent.txt'
        })).rejects.toThrow('GitLab API error: 404 Error');
      });
    });

    describe('create_or_update_file handler', () => {
      it('should create/update file with basic data', async () => {
        const mockResult = {
          file_path: 'new-file.txt',
          branch: 'main',
          commit_id: 'abc123'
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockResult) as any);

        const tool = filesToolRegistry.get('create_or_update_file')!;
        const result = await tool.handler({
          project_id: 'test/project',
          file_path: 'new-file.txt',
          branch: 'main',
          content: 'New file content',
          commit_message: 'Add new file'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/repository/files/new-file.txt',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: expect.stringContaining('branch=main&content=New+file+content&commit_message=Add+new+file')
          }
        );
        expect(result).toEqual(mockResult);
      });

      it('should include optional parameters', async () => {
        const mockResult = { file_path: 'test.txt', branch: 'main' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockResult) as any);

        const tool = filesToolRegistry.get('create_or_update_file')!;
        await tool.handler({
          project_id: 'test/project',
          file_path: 'test.txt',
          branch: 'main',
          content: 'Test content',
          commit_message: 'Update file',
          author_email: 'test@example.com',
          author_name: 'Test Author',
          encoding: 'base64',
          last_commit_id: 'def456'
        });

        const call = mockEnhancedFetch.mock.calls[0];
        const body = call[1]?.body as string;
        expect(body).toContain('author_email=test%40example.com');
        expect(body).toContain('author_name=Test+Author');
        expect(body).toContain('encoding=base64');
        expect(body).toContain('last_commit_id=def456');
      });

      it('should handle creation conflicts', async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 409) as any);

        const tool = filesToolRegistry.get('create_or_update_file')!;

        await expect(tool.handler({
          project_id: 'test/project',
          file_path: 'existing-file.txt',
          branch: 'main',
          content: 'Content',
          commit_message: 'Create file'
        })).rejects.toThrow('GitLab API error: 409 Error');
      });
    });

    describe('push_files handler', () => {
      it('should push multiple files in single commit', async () => {
        const mockCommit = {
          id: 'abc123',
          short_id: 'abc123',
          title: 'Add multiple files',
          message: 'Add multiple files\n\n- Added file1.txt\n- Added file2.txt'
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockCommit) as any);

        const tool = filesToolRegistry.get('push_files')!;
        const result = await tool.handler({
          project_id: 'test/project',
          branch: 'main',
          commit_message: 'Add multiple files',
          files: [
            {
              file_path: 'file1.txt',
              content: 'Content 1',
              encoding: 'text'
            },
            {
              file_path: 'file2.txt',
              content: 'Content 2',
              execute_filemode: true
            }
          ]
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/repository/commits',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345',
              'Content-Type': 'application/json'
            },
            body: expect.stringContaining('"branch":"main"')
          }
        );

        const call = mockEnhancedFetch.mock.calls[0];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.actions).toHaveLength(2);
        expect(body.actions[0]).toEqual({
          action: 'create',
          file_path: 'file1.txt',
          content: 'Content 1',
          encoding: 'text',
          execute_filemode: false
        });
        expect(body.actions[1]).toEqual({
          action: 'create',
          file_path: 'file2.txt',
          content: 'Content 2',
          encoding: 'text',
          execute_filemode: true
        });
        expect(result).toEqual(mockCommit);
      });

      it('should include optional commit parameters', async () => {
        const mockCommit = { id: 'def456', title: 'Commit with author' };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockCommit) as any);

        const tool = filesToolRegistry.get('push_files')!;
        await tool.handler({
          project_id: 'test/project',
          branch: 'feature',
          commit_message: 'Commit with author',
          start_branch: 'main',
          author_email: 'author@example.com',
          author_name: 'Author Name',
          files: [
            {
              file_path: 'test.txt',
              content: 'Test content'
            }
          ]
        });

        const call = mockEnhancedFetch.mock.calls[0];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.start_branch).toBe('main');
        expect(body.author_email).toBe('author@example.com');
        expect(body.author_name).toBe('Author Name');
      });

      it('should handle empty files array', async () => {
        const tool = filesToolRegistry.get('push_files')!;

        // This should validate and fail with Zod schema validation
        await expect(tool.handler({
          project_id: 'test/project',
          branch: 'main',
          commit_message: 'Empty commit',
          files: []
        })).rejects.toThrow();
      });
    });

    describe('upload_markdown handler', () => {
      // Note: This is a complex handler that involves FormData and file processing
      // These tests focus on the API call structure rather than complex file processing

      it('should upload file for markdown use', async () => {
        const mockUpload = {
          alt: 'test-image',
          url: '/uploads/abc123/test-image.png',
          markdown: '![test-image](/uploads/abc123/test-image.png)'
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockUpload) as any);

        const tool = filesToolRegistry.get('upload_markdown')!;
        const result = await tool.handler({
          project_id: 'test/project',
          file: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', // 1x1 PNG base64
          filename: 'test-image.png'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/projects/test%2Fproject/uploads',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token-12345'
            },
            body: expect.any(FormData)
          }
        );
        expect(result).toEqual(mockUpload);
      });

      it('should handle upload errors', async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 413) as any);

        const tool = filesToolRegistry.get('upload_markdown')!;

        await expect(tool.handler({
          project_id: 'test/project',
          file: 'base64content',
          filename: 'large-file.zip'
        })).rejects.toThrow('GitLab API error: 413 Error');
      });
    });

    describe('Error handling', () => {
      it('should handle validation errors', async () => {
        const tool = filesToolRegistry.get('get_file_contents')!;

        // Test with invalid input that should fail Zod validation
        await expect(tool.handler({
          project_id: 123, // Should be string
          file_path: null // Should be string
        })).rejects.toThrow();
      });

      it('should handle API errors with proper error messages', async () => {
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 500) as any);

        const tool = filesToolRegistry.get('get_repository_tree')!;

        await expect(tool.handler({
          project_id: 'test/project'
        })).rejects.toThrow('GitLab API error: 500 Error');
      });

      it('should handle network errors', async () => {
        mockEnhancedFetch.mockRejectedValueOnce(new Error('Network error'));

        const tool = filesToolRegistry.get('create_or_update_file')!;

        await expect(tool.handler({
          project_id: 'test/project',
          file_path: 'test.txt',
          branch: 'main',
          content: 'content',
          commit_message: 'test'
        })).rejects.toThrow('Network error');
      });
    });
  });
});