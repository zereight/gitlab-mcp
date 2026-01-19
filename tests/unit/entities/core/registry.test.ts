import {
  coreToolRegistry,
  getCoreReadOnlyToolNames,
  getCoreToolDefinitions,
  getFilteredCoreTools,
} from "../../../../src/entities/core/registry";
import { enhancedFetch } from "../../../../src/utils/fetch";

// Mock the fetch function to avoid actual API calls
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

describe("Core Registry", () => {
  describe("Registry Structure", () => {
    it("should be a Map instance", () => {
      expect(coreToolRegistry instanceof Map).toBe(true);
    });

    it("should contain expected consolidated tools", () => {
      const toolNames = Array.from(coreToolRegistry.keys());

      // Consolidated read-only tools
      expect(toolNames).toContain("browse_projects");
      expect(toolNames).toContain("browse_namespaces");
      expect(toolNames).toContain("browse_commits");
      expect(toolNames).toContain("browse_events");

      // Consolidated write tools
      expect(toolNames).toContain("manage_repository");

      // Kept as-is tools
      expect(toolNames).toContain("get_users");
      expect(toolNames).toContain("list_project_members");
      expect(toolNames).toContain("list_group_iterations");
      expect(toolNames).toContain("download_attachment");
      expect(toolNames).toContain("create_branch");
      expect(toolNames).toContain("create_group");

      // New todos tools
      expect(toolNames).toContain("list_todos");
      expect(toolNames).toContain("manage_todos");
    });

    it("should have tools with valid structure", () => {
      for (const [toolName, tool] of coreToolRegistry) {
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
      const toolNames = Array.from(coreToolRegistry.keys());
      const uniqueNames = new Set(toolNames);

      expect(toolNames.length).toBe(uniqueNames.size);
    });

    it("should have substantial number of tools", () => {
      expect(coreToolRegistry.size).toBeGreaterThanOrEqual(12);
    });
  });

  describe("Tool Definitions", () => {
    it("should have proper browse_projects tool", () => {
      const tool = coreToolRegistry.get("browse_projects");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("browse_projects");
      expect(tool?.description).toContain("PROJECT DISCOVERY");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper browse_namespaces tool", () => {
      const tool = coreToolRegistry.get("browse_namespaces");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("browse_namespaces");
      expect(tool?.description).toContain("NAMESPACE OPERATIONS");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper browse_commits tool", () => {
      const tool = coreToolRegistry.get("browse_commits");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("browse_commits");
      expect(tool?.description).toContain("COMMIT HISTORY");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper browse_events tool", () => {
      const tool = coreToolRegistry.get("browse_events");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("browse_events");
      expect(tool?.description).toContain("ACTIVITY FEED");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper manage_repository tool", () => {
      const tool = coreToolRegistry.get("manage_repository");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("manage_repository");
      expect(tool?.description).toContain("REPOSITORY MANAGEMENT");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper get_users tool", () => {
      const tool = coreToolRegistry.get("get_users");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("get_users");
      expect(tool?.description).toContain("FIND USERS");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper list_todos tool", () => {
      const tool = coreToolRegistry.get("list_todos");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("list_todos");
      expect(tool?.description).toContain("TASK QUEUE");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper manage_todos tool", () => {
      const tool = coreToolRegistry.get("manage_todos");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("manage_todos");
      expect(tool?.description).toContain("TODO ACTIONS");
      expect(tool?.inputSchema).toBeDefined();
    });
  });

  describe("Read-Only Tools Function", () => {
    it("should return an array of read-only tool names", () => {
      const readOnlyTools = getCoreReadOnlyToolNames();

      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it("should include expected read-only tools", () => {
      const readOnlyTools = getCoreReadOnlyToolNames();

      // Consolidated read tools
      expect(readOnlyTools).toContain("browse_projects");
      expect(readOnlyTools).toContain("browse_namespaces");
      expect(readOnlyTools).toContain("browse_commits");
      expect(readOnlyTools).toContain("browse_events");

      // Kept as-is read tools
      expect(readOnlyTools).toContain("get_users");
      expect(readOnlyTools).toContain("list_project_members");
      expect(readOnlyTools).toContain("list_group_iterations");
      expect(readOnlyTools).toContain("download_attachment");
      expect(readOnlyTools).toContain("list_todos");
    });

    it("should not include write tools", () => {
      const readOnlyTools = getCoreReadOnlyToolNames();

      expect(readOnlyTools).not.toContain("manage_repository");
      expect(readOnlyTools).not.toContain("create_branch");
      expect(readOnlyTools).not.toContain("create_group");
      expect(readOnlyTools).not.toContain("manage_todos");
    });

    it("should return tools that exist in the registry", () => {
      const readOnlyTools = getCoreReadOnlyToolNames();
      const registryKeys = Array.from(coreToolRegistry.keys());

      for (const toolName of readOnlyTools) {
        expect(registryKeys).toContain(toolName);
      }
    });
  });

  describe("Core Tool Definitions Function", () => {
    it("should return an array of tool definitions", () => {
      const definitions = getCoreToolDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBe(coreToolRegistry.size);
    });

    it("should return all tools from registry", () => {
      const definitions = getCoreToolDefinitions();
      const registrySize = coreToolRegistry.size;

      expect(definitions.length).toBe(registrySize);
    });

    it("should return tool definitions with proper structure", () => {
      const definitions = getCoreToolDefinitions();

      for (const definition of definitions) {
        expect(definition).toHaveProperty("name");
        expect(definition).toHaveProperty("description");
        expect(definition).toHaveProperty("inputSchema");
        expect(definition).toHaveProperty("handler");
      }
    });
  });

  describe("Filtered Core Tools Function", () => {
    it("should return all tools in normal mode", () => {
      const allTools = getFilteredCoreTools(false);
      const allDefinitions = getCoreToolDefinitions();

      expect(allTools.length).toBe(allDefinitions.length);
    });

    it("should return only read-only tools in read-only mode", () => {
      const readOnlyTools = getFilteredCoreTools(true);
      const readOnlyNames = getCoreReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
    });

    it("should filter tools correctly in read-only mode", () => {
      const readOnlyTools = getFilteredCoreTools(true);
      const readOnlyNames = getCoreReadOnlyToolNames();

      for (const tool of readOnlyTools) {
        expect(readOnlyNames).toContain(tool.name);
      }
    });

    it("should not include write tools in read-only mode", () => {
      const readOnlyTools = getFilteredCoreTools(true);
      const writeTools = ["manage_repository", "create_branch", "create_group", "manage_todos"];

      for (const tool of readOnlyTools) {
        expect(writeTools).not.toContain(tool.name);
      }
    });
  });

  describe("Tool Handlers", () => {
    it("should have handlers that are async functions", () => {
      for (const [, tool] of coreToolRegistry) {
        expect(tool.handler.constructor.name).toBe("AsyncFunction");
      }
    });

    it("should have handlers that accept arguments", () => {
      for (const [, tool] of coreToolRegistry) {
        expect(tool.handler.length).toBe(1); // Should accept one argument
      }
    });
  });

  describe("Registry Consistency", () => {
    it("should have all expected essential tools", () => {
      const essentialTools = [
        // Consolidated tools
        "browse_projects",
        "browse_namespaces",
        "browse_commits",
        "browse_events",
        "manage_repository",
        // Kept as-is tools
        "get_users",
        "list_project_members",
        "list_group_iterations",
        "download_attachment",
        "create_branch",
        "create_group",
        // Todos tools
        "list_todos",
        "manage_todos",
      ];

      for (const toolName of essentialTools) {
        expect(coreToolRegistry.has(toolName)).toBe(true);
      }
    });

    it("should have consistent tool count between functions", () => {
      const allDefinitions = getCoreToolDefinitions();
      const readOnlyNames = getCoreReadOnlyToolNames();
      const readOnlyTools = getFilteredCoreTools(true);

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(allDefinitions.length).toBe(coreToolRegistry.size);
      expect(allDefinitions.length).toBeGreaterThan(readOnlyNames.length);
    });

    it("should have more tools than just read-only ones", () => {
      const totalTools = coreToolRegistry.size;
      const readOnlyCount = getCoreReadOnlyToolNames().length;

      expect(totalTools).toBeGreaterThan(readOnlyCount);
    });
  });

  describe("Tool Input Schemas", () => {
    it("should have valid JSON schema structure for all tools", () => {
      for (const [, tool] of coreToolRegistry) {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe("object");
        // Schema can have either "type" (regular object) or "oneOf" (discriminated union)
        const schema = tool.inputSchema as Record<string, unknown>;
        const hasValidStructure = "type" in schema || "oneOf" in schema;
        expect(hasValidStructure).toBe(true);
      }
    });

    it("should have consistent schema format", () => {
      for (const [toolName, tool] of coreToolRegistry) {
        expect(tool.inputSchema).toBeDefined();

        // Schema should be an object with type or oneOf property (discriminated unions use oneOf)
        if (typeof tool.inputSchema === "object" && tool.inputSchema !== null) {
          const schema = tool.inputSchema as Record<string, unknown>;
          const hasValidStructure = "type" in schema || "oneOf" in schema;
          expect(hasValidStructure).toBe(true);
        } else {
          throw new Error(`Tool ${toolName} has invalid inputSchema type`);
        }
      }
    });
  });

  describe("Handler Tests", () => {
    describe("browse_projects Handler", () => {
      it("should search projects with action: search", async () => {
        const mockApiResponse = [
          {
            id: 1,
            name: "test-project",
            path_with_namespace: "group/test-project",
            description: "A test project",
          },
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("browse_projects");
        expect(tool).toBeDefined();

        const result = await tool!.handler({ action: "search", q: "test" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/projects?");
        expect(calledUrl).toContain("search=test");
        expect(calledUrl).toContain("active=true");

        expect(result).toEqual(mockApiResponse);
      });

      it("should list projects with action: list", async () => {
        const mockApiResponse = [
          { id: 1, name: "project1" },
          { id: 2, name: "project2" },
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("browse_projects");
        const result = await tool!.handler({ action: "list" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/projects?");
        expect(calledUrl).toContain("active=true");

        expect(result).toEqual(mockApiResponse);
      });

      it("should get project with action: get", async () => {
        const mockApiResponse = {
          id: 123,
          name: "my-project",
          path_with_namespace: "group/my-project",
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("browse_projects");
        const result = await tool!.handler({ action: "get", project_id: "123" });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/123?"
        );

        expect(result).toEqual(mockApiResponse);
      });

      it("should handle empty results", async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("browse_projects");
        const result = await tool!.handler({ action: "search", q: "nonexistent" });

        expect(result).toEqual([]);
      });

      it("should handle API errors gracefully", async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        } as any);

        const tool = coreToolRegistry.get("browse_projects");

        await expect(tool!.handler({ action: "search", q: "test" })).rejects.toThrow(
          "GitLab API error: 401 Unauthorized"
        );
      });

      it("should pass through search parameters correctly", async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("browse_projects");
        await tool!.handler({
          action: "search",
          with_programming_language: "javascript",
          order_by: "updated_at",
          sort: "desc",
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("with_programming_language=javascript");
        expect(calledUrl).toContain("order_by=updated_at");
        expect(calledUrl).toContain("sort=desc");
      });

      it("should parse topic: operator and properly URL-encode spaces in search query", async () => {
        // Test: topic: operator parsing AND space handling in search queries
        // Edge case: "topic:devops test project" contains:
        //   1. topic: operator that should be extracted to separate param
        //   2. Space in remaining search text that must be properly encoded
        // Why this matters: Incorrect encoding breaks GitLab API search functionality
        // URLSearchParams encodes spaces as + (x-www-form-urlencoded standard)
        // GitLab API accepts both + and %20 for spaces
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("browse_projects");
        await tool!.handler({ action: "search", q: "topic:devops test project" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        // topic: operator should be extracted to separate query param
        expect(calledUrl).toContain("topic=devops");
        // Space in "test project" should be encoded as + (URLSearchParams standard)
        // NOT as %2B (which would be double-encoding if we manually added + before URLSearchParams)
        expect(calledUrl).toContain("search=test+project");
      });

      it("should properly encode special characters like + in search query", async () => {
        // Test: Literal + character in search query
        // Edge case: "C++ programming" contains a literal + that must be encoded as %2B
        // Why this matters: + has special meaning in URLs (space), so literal + must be escaped
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("browse_projects");
        await tool!.handler({ action: "search", q: "C++ programming" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        // Literal + should be encoded as %2B, space as +
        // "C++ programming" -> "C%2B%2B+programming"
        expect(calledUrl).toContain("search=C%2B%2B+programming");
      });
    });

    describe("manage_repository Handler", () => {
      it("should create repository with action: create", async () => {
        // Mock namespace check (doesn't exist)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any);

        // Mock project creation
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({
            id: 1000,
            name: "new-repo",
            web_url: "https://gitlab.example.com/current-user/new-repo",
          }),
        } as any);

        const tool = coreToolRegistry.get("manage_repository");
        const result = await tool!.handler({
          action: "create",
          name: "new-repo",
          description: "A new repository",
          visibility: "private",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({
          id: 1000,
          name: "new-repo",
        });
      });

      it("should fork repository with action: fork", async () => {
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({
            id: 2000,
            name: "forked-repo",
            forked_from_project: { id: 1000, name: "original-repo" },
          }),
        } as any);

        const tool = coreToolRegistry.get("manage_repository");
        const result = await tool!.handler({
          action: "fork",
          project_id: "1000",
          namespace: "my-group",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/1000/fork",
          expect.objectContaining({
            method: "POST",
          })
        );

        expect(result).toMatchObject({
          id: 2000,
          name: "forked-repo",
        });
      });
    });

    describe("list_todos Handler", () => {
      it("should list todos with no filters (default behavior)", async () => {
        // Test: Default list todos call with no filters
        // Why this matters: Verifies basic API endpoint is correct when no filters applied
        // Edge case: Schema has default per_page=20, so that's always included
        const mockApiResponse = [
          { id: 1, action_name: "assigned", target_type: "Issue", state: "pending" },
          { id: 2, action_name: "mentioned", target_type: "MergeRequest", state: "pending" },
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("list_todos");
        const result = await tool!.handler({});

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        // per_page has a default value in schema, so it's always included
        expect(calledUrl).toContain("/api/v4/todos?");
        expect(calledUrl).toContain("per_page=20");
        expect(result).toEqual(mockApiResponse);
      });

      it("should filter todos by state parameter", async () => {
        // Test: Filter by state=pending vs state=done
        // Edge case: Ensures state filter is properly passed to API
        // Why this matters: Users need to see only active or only completed todos
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([{ id: 1, state: "pending" }]),
        } as any);

        const tool = coreToolRegistry.get("list_todos");
        await tool!.handler({ state: "pending" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("state=pending");
      });

      it("should filter todos by action type", async () => {
        // Test: Filter by specific action types (assigned, mentioned, review_requested, etc.)
        // Why this matters: Users may want to see only review requests or only mentions
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("list_todos");
        await tool!.handler({ action: "review_requested" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("action=review_requested");
      });

      it("should filter todos by target type (Issue, MergeRequest, etc.)", async () => {
        // Test: Filter by target_type to see only Issue todos or only MR todos
        // Edge case: type parameter contains special characters like DesignManagement::Design
        // Why this matters: Users filtering by specific resource types
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("list_todos");
        await tool!.handler({ type: "MergeRequest" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("type=MergeRequest");
      });

      it("should combine multiple filter parameters correctly", async () => {
        // Test: Multiple filters combined (state + action + type)
        // Why this matters: Real-world usage often involves multiple filters
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("list_todos");
        await tool!.handler({
          state: "pending",
          action: "assigned",
          type: "Issue",
          per_page: 50,
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("state=pending");
        expect(calledUrl).toContain("action=assigned");
        expect(calledUrl).toContain("type=Issue");
        expect(calledUrl).toContain("per_page=50");
      });

      it("should handle pagination parameters", async () => {
        // Test: Pagination with page and per_page parameters
        // Why this matters: Large todo lists need proper pagination
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("list_todos");
        await tool!.handler({ page: 2, per_page: 20 });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("page=2");
        expect(calledUrl).toContain("per_page=20");
      });

      it("should throw error on API failure", async () => {
        // Test: Proper error handling when GitLab API returns error
        // Why this matters: Users need clear error messages on API failures
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        } as any);

        const tool = coreToolRegistry.get("list_todos");
        await expect(tool!.handler({})).rejects.toThrow("GitLab API error: 401 Unauthorized");
      });
    });

    describe("manage_todos Handler", () => {
      it("should mark single todo as done with action: mark_done", async () => {
        // Test: mark_done action with specific todo ID
        // Why this matters: Users need to complete individual todos
        // Edge case: Verifies POST to /todos/{id}/mark_as_done endpoint
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 1, state: "done" }),
        } as any);

        const tool = coreToolRegistry.get("manage_todos");
        const result = await tool!.handler({ action: "mark_done", id: 1 });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/todos/1/mark_as_done",
          { method: "POST" }
        );

        expect(result).toMatchObject({ id: 1, state: "done" });
      });

      it("should mark ALL todos as done with action: mark_all_done", async () => {
        // Test: Bulk operation to complete all pending todos at once
        // Why this matters: Users often need to clear their entire todo queue
        // Edge case: This endpoint returns 204 No Content, not a JSON body
        // Handler returns a success object since there's no todo to return
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
        } as any);

        const tool = coreToolRegistry.get("manage_todos");
        const result = await tool!.handler({ action: "mark_all_done" });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/todos/mark_all_as_done",
          { method: "POST" }
        );

        expect(result).toMatchObject({ success: true, message: "All todos marked as done" });
      });

      it("should restore completed todo back to pending with action: restore", async () => {
        // Test: Undo a completed todo, returning it to pending state
        // Why this matters: Users may accidentally mark todos done
        // Edge case: Uses /mark_as_pending endpoint (not /restore)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 1, state: "pending" }),
        } as any);

        const tool = coreToolRegistry.get("manage_todos");
        const result = await tool!.handler({ action: "restore", id: 1 });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/todos/1/mark_as_pending",
          { method: "POST" }
        );

        expect(result).toMatchObject({ id: 1, state: "pending" });
      });

      it("should require id for mark_done action", async () => {
        // Test: Validation that id is required for single-todo operations
        // Why this matters: Prevents calling mark_done without specifying which todo
        // Edge case: Should throw at schema validation (Zod discriminated union enforces id)
        const tool = coreToolRegistry.get("manage_todos");

        // Discriminated union schema now enforces id at parse time
        await expect(tool!.handler({ action: "mark_done" })).rejects.toThrow();

        // Verify no API call was made
        expect(mockEnhancedFetch).not.toHaveBeenCalled();
      });

      it("should require id for restore action", async () => {
        // Test: Validation that id is required for restore operation
        // Why this matters: Can't restore without knowing which todo to restore
        // Edge case: Same validation as mark_done - Zod enforces id at parse time
        const tool = coreToolRegistry.get("manage_todos");

        // Discriminated union schema now enforces id at parse time
        await expect(tool!.handler({ action: "restore" })).rejects.toThrow();

        // Verify no API call was made
        expect(mockEnhancedFetch).not.toHaveBeenCalled();
      });

      it("should NOT require id for mark_all_done action", async () => {
        // Test: mark_all_done is a bulk operation that doesn't need specific ID
        // Why this matters: Verifies the id validation logic is correct
        // Edge case: id parameter should be ignored for mark_all_done
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
        } as any);

        const tool = coreToolRegistry.get("manage_todos");
        // Should not throw even without id
        const result = await tool!.handler({ action: "mark_all_done" });

        expect(result).toMatchObject({ success: true });
      });

      it("should throw error on API failure", async () => {
        // Test: Proper error handling when GitLab API returns error
        // Why this matters: Users need clear error messages on failures
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as any);

        const tool = coreToolRegistry.get("manage_todos");

        await expect(tool!.handler({ action: "mark_done", id: 999999 })).rejects.toThrow(
          "GitLab API error: 404 Not Found"
        );
      });
    });
  });
});
