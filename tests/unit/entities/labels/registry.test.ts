import {
  labelsToolRegistry,
  getLabelsReadOnlyToolNames,
  getLabelsToolDefinitions,
  getFilteredLabelsTools,
} from "../../../../src/entities/labels/registry";
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

describe("Labels Registry - CQRS Tools", () => {
  describe("Registry Structure", () => {
    it("should be a Map instance", () => {
      expect(labelsToolRegistry instanceof Map).toBe(true);
    });

    it("should contain exactly 2 CQRS tools", () => {
      const toolNames = Array.from(labelsToolRegistry.keys());

      expect(toolNames).toContain("browse_labels");
      expect(toolNames).toContain("manage_label");
      expect(labelsToolRegistry.size).toBe(2);
    });

    it("should have tools with valid structure", () => {
      for (const [toolName, tool] of labelsToolRegistry) {
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
      const toolNames = Array.from(labelsToolRegistry.keys());
      const uniqueNames = new Set(toolNames);

      expect(toolNames.length).toBe(uniqueNames.size);
    });
  });

  describe("Tool Definitions", () => {
    it("should have proper browse_labels tool", () => {
      const tool = labelsToolRegistry.get("browse_labels");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("browse_labels");
      expect(tool?.description).toContain("BROWSE labels");
      expect(tool?.description).toContain("list");
      expect(tool?.description).toContain("get");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper manage_label tool", () => {
      const tool = labelsToolRegistry.get("manage_label");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("manage_label");
      expect(tool?.description).toContain("MANAGE labels");
      expect(tool?.description).toContain("create");
      expect(tool?.description).toContain("update");
      expect(tool?.description).toContain("delete");
      expect(tool?.inputSchema).toBeDefined();
    });
  });

  describe("Read-Only Tools Function", () => {
    it("should return an array of read-only tool names", () => {
      const readOnlyTools = getLabelsReadOnlyToolNames();

      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it("should include only browse_labels as read-only", () => {
      const readOnlyTools = getLabelsReadOnlyToolNames();

      expect(readOnlyTools).toContain("browse_labels");
      expect(readOnlyTools).toEqual(["browse_labels"]);
    });

    it("should not include manage tools (write tools)", () => {
      const readOnlyTools = getLabelsReadOnlyToolNames();

      expect(readOnlyTools).not.toContain("manage_label");
    });

    it("should return exactly 1 read-only tool", () => {
      const readOnlyTools = getLabelsReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(1);
    });

    it("should return tools that exist in the registry", () => {
      const readOnlyTools = getLabelsReadOnlyToolNames();
      const registryKeys = Array.from(labelsToolRegistry.keys());

      for (const toolName of readOnlyTools) {
        expect(registryKeys).toContain(toolName);
      }
    });
  });

  describe("Labels Tool Definitions Function", () => {
    it("should return an array of tool definitions", () => {
      const definitions = getLabelsToolDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBe(labelsToolRegistry.size);
    });

    it("should return all 2 CQRS tools from registry", () => {
      const definitions = getLabelsToolDefinitions();

      expect(definitions.length).toBe(2);
    });

    it("should return tool definitions with proper structure", () => {
      const definitions = getLabelsToolDefinitions();

      for (const definition of definitions) {
        expect(definition).toHaveProperty("name");
        expect(definition).toHaveProperty("description");
        expect(definition).toHaveProperty("inputSchema");
        expect(definition).toHaveProperty("handler");
      }
    });
  });

  describe("Filtered Labels Tools Function", () => {
    it("should return all tools in normal mode", () => {
      const allTools = getFilteredLabelsTools(false);
      const allDefinitions = getLabelsToolDefinitions();

      expect(allTools.length).toBe(allDefinitions.length);
      expect(allTools.length).toBe(2);
    });

    it("should return only read-only tools in read-only mode", () => {
      const readOnlyTools = getFilteredLabelsTools(true);
      const readOnlyNames = getLabelsReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(readOnlyTools.length).toBe(1);
    });

    it("should filter tools correctly in read-only mode", () => {
      const readOnlyTools = getFilteredLabelsTools(true);
      const readOnlyNames = getLabelsReadOnlyToolNames();

      for (const tool of readOnlyTools) {
        expect(readOnlyNames).toContain(tool.name);
      }
    });

    it("should not include manage tools in read-only mode", () => {
      const readOnlyTools = getFilteredLabelsTools(true);

      for (const tool of readOnlyTools) {
        expect(tool.name).not.toBe("manage_label");
      }
    });
  });

  describe("Tool Handlers", () => {
    it("should have handlers that are async functions", () => {
      for (const [, tool] of labelsToolRegistry) {
        expect(tool.handler.constructor.name).toBe("AsyncFunction");
      }
    });

    it("should have handlers that accept arguments", () => {
      for (const [, tool] of labelsToolRegistry) {
        expect(tool.handler.length).toBe(1);
      }
    });
  });

  describe("Registry Consistency", () => {
    it("should have all expected CQRS tools", () => {
      const expectedTools = ["browse_labels", "manage_label"];

      for (const toolName of expectedTools) {
        expect(labelsToolRegistry.has(toolName)).toBe(true);
      }
    });

    it("should have consistent tool count between functions", () => {
      const allDefinitions = getLabelsToolDefinitions();
      const readOnlyNames = getLabelsReadOnlyToolNames();
      const readOnlyTools = getFilteredLabelsTools(true);

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(allDefinitions.length).toBe(labelsToolRegistry.size);
      expect(allDefinitions.length).toBeGreaterThan(readOnlyNames.length);
    });

    it("should have more tools than just read-only ones", () => {
      const totalTools = labelsToolRegistry.size;
      const readOnlyCount = getLabelsReadOnlyToolNames().length;

      expect(totalTools).toBeGreaterThan(readOnlyCount);
      expect(totalTools).toBe(2);
      expect(readOnlyCount).toBe(1);
    });
  });

  describe("Tool Input Schemas", () => {
    it("should have valid JSON schema structure for all tools", () => {
      for (const [, tool] of labelsToolRegistry) {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe("object");
        const schema = tool.inputSchema as Record<string, unknown>;
        const hasValidStructure = "type" in schema || "anyOf" in schema || "oneOf" in schema;
        expect(hasValidStructure).toBe(true);
      }
    });

    it("should have consistent schema format", () => {
      for (const [toolName, tool] of labelsToolRegistry) {
        expect(tool.inputSchema).toBeDefined();

        if (typeof tool.inputSchema === "object" && tool.inputSchema !== null) {
          const schema = tool.inputSchema as Record<string, unknown>;
          const hasValidStructure = "type" in schema || "anyOf" in schema || "oneOf" in schema;
          expect(hasValidStructure).toBe(true);
        } else {
          throw new Error(`Tool ${toolName} has invalid inputSchema type`);
        }
      }
    });
  });

  describe("Handler Tests", () => {
    const mockResponse = (data: unknown, ok = true, status = 200) => ({
      ok,
      status,
      statusText: ok ? "OK" : "Error",
      json: jest.fn().mockResolvedValue(data),
      text: jest.fn().mockResolvedValue(typeof data === "string" ? data : JSON.stringify(data)),
    });

    describe("browse_labels handler - list action", () => {
      it("should list labels with basic parameters", async () => {
        // First mock for namespace resolution (project lookup)
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        // Second mock for labels list
        const mockLabels = [
          { id: 1, name: "bug", color: "#ff0000" },
          { id: 2, name: "feature", color: "#00ff00" },
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockLabels) as never);

        const tool = labelsToolRegistry.get("browse_labels")!;
        const result = await tool.handler({
          action: "list",
          namespace: "test/project",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockLabels);
      });

      it("should list labels with search filter", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockLabels = [{ id: 1, name: "bug", color: "#ff0000" }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockLabels) as never);

        const tool = labelsToolRegistry.get("browse_labels")!;
        await tool.handler({
          action: "list",
          namespace: "test/project",
          search: "bug",
          with_counts: true,
          per_page: 50,
          page: 1,
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const url = call[0] as string;
        expect(url).toContain("search=bug");
        expect(url).toContain("with_counts=true");
        expect(url).toContain("per_page=50");
        expect(url).toContain("page=1");
      });

      it("should list group labels", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-group", kind: "group" }) as never
        );
        const mockLabels = [{ id: 3, name: "priority", color: "#0000ff" }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockLabels) as never);

        const tool = labelsToolRegistry.get("browse_labels")!;
        const result = await tool.handler({
          action: "list",
          namespace: "test-group",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockLabels);
      });

      it("should handle API errors", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as never);

        const tool = labelsToolRegistry.get("browse_labels")!;

        await expect(
          tool.handler({
            action: "list",
            namespace: "nonexistent/project",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });
    });

    describe("browse_labels handler - get action", () => {
      it("should get label by ID", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockLabel = { id: 1, name: "bug", color: "#ff0000", description: "Bug label" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockLabel) as never);

        const tool = labelsToolRegistry.get("browse_labels")!;
        const result = await tool.handler({
          action: "get",
          namespace: "test/project",
          label_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockLabel);
      });

      it("should get label by name", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockLabel = { id: 1, name: "bug", color: "#ff0000" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockLabel) as never);

        const tool = labelsToolRegistry.get("browse_labels")!;
        const result = await tool.handler({
          action: "get",
          namespace: "test/project",
          label_id: "bug",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockLabel);
      });

      it("should handle label not found", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as never);

        const tool = labelsToolRegistry.get("browse_labels")!;

        await expect(
          tool.handler({
            action: "get",
            namespace: "test/project",
            label_id: "nonexistent",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });

      it("should include ancestor groups parameter", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockLabel = { id: 1, name: "bug", color: "#ff0000" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockLabel) as never);

        const tool = labelsToolRegistry.get("browse_labels")!;
        await tool.handler({
          action: "get",
          namespace: "test/project",
          label_id: "1",
          include_ancestor_groups: true,
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const url = call[0] as string;
        expect(url).toContain("include_ancestor_groups=true");
      });
    });

    describe("manage_label handler - create action", () => {
      it("should create label", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockLabel = { id: 3, name: "new-label", color: "#ffff00" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockLabel) as never);

        const tool = labelsToolRegistry.get("manage_label")!;
        const result = await tool.handler({
          action: "create",
          namespace: "test/project",
          name: "new-label",
          color: "#ffff00",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockLabel);
      });

      it("should create label with all options", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockLabel = { id: 4, name: "priority-label", color: "#ff00ff" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockLabel) as never);

        const tool = labelsToolRegistry.get("manage_label")!;
        await tool.handler({
          action: "create",
          namespace: "test/project",
          name: "priority-label",
          color: "#ff00ff",
          description: "High priority items",
          priority: 1,
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.name).toBe("priority-label");
        expect(body.color).toBe("#ff00ff");
        expect(body.description).toBe("High priority items");
        expect(body.priority).toBe(1);
      });

      it("should create group label", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-group", kind: "group" }) as never
        );
        const mockLabel = { id: 5, name: "group-label", color: "#00ffff" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockLabel) as never);

        const tool = labelsToolRegistry.get("manage_label")!;
        const result = await tool.handler({
          action: "create",
          namespace: "test-group",
          name: "group-label",
          color: "#00ffff",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockLabel);
      });
    });

    describe("manage_label handler - update action", () => {
      it("should update label", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockLabel = { id: 1, name: "bug", color: "#cc0000" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockLabel) as never);

        const tool = labelsToolRegistry.get("manage_label")!;
        const result = await tool.handler({
          action: "update",
          namespace: "test/project",
          label_id: "1",
          color: "#cc0000",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockLabel);
      });

      it("should rename label", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockLabel = { id: 1, name: "critical-bug", color: "#ff0000" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockLabel) as never);

        const tool = labelsToolRegistry.get("manage_label")!;
        await tool.handler({
          action: "update",
          namespace: "test/project",
          label_id: "1",
          new_name: "critical-bug",
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.new_name).toBe("critical-bug");
      });

      it("should update label priority", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockLabel = { id: 1, name: "bug", priority: 5 };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockLabel) as never);

        const tool = labelsToolRegistry.get("manage_label")!;
        await tool.handler({
          action: "update",
          namespace: "test/project",
          label_id: "1",
          priority: 5,
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.priority).toBe(5);
      });
    });

    describe("manage_label handler - delete action", () => {
      it("should delete label", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null) as never);

        const tool = labelsToolRegistry.get("manage_label")!;
        const result = await tool.handler({
          action: "delete",
          namespace: "test/project",
          label_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ deleted: true });
      });

      it("should delete label by name", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null) as never);

        const tool = labelsToolRegistry.get("manage_label")!;
        const result = await tool.handler({
          action: "delete",
          namespace: "test/project",
          label_id: "bug",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ deleted: true });
      });

      it("should handle delete of non-existent label", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as never);

        const tool = labelsToolRegistry.get("manage_label")!;

        await expect(
          tool.handler({
            action: "delete",
            namespace: "test/project",
            label_id: "nonexistent",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });
    });

    describe("Error Handling", () => {
      it("should handle schema validation errors for browse_labels", async () => {
        const tool = labelsToolRegistry.get("browse_labels")!;

        // Missing required action
        await expect(tool.handler({})).rejects.toThrow();

        // Invalid action
        await expect(tool.handler({ action: "invalid", namespace: "test" })).rejects.toThrow();

        // Missing namespace for list
        await expect(tool.handler({ action: "list" })).rejects.toThrow();

        // Missing label_id for get
        await expect(tool.handler({ action: "get", namespace: "test" })).rejects.toThrow();
      });

      it("should handle schema validation errors for manage_label", async () => {
        const tool = labelsToolRegistry.get("manage_label")!;

        // Missing required action
        await expect(tool.handler({})).rejects.toThrow();

        // Invalid action
        await expect(tool.handler({ action: "invalid", namespace: "test" })).rejects.toThrow();

        // Missing name for create
        await expect(
          tool.handler({ action: "create", namespace: "test", color: "#ff0000" })
        ).rejects.toThrow();

        // Missing color for create
        await expect(
          tool.handler({ action: "create", namespace: "test", name: "label" })
        ).rejects.toThrow();

        // Missing label_id for update
        await expect(tool.handler({ action: "update", namespace: "test" })).rejects.toThrow();

        // Missing label_id for delete
        await expect(tool.handler({ action: "delete", namespace: "test" })).rejects.toThrow();
      });

      it("should handle network errors", async () => {
        // First call for namespace resolution succeeds
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        // Second call (actual API) fails with network error
        mockEnhancedFetch.mockRejectedValueOnce(new Error("Connection timeout"));

        const tool = labelsToolRegistry.get("browse_labels")!;

        await expect(
          tool.handler({
            action: "list",
            namespace: "test/project",
          })
        ).rejects.toThrow("Connection timeout");
      });

      it("should handle API errors with proper error messages", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 403) as never);

        const tool = labelsToolRegistry.get("browse_labels")!;

        await expect(
          tool.handler({
            action: "list",
            namespace: "private/project",
          })
        ).rejects.toThrow("GitLab API error: 403 Error");
      });

      it("should handle API error responses in manage_label create", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 400) as never);

        const tool = labelsToolRegistry.get("manage_label")!;

        await expect(
          tool.handler({
            action: "create",
            namespace: "test",
            name: "new-label",
            color: "#ff0000",
          })
        ).rejects.toThrow("GitLab API error: 400 Error");
      });

      it("should handle API error responses in manage_label update", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 500) as never);

        const tool = labelsToolRegistry.get("manage_label")!;

        await expect(
          tool.handler({
            action: "update",
            namespace: "test",
            label_id: "1",
            color: "#00ff00",
          })
        ).rejects.toThrow("GitLab API error: 500 Error");
      });
    });
  });
});
