import {
  variablesToolRegistry,
  getVariablesReadOnlyToolNames,
  getVariablesToolDefinitions,
  getFilteredVariablesTools,
} from "../../../../src/entities/variables/registry";
import { enhancedFetch } from "../../../../src/utils/fetch";

// Mock enhancedFetch to avoid actual API calls
jest.mock("../../../../src/utils/fetch", () => ({
  enhancedFetch: jest.fn(),
}));

const mockEnhancedFetch = enhancedFetch as jest.MockedFunction<typeof enhancedFetch>;

// Mock environment variables
const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    GITLAB_API_URL: "https://gitlab.example.com",
    GITLAB_TOKEN: "test-token-12345",
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

describe("Variables Registry", () => {
  describe("Registry Structure", () => {
    it("should be a Map instance", () => {
      expect(variablesToolRegistry instanceof Map).toBe(true);
    });

    it("should contain expected variable tools", () => {
      const toolNames = Array.from(variablesToolRegistry.keys());

      // Check for read-only tools
      expect(toolNames).toContain("list_variables");
      expect(toolNames).toContain("get_variable");

      // Check for write tools
      expect(toolNames).toContain("create_variable");
      expect(toolNames).toContain("update_variable");
      expect(toolNames).toContain("delete_variable");
    });

    it("should have tools with valid structure", () => {
      for (const [toolName, tool] of variablesToolRegistry) {
        expect(tool).toHaveProperty("name", toolName);
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(tool).toHaveProperty("handler");
        expect(typeof tool.description).toBe("string");
        expect(typeof tool.handler).toBe("function");
        expect(tool.description.length).toBeGreaterThan(0);
      }
    });

    it("should have unique tool names", () => {
      const toolNames = Array.from(variablesToolRegistry.keys());
      const uniqueNames = new Set(toolNames);

      expect(toolNames.length).toBe(uniqueNames.size);
    });
  });

  describe("Tool Definitions", () => {
    it("should have proper list_variables tool", () => {
      const tool = variablesToolRegistry.get("list_variables");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("list_variables");
      expect(tool?.description).toContain("CI/CD environment variables");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper get_variable tool", () => {
      const tool = variablesToolRegistry.get("get_variable");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("get_variable");
      expect(tool?.description).toContain("specific CI/CD variable");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper create_variable tool", () => {
      const tool = variablesToolRegistry.get("create_variable");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("create_variable");
      expect(tool?.description).toContain("Add new CI/CD");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper update_variable tool", () => {
      const tool = variablesToolRegistry.get("update_variable");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("update_variable");
      expect(tool?.description).toContain("Modify CI/CD variable");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper delete_variable tool", () => {
      const tool = variablesToolRegistry.get("delete_variable");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("delete_variable");
      expect(tool?.description).toContain("Delete CI/CD variable");
      expect(tool?.inputSchema).toBeDefined();
    });
  });

  describe("Read-Only Tools Function", () => {
    it("should return an array of read-only tool names", () => {
      const readOnlyTools = getVariablesReadOnlyToolNames();

      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it("should include expected read-only tools", () => {
      const readOnlyTools = getVariablesReadOnlyToolNames();

      expect(readOnlyTools).toContain("list_variables");
      expect(readOnlyTools).toContain("get_variable");
    });

    it("should not include write tools", () => {
      const readOnlyTools = getVariablesReadOnlyToolNames();

      expect(readOnlyTools).not.toContain("create_variable");
      expect(readOnlyTools).not.toContain("update_variable");
      expect(readOnlyTools).not.toContain("delete_variable");
    });

    it("should return tools that exist in the registry", () => {
      const readOnlyTools = getVariablesReadOnlyToolNames();
      const registryKeys = Array.from(variablesToolRegistry.keys());

      for (const toolName of readOnlyTools) {
        expect(registryKeys).toContain(toolName);
      }
    });
  });

  describe("Tool Handlers", () => {
    it("should have handlers that are async functions", () => {
      for (const [, tool] of variablesToolRegistry) {
        expect(tool.handler.constructor.name).toBe("AsyncFunction");
      }
    });

    it("should have handlers that accept arguments", () => {
      for (const [, tool] of variablesToolRegistry) {
        expect(tool.handler.length).toBe(1); // Should accept one argument
      }
    });
  });

  describe("Registry Consistency", () => {
    it("should have all tools defined in registry", () => {
      const expectedTools = [
        "list_variables",
        "get_variable",
        "create_variable",
        "update_variable",
        "delete_variable",
      ];

      for (const toolName of expectedTools) {
        expect(variablesToolRegistry.has(toolName)).toBe(true);
      }
    });

    it("should have consistent tool count", () => {
      const toolCount = variablesToolRegistry.size;
      const readOnlyCount = getVariablesReadOnlyToolNames().length;

      // Registry should have more tools than just read-only ones
      expect(toolCount).toBeGreaterThan(readOnlyCount);
      // Should have exactly 5 tools as defined above
      expect(toolCount).toBe(5);
    });
  });

  describe("Variable Tool Specifics", () => {
    it("should support both project and group variables", () => {
      const listTool = variablesToolRegistry.get("list_variables");
      const getTool = variablesToolRegistry.get("get_variable");

      expect(listTool?.description).toContain("Group variables are inherited");
      expect(getTool?.description).toContain("specific CI/CD variable");
    });

    it("should mention CI/CD context in descriptions", () => {
      const toolNames = Array.from(variablesToolRegistry.keys());

      for (const toolName of toolNames) {
        const tool = variablesToolRegistry.get(toolName);
        expect(tool?.description.toLowerCase()).toMatch(/ci\/cd|variable/);
      }
    });
  });

  describe("Helper Functions", () => {
    describe("getVariablesToolDefinitions", () => {
      it("should return all tool definitions", () => {
        const definitions = getVariablesToolDefinitions();
        expect(definitions).toHaveLength(5);
        expect(
          definitions.every(def => def.name && def.description && def.inputSchema && def.handler)
        ).toBe(true);
      });
    });

    describe("getFilteredVariablesTools", () => {
      it("should return all tools when readOnlyMode is false", () => {
        const tools = getFilteredVariablesTools(false);
        expect(tools).toHaveLength(5);
      });

      it("should return only read-only tools when readOnlyMode is true", () => {
        const tools = getFilteredVariablesTools(true);
        expect(tools).toHaveLength(2);
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain("list_variables");
        expect(toolNames).toContain("get_variable");
        expect(toolNames).not.toContain("create_variable");
      });
    });
  });

  describe("Handler Functions", () => {
    const mockResponse = (data: any, ok = true, status = 200) => ({
      ok,
      status,
      statusText: ok ? "OK" : "Error",
      json: jest.fn().mockResolvedValue(data),
    });

    describe("list_variables handler", () => {
      it("should list project variables", async () => {
        const mockVariables = [
          {
            key: "API_KEY",
            value: "[hidden]",
            protected: true,
            masked: true,
            environment_scope: "*",
          },
          {
            key: "DB_PASSWORD",
            value: "[hidden]",
            protected: true,
            masked: true,
            environment_scope: "production",
          },
        ];

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock actual variables API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue(mockVariables),
        } as any);

        const tool = variablesToolRegistry.get("list_variables")!;
        const result = await tool.handler({
          namespace: "test/project",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariables);
      });

      it("should list group variables", async () => {
        const mockVariables = [
          {
            key: "GROUP_TOKEN",
            value: "[hidden]",
            protected: false,
            masked: true,
            environment_scope: "*",
          },
        ];

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 456, name: "test-group" }),
        } as any);

        // Mock actual variables API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue(mockVariables),
        } as any);

        const tool = variablesToolRegistry.get("list_variables")!;
        const result = await tool.handler({
          namespace: "test-group",
        });

        // Second call is the variables list with default per_page
        expect(mockEnhancedFetch).toHaveBeenNthCalledWith(
          2,
          "https://gitlab.example.com/api/v4/groups/test-group/variables?per_page=20"
        );
        expect(result).toEqual(mockVariables);
      });

      it("should use explicit per_page when provided", async () => {
        const mockVariables = [
          {
            key: "CUSTOM_VAR",
            value: "custom-value",
            protected: false,
            masked: false,
            environment_scope: "*",
          },
        ];

        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 789, name: "test-project" }),
        } as any);

        // Mock actual variables API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue(mockVariables),
        } as any);

        const tool = variablesToolRegistry.get("list_variables")!;
        const result = await tool.handler({
          namespace: "test/project",
          per_page: 50, // Explicit per_page value
        });

        // Second call should use the explicit per_page value
        expect(mockEnhancedFetch).toHaveBeenNthCalledWith(
          2,
          "https://gitlab.example.com/api/v4/projects/test%2Fproject/variables?per_page=50"
        );
        expect(result).toEqual(mockVariables);
      });

      it("should handle API errors", async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 123, name: "private-project" }),
        } as any);

        // Mock actual variables API call - fails with 403
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Error",
          json: jest.fn().mockResolvedValue(null),
        } as any);

        const tool = variablesToolRegistry.get("list_variables")!;

        await expect(
          tool.handler({
            namespace: "private/project",
          })
        ).rejects.toThrow("GitLab API error: 403 Error");
      });

      it("should handle API errors with empty response text", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with empty text response
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: jest.fn().mockResolvedValue(""),
        } as any);

        const tool = variablesToolRegistry.get("list_variables")!;

        await expect(
          tool.handler({
            namespace: "test/project",
          })
        ).rejects.toThrow("GitLab API error: 404 Not Found");
      });

      it("should handle API errors with detailed JSON error", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with detailed JSON error
        const errorResponse = {
          message: "Access denied",
          error: "Insufficient permissions",
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse)),
        } as any);

        const tool = variablesToolRegistry.get("list_variables")!;

        await expect(
          tool.handler({
            namespace: "test/project",
          })
        ).rejects.toThrow(
          "GitLab API error: 403 Forbidden - Access denied - Insufficient permissions"
        );
      });

      it("should handle API errors with complex message format", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with complex message format
        const errorResponse = {
          message: {
            value: ["Field is required", "Invalid format"],
          },
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse)),
        } as any);

        const tool = variablesToolRegistry.get("list_variables")!;

        await expect(
          tool.handler({
            namespace: "test/project",
          })
        ).rejects.toThrow("GitLab API error: 400 Bad Request - Field is required, Invalid format");
      });

      it("should handle API errors with object message format", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with object message format
        const errorResponse = {
          message: { key: "invalid", details: "more info" },
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          statusText: "Unprocessable Entity",
          text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse)),
        } as any);

        const tool = variablesToolRegistry.get("list_variables")!;

        await expect(
          tool.handler({
            namespace: "test/project",
          })
        ).rejects.toThrow(
          'GitLab API error: 422 Unprocessable Entity - {"key":"invalid","details":"more info"}'
        );
      });

      it("should handle API errors with unparseable JSON response", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with invalid JSON that can't be parsed
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: jest.fn().mockResolvedValue("Invalid JSON {{{"),
        } as any);

        const tool = variablesToolRegistry.get("list_variables")!;

        await expect(
          tool.handler({
            namespace: "test/project",
          })
        ).rejects.toThrow("GitLab API error: 500 Internal Server Error");
      });
    });

    describe("get_variable handler", () => {
      it("should get project variable by key", async () => {
        const mockVariable = {
          key: "API_KEY",
          value: "[hidden]",
          variable_type: "env_var",
          protected: true,
          masked: true,
          environment_scope: "*",
        };

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock actual get variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue(mockVariable),
        } as any);

        const tool = variablesToolRegistry.get("get_variable")!;
        const result = await tool.handler({
          namespace: "test/project",
          key: "API_KEY",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it("should get group variable with environment scope filter", async () => {
        const mockVariable = {
          key: "DB_URL",
          value: "[hidden]",
          environment_scope: "production",
        };

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 456, name: "test-group" }),
        } as any);

        // Mock actual get variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue(mockVariable),
        } as any);

        const tool = variablesToolRegistry.get("get_variable")!;
        const result = await tool.handler({
          namespace: "test-group",
          key: "DB_URL",
          filter: {
            environment_scope: "production",
          },
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it("should handle variable not found", async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock actual get variable API call - fails with 404
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Error",
          json: jest.fn().mockResolvedValue(null),
        } as any);

        const tool = variablesToolRegistry.get("get_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "NONEXISTENT_KEY",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });

      it("should handle get_variable API error with detailed JSON error", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with detailed JSON error
        const errorResponse = {
          message: "Variable not accessible",
          error: "Insufficient scope",
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse)),
        } as any);

        const tool = variablesToolRegistry.get("get_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "RESTRICTED_VAR",
          })
        ).rejects.toThrow(
          "GitLab API error: 403 Forbidden - Variable not accessible - Insufficient scope"
        );
      });
    });

    describe("create_variable handler", () => {
      it("should create project variable with basic settings", async () => {
        const mockVariable = {
          key: "NEW_API_KEY",
          value: "secret123",
          variable_type: "env_var",
          protected: false,
          masked: false,
          environment_scope: "*",
        };

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock actual create variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue(mockVariable),
        } as any);

        const tool = variablesToolRegistry.get("create_variable")!;
        const result = await tool.handler({
          namespace: "test/project",
          key: "NEW_API_KEY",
          value: "secret123",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it("should create group variable with advanced settings", async () => {
        const mockVariable = {
          key: "DEPLOY_KEY",
          value: "[hidden]",
          variable_type: "file",
          protected: true,
          masked: true,
          environment_scope: "production",
        };

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 456, name: "test-group" }),
        } as any);

        // Mock actual create variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue(mockVariable),
        } as any);

        const tool = variablesToolRegistry.get("create_variable")!;
        const result = await tool.handler({
          namespace: "test-group",
          key: "DEPLOY_KEY",
          value: "ssh-rsa AAAAB3NzaC1yc2E...",
          variable_type: "file",
          protected: true,
          masked: true,
          environment_scope: "production",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it("should handle variable creation conflicts", async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock actual create variable API call - fails with 400
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Error",
          json: jest.fn().mockResolvedValue(null),
        } as any);

        const tool = variablesToolRegistry.get("create_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "EXISTING_KEY",
            value: "value",
          })
        ).rejects.toThrow("GitLab API error: 400 Error");
      });
    });

    describe("update_variable handler", () => {
      it("should update project variable", async () => {
        const mockVariable = {
          key: "API_KEY",
          value: "[hidden]",
          variable_type: "env_var",
          protected: true,
          masked: true,
          environment_scope: "*",
        };

        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock actual update variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue(mockVariable),
        } as any);

        const tool = variablesToolRegistry.get("update_variable")!;
        const result = await tool.handler({
          namespace: "test/project",
          key: "API_KEY",
          value: "new-secret-value",
          protected: true,
          masked: true,
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it("should update group variable with environment scope filter", async () => {
        const mockVariable = {
          key: "DB_PASSWORD",
          value: "[hidden]",
          environment_scope: "staging",
        };

        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 456, name: "test-group" }),
        } as any);

        // Mock actual update variable API call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue(mockVariable),
        } as any);

        const tool = variablesToolRegistry.get("update_variable")!;
        const result = await tool.handler({
          namespace: "test-group",
          key: "DB_PASSWORD",
          value: "new-password",
          filter: {
            environment_scope: "staging",
          },
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it("should handle variable update errors", async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock actual update variable API call - fails with 404
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Error",
          json: jest.fn().mockResolvedValue(null),
        } as any);

        const tool = variablesToolRegistry.get("update_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "NONEXISTENT_KEY",
            value: "value",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });
    });

    describe("delete_variable handler", () => {
      it("should delete project variable", async () => {
        // Mock namespace detection call (project endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock actual delete variable API call (204 No Content)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          statusText: "No Content",
        } as any);

        const tool = variablesToolRegistry.get("delete_variable")!;
        const result = await tool.handler({
          namespace: "test/project",
          key: "OLD_API_KEY",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        // Handler returns { deleted: true } after successful deletion
        expect(result).toEqual({ deleted: true });
      });

      it("should delete group variable with environment scope", async () => {
        // Mock namespace detection call (group endpoint check)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 456, name: "test-group" }),
        } as any);

        // Mock actual delete variable API call (204 No Content)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          statusText: "No Content",
        } as any);

        const tool = variablesToolRegistry.get("delete_variable")!;
        const result = await tool.handler({
          namespace: "test-group",
          key: "TEMP_TOKEN",
          filter: {
            environment_scope: "development",
          },
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        // Handler returns { deleted: true } after successful deletion
        expect(result).toEqual({ deleted: true });
      });

      it("should handle variable deletion errors", async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock actual delete variable API call - fails with 404
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Error",
          json: jest.fn().mockResolvedValue(null),
        } as any);

        const tool = variablesToolRegistry.get("delete_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "NONEXISTENT_KEY",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });
    });

    describe("Error handling", () => {
      it("should handle validation errors", async () => {
        const tool = variablesToolRegistry.get("get_variable")!;

        // Test with invalid input that should fail Zod validation
        await expect(
          tool.handler({
            namespace: 123, // Should be string
            key: null, // Should be string
          })
        ).rejects.toThrow();
      });

      it("should handle API errors with proper error messages", async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock actual list variables API call - fails with 500
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Error",
          json: jest.fn().mockResolvedValue(null),
        } as any);

        const tool = variablesToolRegistry.get("list_variables")!;

        await expect(
          tool.handler({
            namespace: "test/project",
          })
        ).rejects.toThrow("GitLab API error: 500 Error");
      });

      it("should handle network errors", async () => {
        // Mock namespace detection call (project endpoint check) - succeeds
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock actual create variable API call - fails with network error
        mockEnhancedFetch.mockRejectedValueOnce(new Error("Network error"));

        const tool = variablesToolRegistry.get("create_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "TEST_KEY",
            value: "test-value",
          })
        ).rejects.toThrow("Network error");
      });

      it("should handle get_variable with empty response text", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with empty response text
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          text: jest.fn().mockResolvedValue(""), // Empty response text
        } as any);

        const tool = variablesToolRegistry.get("get_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "TEST_VAR",
          })
        ).rejects.toThrow("GitLab API error: 400 Bad Request");
      });

      it("should handle get_variable with string message and error fields", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with both message (string) and error fields
        const errorResponse = {
          message: "Variable not found",
          error: "Variable with key TEST_VAR does not exist",
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse)),
        } as any);

        const tool = variablesToolRegistry.get("get_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "TEST_VAR",
          })
        ).rejects.toThrow(
          "GitLab API error: 404 Not Found - Variable not found - Variable with key TEST_VAR does not exist"
        );
      });

      it("should handle create_variable with whitespace-only response text", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with whitespace-only response text
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          text: jest.fn().mockResolvedValue("   "), // Whitespace-only response text
        } as any);

        const tool = variablesToolRegistry.get("create_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "NEW_VAR",
            value: "test-value",
          })
        ).rejects.toThrow("GitLab API error: 400 Bad Request");
      });

      it("should handle update_variable with array message value", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with message.value array format
        const errorResponse = {
          message: {
            value: ["Key must be alphanumeric", "Value cannot be empty"],
          },
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          statusText: "Unprocessable Entity",
          text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse)),
        } as any);

        const tool = variablesToolRegistry.get("update_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "TEST_VAR",
            value: "",
          })
        ).rejects.toThrow(
          "GitLab API error: 422 Unprocessable Entity - Key must be alphanumeric, Value cannot be empty"
        );
      });

      it("should handle delete_variable with complex message object", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with complex message object (not string, not .value array)
        const errorResponse = {
          message: {
            key: "validation_failed",
            details: {
              field: "key",
              code: "invalid_format",
            },
          },
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          statusText: "Unprocessable Entity",
          text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse)),
        } as any);

        const tool = variablesToolRegistry.get("delete_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "TEST_VAR",
          })
        ).rejects.toThrow(
          'GitLab API error: 422 Unprocessable Entity - {"key":"validation_failed","details":{"field":"key","code":"invalid_format"}}'
        );
      });

      it("should handle update_variable with empty response text and both string message and error fields", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with empty response text - should trigger the empty text handling in update_variable
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          text: jest.fn().mockResolvedValue(""),
        } as any);

        const tool = variablesToolRegistry.get("update_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "TEST_VAR",
            value: "updated-value",
          })
        ).rejects.toThrow("GitLab API error: 400 Bad Request");
      });

      it("should handle update_variable with string message and error fields", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with both string message and error fields
        const errorResponse = {
          message: "Variable update failed",
          error: "Variable is protected",
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          statusText: "Unprocessable Entity",
          text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse)),
        } as any);

        const tool = variablesToolRegistry.get("update_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "PROTECTED_VAR",
            value: "new-value",
          })
        ).rejects.toThrow(
          "GitLab API error: 422 Unprocessable Entity - Variable update failed - Variable is protected"
        );
      });

      it("should handle update_variable with complex message object (non-string, non-array)", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with complex message object
        const errorResponse = {
          message: {
            field: "value",
            constraint: "max_length",
            limit: 1000,
          },
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          statusText: "Unprocessable Entity",
          text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse)),
        } as any);

        const tool = variablesToolRegistry.get("update_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "TEST_VAR",
            value: "very-long-value",
          })
        ).rejects.toThrow(
          'GitLab API error: 422 Unprocessable Entity - {"field":"value","constraint":"max_length","limit":1000}'
        );
      });

      it("should handle delete_variable with empty response text", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with empty response text - should trigger the empty text handling in delete_variable
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          text: jest.fn().mockResolvedValue(""),
        } as any);

        const tool = variablesToolRegistry.get("delete_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "PROTECTED_VAR",
          })
        ).rejects.toThrow("GitLab API error: 403 Forbidden");
      });

      it("should handle delete_variable with string message and error fields", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with both string message and error fields
        const errorResponse = {
          message: "Cannot delete variable",
          error: "Variable is being used by active pipelines",
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 409,
          statusText: "Conflict",
          text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse)),
        } as any);

        const tool = variablesToolRegistry.get("delete_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "ACTIVE_VAR",
          })
        ).rejects.toThrow(
          "GitLab API error: 409 Conflict - Cannot delete variable - Variable is being used by active pipelines"
        );
      });

      it("should handle delete_variable with array message value", async () => {
        // Mock namespace detection call
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 123, name: "test-project" }),
        } as any);

        // Mock API error with message.value array format
        const errorResponse = {
          message: {
            value: ["Variable cannot be deleted", "Referenced by protected branch"],
          },
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          statusText: "Unprocessable Entity",
          text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse)),
        } as any);

        const tool = variablesToolRegistry.get("delete_variable")!;

        await expect(
          tool.handler({
            namespace: "test/project",
            key: "PROTECTED_VAR",
          })
        ).rejects.toThrow(
          "GitLab API error: 422 Unprocessable Entity - Variable cannot be deleted, Referenced by protected branch"
        );
      });
    });
  });
});
