import {
  snippetsToolRegistry,
  getSnippetsReadOnlyToolNames,
  getSnippetsToolDefinitions,
  getFilteredSnippetsTools,
} from "../../../../src/entities/snippets/registry";
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
});

describe("Snippets Registry", () => {
  describe("Registry Structure", () => {
    it("should be a Map instance", () => {
      expect(snippetsToolRegistry instanceof Map).toBe(true);
    });

    it("should contain expected snippet tools", () => {
      const toolNames = Array.from(snippetsToolRegistry.keys());

      // Check for read-only tools
      expect(toolNames).toContain("list_snippets");

      // Check for write tools
      expect(toolNames).toContain("manage_snippet");

      // Should have exactly 2 tools
      expect(toolNames).toHaveLength(2);
    });

    it("should have valid tool definitions", () => {
      for (const [name, tool] of snippetsToolRegistry) {
        expect(tool).toHaveProperty("name", name);
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(tool).toHaveProperty("handler");
        expect(typeof tool.handler).toBe("function");
      }
    });
  });

  describe("getSnippetsReadOnlyToolNames", () => {
    it("should return read-only tool names", () => {
      const readOnlyNames = getSnippetsReadOnlyToolNames();
      expect(readOnlyNames).toEqual(["list_snippets"]);
    });
  });

  describe("getSnippetsToolDefinitions", () => {
    it("should return all tool definitions", () => {
      const definitions = getSnippetsToolDefinitions();
      expect(definitions).toHaveLength(2);
      expect(definitions.map(d => d.name)).toContain("list_snippets");
      expect(definitions.map(d => d.name)).toContain("manage_snippet");
    });
  });

  describe("getFilteredSnippetsTools", () => {
    it("should return all tools when not in read-only mode", () => {
      const tools = getFilteredSnippetsTools(false);
      expect(tools).toHaveLength(2);
    });

    it("should return only read-only tools in read-only mode", () => {
      const tools = getFilteredSnippetsTools(true);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("list_snippets");
    });
  });

  describe("list_snippets handler", () => {
    const listSnippetsTool = snippetsToolRegistry.get("list_snippets");

    it("should list personal snippets", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 1,
            title: "Test Snippet",
            visibility: "private",
          },
        ],
      };
      mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

      const result = await listSnippetsTool?.handler({
        scope: "personal",
        per_page: 20,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v4/snippets?per_page=20")
      );
      expect(result).toEqual([
        {
          id: 1,
          title: "Test Snippet",
          visibility: "private",
        },
      ]);
    });

    it("should list public snippets", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 2,
            title: "Public Snippet",
            visibility: "public",
          },
        ],
      };
      mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

      const result = await listSnippetsTool?.handler({
        scope: "public",
        per_page: 20,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v4/snippets/public?per_page=20")
      );
      expect(result).toEqual([
        {
          id: 2,
          title: "Public Snippet",
          visibility: "public",
        },
      ]);
    });

    it("should list project snippets", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 3,
            title: "Project Snippet",
            visibility: "internal",
          },
        ],
      };
      mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

      const result = await listSnippetsTool?.handler({
        scope: "project",
        projectId: "123",
        per_page: 20,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v4/projects/123/snippets?per_page=20")
      );
      expect(result).toEqual([
        {
          id: 3,
          title: "Project Snippet",
          visibility: "internal",
        },
      ]);
    });

    it("should fail when projectId is missing for project scope", async () => {
      await expect(
        listSnippetsTool?.handler({
          scope: "project",
          per_page: 20,
        })
      ).rejects.toThrow();
    });

    it("should support visibility filtering", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => [],
      };
      mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

      await listSnippetsTool?.handler({
        scope: "personal",
        visibility: "public",
        per_page: 20,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("visibility=public")
      );
    });

    it("should support date filtering", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => [],
      };
      mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

      await listSnippetsTool?.handler({
        scope: "personal",
        created_after: "2024-01-01T00:00:00Z",
        created_before: "2024-12-31T23:59:59Z",
        per_page: 20,
      });

      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("created_after=2024-01-01T00%3A00%3A00Z")
      );
      expect(mockEnhancedFetch).toHaveBeenCalledWith(
        expect.stringContaining("created_before=2024-12-31T23%3A59%3A59Z")
      );
    });
  });

  describe("manage_snippet handler", () => {
    const manageSnippetTool = snippetsToolRegistry.get("manage_snippet");

    describe("read action", () => {
      it("should read a personal snippet", async () => {
        const mockResponse = {
          ok: true,
          status: 200,
          json: async () => ({
            id: 1,
            title: "Test Snippet",
            description: "Test description",
            visibility: "private",
          }),
        };
        mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

        const result = await manageSnippetTool?.handler({
          action: "read",
          id: 1,
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v4/snippets/1")
        );
        expect(result).toEqual({
          id: 1,
          title: "Test Snippet",
          description: "Test description",
          visibility: "private",
        });
      });

      it("should read a project snippet", async () => {
        const mockResponse = {
          ok: true,
          status: 200,
          json: async () => ({
            id: 2,
            title: "Project Snippet",
          }),
        };
        mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

        await manageSnippetTool?.handler({
          action: "read",
          id: 2,
          projectId: "456",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v4/projects/456/snippets/2")
        );
      });

      it("should read raw snippet content", async () => {
        const mockResponse = {
          ok: true,
          status: 200,
          json: async () => "console.log('raw content');",
        };
        mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

        await manageSnippetTool?.handler({
          action: "read",
          id: 3,
          raw: true,
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v4/snippets/3/raw")
        );
      });
    });

    describe("create action", () => {
      it("should create a personal snippet", async () => {
        const mockResponse = {
          ok: true,
          status: 201,
          json: async () => ({
            id: 10,
            title: "New Snippet",
          }),
        };
        mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

        const result = await manageSnippetTool?.handler({
          action: "create",
          title: "New Snippet",
          visibility: "private",
          files: [
            {
              file_path: "example.js",
              content: "console.log('hello');",
            },
          ],
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v4/snippets"),
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
          })
        );
        expect(result).toEqual({
          id: 10,
          title: "New Snippet",
        });
      });

      it("should create a project snippet", async () => {
        const mockResponse = {
          ok: true,
          status: 201,
          json: async () => ({
            id: 11,
            title: "Project Snippet",
          }),
        };
        mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

        await manageSnippetTool?.handler({
          action: "create",
          projectId: "789",
          title: "Project Snippet",
          visibility: "public",
          files: [
            {
              file_path: "test.py",
              content: "print('test')",
            },
          ],
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v4/projects/789/snippets"),
          expect.objectContaining({
            method: "POST",
          })
        );
      });

      it("should create a multi-file snippet", async () => {
        const mockResponse = {
          ok: true,
          status: 201,
          json: async () => ({ id: 12 }),
        };
        mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

        await manageSnippetTool?.handler({
          action: "create",
          title: "Multi-file Snippet",
          visibility: "private",
          files: [
            { file_path: "file1.js", content: "// file 1" },
            { file_path: "file2.js", content: "// file 2" },
          ],
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"files"'),
          })
        );
      });
    });

    describe("update action", () => {
      it("should update snippet title", async () => {
        const mockResponse = {
          ok: true,
          status: 200,
          json: async () => ({
            id: 5,
            title: "Updated Title",
          }),
        };
        mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

        await manageSnippetTool?.handler({
          action: "update",
          id: 5,
          title: "Updated Title",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v4/snippets/5"),
          expect.objectContaining({
            method: "PUT",
          })
        );
      });

      it("should update snippet files with actions", async () => {
        const mockResponse = {
          ok: true,
          status: 200,
          json: async () => ({ id: 6 }),
        };
        mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

        await manageSnippetTool?.handler({
          action: "update",
          id: 6,
          files: [
            {
              file_path: "new_file.js",
              content: "// new",
              action: "create",
            },
            {
              file_path: "existing.js",
              content: "// updated",
              action: "update",
            },
            {
              file_path: "old_file.js",
              action: "delete",
            },
          ],
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            method: "PUT",
            body: expect.stringContaining('"action"'),
          })
        );
      });

      it("should fail when no update fields provided", async () => {
        await expect(
          manageSnippetTool?.handler({
            action: "update",
            id: 7,
          })
        ).rejects.toThrow();
      });
    });

    describe("delete action", () => {
      it("should delete a personal snippet", async () => {
        const mockResponse = {
          ok: true,
          status: 204,
          json: async () => undefined,
        };
        mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

        const result = await manageSnippetTool?.handler({
          action: "delete",
          id: 8,
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v4/snippets/8"),
          expect.objectContaining({
            method: "DELETE",
          })
        );
        expect(result).toEqual({ deleted: true, id: 8 });
      });

      it("should delete a project snippet", async () => {
        const mockResponse = {
          ok: true,
          status: 204,
          json: async () => undefined,
        };
        mockEnhancedFetch.mockResolvedValue(mockResponse as Response);

        await manageSnippetTool?.handler({
          action: "delete",
          id: 9,
          projectId: "999",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v4/projects/999/snippets/9"),
          expect.objectContaining({
            method: "DELETE",
          })
        );
      });
    });
  });
});
