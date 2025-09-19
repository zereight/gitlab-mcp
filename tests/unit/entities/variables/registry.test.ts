import { variablesToolRegistry, getVariablesReadOnlyToolNames, getVariablesToolDefinitions, getFilteredVariablesTools } from '../../../../src/entities/variables/registry';
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

describe('Variables Registry', () => {
  describe('Registry Structure', () => {
    it('should be a Map instance', () => {
      expect(variablesToolRegistry instanceof Map).toBe(true);
    });

    it('should contain expected variable tools', () => {
      const toolNames = Array.from(variablesToolRegistry.keys());

      // Check for read-only tools
      expect(toolNames).toContain('list_variables');
      expect(toolNames).toContain('get_variable');

      // Check for write tools
      expect(toolNames).toContain('create_variable');
      expect(toolNames).toContain('update_variable');
      expect(toolNames).toContain('delete_variable');
    });

    it('should have tools with valid structure', () => {
      for (const [toolName, tool] of variablesToolRegistry) {
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
      const toolNames = Array.from(variablesToolRegistry.keys());
      const uniqueNames = new Set(toolNames);

      expect(toolNames.length).toBe(uniqueNames.size);
    });
  });

  describe('Tool Definitions', () => {
    it('should have proper list_variables tool', () => {
      const tool = variablesToolRegistry.get('list_variables');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('list_variables');
      expect(tool?.description).toContain('CI/CD environment variables');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper get_variable tool', () => {
      const tool = variablesToolRegistry.get('get_variable');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_variable');
      expect(tool?.description).toContain('specific CI/CD variable');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper create_variable tool', () => {
      const tool = variablesToolRegistry.get('create_variable');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('create_variable');
      expect(tool?.description).toContain('Add new CI/CD');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper update_variable tool', () => {
      const tool = variablesToolRegistry.get('update_variable');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('update_variable');
      expect(tool?.description).toContain('Modify CI/CD variable');
      expect(tool?.inputSchema).toBeDefined();
    });

    it('should have proper delete_variable tool', () => {
      const tool = variablesToolRegistry.get('delete_variable');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('delete_variable');
      expect(tool?.description).toContain('Delete CI/CD variable');
      expect(tool?.inputSchema).toBeDefined();
    });
  });

  describe('Read-Only Tools Function', () => {
    it('should return an array of read-only tool names', () => {
      const readOnlyTools = getVariablesReadOnlyToolNames();

      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it('should include expected read-only tools', () => {
      const readOnlyTools = getVariablesReadOnlyToolNames();

      expect(readOnlyTools).toContain('list_variables');
      expect(readOnlyTools).toContain('get_variable');
    });

    it('should not include write tools', () => {
      const readOnlyTools = getVariablesReadOnlyToolNames();

      expect(readOnlyTools).not.toContain('create_variable');
      expect(readOnlyTools).not.toContain('update_variable');
      expect(readOnlyTools).not.toContain('delete_variable');
    });

    it('should return tools that exist in the registry', () => {
      const readOnlyTools = getVariablesReadOnlyToolNames();
      const registryKeys = Array.from(variablesToolRegistry.keys());

      for (const toolName of readOnlyTools) {
        expect(registryKeys).toContain(toolName);
      }
    });
  });

  describe('Tool Handlers', () => {
    it('should have handlers that are async functions', () => {
      for (const [, tool] of variablesToolRegistry) {
        expect(tool.handler.constructor.name).toBe('AsyncFunction');
      }
    });

    it('should have handlers that accept arguments', () => {
      for (const [, tool] of variablesToolRegistry) {
        expect(tool.handler.length).toBe(1); // Should accept one argument
      }
    });
  });

  describe('Registry Consistency', () => {
    it('should have all tools defined in registry', () => {
      const expectedTools = [
        'list_variables',
        'get_variable',
        'create_variable',
        'update_variable',
        'delete_variable',
      ];

      for (const toolName of expectedTools) {
        expect(variablesToolRegistry.has(toolName)).toBe(true);
      }
    });

    it('should have consistent tool count', () => {
      const toolCount = variablesToolRegistry.size;
      const readOnlyCount = getVariablesReadOnlyToolNames().length;

      // Registry should have more tools than just read-only ones
      expect(toolCount).toBeGreaterThan(readOnlyCount);
      // Should have exactly 5 tools as defined above
      expect(toolCount).toBe(5);
    });
  });

  describe('Variable Tool Specifics', () => {
    it('should support both project and group variables', () => {
      const listTool = variablesToolRegistry.get('list_variables');
      const getTool = variablesToolRegistry.get('get_variable');

      expect(listTool?.description).toContain('Group variables are inherited');
      expect(getTool?.description).toContain('specific CI/CD variable');
    });

    it('should mention CI/CD context in descriptions', () => {
      const toolNames = Array.from(variablesToolRegistry.keys());

      for (const toolName of toolNames) {
        const tool = variablesToolRegistry.get(toolName);
        expect(tool?.description.toLowerCase()).toMatch(/ci\/cd|variable/);
      }
    });
  });

  describe('Helper Functions', () => {
    describe('getVariablesToolDefinitions', () => {
      it('should return all tool definitions', () => {
        const definitions = getVariablesToolDefinitions();
        expect(definitions).toHaveLength(5);
        expect(definitions.every(def => def.name && def.description && def.inputSchema && def.handler)).toBe(true);
      });
    });

    describe('getFilteredVariablesTools', () => {
      it('should return all tools when readOnlyMode is false', () => {
        const tools = getFilteredVariablesTools(false);
        expect(tools).toHaveLength(5);
      });

      it('should return only read-only tools when readOnlyMode is true', () => {
        const tools = getFilteredVariablesTools(true);
        expect(tools).toHaveLength(2);
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('list_variables');
        expect(toolNames).toContain('get_variable');
        expect(toolNames).not.toContain('create_variable');
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

    describe('list_variables handler', () => {
      it('should list project variables', async () => {
        const mockVariables = [
          { key: 'API_KEY', value: '[hidden]', protected: true, masked: true, environment_scope: '*' },
          { key: 'DB_PASSWORD', value: '[hidden]', protected: true, masked: true, environment_scope: 'production' }
        ];

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual variables API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue(mockVariables)
        } as any);

        const tool = variablesToolRegistry.get('list_variables')!;
        const result = await tool.handler({
          namespacePath: 'test/project'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariables);
      });

      it('should list group variables', async () => {
        const mockVariables = [
          { key: 'GROUP_TOKEN', value: '[hidden]', protected: false, masked: true, environment_scope: '*' }
        ];

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 456, name: 'test-group' })
        } as any);

        // Mock actual variables API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue(mockVariables)
        } as any);

        const tool = variablesToolRegistry.get('list_variables')!;
        const result = await tool.handler({
          namespacePath: 'test-group'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/groups/test-group/variables',
          {
            headers: {
              Authorization: 'Bearer test-token-12345'
            }
          }
        );
        expect(result).toEqual(mockVariables);
      });

      it('should handle API errors', async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'private-project' })
        } as any);

        // Mock actual variables API call - fails with 403
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Error',
          json: jest.fn().mockResolvedValue(null)
        } as any);

        const tool = variablesToolRegistry.get('list_variables')!;

        await expect(tool.handler({
          namespacePath: 'private/project'
        })).rejects.toThrow('GitLab API error: 403 Error');
      });
    });

    describe('get_variable handler', () => {
      it('should get project variable by key', async () => {
        const mockVariable = {
          key: 'API_KEY',
          value: '[hidden]',
          variable_type: 'env_var',
          protected: true,
          masked: true,
          environment_scope: '*'
        };

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual get variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue(mockVariable)
        } as any);

        const tool = variablesToolRegistry.get('get_variable')!;
        const result = await tool.handler({
          namespacePath: 'test/project',
          key: 'API_KEY'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it('should get group variable with environment scope filter', async () => {
        const mockVariable = {
          key: 'DB_URL',
          value: '[hidden]',
          environment_scope: 'production'
        };

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 456, name: 'test-group' })
        } as any);

        // Mock actual get variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue(mockVariable)
        } as any);

        const tool = variablesToolRegistry.get('get_variable')!;
        const result = await tool.handler({
          namespacePath: 'test-group',
          key: 'DB_URL',
          filter: {
            environment_scope: 'production'
          }
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it('should handle variable not found', async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual get variable API call - fails with 404
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Error',
          json: jest.fn().mockResolvedValue(null)
        } as any);

        const tool = variablesToolRegistry.get('get_variable')!;

        await expect(tool.handler({
          namespacePath: 'test/project',
          key: 'NONEXISTENT_KEY'
        })).rejects.toThrow('GitLab API error: 404 Error');
      });
    });

    describe('create_variable handler', () => {
      it('should create project variable with basic settings', async () => {
        const mockVariable = {
          key: 'NEW_API_KEY',
          value: 'secret123',
          variable_type: 'env_var',
          protected: false,
          masked: false,
          environment_scope: '*'
        };

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual create variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue(mockVariable)
        } as any);

        const tool = variablesToolRegistry.get('create_variable')!;
        const result = await tool.handler({
          namespacePath: 'test/project',
          key: 'NEW_API_KEY',
          value: 'secret123'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it('should create group variable with advanced settings', async () => {
        const mockVariable = {
          key: 'DEPLOY_KEY',
          value: '[hidden]',
          variable_type: 'file',
          protected: true,
          masked: true,
          environment_scope: 'production'
        };

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 456, name: 'test-group' })
        } as any);

        // Mock actual create variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue(mockVariable)
        } as any);

        const tool = variablesToolRegistry.get('create_variable')!;
        const result = await tool.handler({
          namespacePath: 'test-group',
          key: 'DEPLOY_KEY',
          value: 'ssh-rsa AAAAB3NzaC1yc2E...',
          variable_type: 'file',
          protected: true,
          masked: true,
          environment_scope: 'production'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it('should handle variable creation conflicts', async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual create variable API call - fails with 400
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Error',
          json: jest.fn().mockResolvedValue(null)
        } as any);

        const tool = variablesToolRegistry.get('create_variable')!;

        await expect(tool.handler({
          namespacePath: 'test/project',
          key: 'EXISTING_KEY',
          value: 'value'
        })).rejects.toThrow('GitLab API error: 400 Error');
      });
    });

    describe('update_variable handler', () => {
      it('should update project variable', async () => {
        const mockVariable = {
          key: 'API_KEY',
          value: '[hidden]',
          variable_type: 'env_var',
          protected: true,
          masked: true,
          environment_scope: '*'
        };

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual update variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue(mockVariable)
        } as any);

        const tool = variablesToolRegistry.get('update_variable')!;
        const result = await tool.handler({
          namespacePath: 'test/project',
          key: 'API_KEY',
          value: 'new-secret-value',
          protected: true,
          masked: true
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it('should update group variable with environment scope filter', async () => {
        const mockVariable = {
          key: 'DB_PASSWORD',
          value: '[hidden]',
          environment_scope: 'staging'
        };

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 456, name: 'test-group' })
        } as any);

        // Mock actual update variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue(mockVariable)
        } as any);

        const tool = variablesToolRegistry.get('update_variable')!;
        const result = await tool.handler({
          namespacePath: 'test-group',
          key: 'DB_PASSWORD',
          value: 'new-password',
          filter: {
            environment_scope: 'staging'
          }
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it('should handle variable update errors', async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual update variable API call - fails with 404
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Error',
          json: jest.fn().mockResolvedValue(null)
        } as any);

        const tool = variablesToolRegistry.get('update_variable')!;

        await expect(tool.handler({
          namespacePath: 'test/project',
          key: 'NONEXISTENT_KEY',
          value: 'value'
        })).rejects.toThrow('GitLab API error: 404 Error');
      });
    });

    describe('delete_variable handler', () => {
      it('should delete project variable', async () => {
        const mockResult = { message: 'Variable deleted successfully' };

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual delete variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue(mockResult)
        } as any);

        const tool = variablesToolRegistry.get('delete_variable')!;
        const result = await tool.handler({
          namespacePath: 'test/project',
          key: 'OLD_API_KEY'
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockResult);
      });

      it('should delete group variable with environment scope', async () => {
        const mockResult = { message: 'Variable deleted' };

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 456, name: 'test-group' })
        } as any);

        // Mock actual delete variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue(mockResult)
        } as any);

        const tool = variablesToolRegistry.get('delete_variable')!;
        const result = await tool.handler({
          namespacePath: 'test-group',
          key: 'TEMP_TOKEN',
          filter: {
            environment_scope: 'development'
          }
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockResult);
      });

      it('should handle variable deletion errors', async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual delete variable API call - fails with 404
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Error',
          json: jest.fn().mockResolvedValue(null)
        } as any);

        const tool = variablesToolRegistry.get('delete_variable')!;

        await expect(tool.handler({
          namespacePath: 'test/project',
          key: 'NONEXISTENT_KEY'
        })).rejects.toThrow('GitLab API error: 404 Error');
      });
    });

    describe('Error handling', () => {
      it('should handle validation errors', async () => {
        const tool = variablesToolRegistry.get('get_variable')!;

        // Test with invalid input that should fail Zod validation
        await expect(tool.handler({
          namespacePath: 123, // Should be string
          key: null // Should be string
        })).rejects.toThrow();
      });

      it('should handle API errors with proper error messages', async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual list variables API call - fails with 500
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Error',
          json: jest.fn().mockResolvedValue(null)
        } as any);

        const tool = variablesToolRegistry.get('list_variables')!;

        await expect(tool.handler({
          namespacePath: 'test/project'
        })).rejects.toThrow('GitLab API error: 500 Error');
      });

      it('should handle network errors', async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockResolvedValue({ id: 123, name: 'test-project' })
        } as any);

        // Mock actual create variable API call - fails with network error
        mockEnhancedFetch.mockRejectedValueOnce(new Error('Network error'));

        const tool = variablesToolRegistry.get('create_variable')!;

        await expect(tool.handler({
          namespacePath: 'test/project',
          key: 'TEST_KEY',
          value: 'test-value'
        })).rejects.toThrow('Network error');
      });
    });
  });
});