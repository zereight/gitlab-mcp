import {
  webhooksToolRegistry,
  getWebhooksReadOnlyToolNames,
  getWebhooksToolDefinitions,
  getFilteredWebhooksTools,
} from "../../../../src/entities/webhooks/registry";
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

describe("Webhooks Registry", () => {
  describe("Registry Structure", () => {
    it("should be a Map instance", () => {
      expect(webhooksToolRegistry instanceof Map).toBe(true);
    });

    it("should contain expected webhook tools", () => {
      const toolNames = Array.from(webhooksToolRegistry.keys());

      // Check for read-only tools
      expect(toolNames).toContain("list_webhooks");

      // Check for manage tool
      expect(toolNames).toContain("manage_webhook");
    });

    it("should have tools with valid structure", () => {
      const toolEntries = Array.from(webhooksToolRegistry.values());

      toolEntries.forEach(tool => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(tool).toHaveProperty("handler");
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.description).toBe("string");
        expect(typeof tool.inputSchema).toBe("object");
        expect(typeof tool.handler).toBe("function");
      });
    });

    it("should have unique tool names", () => {
      const toolNames = Array.from(webhooksToolRegistry.keys());
      const uniqueNames = new Set(toolNames);
      expect(toolNames.length).toBe(uniqueNames.size);
    });

    it("should have exactly 2 webhook tools", () => {
      expect(webhooksToolRegistry.size).toBe(2);
    });
  });

  describe("Tool Definitions", () => {
    it("should have proper list_webhooks tool", () => {
      const tool = webhooksToolRegistry.get("list_webhooks");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("list_webhooks");
      expect(tool!.description).toContain("List all webhooks");
      expect(tool!.inputSchema).toBeDefined();
    });

    it("should have proper manage_webhook tool", () => {
      const tool = webhooksToolRegistry.get("manage_webhook");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("manage_webhook");
      expect(tool!.description).toContain("Manage webhooks with full CRUD");
      expect(tool!.inputSchema).toBeDefined();
    });
  });

  describe("Read-Only Tools Function", () => {
    it("should return an array of read-only tool names", () => {
      const readOnlyTools = getWebhooksReadOnlyToolNames();
      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it("should include expected read-only tools", () => {
      const readOnlyTools = getWebhooksReadOnlyToolNames();
      expect(readOnlyTools).toContain("list_webhooks");
      expect(readOnlyTools).toContain("manage_webhook");
    });

    it("should return exactly 2 tools (manage_webhook allowed for read action)", () => {
      const readOnlyTools = getWebhooksReadOnlyToolNames();
      expect(readOnlyTools.length).toBe(2);
    });

    it("should return tools that exist in the registry", () => {
      const readOnlyTools = getWebhooksReadOnlyToolNames();
      readOnlyTools.forEach(toolName => {
        expect(webhooksToolRegistry.has(toolName)).toBe(true);
      });
    });
  });

  describe("Webhooks Tool Definitions Function", () => {
    it("should return an array of tool definitions", () => {
      const toolDefinitions = getWebhooksToolDefinitions();
      expect(Array.isArray(toolDefinitions)).toBe(true);
      expect(toolDefinitions.length).toBe(2);
    });

    it("should return all tools from registry", () => {
      const toolDefinitions = getWebhooksToolDefinitions();
      const registrySize = webhooksToolRegistry.size;
      expect(toolDefinitions.length).toBe(registrySize);
    });

    it("should return tool definitions with proper structure", () => {
      const toolDefinitions = getWebhooksToolDefinitions();

      toolDefinitions.forEach(tool => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(tool).toHaveProperty("handler");
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.description).toBe("string");
        expect(typeof tool.inputSchema).toBe("object");
      });
    });
  });

  describe("Filtered Webhooks Tools Function", () => {
    it("should return all tools in normal mode", () => {
      const filteredTools = getFilteredWebhooksTools(false);
      expect(filteredTools.length).toBe(2);
    });

    it("should return read-only tools in read-only mode", () => {
      const filteredTools = getFilteredWebhooksTools(true);
      expect(filteredTools.length).toBe(2);

      const toolNames = filteredTools.map(tool => tool.name);
      expect(toolNames).toContain("list_webhooks");
      expect(toolNames).toContain("manage_webhook");
    });
  });

  describe("list_webhooks Handler", () => {
    it("should handle project action correctly", async () => {
      const tool = webhooksToolRegistry.get("list_webhooks");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ id: 1, url: "https://example.com/hook" }],
      } as Response);

      const result = await tool!.handler({
        action: "project",
        projectId: "test-project",
        page: 1,
        per_page: 20,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/hooks")
      );
      expect(result).toBeDefined();
    });

    it("should handle group action correctly", async () => {
      const tool = webhooksToolRegistry.get("list_webhooks");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ id: 1, url: "https://example.com/hook" }],
      } as Response);

      const result = await tool!.handler({
        action: "group",
        groupId: "test-group",
        page: 1,
        per_page: 20,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("groups/test-group/hooks")
      );
      expect(result).toBeDefined();
    });

    it("should throw error for invalid action", async () => {
      const tool = webhooksToolRegistry.get("list_webhooks");
      expect(tool).toBeDefined();

      await expect(
        tool!.handler({
          action: "project",
          // Missing projectId
        })
      ).rejects.toThrow();
    });
  });

  describe("manage_webhook Handler", () => {
    it("should handle create action", async () => {
      const tool = webhooksToolRegistry.get("manage_webhook");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, url: "https://example.com/hook" }),
      } as Response);

      const result = await tool!.handler({
        action: "create",
        scope: "project",
        projectId: "test-project",
        url: "https://example.com/hook",
        push_events: true,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/hooks"),
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result).toBeDefined();
    });

    it("should handle read action", async () => {
      const tool = webhooksToolRegistry.get("manage_webhook");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, url: "https://example.com/hook" }),
      } as Response);

      const result = await tool!.handler({
        action: "read",
        scope: "project",
        projectId: "test-project",
        hookId: 1,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/hooks/1")
      );
      expect(result).toBeDefined();
    });

    it("should handle update action", async () => {
      const tool = webhooksToolRegistry.get("manage_webhook");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, url: "https://example.com/hook-updated" }),
      } as Response);

      const result = await tool!.handler({
        action: "update",
        scope: "project",
        projectId: "test-project",
        hookId: 1,
        url: "https://example.com/hook-updated",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/hooks/1"),
        expect.objectContaining({
          method: "PUT",
        })
      );
      expect(result).toBeDefined();
    });

    it("should handle delete action", async () => {
      const tool = webhooksToolRegistry.get("manage_webhook");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => undefined,
      } as Response);

      const result = await tool!.handler({
        action: "delete",
        scope: "project",
        projectId: "test-project",
        hookId: 1,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/hooks/1"),
        expect.objectContaining({
          method: "DELETE",
        })
      );
      expect(result).toEqual({ success: true, message: "Webhook deleted successfully" });
    });

    it("should handle test action", async () => {
      const tool = webhooksToolRegistry.get("manage_webhook");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await tool!.handler({
        action: "test",
        scope: "project",
        projectId: "test-project",
        hookId: 1,
        trigger: "push_events",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/hooks/1/test/push_events"),
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result).toBeDefined();
    });

    it("should enforce read-only mode for write operations", async () => {
      // Set read-only mode
      process.env.GITLAB_READ_ONLY_MODE = "true";

      const tool = webhooksToolRegistry.get("manage_webhook");
      expect(tool).toBeDefined();

      await expect(
        tool!.handler({
          action: "create",
          scope: "project",
          projectId: "test-project",
          url: "https://example.com/hook",
        })
      ).rejects.toThrow("not allowed in read-only mode");

      await expect(
        tool!.handler({
          action: "update",
          scope: "project",
          projectId: "test-project",
          hookId: 1,
          url: "https://example.com/hook",
        })
      ).rejects.toThrow("not allowed in read-only mode");

      await expect(
        tool!.handler({
          action: "delete",
          scope: "project",
          projectId: "test-project",
          hookId: 1,
        })
      ).rejects.toThrow("not allowed in read-only mode");

      await expect(
        tool!.handler({
          action: "test",
          scope: "project",
          projectId: "test-project",
          hookId: 1,
          trigger: "push_events",
        })
      ).rejects.toThrow("not allowed in read-only mode");

      // Cleanup
      delete process.env.GITLAB_READ_ONLY_MODE;
    });

    it("should allow read action in read-only mode", async () => {
      // Set read-only mode
      process.env.GITLAB_READ_ONLY_MODE = "true";

      const tool = webhooksToolRegistry.get("manage_webhook");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, url: "https://example.com/hook" }),
      } as Response);

      const result = await tool!.handler({
        action: "read",
        scope: "project",
        projectId: "test-project",
        hookId: 1,
      });

      expect(result).toBeDefined();

      // Cleanup
      delete process.env.GITLAB_READ_ONLY_MODE;
    });

    it("should require hookId for read action", async () => {
      const tool = webhooksToolRegistry.get("manage_webhook");
      expect(tool).toBeDefined();

      await expect(
        tool!.handler({
          action: "read",
          scope: "project",
          projectId: "test-project",
          // Missing hookId
        })
      ).rejects.toThrow();
    });

    it("should require url for create action", async () => {
      const tool = webhooksToolRegistry.get("manage_webhook");
      expect(tool).toBeDefined();

      await expect(
        tool!.handler({
          action: "create",
          scope: "project",
          projectId: "test-project",
          // Missing url
        })
      ).rejects.toThrow();
    });

    it("should require trigger for test action", async () => {
      const tool = webhooksToolRegistry.get("manage_webhook");
      expect(tool).toBeDefined();

      await expect(
        tool!.handler({
          action: "test",
          scope: "project",
          projectId: "test-project",
          hookId: 1,
          // Missing trigger
        })
      ).rejects.toThrow();
    });
  });
});
