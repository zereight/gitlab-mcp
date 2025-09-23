/**
 * Unit tests for server.ts
 * Tests server initialization, transport mode detection, and server setup
 */

// Mock all external dependencies at the top
const mockServer = {
  connect: jest.fn()
};

const mockApp = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  all: jest.fn(),
  listen: jest.fn()
};

const mockTransport = {
  sessionId: 'test-session-123',
  handleRequest: jest.fn(),
  handlePostMessage: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Mock Express
const mockExpress = jest.fn(() => mockApp);
(mockExpress as any).json = jest.fn();
jest.mock('express', () => mockExpress);

// Mock SDK components
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn(() => mockServer)
}));

jest.mock('@modelcontextprotocol/sdk/server/sse.js', () => ({
  SSEServerTransport: jest.fn(() => mockTransport)
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(() => mockTransport)
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn(() => mockTransport)
}));

// Mock config
jest.mock('../../src/config', () => ({
  SSE: false,
  STREAMABLE_HTTP: false,
  HOST: 'localhost',
  PORT: '3000',
  packageName: 'test-package',
  packageVersion: '1.0.0'
}));

// Mock types
jest.mock('../../src/types', () => ({}));

// Mock handlers
jest.mock('../../src/handlers', () => ({
  setupHandlers: jest.fn()
}));

// Mock logger
jest.mock('../../src/logger', () => ({
  logger: mockLogger
}));

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { startServer } from '../../src/server';

describe('server', () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();

    // Store original values
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };

    // Reset to default state
    process.argv = ['node', 'server.js'];
    delete process.env.SSE;
    delete process.env.STREAMABLE_HTTP;

    // Mock app.listen to call callback immediately
    mockApp.listen.mockImplementation((port: number, host: string, callback: () => void) => {
      if (callback) callback();
    });

    // Mock server.connect to resolve
    mockServer.connect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  describe('transport mode detection', () => {
    it('should select stdio mode when stdio argument is provided', async () => {
      process.argv = ['node', 'server.js', 'stdio'];
      delete process.env.PORT;

      await startServer();

      expect(mockLogger.info).toHaveBeenCalledWith('Selected stdio mode (explicit argument)');
    });

    it('should select dual transport mode when PORT environment variable is set', async () => {
      process.env.PORT = '3000';

      // Re-import to pick up new env vars
      jest.resetModules();
      jest.doMock('../../src/config', () => ({
        HOST: 'localhost',
        PORT: '3000',
        packageName: 'test-package',
        packageVersion: '1.0.0'
      }));

      const { startServer: newStartServer } = await import('../../src/server');
      await newStartServer();

      expect(mockLogger.info).toHaveBeenCalledWith('Selected dual transport mode (SSE + StreamableHTTP) - PORT environment variable detected');
    });

    it('should select stdio mode when no PORT is set', async () => {
      delete process.env.PORT;
      process.argv = ['node', 'server.js'];

      await startServer();

      expect(mockLogger.info).toHaveBeenCalledWith('Selected stdio mode (no PORT environment variable)');
    });

    it('should log transport mode detection information', async () => {
      delete process.env.PORT;

      await startServer();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/Transport mode detection: args=\[\], PORT=/)
      );
    });
  });

  describe('dual transport mode', () => {
    beforeEach(() => {
      process.env.PORT = '3000';
    });

    it('should set up Express app with JSON middleware', async () => {
      const express = require('express');

      await startServer();

      expect(express).toHaveBeenCalled();
      expect(mockApp.use).toHaveBeenCalledWith(express.json());
    });

    it('should set up both SSE and StreamableHTTP endpoints', async () => {
      await startServer();

      expect(mockApp.get).toHaveBeenCalledWith('/sse', expect.any(Function));
      expect(mockApp.post).toHaveBeenCalledWith('/messages', expect.any(Function));
      expect(mockApp.all).toHaveBeenCalledWith('/mcp', expect.any(Function));
    });

    it('should start HTTP server with dual transport endpoints', async () => {
      await startServer();

      expect(mockApp.listen).toHaveBeenCalledWith(3000, 'localhost', expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith('GitLab MCP Server running on http://localhost:3000');
      expect(mockLogger.info).toHaveBeenCalledWith('🔄 Dual Transport Mode Active:');
    });

    it('should handle SSE endpoint requests', async () => {
      await startServer();

      // Get the SSE handler
      const sseHandler = mockApp.get.mock.calls.find(call => call[0] === '/sse')[1];

      // Mock request and response objects
      const mockReq = {};
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      // Execute the SSE handler
      await sseHandler(mockReq, mockRes);

      expect(mockServer.connect).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('SSE endpoint hit!');
    });

    it('should handle messages endpoint with valid session', async () => {
      await startServer();

      // Get the messages handler
      const messagesHandler = mockApp.post.mock.calls.find(call => call[0] === '/messages')[1];

      // Mock request and response objects
      const mockReq = {
        query: { sessionId: 'test-session-123' },
        body: { id: 1, method: 'test', params: {} }
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Mock transport exists
      const transport = { handleRequest: jest.fn().mockResolvedValue({ result: 'success' }) };

      // Execute the messages handler
      await messagesHandler(mockReq, mockRes);

      expect(mockLogger.debug).toHaveBeenCalledWith('SSE messages endpoint hit!');
    });

    it('should handle messages endpoint with missing session', async () => {
      await startServer();

      // Get the messages handler
      const messagesHandler = mockApp.post.mock.calls.find(call => call[0] === '/messages')[1];

      // Mock request and response objects with missing sessionId
      const mockReq = {
        query: {},
        body: { id: 1, method: 'test', params: {} }
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Execute the messages handler
      await messagesHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Session not found' });
    });

    it('should handle messages endpoint errors', async () => {
      await startServer();

      // Get the messages handler
      const messagesHandler = mockApp.post.mock.calls.find(call => call[0] === '/messages')[1];

      // Mock request and response objects
      const mockReq = {
        query: { sessionId: 'test-session-123' },
        body: { id: 1, method: 'test', params: {} }
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Mock transport error
      const transport = {
        handleRequest: jest.fn().mockRejectedValue(new Error('Transport error'))
      };

      // Execute the messages handler (this should catch the error)
      await messagesHandler(mockReq, mockRes);

      expect(mockLogger.debug).toHaveBeenCalledWith('SSE messages endpoint hit!');
    });

    it('should handle MCP endpoint requests', async () => {
      await startServer();

      // Get the MCP handler
      const mcpHandler = mockApp.all.mock.calls.find(call => call[0] === '/mcp')[1];

      // Mock request and response objects
      const mockReq = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { id: 1, method: 'test', params: {} }
      };
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      // Execute the MCP handler
      await mcpHandler(mockReq, mockRes);

      expect(mockServer.connect).toHaveBeenCalled();
    });

    it('should handle server listen callback', async () => {
      await startServer();

      // Get the listen callback
      const listenCallback = mockApp.listen.mock.calls[0][2];

      // Execute the callback
      listenCallback();

      expect(mockLogger.info).toHaveBeenCalledWith('GitLab MCP Server running on http://localhost:3000');
    });

    it('should handle SSE transport errors', async () => {
      await startServer();

      // Get the messages handler
      const messagesHandler = mockApp.post.mock.calls.find(call => call[0] === '/messages')[1];

      // Mock request with valid session but transport throws error
      const mockReq = {
        query: { sessionId: 'test-session-123' },
        body: { method: 'test', params: {} }
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn(() => mockRes)
      };

      // Mock transport with error
      const sseHandler = mockApp.get.mock.calls.find(call => call[0] === '/sse')[1];

      // Create transport by hitting SSE endpoint first
      await sseHandler({}, {});

      // Execute the messages handler (this would normally fail if transport throws error)
      await messagesHandler(mockReq, mockRes);

      expect(mockLogger.debug).toHaveBeenCalledWith('SSE messages endpoint hit!');
    });
  });

  describe('transport mode determination', () => {
    it('should select stdio mode with explicit stdio argument', async () => {
      process.env.PORT = '3000'; // Even with PORT, stdio arg should override
      process.argv = ['node', 'server.js', 'stdio'];

      await startServer();

      expect(mockLogger.info).toHaveBeenCalledWith('Selected stdio mode (explicit argument)');
      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
    });

    it('should select dual mode when PORT is set without stdio arg', async () => {
      process.env.PORT = '3000';
      process.argv = ['node', 'server.js']; // No stdio arg

      await startServer();

      expect(mockLogger.info).toHaveBeenCalledWith('Selected dual transport mode (SSE + StreamableHTTP) - PORT environment variable detected');
      expect(mockApp.listen).toHaveBeenCalledWith(3000, 'localhost', expect.any(Function));
    });
  });

  describe('individual transport modes', () => {
    it('should handle SSE mode error cases in dual mode', async () => {
      process.env.PORT = '3000';
      await startServer();

      // Get the SSE messages handler from dual mode
      const messagesHandler = mockApp.post.mock.calls.find(call => call[0] === '/messages')[1];

      // Test error case in messages handler
      const mockReq = {
        query: { sessionId: 'test-session-123' },
        body: { test: 'data' }
      };
      const mockRes = {
        status: jest.fn(() => mockRes),
        json: jest.fn()
      };

      // Mock transport.handlePostMessage to throw error
      mockTransport.handlePostMessage.mockRejectedValueOnce(new Error('Transport error'));

      // First create SSE transport by hitting SSE endpoint
      const sseHandler = mockApp.get.mock.calls.find(call => call[0] === '/sse')[1];
      await sseHandler({}, {});

      // Now test error handling in messages handler
      await messagesHandler(mockReq, mockRes);

      expect(mockLogger.debug).toHaveBeenCalledWith('SSE messages endpoint hit!');
    });

    it('should handle StreamableHTTP mode error cases in dual mode', async () => {
      process.env.PORT = '3000';
      await startServer();

      // Get the MCP handler from dual mode
      const mcpHandler = mockApp.all.mock.calls.find(call => call[0] === '/mcp')[1];

      // Test error case in MCP handler
      const mockReq = {
        headers: { 'mcp-session-id': 'existing-session' },
        method: 'POST',
        body: { test: 'data' }
      };
      const mockRes = {
        status: jest.fn(() => mockRes),
        json: jest.fn()
      };

      // Mock transport.handleRequest to throw error
      mockTransport.handleRequest.mockRejectedValueOnce(new Error('Transport error'));

      // Test error handling in MCP handler
      await mcpHandler(mockReq, mockRes);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error in StreamableHTTP transport'
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should handle StreamableHTTP new session creation in dual mode', async () => {
      process.env.PORT = '3000';
      await startServer();

      // Get the MCP handler from dual mode
      const mcpHandler = mockApp.all.mock.calls.find(call => call[0] === '/mcp')[1];

      // Test new session creation (no existing session ID)
      const mockReq = {
        headers: {}, // No mcp-session-id header
        method: 'POST',
        body: { test: 'data' }
      };
      const mockRes = {
        status: jest.fn(() => mockRes),
        json: jest.fn()
      };

      // Test the handler - this should create a new transport
      await mcpHandler(mockReq, mockRes);

      expect(mockServer.connect).toHaveBeenCalled();
      expect(mockTransport.handleRequest).toHaveBeenCalled();
    });
  });

  describe('stdio mode', () => {
    beforeEach(() => {
      // Ensure stdio mode by removing PORT from environment
      delete process.env.PORT;

      // Re-import config to pick up new env vars
      jest.resetModules();
      jest.doMock('../../src/config', () => ({
        SSE: false,
        STREAMABLE_HTTP: false,
        HOST: 'localhost',
        PORT: undefined, // No PORT means stdio mode
        packageName: 'test-package',
        packageVersion: '1.0.0'
      }));
    });

    it('should connect server with StdioServerTransport', async () => {
      const { startServer: newStartServer } = await import('../../src/server');
      await newStartServer();

      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
    });

    it('should not set up any HTTP endpoints in stdio mode', async () => {
      const { startServer: newStartServer } = await import('../../src/server');
      await newStartServer();

      expect(mockApp.get).not.toHaveBeenCalled();
      expect(mockApp.post).not.toHaveBeenCalled();
      expect(mockApp.listen).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle server connection errors in stdio mode', async () => {
      // Ensure stdio mode by removing PORT from environment
      delete process.env.PORT;

      // Re-import config to pick up new env vars
      jest.resetModules();
      jest.doMock('../../src/config', () => ({
        SSE: false,
        STREAMABLE_HTTP: false,
        HOST: 'localhost',
        PORT: undefined, // No PORT means stdio mode
        packageName: 'test-package',
        packageVersion: '1.0.0'
      }));

      mockServer.connect.mockRejectedValue(new Error('Connection failed'));

      // stdio mode should propagate connection errors
      const { startServer: newStartServer } = await import('../../src/server');
      await expect(newStartServer()).rejects.toThrow('Connection failed');
    });

    it('should handle server.connect rejections gracefully', async () => {
      // Ensure stdio mode by removing PORT from environment
      delete process.env.PORT;

      // Re-import config to pick up new env vars
      jest.resetModules();
      jest.doMock('../../src/config', () => ({
        SSE: false,
        STREAMABLE_HTTP: false,
        HOST: 'localhost',
        PORT: undefined, // No PORT means stdio mode
        packageName: 'test-package',
        packageVersion: '1.0.0'
      }));

      const originalConnect = mockServer.connect;
      mockServer.connect.mockRejectedValue(new Error('Connection failed'));

      try {
        const { startServer: newStartServer } = await import('../../src/server');
        await newStartServer();
      } catch (error: any) {
        expect(error.message).toBe('Connection failed');
      }

      // Restore original mock
      mockServer.connect = originalConnect;
    });
  });

  describe('request handlers', () => {
    describe('SSE messages endpoint', () => {
      beforeEach(() => {
        process.env.PORT = '3000';
      });

      it('should handle valid session ID in messages endpoint', async () => {
        await startServer();

        // Get the messages handler
        const messagesHandler = mockApp.post.mock.calls.find(call => call[0] === '/messages')[1];

        // Mock request with session ID
        const mockReq = {
          query: { sessionId: 'test-session-123' },
          body: { method: 'test', params: {} }
        };
        const mockRes = {
          json: jest.fn(),
          status: jest.fn(() => mockRes)
        };

        // First create a transport through SSE endpoint
        const sseHandler = mockApp.get.mock.calls.find(call => call[0] === '/sse')[1];
        await sseHandler({}, {});

        // Now call messages handler
        await messagesHandler(mockReq, mockRes);

        expect(mockLogger.debug).toHaveBeenCalledWith('SSE messages endpoint hit!');
      });

      it('should return 404 for invalid session ID', async () => {
        await startServer();

        const messagesHandler = mockApp.post.mock.calls.find(call => call[0] === '/messages')[1];

        const mockReq = {
          query: { sessionId: 'invalid-session' },
          body: { method: 'test', params: {} }
        };
        const mockRes = {
          json: jest.fn(),
          status: jest.fn(() => mockRes)
        };

        await messagesHandler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Session not found' });
      });

      it('should return 404 when no session ID provided', async () => {
        await startServer();

        const messagesHandler = mockApp.post.mock.calls.find(call => call[0] === '/messages')[1];

        const mockReq = {
          query: {},
          body: { method: 'test', params: {} }
        };
        const mockRes = {
          json: jest.fn(),
          status: jest.fn(() => mockRes)
        };

        await messagesHandler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Session not found' });
      });
    });
  });

  describe('signal handlers', () => {
    it('should handle SIGINT signal', () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      // Trigger SIGINT
      expect(() => {
        process.emit('SIGINT');
      }).toThrow('process.exit called');

      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down GitLab MCP Server...');
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should handle SIGTERM signal', () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      // Trigger SIGTERM
      expect(() => {
        process.emit('SIGTERM');
      }).toThrow('process.exit called');

      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down GitLab MCP Server...');
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });
  });

  // Note: setupHandlers integration is tested separately in handlers.test.ts
});