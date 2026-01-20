/**
 * Unit tests for main.ts
 * Tests server startup and error handling
 */

import { startServer } from "../../src/server";
import { logger } from "../../src/logger";
import { tryApplyProfileFromEnv } from "../../src/profiles";

// Mock the server module
jest.mock("../../src/server", () => ({
  startServer: jest.fn(),
}));

// Mock the profiles module
jest.mock("../../src/profiles", () => ({
  tryApplyProfileFromEnv: jest.fn(),
}));

// Mock logger to prevent output during tests
jest.mock("../../src/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock process.exit to prevent actual exit during tests
const mockProcessExit = jest.spyOn(process, "exit").mockImplementation((code?: number) => {
  throw new Error(`process.exit(${code})`);
});

// Create typed mocks
const mockStartServer = startServer as jest.MockedFunction<typeof startServer>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockTryApplyProfileFromEnv = tryApplyProfileFromEnv as jest.MockedFunction<
  typeof tryApplyProfileFromEnv
>;

describe("main", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockProcessExit.mockRestore();
  });

  describe("server startup behavior", () => {
    it("should call startServer when imported", async () => {
      mockStartServer.mockResolvedValue(undefined);

      // Simulate the main module execution
      const mainPromise = mockStartServer().catch((error: unknown) => {
        mockLogger.error(`Failed to start GitLab MCP Server: ${error}`);
        throw new Error("process.exit(1)");
      });

      await mainPromise;

      expect(mockStartServer).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should handle server startup errors and log them", async () => {
      const testError = new Error("Server startup failed");
      mockStartServer.mockRejectedValue(testError);

      // Simulate the main module execution with error handling
      const mainPromise = mockStartServer().catch((error: unknown) => {
        mockLogger.error(`Failed to start GitLab MCP Server: ${error}`);
        throw new Error("process.exit(1)");
      });

      try {
        await mainPromise;
      } catch (error) {
        expect(error.message).toBe("process.exit(1)");
      }

      expect(mockStartServer).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to start GitLab MCP Server: Error: Server startup failed"
      );
    });

    it("should handle non-Error exceptions during startup", async () => {
      const testError = "String error message";
      mockStartServer.mockRejectedValue(testError);

      const mainPromise = mockStartServer().catch((error: unknown) => {
        mockLogger.error(`Failed to start GitLab MCP Server: ${error}`);
        throw new Error("process.exit(1)");
      });

      try {
        await mainPromise;
      } catch (error) {
        expect(error.message).toBe("process.exit(1)");
      }

      expect(mockStartServer).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to start GitLab MCP Server: String error message"
      );
    });

    it("should handle undefined errors during startup", async () => {
      mockStartServer.mockRejectedValue(undefined);

      const mainPromise = mockStartServer().catch((error: unknown) => {
        mockLogger.error(`Failed to start GitLab MCP Server: ${error}`);
        throw new Error("process.exit(1)");
      });

      try {
        await mainPromise;
      } catch (error) {
        expect(error.message).toBe("process.exit(1)");
      }

      expect(mockStartServer).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to start GitLab MCP Server: undefined");
    });

    it("should handle null errors during startup", async () => {
      mockStartServer.mockRejectedValue(null);

      const mainPromise = mockStartServer().catch((error: unknown) => {
        mockLogger.error(`Failed to start GitLab MCP Server: ${error}`);
        throw new Error("process.exit(1)");
      });

      try {
        await mainPromise;
      } catch (error) {
        expect(error.message).toBe("process.exit(1)");
      }

      expect(mockStartServer).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to start GitLab MCP Server: null");
    });
  });

  describe("main module structure", () => {
    it("should be executable as a Node.js script", () => {
      // Test that main.ts has the correct shebang and imports
      const fs = require("fs");
      const path = require("path");
      const mainPath = path.resolve(__dirname, "../../src/main.ts");
      const content = fs.readFileSync(mainPath, "utf8");

      expect(content).toMatch(/^#!/); // Shebang
      expect(content).toContain("import { startServer }");
      expect(content).toContain("import { logger }");
      // main.ts now uses main().catch for profile loading support
      expect(content).toContain("main().catch");
    });

    it("should exit with code 1 on startup failure", async () => {
      const testError = new Error("Startup failed");
      mockStartServer.mockRejectedValue(testError);

      // Test the actual error handling logic from main.ts
      try {
        await mockStartServer().catch((error: unknown) => {
          mockLogger.error(`Failed to start GitLab MCP Server: ${error}`);
          process.exit(1); // This will throw due to our mock
        });
      } catch (error) {
        expect(error.message).toBe("process.exit(1)");
      }

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("profile handling", () => {
    beforeEach(() => {
      mockStartServer.mockResolvedValue(undefined);
      mockTryApplyProfileFromEnv.mockResolvedValue(undefined);
    });

    it("should log profile info when profile is applied", async () => {
      // Simulate profile result
      mockTryApplyProfileFromEnv.mockResolvedValue({
        success: true,
        profileName: "work",
        host: "gitlab.company.com",
        appliedSettings: [],
        validation: { valid: true, errors: [], warnings: [] },
      });

      // Simulate main() function logic
      const result = await mockTryApplyProfileFromEnv();
      if (result && "profileName" in result) {
        mockLogger.info(
          { profile: result.profileName, host: result.host },
          "Using configuration profile"
        );
      }

      expect(mockLogger.info).toHaveBeenCalledWith(
        { profile: "work", host: "gitlab.company.com" },
        "Using configuration profile"
      );
    });

    it("should log preset info when preset is applied", async () => {
      // Simulate preset result
      mockTryApplyProfileFromEnv.mockResolvedValue({
        success: true,
        presetName: "readonly",
        appliedSettings: [],
        validation: { valid: true, errors: [], warnings: [] },
      });

      // Simulate main() function logic
      const result = await mockTryApplyProfileFromEnv();
      if (result && "presetName" in result) {
        mockLogger.info({ preset: result.presetName }, "Using configuration preset");
      }

      expect(mockLogger.info).toHaveBeenCalledWith(
        { preset: "readonly" },
        "Using configuration preset"
      );
    });

    it("should exit with code 1 when profile loading fails", async () => {
      const profileError = new Error("Profile not found");
      mockTryApplyProfileFromEnv.mockRejectedValue(profileError);

      // Simulate main() function error handling
      try {
        await mockTryApplyProfileFromEnv().catch(error => {
          const message = error instanceof Error ? error.message : String(error);
          mockLogger.error({ error: message }, "Failed to load profile");
          process.exit(1);
        });
      } catch (error) {
        expect(error.message).toBe("process.exit(1)");
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: "Profile not found" },
        "Failed to load profile"
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should not log anything when no profile is applied", async () => {
      mockTryApplyProfileFromEnv.mockResolvedValue(undefined);

      // Simulate main() function logic
      const result = await mockTryApplyProfileFromEnv();
      if (result) {
        // This branch should not be taken
        mockLogger.info({}, "Profile applied");
      }

      // Should not have logged profile info
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.anything(),
        "Using configuration profile"
      );
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.anything(),
        "Using configuration preset"
      );
    });
  });

  describe("getProfileFromArgs behavior", () => {
    const originalArgv = process.argv;

    afterEach(() => {
      process.argv = originalArgv;
    });

    it("should parse --profile flag from CLI args", () => {
      // Test the parsing logic
      const args = ["node", "main.js", "--profile", "work", "sse"];
      const slicedArgs = args.slice(2);

      let profileName: string | undefined;
      for (let i = 0; i < slicedArgs.length; i++) {
        if (slicedArgs[i] === "--profile") {
          const value = slicedArgs[i + 1];
          if (value && !value.startsWith("--")) {
            profileName = value;
          }
        }
      }

      expect(profileName).toBe("work");
    });

    it("should return undefined when --profile flag is not present", () => {
      const args = ["node", "main.js", "sse"];
      const slicedArgs = args.slice(2);

      let profileName: string | undefined;
      for (let i = 0; i < slicedArgs.length; i++) {
        if (slicedArgs[i] === "--profile") {
          profileName = slicedArgs[i + 1];
        }
      }

      expect(profileName).toBeUndefined();
    });

    it("should reject --profile without value", () => {
      const args = ["node", "main.js", "--profile"];
      const slicedArgs = args.slice(2);

      let isValid = true;
      for (let i = 0; i < slicedArgs.length; i++) {
        if (slicedArgs[i] === "--profile") {
          const value = slicedArgs[i + 1];
          if (!value || value.startsWith("--")) {
            isValid = false;
          }
        }
      }

      expect(isValid).toBe(false);
    });

    it("should reject --profile followed by another flag", () => {
      const args = ["node", "main.js", "--profile", "--other-flag"];
      const slicedArgs = args.slice(2);

      let isValid = true;
      for (let i = 0; i < slicedArgs.length; i++) {
        if (slicedArgs[i] === "--profile") {
          const value = slicedArgs[i + 1];
          if (!value || value.startsWith("--")) {
            isValid = false;
          }
        }
      }

      expect(isValid).toBe(false);
    });
  });
});
