/**
 * Unit tests for handlers.ts
 * Tests MCP request handlers and tool execution
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { setupHandlers } from '../../src/handlers';
import { ConnectionManager } from '../../src/services/ConnectionManager';

// Mock dependencies
const mockEnhancedFetch = require('../__mocks__/enhancedFetch').mockEnhancedFetch;

// Mock ConnectionManager
const mockConnectionManager = {
  initialize: jest.fn(),
  getClient: jest.fn(),
  getInstanceInfo: jest.fn()
};

jest.mock('../../src/services/ConnectionManager', () => ({
  ConnectionManager: {
    getInstance: jest.fn(() => mockConnectionManager)
  }
}));

// Mock logger
jest.mock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock RegistryManager
const mockRegistryManager = {
  getAllToolDefinitions: jest.fn(),
  hasToolHandler: jest.fn(),
  executeTool: jest.fn()
};

jest.mock('../../src/registry-manager', () => ({
  RegistryManager: {
    getInstance: jest.fn(() => mockRegistryManager)
  }
}));

describe('handlers', () => {
  let mockServer: jest.Mocked<Server>;
  let listToolsHandler: any;
  let callToolHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock server
    mockServer = {
      setRequestHandler: jest.fn()
    } as any;

    // Mock ConnectionManager methods
    mockConnectionManager.initialize.mockResolvedValue(undefined);
    mockConnectionManager.getClient.mockReturnValue({});
    mockConnectionManager.getInstanceInfo.mockReturnValue({
      version: '16.0.0',
      tier: 'ultimate'
    });

    // Mock RegistryManager methods
    mockRegistryManager.getAllToolDefinitions.mockReturnValue([
      {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: { type: 'object', properties: {} }
      }
    ]);
    mockRegistryManager.hasToolHandler.mockReturnValue(true);
    mockRegistryManager.executeTool.mockResolvedValue({ result: 'success' });
  });

  describe('setupHandlers', () => {
    it('should initialize connection manager and set up request handlers', async () => {
      await setupHandlers(mockServer);

      // Should initialize connection manager
      expect(mockConnectionManager.initialize).toHaveBeenCalledTimes(1);

      // Should set up both handlers
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        ListToolsRequestSchema,
        expect.any(Function)
      );
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        CallToolRequestSchema,
        expect.any(Function)
      );

      // Capture the handlers for further testing
      listToolsHandler = mockServer.setRequestHandler.mock.calls[0][1];
      callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];
    });

    it('should continue setup even if connection initialization fails', async () => {
      mockConnectionManager.initialize.mockRejectedValue(new Error('Connection failed'));

      await setupHandlers(mockServer);

      // Should still set up handlers despite connection failure
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('list tools handler', () => {
    beforeEach(async () => {
      await setupHandlers(mockServer);
      listToolsHandler = mockServer.setRequestHandler.mock.calls[0][1];
    });

    it('should return list of tools from registry manager', async () => {
      const mockTools = [
        {
          name: 'get_project',
          description: 'Get project details',
          inputSchema: {
            type: 'object',
            properties: { id: { type: 'string' } },
            $schema: 'http://json-schema.org/draft-07/schema#'
          }
        },
        {
          name: 'list_projects',
          description: 'List all projects',
          inputSchema: { type: 'object', properties: {} }
        }
      ];

      mockRegistryManager.getAllToolDefinitions.mockReturnValue(mockTools);

      const result = await listToolsHandler({ method: 'tools/list' }, {});

      expect(result).toEqual({
        tools: [
          {
            name: 'get_project',
            description: 'Get project details',
            inputSchema: {
              type: 'object',
              properties: { id: { type: 'string' } }
            }
          },
          {
            name: 'list_projects',
            description: 'List all projects',
            inputSchema: { type: 'object', properties: {} }
          }
        ]
      });

      expect(mockRegistryManager.getAllToolDefinitions).toHaveBeenCalledTimes(1);
    });

    it('should remove $schema from input schemas for Gemini compatibility', async () => {
      const toolWithSchema = {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {},
          $schema: 'http://json-schema.org/draft-07/schema#'
        }
      };

      mockRegistryManager.getAllToolDefinitions.mockReturnValue([toolWithSchema]);

      const result = await listToolsHandler({ method: 'tools/list' }, {});

      expect(result.tools[0].inputSchema).not.toHaveProperty('$schema');
      expect(result.tools[0].inputSchema.type).toBe('object');
    });

    it('should force input schemas to be type object for MCP compatibility', async () => {
      const toolWithoutType = {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {
          properties: {}
        }
      };

      mockRegistryManager.getAllToolDefinitions.mockReturnValue([toolWithoutType]);

      const result = await listToolsHandler({ method: 'tools/list' }, {});

      expect(result.tools[0].inputSchema.type).toBe('object');
    });
  });

  describe('call tool handler', () => {
    beforeEach(async () => {
      await setupHandlers(mockServer);
      callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];
    });

    it('should execute tool and return result', async () => {
      const mockRequest = {
        params: {
          name: 'get_project',
          arguments: { id: 'test-project' }
        }
      };

      const mockResult = { id: 123, name: 'Test Project' };
      mockRegistryManager.executeTool.mockResolvedValue(mockResult);

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockResult, null, 2)
          }
        ]
      });

      expect(mockRegistryManager.hasToolHandler).toHaveBeenCalledWith('get_project');
      expect(mockRegistryManager.executeTool).toHaveBeenCalledWith('get_project', { id: 'test-project' });
    });

    it('should throw error if arguments are missing', async () => {
      const mockRequest = {
        params: {
          name: 'get_project'
          // arguments missing
        }
      };

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Arguments are required' }, null, 2)
          }
        ],
        isError: true
      });
    });

    it('should verify connection and continue if already initialized', async () => {
      const mockRequest = {
        params: {
          name: 'test_tool',
          arguments: {}
        }
      };

      await callToolHandler(mockRequest);

      expect(mockConnectionManager.getClient).toHaveBeenCalled();
      expect(mockConnectionManager.getInstanceInfo).toHaveBeenCalled();
      expect(mockConnectionManager.initialize).toHaveBeenCalledTimes(1); // Only from setupHandlers
    });

    it('should initialize connection if not already initialized', async () => {
      // Reset mocks to simulate uninitialized state
      mockConnectionManager.getClient.mockImplementationOnce(() => {
        throw new Error('Not initialized');
      });
      mockConnectionManager.getClient.mockReturnValue({}); // Success on retry

      const mockRequest = {
        params: {
          name: 'test_tool',
          arguments: {}
        }
      };

      await callToolHandler(mockRequest);

      expect(mockConnectionManager.initialize).toHaveBeenCalledTimes(2); // Once from setup, once from handler
    });

    it('should return error if connection initialization fails', async () => {
      // Simulate connection failure
      mockConnectionManager.getClient.mockImplementation(() => {
        throw new Error('Not initialized');
      });
      mockConnectionManager.initialize.mockRejectedValue(new Error('Connection failed'));

      const mockRequest = {
        params: {
          name: 'test_tool',
          arguments: {}
        }
      };

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Bad Request: Server not initialized' }, null, 2)
          }
        ],
        isError: true
      });
    });

    it('should return error if tool is not available', async () => {
      mockRegistryManager.hasToolHandler.mockReturnValue(false);

      const mockRequest = {
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      };

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: "Failed to execute tool 'unknown_tool': Tool 'unknown_tool' is not available or has been filtered out"
            }, null, 2)
          }
        ],
        isError: true
      });
    });

    it('should return error if tool execution fails', async () => {
      mockRegistryManager.executeTool.mockRejectedValue(new Error('Tool execution failed'));

      const mockRequest = {
        params: {
          name: 'test_tool',
          arguments: {}
        }
      };

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: "Failed to execute tool 'test_tool': Tool execution failed"
            }, null, 2)
          }
        ],
        isError: true
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockRegistryManager.executeTool.mockRejectedValue('String error');

      const mockRequest = {
        params: {
          name: 'test_tool',
          arguments: {}
        }
      };

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: "Failed to execute tool 'test_tool': String error"
            }, null, 2)
          }
        ],
        isError: true
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty arguments in tool call', async () => {
      await setupHandlers(mockServer);
      callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];

      const mockRequest = {
        params: {
          name: 'test_tool',
          arguments: {}
        }
      };

      const result = await callToolHandler(mockRequest);

      expect(mockRegistryManager.executeTool).toHaveBeenCalledWith('test_tool', {});
    });
  });
});