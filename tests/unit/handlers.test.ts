/**
 * Unit tests for handlers.ts
 * Tests MCP request handlers and tool execution
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { setupHandlers, parseGitLabApiError } from "../../src/handlers";
import { StructuredToolError } from "../../src/utils/error-handler";

// Mock ConnectionManager
const mockConnectionManager = {
  initialize: jest.fn(),
  getClient: jest.fn(),
  getInstanceInfo: jest.fn(),
  getTier: jest.fn(),
  isFeatureAvailable: jest.fn(),
};

jest.mock("../../src/services/ConnectionManager", () => ({
  ConnectionManager: {
    getInstance: jest.fn(() => mockConnectionManager),
  },
}));

// Mock logger
jest.mock("../../src/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock RegistryManager
const mockRegistryManager = {
  getAllToolDefinitions: jest.fn(),
  hasToolHandler: jest.fn(),
  executeTool: jest.fn(),
};

jest.mock("../../src/registry-manager", () => ({
  RegistryManager: {
    getInstance: jest.fn(() => mockRegistryManager),
  },
}));

describe("handlers", () => {
  let mockServer: jest.Mocked<Server>;
  let listToolsHandler: any;
  let callToolHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock server
    mockServer = {
      setRequestHandler: jest.fn(),
    } as any;

    // Mock ConnectionManager methods
    mockConnectionManager.initialize.mockResolvedValue(undefined);
    mockConnectionManager.getClient.mockReturnValue({});
    mockConnectionManager.getInstanceInfo.mockReturnValue({
      version: "16.0.0",
      tier: "ultimate",
    });
    // Tier detection methods used by error-handler.ts
    mockConnectionManager.getTier.mockReturnValue("ultimate");
    mockConnectionManager.isFeatureAvailable.mockReturnValue(true);

    // Mock RegistryManager methods
    mockRegistryManager.getAllToolDefinitions.mockReturnValue([
      {
        name: "test_tool",
        description: "Test tool",
        inputSchema: { type: "object", properties: {} },
      },
    ]);
    mockRegistryManager.hasToolHandler.mockReturnValue(true);
    mockRegistryManager.executeTool.mockResolvedValue({ result: "success" });
  });

  describe("setupHandlers", () => {
    it("should initialize connection manager and set up request handlers", async () => {
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

    it("should continue setup even if connection initialization fails", async () => {
      mockConnectionManager.initialize.mockRejectedValue(new Error("Connection failed"));

      await setupHandlers(mockServer);

      // Should still set up handlers despite connection failure
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe("list tools handler", () => {
    beforeEach(async () => {
      await setupHandlers(mockServer);
      listToolsHandler = mockServer.setRequestHandler.mock.calls[0][1];
    });

    it("should return list of tools from registry manager", async () => {
      const mockTools = [
        {
          name: "get_project",
          description: "Get project details",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            $schema: "http://json-schema.org/draft-07/schema#",
          },
        },
        {
          name: "list_projects",
          description: "List all projects",
          inputSchema: { type: "object", properties: {} },
        },
      ];

      mockRegistryManager.getAllToolDefinitions.mockReturnValue(mockTools);

      const result = await listToolsHandler({ method: "tools/list" }, {});

      expect(result).toEqual({
        tools: [
          {
            name: "get_project",
            description: "Get project details",
            inputSchema: {
              type: "object",
              properties: { id: { type: "string" } },
            },
          },
          {
            name: "list_projects",
            description: "List all projects",
            inputSchema: { type: "object", properties: {} },
          },
        ],
      });

      expect(mockRegistryManager.getAllToolDefinitions).toHaveBeenCalledTimes(1);
    });

    it("should remove $schema from input schemas for Gemini compatibility", async () => {
      const toolWithSchema = {
        name: "test_tool",
        description: "Test tool",
        inputSchema: {
          type: "object",
          properties: {},
          $schema: "http://json-schema.org/draft-07/schema#",
        },
      };

      mockRegistryManager.getAllToolDefinitions.mockReturnValue([toolWithSchema]);

      const result = await listToolsHandler({ method: "tools/list" }, {});

      expect(result.tools[0].inputSchema).not.toHaveProperty("$schema");
      expect(result.tools[0].inputSchema.type).toBe("object");
    });

    it("should force input schemas to be type object for MCP compatibility", async () => {
      const toolWithoutType = {
        name: "test_tool",
        description: "Test tool",
        inputSchema: {
          properties: {},
        },
      };

      mockRegistryManager.getAllToolDefinitions.mockReturnValue([toolWithoutType]);

      const result = await listToolsHandler({ method: "tools/list" }, {});

      expect(result.tools[0].inputSchema.type).toBe("object");
    });
  });

  describe("call tool handler", () => {
    beforeEach(async () => {
      await setupHandlers(mockServer);
      callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];
    });

    it("should execute tool and return result", async () => {
      const mockRequest = {
        params: {
          name: "get_project",
          arguments: { id: "test-project" },
        },
      };

      const mockResult = { id: 123, name: "Test Project" };
      mockRegistryManager.executeTool.mockResolvedValue(mockResult);

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify(mockResult, null, 2),
          },
        ],
      });

      expect(mockRegistryManager.hasToolHandler).toHaveBeenCalledWith("get_project");
      expect(mockRegistryManager.executeTool).toHaveBeenCalledWith("get_project", {
        id: "test-project",
      });
    });

    it("should throw error if arguments are missing", async () => {
      const mockRequest = {
        params: {
          name: "get_project",
          // arguments missing
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Arguments are required" }, null, 2),
          },
        ],
        isError: true,
      });
    });

    it("should verify connection and continue if already initialized", async () => {
      const mockRequest = {
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      await callToolHandler(mockRequest);

      expect(mockConnectionManager.getClient).toHaveBeenCalled();
      expect(mockConnectionManager.getInstanceInfo).toHaveBeenCalled();
      expect(mockConnectionManager.initialize).toHaveBeenCalledTimes(1); // Only from setupHandlers
    });

    it("should initialize connection if not already initialized", async () => {
      // Reset mocks to simulate uninitialized state
      mockConnectionManager.getClient.mockImplementationOnce(() => {
        throw new Error("Not initialized");
      });
      mockConnectionManager.getClient.mockReturnValue({}); // Success on retry

      const mockRequest = {
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      await callToolHandler(mockRequest);

      expect(mockConnectionManager.initialize).toHaveBeenCalledTimes(2); // Once from setup, once from handler
    });

    it("should return error if connection initialization fails", async () => {
      // Simulate connection failure
      mockConnectionManager.getClient.mockImplementation(() => {
        throw new Error("Not initialized");
      });
      mockConnectionManager.initialize.mockRejectedValue(new Error("Connection failed"));

      const mockRequest = {
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Bad Request: Server not initialized" }, null, 2),
          },
        ],
        isError: true,
      });
    });

    it("should return error if tool is not available", async () => {
      mockRegistryManager.hasToolHandler.mockReturnValue(false);

      const mockRequest = {
        params: {
          name: "unknown_tool",
          arguments: {},
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error:
                  "Failed to execute tool 'unknown_tool': Tool 'unknown_tool' is not available or has been filtered out",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      });
    });

    it("should return error if tool execution fails", async () => {
      mockRegistryManager.executeTool.mockRejectedValue(new Error("Tool execution failed"));

      const mockRequest = {
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Failed to execute tool 'test_tool': Tool execution failed",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockRegistryManager.executeTool.mockRejectedValue("String error");

      const mockRequest = {
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Failed to execute tool 'test_tool': String error",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty arguments in tool call", async () => {
      await setupHandlers(mockServer);
      callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];

      const mockRequest = {
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      await callToolHandler(mockRequest);

      expect(mockRegistryManager.executeTool).toHaveBeenCalledWith("test_tool", {});
    });
  });

  describe("structured error handling", () => {
    beforeEach(async () => {
      await setupHandlers(mockServer);
      callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];
    });

    it("should parse GitLab API error and return structured error response", async () => {
      // Simulate a 403 Forbidden error from GitLab API
      mockRegistryManager.executeTool.mockRejectedValue(
        new Error("GitLab API error: 403 Forbidden - You need to be a project member")
      );

      const mockRequest = {
        params: {
          name: "browse_protected_branches",
          arguments: { action: "list", project_id: "123" },
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      // Should be a structured error (either TIER_RESTRICTED or PERMISSION_DENIED)
      expect(parsed.error_code).toBeDefined();
      expect(parsed.tool).toBe("browse_protected_branches");
      expect(parsed.http_status).toBe(403);
    });

    it("should parse wrapped GitLab API error correctly", async () => {
      // Error is wrapped with "Failed to execute tool" prefix
      mockRegistryManager.executeTool.mockRejectedValue(
        new Error(
          "Failed to execute tool 'test': GitLab API error: 404 Not Found - Project not found"
        )
      );

      const mockRequest = {
        params: {
          name: "browse_projects",
          arguments: { action: "get", project_id: "999" },
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error_code).toBe("NOT_FOUND");
      expect(parsed.http_status).toBe(404);
    });

    it("should extract action from tool arguments", async () => {
      mockRegistryManager.executeTool.mockRejectedValue(
        new Error("GitLab API error: 500 Internal Server Error")
      );

      const mockRequest = {
        params: {
          name: "manage_merge_request",
          arguments: { action: "approve", project_id: "123", iid: "1" },
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.action).toBe("approve");
    });

    it("should handle GitLab API error without status text", async () => {
      mockRegistryManager.executeTool.mockRejectedValue(new Error("GitLab API error: 429"));

      const mockRequest = {
        params: {
          name: "browse_projects",
          arguments: { action: "list" },
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error_code).toBe("RATE_LIMITED");
      expect(parsed.http_status).toBe(429);
    });

    it("should handle 5xx server errors", async () => {
      mockRegistryManager.executeTool.mockRejectedValue(
        new Error("GitLab API error: 502 Bad Gateway")
      );

      const mockRequest = {
        params: {
          name: "browse_projects",
          arguments: { action: "list" },
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error_code).toBe("SERVER_ERROR");
      expect(parsed.http_status).toBe(502);
    });

    it("should fallback to plain error for non-GitLab API errors", async () => {
      mockRegistryManager.executeTool.mockRejectedValue(new Error("Some other error"));

      const mockRequest = {
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      // Should be plain error format, not structured
      expect(parsed.error).toContain("Some other error");
      expect(parsed.error_code).toBeUndefined();
    });
  });

  describe("parseGitLabApiError", () => {
    // Tests for the parseGitLabApiError helper function
    // Validates that GitLab API error strings are correctly parsed into status and message

    it("should parse standard GitLab API error format", () => {
      const result = parseGitLabApiError("GitLab API error: 403 Forbidden");
      expect(result).toEqual({
        status: 403,
        message: "403 Forbidden",
      });
    });

    it("should parse error with status text and details", () => {
      const result = parseGitLabApiError(
        "GitLab API error: 404 Not Found - Project does not exist"
      );
      expect(result).toEqual({
        status: 404,
        message: "404 Not Found - Project does not exist",
      });
    });

    it("should parse error with only status code", () => {
      const result = parseGitLabApiError("GitLab API error: 429");
      expect(result).toEqual({
        status: 429,
        message: "429",
      });
    });

    it("should parse error with details but no status text", () => {
      const result = parseGitLabApiError("GitLab API error: 500 - Server error message");
      expect(result).toEqual({
        status: 500,
        message: "500 - Server error message",
      });
    });

    it("should parse wrapped error (from tool execution)", () => {
      const result = parseGitLabApiError(
        "Failed to execute tool 'test': GitLab API error: 403 Forbidden - Access denied"
      );
      expect(result).toEqual({
        status: 403,
        message: "403 Forbidden - Access denied",
      });
    });

    it("should handle multi-word status text", () => {
      const result = parseGitLabApiError("GitLab API error: 502 Bad Gateway");
      expect(result).toEqual({
        status: 502,
        message: "502 Bad Gateway",
      });
    });

    it("should return null for non-GitLab API errors", () => {
      expect(parseGitLabApiError("Some random error")).toBeNull();
      expect(parseGitLabApiError("Connection refused")).toBeNull();
      expect(parseGitLabApiError("Timeout")).toBeNull();
    });

    it("should return null for malformed GitLab API errors", () => {
      // Missing status code
      expect(parseGitLabApiError("GitLab API error: Forbidden")).toBeNull();
      // Just the prefix
      expect(parseGitLabApiError("GitLab API error:")).toBeNull();
    });

    it("should handle 5xx server errors", () => {
      const result = parseGitLabApiError("GitLab API error: 503 Service Unavailable");
      expect(result).toEqual({
        status: 503,
        message: "503 Service Unavailable",
      });
    });
  });

  describe("structured error handling - additional paths", () => {
    beforeEach(async () => {
      await setupHandlers(mockServer);
      callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];
    });

    it("should extract action from error cause via wrapper", async () => {
      // Test extractActionFromError when wrapped error's cause has action property (line 88)
      // The error gets wrapped on line 320: throw new Error(..., { cause: error })
      // So the wrapper's cause (original error) needs the action property
      const errorWithAction = new Error("GitLab API error: 403 Forbidden");
      (errorWithAction as any).action = "custom_action";
      mockRegistryManager.executeTool.mockRejectedValue(errorWithAction);

      const mockRequest = {
        params: {
          name: "test_tool",
          arguments: { action: "ignored_action" },
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      // Action is extracted from the cause chain (line 88)
      expect(parsed.action).toBe("custom_action");
    });

    it("should pass through StructuredToolError via cause chain", async () => {
      // Test toStructuredError when error.cause is StructuredToolError (lines 109-111)
      // The error gets wrapped, so we check the cause for StructuredToolError
      const structuredError = new StructuredToolError({
        error_code: "API_ERROR",
        tool: "original_tool",
        action: "original_action",
        message: "Pre-structured error",
        http_status: 418,
      });
      mockRegistryManager.executeTool.mockRejectedValue(structuredError);

      const mockRequest = {
        params: {
          name: "test_tool",
          arguments: {},
        },
      };

      const result = await callToolHandler(mockRequest);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      // Should preserve the original structured error
      expect(parsed.error_code).toBe("API_ERROR");
      expect(parsed.tool).toBe("original_tool");
      expect(parsed.action).toBe("original_action");
      expect(parsed.http_status).toBe(418);
    });
  });

  describe("list tools handler - resolveRefs edge cases", () => {
    beforeEach(async () => {
      await setupHandlers(mockServer);
      listToolsHandler = mockServer.setRequestHandler.mock.calls[0][1];
    });

    it("should resolve $ref references in input schemas", () => {
      // Test resolveRefs with $ref (lines 164-173)
      const toolWithRef = {
        name: "test_tool",
        description: "Test tool",
        inputSchema: {
          type: "object",
          properties: {
            sharedProp: { type: "string", description: "Shared property" },
            refProp: { $ref: "#/properties/sharedProp" },
          },
        },
      };

      mockRegistryManager.getAllToolDefinitions.mockReturnValue([toolWithRef]);

      return listToolsHandler({ method: "tools/list" }, {}).then((result: any) => {
        // The $ref should be resolved
        expect(result.tools[0].inputSchema.properties.refProp).not.toHaveProperty("$ref");
        expect(result.tools[0].inputSchema.properties.refProp.type).toBe("string");
      });
    });

    it("should handle unresolvable $ref by removing it", () => {
      // Test resolveRefs with unresolvable $ref (lines 175-178)
      const toolWithBadRef = {
        name: "test_tool",
        description: "Test tool",
        inputSchema: {
          type: "object",
          properties: {
            badRef: { $ref: "#/properties/nonExistent", description: "Has bad ref" },
          },
        },
      };

      mockRegistryManager.getAllToolDefinitions.mockReturnValue([toolWithBadRef]);

      return listToolsHandler({ method: "tools/list" }, {}).then((result: any) => {
        // The $ref should be removed, but description preserved
        expect(result.tools[0].inputSchema.properties.badRef).not.toHaveProperty("$ref");
        expect(result.tools[0].inputSchema.properties.badRef.description).toBe("Has bad ref");
      });
    });

    it("should handle array schemas in resolveRefs", () => {
      // Test resolveRefs with array (line 159)
      const toolWithArray = {
        name: "test_tool",
        description: "Test tool",
        inputSchema: {
          type: "object",
          properties: {
            items: {
              oneOf: [{ type: "string" }, { type: "number" }],
            },
          },
        },
      };

      mockRegistryManager.getAllToolDefinitions.mockReturnValue([toolWithArray]);

      return listToolsHandler({ method: "tools/list" }, {}).then((result: any) => {
        // The array should be preserved
        expect(result.tools[0].inputSchema.properties.items.oneOf).toHaveLength(2);
      });
    });

    it("should handle nested objects in resolveRefs", () => {
      // Test resolveRefs with nested object (line 194)
      const toolWithNested = {
        name: "test_tool",
        description: "Test tool",
        inputSchema: {
          type: "object",
          properties: {
            nested: {
              type: "object",
              additionalProperties: { type: "string" },
            },
          },
        },
      };

      mockRegistryManager.getAllToolDefinitions.mockReturnValue([toolWithNested]);

      return listToolsHandler({ method: "tools/list" }, {}).then((result: any) => {
        expect(result.tools[0].inputSchema.properties.nested.additionalProperties.type).toBe(
          "string"
        );
      });
    });
  });
});
