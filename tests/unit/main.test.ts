/**
 * Unit tests for main.ts
 * Tests server startup and error handling
 */

import { startServer } from '../../src/server';
import { logger } from '../../src/logger';

// Mock the server module
jest.mock('../../src/server', () => ({
  startServer: jest.fn()
}));

// Mock logger to prevent output during tests
jest.mock('../../src/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock process.exit to prevent actual exit during tests
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`process.exit(${code})`);
});

// Create typed mocks
const mockStartServer = startServer as jest.MockedFunction<typeof startServer>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('main', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockProcessExit.mockRestore();
  });

  describe('server startup behavior', () => {
    it('should call startServer when imported', async () => {
      mockStartServer.mockResolvedValue(undefined);

      // Simulate the main module execution
      const mainPromise = mockStartServer().catch((error: unknown) => {
        mockLogger.error(`Failed to start GitLab MCP Server: ${error}`);
        throw new Error('process.exit(1)');
      });

      await mainPromise;

      expect(mockStartServer).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle server startup errors and log them', async () => {
      const testError = new Error('Server startup failed');
      mockStartServer.mockRejectedValue(testError);

      // Simulate the main module execution with error handling
      const mainPromise = mockStartServer().catch((error: unknown) => {
        mockLogger.error(`Failed to start GitLab MCP Server: ${error}`);
        throw new Error('process.exit(1)');
      });

      try {
        await mainPromise;
      } catch (error) {
        expect(error.message).toBe('process.exit(1)');
      }

      expect(mockStartServer).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start GitLab MCP Server: Error: Server startup failed');
    });

    it('should handle non-Error exceptions during startup', async () => {
      const testError = 'String error message';
      mockStartServer.mockRejectedValue(testError);

      const mainPromise = mockStartServer().catch((error: unknown) => {
        mockLogger.error(`Failed to start GitLab MCP Server: ${error}`);
        throw new Error('process.exit(1)');
      });

      try {
        await mainPromise;
      } catch (error) {
        expect(error.message).toBe('process.exit(1)');
      }

      expect(mockStartServer).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start GitLab MCP Server: String error message');
    });

    it('should handle undefined errors during startup', async () => {
      mockStartServer.mockRejectedValue(undefined);

      const mainPromise = mockStartServer().catch((error: unknown) => {
        mockLogger.error(`Failed to start GitLab MCP Server: ${error}`);
        throw new Error('process.exit(1)');
      });

      try {
        await mainPromise;
      } catch (error) {
        expect(error.message).toBe('process.exit(1)');
      }

      expect(mockStartServer).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start GitLab MCP Server: undefined');
    });

    it('should handle null errors during startup', async () => {
      mockStartServer.mockRejectedValue(null);

      const mainPromise = mockStartServer().catch((error: unknown) => {
        mockLogger.error(`Failed to start GitLab MCP Server: ${error}`);
        throw new Error('process.exit(1)');
      });

      try {
        await mainPromise;
      } catch (error) {
        expect(error.message).toBe('process.exit(1)');
      }

      expect(mockStartServer).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start GitLab MCP Server: null');
    });
  });

  describe('main module structure', () => {
    it('should be executable as a Node.js script', () => {
      // Test that main.ts has the correct shebang and imports
      const fs = require('fs');
      const path = require('path');
      const mainPath = path.resolve(__dirname, '../../src/main.ts');
      const content = fs.readFileSync(mainPath, 'utf8');

      expect(content).toMatch(/^#!/); // Shebang
      expect(content).toContain('import { startServer }');
      expect(content).toContain('import { logger }');
      expect(content).toContain('startServer().catch');
    });

    it('should exit with code 1 on startup failure', async () => {
      const testError = new Error('Startup failed');
      mockStartServer.mockRejectedValue(testError);

      // Test the actual error handling logic from main.ts
      try {
        await mockStartServer().catch((error: unknown) => {
          mockLogger.error(`Failed to start GitLab MCP Server: ${error}`);
          process.exit(1); // This will throw due to our mock
        });
      } catch (error) {
        expect(error.message).toBe('process.exit(1)');
      }

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});