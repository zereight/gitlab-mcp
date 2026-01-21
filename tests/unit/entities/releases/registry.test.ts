import {
  releasesToolRegistry,
  getReleasesReadOnlyToolNames,
  getReleasesToolDefinitions,
  getFilteredReleasesTools,
} from "../../../../src/entities/releases/registry";
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

describe("Releases Registry", () => {
  describe("Registry Structure", () => {
    it("should be a Map instance", () => {
      expect(releasesToolRegistry instanceof Map).toBe(true);
    });

    it("should contain expected release tools", () => {
      const toolNames = Array.from(releasesToolRegistry.keys());

      // Check for browse tool
      expect(toolNames).toContain("browse_releases");

      // Check for manage tool
      expect(toolNames).toContain("manage_release");
    });

    it("should have tools with valid structure", () => {
      const toolEntries = Array.from(releasesToolRegistry.values());

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
      const toolNames = Array.from(releasesToolRegistry.keys());
      const uniqueNames = new Set(toolNames);
      expect(toolNames.length).toBe(uniqueNames.size);
    });

    it("should have exactly 2 release tools", () => {
      expect(releasesToolRegistry.size).toBe(2);
    });
  });

  describe("Tool Definitions", () => {
    it("should have proper browse_releases tool", () => {
      const tool = releasesToolRegistry.get("browse_releases");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("browse_releases");
      expect(tool!.description).toContain("BROWSE");
      expect(tool!.inputSchema).toBeDefined();
    });

    it("should have proper manage_release tool", () => {
      const tool = releasesToolRegistry.get("manage_release");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("manage_release");
      expect(tool!.description).toContain("MANAGE");
      expect(tool!.inputSchema).toBeDefined();
    });
  });

  describe("Read-Only Tools Function", () => {
    it("should return an array of read-only tool names", () => {
      const readOnlyTools = getReleasesReadOnlyToolNames();
      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it("should include browse_releases as read-only", () => {
      const readOnlyTools = getReleasesReadOnlyToolNames();
      expect(readOnlyTools).toContain("browse_releases");
    });

    it("should not include manage_release as read-only", () => {
      const readOnlyTools = getReleasesReadOnlyToolNames();
      expect(readOnlyTools).not.toContain("manage_release");
    });

    it("should return exactly 1 read-only tool", () => {
      const readOnlyTools = getReleasesReadOnlyToolNames();
      expect(readOnlyTools.length).toBe(1);
    });

    it("should return tools that exist in the registry", () => {
      const readOnlyTools = getReleasesReadOnlyToolNames();
      readOnlyTools.forEach(toolName => {
        expect(releasesToolRegistry.has(toolName)).toBe(true);
      });
    });
  });

  describe("Releases Tool Definitions Function", () => {
    it("should return an array of tool definitions", () => {
      const toolDefinitions = getReleasesToolDefinitions();
      expect(Array.isArray(toolDefinitions)).toBe(true);
      expect(toolDefinitions.length).toBe(2);
    });

    it("should return all tools from registry", () => {
      const toolDefinitions = getReleasesToolDefinitions();
      const registrySize = releasesToolRegistry.size;
      expect(toolDefinitions.length).toBe(registrySize);
    });

    it("should return tool definitions with proper structure", () => {
      const toolDefinitions = getReleasesToolDefinitions();

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

  describe("Filtered Releases Tools Function", () => {
    it("should return all tools in normal mode", () => {
      const filteredTools = getFilteredReleasesTools(false);
      expect(filteredTools.length).toBe(2);
    });

    it("should return only read-only tools in read-only mode", () => {
      const filteredTools = getFilteredReleasesTools(true);
      expect(filteredTools.length).toBe(1);

      const toolNames = filteredTools.map(tool => tool.name);
      expect(toolNames).toContain("browse_releases");
      expect(toolNames).not.toContain("manage_release");
    });
  });

  describe("browse_releases Handler", () => {
    it("should handle list action correctly", async () => {
      const tool = releasesToolRegistry.get("browse_releases");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          { tag_name: "v1.0.0", name: "Release 1.0.0" },
          { tag_name: "v0.9.0", name: "Release 0.9.0" },
        ],
      } as Response);

      const result = await tool!.handler({
        action: "list",
        project_id: "test-project",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/releases")
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle list action with pagination", async () => {
      const tool = releasesToolRegistry.get("browse_releases");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ tag_name: "v1.0.0" }],
      } as Response);

      await tool!.handler({
        action: "list",
        project_id: "test-project",
        per_page: 50,
        page: 2,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(expect.stringContaining("per_page=50"));
      expect(mockEnhancedFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    });

    it("should handle list action with order_by and sort", async () => {
      const tool = releasesToolRegistry.get("browse_releases");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);

      await tool!.handler({
        action: "list",
        project_id: "test-project",
        order_by: "created_at",
        sort: "asc",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("order_by=created_at")
      );
      expect(mockEnhancedFetch).toHaveBeenCalledWith(expect.stringContaining("sort=asc"));
    });

    it("should handle get action correctly", async () => {
      const tool = releasesToolRegistry.get("browse_releases");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: "v1.0.0",
          name: "Release 1.0.0",
          description: "First release",
        }),
      } as Response);

      const result = await tool!.handler({
        action: "get",
        project_id: "test-project",
        tag_name: "v1.0.0",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/releases/v1.0.0")
      );
      expect(result).toBeDefined();
    });

    it("should handle get action with include_html_description", async () => {
      const tool = releasesToolRegistry.get("browse_releases");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: "v1.0.0", description_html: "<p>Release</p>" }),
      } as Response);

      await tool!.handler({
        action: "get",
        project_id: "test-project",
        tag_name: "v1.0.0",
        include_html_description: true,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("include_html_description=true")
      );
    });

    it("should handle assets action correctly", async () => {
      const tool = releasesToolRegistry.get("browse_releases");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ id: 1, name: "Binary", url: "https://example.com/binary" }],
      } as Response);

      const result = await tool!.handler({
        action: "assets",
        project_id: "test-project",
        tag_name: "v1.0.0",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/releases/v1.0.0/assets/links")
      );
      expect(result).toBeDefined();
    });

    it("should URL-encode project_id with slashes", async () => {
      const tool = releasesToolRegistry.get("browse_releases");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);

      await tool!.handler({
        action: "list",
        project_id: "group/subgroup/project",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/group%2Fsubgroup%2Fproject/releases")
      );
    });

    it("should URL-encode tag_name with special characters", async () => {
      const tool = releasesToolRegistry.get("browse_releases");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await tool!.handler({
        action: "get",
        project_id: "test-project",
        tag_name: "release/1.0.0",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("releases/release%2F1.0.0")
      );
    });

    it("should throw error for invalid input", async () => {
      const tool = releasesToolRegistry.get("browse_releases");
      expect(tool).toBeDefined();

      await expect(
        tool!.handler({
          action: "list",
          // Missing project_id
        })
      ).rejects.toThrow();
    });
  });

  describe("manage_release Handler", () => {
    it("should handle create action", async () => {
      const tool = releasesToolRegistry.get("manage_release");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: "v1.0.0", name: "Release 1.0.0" }),
      } as Response);

      const result = await tool!.handler({
        action: "create",
        project_id: "test-project",
        tag_name: "v1.0.0",
        name: "Release 1.0.0",
        description: "First release",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/releases"),
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result).toBeDefined();
    });

    it("should handle create action with all options", async () => {
      const tool = releasesToolRegistry.get("manage_release");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: "v1.0.0" }),
      } as Response);

      await tool!.handler({
        action: "create",
        project_id: "test-project",
        tag_name: "v1.0.0",
        name: "Release 1.0.0",
        description: "Description",
        ref: "main",
        tag_message: "Annotated tag",
        milestones: ["Sprint 1"],
        released_at: "2024-01-01T00:00:00Z",
        assets: {
          links: [{ name: "Binary", url: "https://example.com/binary" }],
        },
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/releases"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should handle update action", async () => {
      const tool = releasesToolRegistry.get("manage_release");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: "v1.0.0", name: "Updated Release" }),
      } as Response);

      const result = await tool!.handler({
        action: "update",
        project_id: "test-project",
        tag_name: "v1.0.0",
        name: "Updated Release",
        description: "Updated description",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/releases/v1.0.0"),
        expect.objectContaining({
          method: "PUT",
        })
      );
      expect(result).toBeDefined();
    });

    it("should handle delete action", async () => {
      const tool = releasesToolRegistry.get("manage_release");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => undefined,
      } as Response);

      const result = await tool!.handler({
        action: "delete",
        project_id: "test-project",
        tag_name: "v1.0.0",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/releases/v1.0.0"),
        expect.objectContaining({
          method: "DELETE",
        })
      );
      expect(result).toEqual({ deleted: true, tag_name: "v1.0.0" });
    });

    it("should handle create_link action", async () => {
      const tool = releasesToolRegistry.get("manage_release");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 1,
          name: "Binary",
          url: "https://example.com/binary",
        }),
      } as Response);

      const result = await tool!.handler({
        action: "create_link",
        project_id: "test-project",
        tag_name: "v1.0.0",
        name: "Binary",
        url: "https://example.com/binary",
        link_type: "package",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/releases/v1.0.0/assets/links"),
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result).toBeDefined();
    });

    it("should handle create_link action with direct_asset_path", async () => {
      const tool = releasesToolRegistry.get("manage_release");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1 }),
      } as Response);

      await tool!.handler({
        action: "create_link",
        project_id: "test-project",
        tag_name: "v1.0.0",
        name: "Linux Binary",
        url: "https://example.com/linux",
        direct_asset_path: "/binaries/linux-amd64",
      });

      const callBody = JSON.parse(
        (mockEnhancedFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(callBody.direct_asset_path).toBe("/binaries/linux-amd64");
    });

    it("should handle delete_link action", async () => {
      const tool = releasesToolRegistry.get("manage_release");
      expect(tool).toBeDefined();

      mockEnhancedFetch.mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => undefined,
      } as Response);

      const result = await tool!.handler({
        action: "delete_link",
        project_id: "test-project",
        tag_name: "v1.0.0",
        link_id: "123",
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("projects/test-project/releases/v1.0.0/assets/links/123"),
        expect.objectContaining({
          method: "DELETE",
        })
      );
      expect(result).toEqual({ deleted: true, tag_name: "v1.0.0", link_id: "123" });
    });

    it("should throw error for invalid action", async () => {
      const tool = releasesToolRegistry.get("manage_release");
      expect(tool).toBeDefined();

      await expect(
        tool!.handler({
          action: "invalid",
          project_id: "test-project",
          tag_name: "v1.0.0",
        })
      ).rejects.toThrow();
    });

    it("should throw error for missing required fields", async () => {
      const tool = releasesToolRegistry.get("manage_release");
      expect(tool).toBeDefined();

      // Missing tag_name for create
      await expect(
        tool!.handler({
          action: "create",
          project_id: "test-project",
        })
      ).rejects.toThrow();

      // Missing name for create_link
      await expect(
        tool!.handler({
          action: "create_link",
          project_id: "test-project",
          tag_name: "v1.0.0",
          url: "https://example.com",
        })
      ).rejects.toThrow();

      // Missing link_id for delete_link
      await expect(
        tool!.handler({
          action: "delete_link",
          project_id: "test-project",
          tag_name: "v1.0.0",
        })
      ).rejects.toThrow();
    });
  });

  describe("Action Denial", () => {
    it("should throw error when action is denied via GITLAB_DENIED_ACTIONS", async () => {
      // Set up denied actions
      process.env.GITLAB_DENIED_ACTIONS = "manage_release:delete";

      // Need to re-import to pick up env change, but since handlers check at runtime,
      // we need to mock the isActionDenied function
      const configModule = require("../../../../src/config");
      const originalIsActionDenied = configModule.isActionDenied;
      configModule.isActionDenied = jest.fn((toolName: string, actionName: string) => {
        return toolName === "manage_release" && actionName === "delete";
      });

      const tool = releasesToolRegistry.get("manage_release");
      expect(tool).toBeDefined();

      await expect(
        tool!.handler({
          action: "delete",
          project_id: "test-project",
          tag_name: "v1.0.0",
        })
      ).rejects.toThrow("not allowed");

      // Cleanup
      configModule.isActionDenied = originalIsActionDenied;
      delete process.env.GITLAB_DENIED_ACTIONS;
    });
  });
});
