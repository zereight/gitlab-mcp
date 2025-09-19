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
  sessionId: 'test-session-123'
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

  // Note: setupHandlers integration is tested separately in handlers.test.ts
});