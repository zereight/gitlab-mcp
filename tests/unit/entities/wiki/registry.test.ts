import {
  wikiToolRegistry,
  getWikiReadOnlyToolNames,
  getWikiToolDefinitions,
  getFilteredWikiTools,
} from "../../../../src/entities/wiki/registry";
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

describe("Wiki Registry - CQRS Tools", () => {
  describe("Registry Structure", () => {
    it("should be a Map instance", () => {
      expect(wikiToolRegistry instanceof Map).toBe(true);
    });

    it("should contain exactly 2 CQRS tools", () => {
      const toolNames = Array.from(wikiToolRegistry.keys());

      expect(toolNames).toContain("browse_wiki");
      expect(toolNames).toContain("manage_wiki");
      expect(wikiToolRegistry.size).toBe(2);
    });

    it("should have tools with valid structure", () => {
      for (const [toolName, tool] of wikiToolRegistry) {
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
      const toolNames = Array.from(wikiToolRegistry.keys());
      const uniqueNames = new Set(toolNames);

      expect(toolNames.length).toBe(uniqueNames.size);
    });
  });

  describe("Tool Definitions", () => {
    it("should have proper browse_wiki tool", () => {
      const tool = wikiToolRegistry.get("browse_wiki");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("browse_wiki");
      expect(tool?.description).toContain("BROWSE wiki");
      expect(tool?.description).toContain("list");
      expect(tool?.description).toContain("get");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper manage_wiki tool", () => {
      const tool = wikiToolRegistry.get("manage_wiki");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("manage_wiki");
      expect(tool?.description).toContain("MANAGE wiki");
      expect(tool?.description).toContain("create");
      expect(tool?.description).toContain("update");
      expect(tool?.description).toContain("delete");
      expect(tool?.inputSchema).toBeDefined();
    });
  });

  describe("Read-Only Tools Function", () => {
    it("should return an array of read-only tool names", () => {
      const readOnlyTools = getWikiReadOnlyToolNames();

      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it("should include only browse_wiki as read-only", () => {
      const readOnlyTools = getWikiReadOnlyToolNames();

      expect(readOnlyTools).toContain("browse_wiki");
      expect(readOnlyTools).toEqual(["browse_wiki"]);
    });

    it("should not include manage tools (write tools)", () => {
      const readOnlyTools = getWikiReadOnlyToolNames();

      expect(readOnlyTools).not.toContain("manage_wiki");
    });

    it("should return exactly 1 read-only tool", () => {
      const readOnlyTools = getWikiReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(1);
    });

    it("should return tools that exist in the registry", () => {
      const readOnlyTools = getWikiReadOnlyToolNames();
      const registryKeys = Array.from(wikiToolRegistry.keys());

      for (const toolName of readOnlyTools) {
        expect(registryKeys).toContain(toolName);
      }
    });
  });

  describe("Wiki Tool Definitions Function", () => {
    it("should return an array of tool definitions", () => {
      const definitions = getWikiToolDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBe(wikiToolRegistry.size);
    });

    it("should return all 2 CQRS tools from registry", () => {
      const definitions = getWikiToolDefinitions();

      expect(definitions.length).toBe(2);
    });

    it("should return tool definitions with proper structure", () => {
      const definitions = getWikiToolDefinitions();

      for (const definition of definitions) {
        expect(definition).toHaveProperty("name");
        expect(definition).toHaveProperty("description");
        expect(definition).toHaveProperty("inputSchema");
        expect(definition).toHaveProperty("handler");
      }
    });
  });

  describe("Filtered Wiki Tools Function", () => {
    it("should return all tools in normal mode", () => {
      const allTools = getFilteredWikiTools(false);
      const allDefinitions = getWikiToolDefinitions();

      expect(allTools.length).toBe(allDefinitions.length);
      expect(allTools.length).toBe(2);
    });

    it("should return only read-only tools in read-only mode", () => {
      const readOnlyTools = getFilteredWikiTools(true);
      const readOnlyNames = getWikiReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(readOnlyTools.length).toBe(1);
    });

    it("should filter tools correctly in read-only mode", () => {
      const readOnlyTools = getFilteredWikiTools(true);
      const readOnlyNames = getWikiReadOnlyToolNames();

      for (const tool of readOnlyTools) {
        expect(readOnlyNames).toContain(tool.name);
      }
    });

    it("should not include manage tools in read-only mode", () => {
      const readOnlyTools = getFilteredWikiTools(true);

      for (const tool of readOnlyTools) {
        expect(tool.name).not.toBe("manage_wiki");
      }
    });
  });

  describe("Tool Handlers", () => {
    it("should have handlers that are async functions", () => {
      for (const [, tool] of wikiToolRegistry) {
        expect(tool.handler.constructor.name).toBe("AsyncFunction");
      }
    });

    it("should have handlers that accept arguments", () => {
      for (const [, tool] of wikiToolRegistry) {
        expect(tool.handler.length).toBe(1);
      }
    });
  });

  describe("Registry Consistency", () => {
    it("should have all expected CQRS tools", () => {
      const expectedTools = ["browse_wiki", "manage_wiki"];

      for (const toolName of expectedTools) {
        expect(wikiToolRegistry.has(toolName)).toBe(true);
      }
    });

    it("should have consistent tool count between functions", () => {
      const allDefinitions = getWikiToolDefinitions();
      const readOnlyNames = getWikiReadOnlyToolNames();
      const readOnlyTools = getFilteredWikiTools(true);

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(allDefinitions.length).toBe(wikiToolRegistry.size);
      expect(allDefinitions.length).toBeGreaterThan(readOnlyNames.length);
    });

    it("should have more tools than just read-only ones", () => {
      const totalTools = wikiToolRegistry.size;
      const readOnlyCount = getWikiReadOnlyToolNames().length;

      expect(totalTools).toBeGreaterThan(readOnlyCount);
      expect(totalTools).toBe(2);
      expect(readOnlyCount).toBe(1);
    });
  });

  describe("Tool Input Schemas", () => {
    it("should have valid JSON schema structure for all tools", () => {
      for (const [, tool] of wikiToolRegistry) {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe("object");
        const schema = tool.inputSchema as Record<string, unknown>;
        const hasValidStructure = "type" in schema || "anyOf" in schema || "oneOf" in schema;
        expect(hasValidStructure).toBe(true);
      }
    });

    it("should have consistent schema format", () => {
      for (const [toolName, tool] of wikiToolRegistry) {
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

    describe("browse_wiki handler - list action", () => {
      it("should list wiki pages with basic parameters", async () => {
        // First mock for namespace resolution (project lookup)
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        // Second mock for wiki pages list
        const mockWikiPages = [
          { slug: "home", title: "Home", format: "markdown" },
          { slug: "docs", title: "Documentation", format: "markdown" },
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockWikiPages) as never);

        const tool = wikiToolRegistry.get("browse_wiki")!;
        const result = await tool.handler({
          action: "list",
          namespace: "test/project",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockWikiPages);
      });

      it("should list wiki pages with content", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockWikiPages = [
          { slug: "home", title: "Home", format: "markdown", content: "Welcome" },
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockWikiPages) as never);

        const tool = wikiToolRegistry.get("browse_wiki")!;
        await tool.handler({
          action: "list",
          namespace: "test/project",
          with_content: true,
          per_page: 50,
          page: 1,
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const url = call[0] as string;
        expect(url).toContain("with_content=true");
        expect(url).toContain("per_page=50");
        expect(url).toContain("page=1");
      });

      it("should list group wiki pages", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-group", kind: "group" }) as never
        );
        const mockWikiPages = [{ slug: "group-home", title: "Group Home" }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockWikiPages) as never);

        const tool = wikiToolRegistry.get("browse_wiki")!;
        const result = await tool.handler({
          action: "list",
          namespace: "test-group",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockWikiPages);
      });

      it("should handle API errors", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as never);

        const tool = wikiToolRegistry.get("browse_wiki")!;

        await expect(
          tool.handler({
            action: "list",
            namespace: "nonexistent/project",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });
    });

    describe("browse_wiki handler - get action", () => {
      it("should get wiki page by slug", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockWikiPage = {
          slug: "home",
          title: "Home",
          format: "markdown",
          content: "Welcome to the wiki",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockWikiPage) as never);

        const tool = wikiToolRegistry.get("browse_wiki")!;
        const result = await tool.handler({
          action: "get",
          namespace: "test/project",
          slug: "home",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockWikiPage);
      });

      it("should handle wiki page not found", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as never);

        const tool = wikiToolRegistry.get("browse_wiki")!;

        await expect(
          tool.handler({
            action: "get",
            namespace: "test/project",
            slug: "nonexistent-page",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });

      it("should encode slug properly in URL", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockWikiPage = { slug: "path/to/page", title: "Page" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockWikiPage) as never);

        const tool = wikiToolRegistry.get("browse_wiki")!;
        await tool.handler({
          action: "get",
          namespace: "test/project",
          slug: "path/to/page",
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const url = call[0] as string;
        expect(url).toContain("wikis/path%2Fto%2Fpage");
      });
    });

    describe("manage_wiki handler - create action", () => {
      it("should create wiki page", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockWikiPage = {
          slug: "new-page",
          title: "New Page",
          format: "markdown",
          content: "New content",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockWikiPage) as never);

        const tool = wikiToolRegistry.get("manage_wiki")!;
        const result = await tool.handler({
          action: "create",
          namespace: "test/project",
          title: "New Page",
          content: "New content",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockWikiPage);
      });

      it("should create wiki page with format", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockWikiPage = { slug: "asciidoc-page", title: "AsciiDoc Page" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockWikiPage) as never);

        const tool = wikiToolRegistry.get("manage_wiki")!;
        await tool.handler({
          action: "create",
          namespace: "test/project",
          title: "AsciiDoc Page",
          content: "= AsciiDoc Content",
          format: "asciidoc",
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.title).toBe("AsciiDoc Page");
        expect(body.content).toBe("= AsciiDoc Content");
        expect(body.format).toBe("asciidoc");
      });

      it("should create group wiki page", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-group", kind: "group" }) as never
        );
        const mockWikiPage = { slug: "group-page", title: "Group Page" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockWikiPage) as never);

        const tool = wikiToolRegistry.get("manage_wiki")!;
        const result = await tool.handler({
          action: "create",
          namespace: "test-group",
          title: "Group Page",
          content: "Group content",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockWikiPage);
      });
    });

    describe("manage_wiki handler - update action", () => {
      it("should update wiki page", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockWikiPage = {
          slug: "existing-page",
          title: "Updated Title",
          content: "Updated content",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockWikiPage) as never);

        const tool = wikiToolRegistry.get("manage_wiki")!;
        const result = await tool.handler({
          action: "update",
          namespace: "test/project",
          slug: "existing-page",
          title: "Updated Title",
          content: "Updated content",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockWikiPage);
      });

      it("should update wiki page content only", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockWikiPage = { slug: "page", title: "Page", content: "New content" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockWikiPage) as never);

        const tool = wikiToolRegistry.get("manage_wiki")!;
        await tool.handler({
          action: "update",
          namespace: "test/project",
          slug: "page",
          content: "New content",
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.content).toBe("New content");
      });

      it("should encode slug properly in update URL", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockWikiPage = { slug: "path/to/page", title: "Page" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockWikiPage) as never);

        const tool = wikiToolRegistry.get("manage_wiki")!;
        await tool.handler({
          action: "update",
          namespace: "test/project",
          slug: "path/to/page",
          content: "Updated",
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const url = call[0] as string;
        expect(url).toContain("wikis/path%2Fto%2Fpage");
      });
    });

    describe("manage_wiki handler - delete action", () => {
      it("should delete wiki page", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null) as never);

        const tool = wikiToolRegistry.get("manage_wiki")!;
        const result = await tool.handler({
          action: "delete",
          namespace: "test/project",
          slug: "page-to-delete",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ deleted: true });
      });

      it("should handle delete of non-existent page", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as never);

        const tool = wikiToolRegistry.get("manage_wiki")!;

        await expect(
          tool.handler({
            action: "delete",
            namespace: "test/project",
            slug: "nonexistent-page",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });

      it("should encode slug properly in delete URL", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null) as never);

        const tool = wikiToolRegistry.get("manage_wiki")!;
        await tool.handler({
          action: "delete",
          namespace: "test/project",
          slug: "path/to/page",
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const url = call[0] as string;
        expect(url).toContain("wikis/path%2Fto%2Fpage");
      });
    });

    describe("Error Handling", () => {
      it("should handle schema validation errors for browse_wiki", async () => {
        const tool = wikiToolRegistry.get("browse_wiki")!;

        // Missing required action
        await expect(tool.handler({})).rejects.toThrow();

        // Invalid action
        await expect(tool.handler({ action: "invalid", namespace: "test" })).rejects.toThrow();

        // Missing namespace for list
        await expect(tool.handler({ action: "list" })).rejects.toThrow();

        // Missing slug for get
        await expect(tool.handler({ action: "get", namespace: "test" })).rejects.toThrow();
      });

      it("should handle schema validation errors for manage_wiki", async () => {
        const tool = wikiToolRegistry.get("manage_wiki")!;

        // Missing required action
        await expect(tool.handler({})).rejects.toThrow();

        // Invalid action
        await expect(tool.handler({ action: "invalid", namespace: "test" })).rejects.toThrow();

        // Missing title for create
        await expect(
          tool.handler({ action: "create", namespace: "test", content: "content" })
        ).rejects.toThrow();

        // Missing content for create
        await expect(
          tool.handler({ action: "create", namespace: "test", title: "title" })
        ).rejects.toThrow();

        // Missing slug for update
        await expect(tool.handler({ action: "update", namespace: "test" })).rejects.toThrow();

        // Missing slug for delete
        await expect(tool.handler({ action: "delete", namespace: "test" })).rejects.toThrow();
      });

      it("should handle network errors", async () => {
        // First call for namespace resolution succeeds
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        // Second call (actual API) fails with network error
        mockEnhancedFetch.mockRejectedValueOnce(new Error("Connection timeout"));

        const tool = wikiToolRegistry.get("browse_wiki")!;

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

        const tool = wikiToolRegistry.get("browse_wiki")!;

        await expect(
          tool.handler({
            action: "list",
            namespace: "private/project",
          })
        ).rejects.toThrow("GitLab API error: 403 Error");
      });

      it("should handle API error responses in manage_wiki create", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 400) as never);

        const tool = wikiToolRegistry.get("manage_wiki")!;

        await expect(
          tool.handler({
            action: "create",
            namespace: "test",
            title: "New Page",
            content: "Content",
          })
        ).rejects.toThrow("GitLab API error: 400 Error");
      });

      it("should handle API error responses in manage_wiki update", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 500) as never);

        const tool = wikiToolRegistry.get("manage_wiki")!;

        await expect(
          tool.handler({
            action: "update",
            namespace: "test",
            slug: "page",
            content: "Updated",
          })
        ).rejects.toThrow("GitLab API error: 500 Error");
      });
    });
  });
});
