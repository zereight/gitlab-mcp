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
  mockEnhancedFetch.mockReset();
});

describe("Variables Registry", () => {
  describe("Registry Structure", () => {
    it("should be a Map instance", () => {
      expect(variablesToolRegistry instanceof Map).toBe(true);
    });

    it("should contain expected CQRS variable tools", () => {
      const toolNames = Array.from(variablesToolRegistry.keys());

      // Check for CQRS tools (2 tools instead of 5)
      expect(toolNames).toContain("browse_variables");
      expect(toolNames).toContain("manage_variable");

      // Should have exactly 2 CQRS tools
      expect(toolNames).toHaveLength(2);
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
    it("should have proper browse_variables tool", () => {
      const tool = variablesToolRegistry.get("browse_variables");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("browse_variables");
      expect(tool?.description).toContain("BROWSE");
      expect(tool?.description).toContain("CI/CD variables");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper manage_variable tool", () => {
      const tool = variablesToolRegistry.get("manage_variable");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("manage_variable");
      expect(tool?.description).toContain("MANAGE");
      expect(tool?.description).toContain("CI/CD variables");
      expect(tool?.inputSchema).toBeDefined();
    });
  });

  describe("Read-Only Tools Function", () => {
    it("should return an array of read-only tool names", () => {
      const readOnlyTools = getVariablesReadOnlyToolNames();

      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it("should include only browse_variables as read-only", () => {
      const readOnlyTools = getVariablesReadOnlyToolNames();

      expect(readOnlyTools).toContain("browse_variables");
      expect(readOnlyTools).toHaveLength(1);
    });

    it("should not include manage_variable in read-only tools", () => {
      const readOnlyTools = getVariablesReadOnlyToolNames();

      expect(readOnlyTools).not.toContain("manage_variable");
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
        expect(tool.handler.length).toBe(1);
      }
    });
  });

  describe("Registry Consistency", () => {
    it("should have all CQRS tools defined in registry", () => {
      const expectedTools = ["browse_variables", "manage_variable"];

      for (const toolName of expectedTools) {
        expect(variablesToolRegistry.has(toolName)).toBe(true);
      }
    });

    it("should have consistent tool count", () => {
      const toolCount = variablesToolRegistry.size;
      const readOnlyCount = getVariablesReadOnlyToolNames().length;

      // Registry should have more tools than just read-only ones
      expect(toolCount).toBeGreaterThan(readOnlyCount);
      // Should have exactly 2 CQRS tools
      expect(toolCount).toBe(2);
    });
  });

  describe("Variable Tool Specifics", () => {
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
        expect(definitions).toHaveLength(2);
        expect(
          definitions.every(def => def.name && def.description && def.inputSchema && def.handler)
        ).toBe(true);
      });
    });

    describe("getFilteredVariablesTools", () => {
      it("should return all tools when readOnlyMode is false", () => {
        const tools = getFilteredVariablesTools(false);
        expect(tools).toHaveLength(2);
      });

      it("should return only read-only tools when readOnlyMode is true", () => {
        const tools = getFilteredVariablesTools(true);
        expect(tools).toHaveLength(1);
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain("browse_variables");
        expect(toolNames).not.toContain("manage_variable");
      });
    });
  });

  describe("browse_variables Handler", () => {
    describe("list action", () => {
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

        const tool = variablesToolRegistry.get("browse_variables")!;
        const result = await tool.handler({
          action: "list",
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

        const tool = variablesToolRegistry.get("browse_variables")!;
        const result = await tool.handler({
          action: "list",
          namespace: "test-group",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariables);
      });

      it("should use pagination parameters when provided", async () => {
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

        const tool = variablesToolRegistry.get("browse_variables")!;
        const result = await tool.handler({
          action: "list",
          namespace: "test/project",
          per_page: 50,
          page: 2,
        });

        // Verify pagination params are passed
        expect(mockEnhancedFetch).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining("per_page=50")
        );
        expect(mockEnhancedFetch).toHaveBeenNthCalledWith(2, expect.stringContaining("page=2"));
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

        const tool = variablesToolRegistry.get("browse_variables")!;

        await expect(
          tool.handler({
            action: "list",
            namespace: "private/project",
          })
        ).rejects.toThrow("GitLab API error: 403 Error");
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

        const tool = variablesToolRegistry.get("browse_variables")!;

        await expect(
          tool.handler({
            action: "list",
            namespace: "test/project",
          })
        ).rejects.toThrow(
          "GitLab API error: 403 Forbidden - Access denied - Insufficient permissions"
        );
      });
    });

    describe("get action", () => {
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

        const tool = variablesToolRegistry.get("browse_variables")!;
        const result = await tool.handler({
          action: "get",
          namespace: "test/project",
          key: "API_KEY",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockVariable);
      });

      it("should get variable with environment scope filter", async () => {
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

        const tool = variablesToolRegistry.get("browse_variables")!;
        const result = await tool.handler({
          action: "get",
          namespace: "test-group",
          key: "DB_URL",
          filter: {
            environment_scope: "production",
          },
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        // Verify environment scope filter is passed
        expect(mockEnhancedFetch).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining("filter%5Benvironment_scope%5D=production")
        );
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

        const tool = variablesToolRegistry.get("browse_variables")!;

        await expect(
          tool.handler({
            action: "get",
            namespace: "test/project",
            key: "NONEXISTENT_KEY",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });

      it("should require key for get action", async () => {
        const tool = variablesToolRegistry.get("browse_variables")!;

        // get action without key should fail Zod validation
        await expect(
          tool.handler({
            action: "get",
            namespace: "test/project",
            // Missing key
          })
        ).rejects.toThrow();
      });
    });
  });

  describe("manage_variable Handler", () => {
    describe("create action", () => {
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

        const tool = variablesToolRegistry.get("manage_variable")!;
        const result = await tool.handler({
          action: "create",
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

        const tool = variablesToolRegistry.get("manage_variable")!;
        const result = await tool.handler({
          action: "create",
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

      it("should require value for create action", async () => {
        const tool = variablesToolRegistry.get("manage_variable")!;

        // create action without value should fail Zod validation
        await expect(
          tool.handler({
            action: "create",
            namespace: "test/project",
            key: "NEW_KEY",
            // Missing value
          })
        ).rejects.toThrow();
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

        const tool = variablesToolRegistry.get("manage_variable")!;

        await expect(
          tool.handler({
            action: "create",
            namespace: "test/project",
            key: "EXISTING_KEY",
            value: "value",
          })
        ).rejects.toThrow("GitLab API error: 400 Error");
      });
    });

    describe("update action", () => {
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

        const tool = variablesToolRegistry.get("manage_variable")!;
        const result = await tool.handler({
          action: "update",
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

        const tool = variablesToolRegistry.get("manage_variable")!;
        const result = await tool.handler({
          action: "update",
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

        const tool = variablesToolRegistry.get("manage_variable")!;

        await expect(
          tool.handler({
            action: "update",
            namespace: "test/project",
            key: "NONEXISTENT_KEY",
            value: "value",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });
    });

    describe("delete action", () => {
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

        const tool = variablesToolRegistry.get("manage_variable")!;
        const result = await tool.handler({
          action: "delete",
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

        const tool = variablesToolRegistry.get("manage_variable")!;
        const result = await tool.handler({
          action: "delete",
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

        const tool = variablesToolRegistry.get("manage_variable")!;

        await expect(
          tool.handler({
            action: "delete",
            namespace: "test/project",
            key: "NONEXISTENT_KEY",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });
    });
  });

  describe("Error handling", () => {
    it("should handle validation errors for browse_variables", async () => {
      const tool = variablesToolRegistry.get("browse_variables")!;

      // Test with invalid action
      await expect(
        tool.handler({
          action: "invalid_action",
          namespace: "test/project",
        })
      ).rejects.toThrow();
    });

    it("should handle validation errors for manage_variable", async () => {
      const tool = variablesToolRegistry.get("manage_variable")!;

      // Test with invalid action
      await expect(
        tool.handler({
          action: "invalid_action",
          namespace: "test/project",
          key: "TEST_KEY",
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

      const tool = variablesToolRegistry.get("browse_variables")!;

      await expect(
        tool.handler({
          action: "list",
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

      const tool = variablesToolRegistry.get("manage_variable")!;

      await expect(
        tool.handler({
          action: "create",
          namespace: "test/project",
          key: "TEST_KEY",
          value: "test-value",
        })
      ).rejects.toThrow("Network error");
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

      const tool = variablesToolRegistry.get("browse_variables")!;

      await expect(
        tool.handler({
          action: "list",
          namespace: "test/project",
        })
      ).rejects.toThrow("GitLab API error: 400 Bad Request - Field is required, Invalid format");
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

      const tool = variablesToolRegistry.get("browse_variables")!;

      await expect(
        tool.handler({
          action: "list",
          namespace: "test/project",
        })
      ).rejects.toThrow("GitLab API error: 404 Not Found");
    });

    it("should handle manage_variable API errors with string message and error fields", async () => {
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

      const tool = variablesToolRegistry.get("manage_variable")!;

      await expect(
        tool.handler({
          action: "update",
          namespace: "test/project",
          key: "PROTECTED_VAR",
          value: "new-value",
        })
      ).rejects.toThrow(
        "GitLab API error: 422 Unprocessable Entity - Variable update failed - Variable is protected"
      );
    });

    it("should handle delete with complex message object", async () => {
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

      const tool = variablesToolRegistry.get("manage_variable")!;

      await expect(
        tool.handler({
          action: "delete",
          namespace: "test/project",
          key: "TEST_VAR",
        })
      ).rejects.toThrow(
        'GitLab API error: 422 Unprocessable Entity - {"key":"validation_failed","details":{"field":"key","code":"invalid_format"}}'
      );
    });
  });
});
