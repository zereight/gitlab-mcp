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

    describe("browse_namespaces Handler", () => {
      it("should list namespaces with action: list", async () => {
        // Test: List namespaces with no filters (default behavior)
        // Why this matters: Basic namespace discovery for project creation
        const mockApiResponse = [
          { id: 1, name: "my-group", path: "my-group", kind: "group" },
          { id: 2, name: "my-user", path: "my-user", kind: "user" },
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("browse_namespaces");
        const result = await tool!.handler({ action: "list" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/namespaces?");
        expect(result).toEqual(mockApiResponse);
      });

      it("should list namespaces with search filter", async () => {
        // Test: Filter namespaces by search query
        // Why this matters: Finding specific namespace for project creation
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([{ id: 1, name: "test-group", path: "test-group" }]),
        } as any);

        const tool = coreToolRegistry.get("browse_namespaces");
        await tool!.handler({ action: "list", search: "test" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("search=test");
      });

      it("should list namespaces with all optional parameters", async () => {
        // Test: All optional params (owned_only, top_level_only, with_statistics, min_access_level)
        // Why this matters: Advanced filtering for namespace discovery
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("browse_namespaces");
        await tool!.handler({
          action: "list",
          owned_only: true,
          top_level_only: true,
          with_statistics: true,
          min_access_level: 40,
          per_page: 50,
          page: 2,
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("owned_only=true");
        expect(calledUrl).toContain("top_level_only=true");
        expect(calledUrl).toContain("with_statistics=true");
        expect(calledUrl).toContain("min_access_level=40");
        expect(calledUrl).toContain("per_page=50");
        expect(calledUrl).toContain("page=2");
      });

      it("should get specific namespace with action: get", async () => {
        // Test: Get namespace by ID or path
        // Why this matters: Retrieve full namespace details for project operations
        const mockApiResponse = {
          id: 123,
          name: "my-group",
          path: "my-group",
          full_path: "my-group",
          kind: "group",
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("browse_namespaces");
        const result = await tool!.handler({ action: "get", namespace_id: "my-group" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/namespaces/my-group");
        expect(result).toEqual(mockApiResponse);
      });

      it("should verify namespace exists with action: verify (found)", async () => {
        // Test: Verify namespace exists and is accessible (success case)
        // Why this matters: Check namespace availability before creating projects
        const mockApiResponse = { id: 123, name: "existing-group", path: "existing-group" };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("browse_namespaces");
        const result = await tool!.handler({ action: "verify", namespace_id: "existing-group" });

        expect(result).toMatchObject({
          exists: true,
          status: 200,
          namespace: "existing-group",
          data: mockApiResponse,
        });
      });

      it("should verify namespace exists with action: verify (not found)", async () => {
        // Test: Verify namespace that does not exist (404 case)
        // Why this matters: Returns structured response even for non-existent namespaces
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as any);

        const tool = coreToolRegistry.get("browse_namespaces");
        const result = await tool!.handler({ action: "verify", namespace_id: "nonexistent" });

        expect(result).toMatchObject({
          exists: false,
          status: 404,
          namespace: "nonexistent",
          data: null,
        });
      });

      it("should handle API error for list action", async () => {
        // Test: Error handling for list namespaces
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        } as any);

        const tool = coreToolRegistry.get("browse_namespaces");
        await expect(tool!.handler({ action: "list" })).rejects.toThrow(
          "GitLab API error: 401 Unauthorized"
        );
      });

      it("should handle API error for get action", async () => {
        // Test: Error handling for get specific namespace
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Forbidden",
        } as any);

        const tool = coreToolRegistry.get("browse_namespaces");
        await expect(tool!.handler({ action: "get", namespace_id: "secret" })).rejects.toThrow(
          "GitLab API error: 403 Forbidden"
        );
      });
    });

    describe("browse_commits Handler", () => {
      it("should list commits with action: list (basic)", async () => {
        // Test: List commits for a project with no filters
        // Why this matters: Basic commit history browsing
        const mockApiResponse = [
          { id: "abc123", short_id: "abc", title: "Initial commit", author_name: "Test User" },
          { id: "def456", short_id: "def", title: "Add feature", author_name: "Test User" },
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("browse_commits");
        const result = await tool!.handler({ action: "list", project_id: "123" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/projects/123/repository/commits?");
        expect(result).toEqual(mockApiResponse);
      });

      it("should list commits with all filter parameters", async () => {
        // Test: List commits with all optional filters
        // Why this matters: Advanced filtering for commit history analysis
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("browse_commits");
        await tool!.handler({
          action: "list",
          project_id: "test/project",
          ref_name: "main",
          since: "2024-01-01T00:00:00Z",
          until: "2024-12-31T23:59:59Z",
          path: "src/index.ts",
          author: "developer@example.com",
          all: true,
          with_stats: true,
          first_parent: true,
          order: "topo",
          trailers: true,
          per_page: 100,
          page: 1,
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("ref_name=main");
        expect(calledUrl).toContain("since=2024-01-01T00%3A00%3A00Z");
        expect(calledUrl).toContain("until=2024-12-31T23%3A59%3A59Z");
        expect(calledUrl).toContain("path=src%2Findex.ts");
        expect(calledUrl).toContain("author=developer%40example.com");
        expect(calledUrl).toContain("all=true");
        expect(calledUrl).toContain("with_stats=true");
        expect(calledUrl).toContain("first_parent=true");
        expect(calledUrl).toContain("order=topo");
        expect(calledUrl).toContain("trailers=true");
        expect(calledUrl).toContain("per_page=100");
        expect(calledUrl).toContain("page=1");
      });

      it("should get specific commit with action: get", async () => {
        // Test: Get single commit details by SHA
        // Why this matters: Retrieve commit metadata and stats
        const mockApiResponse = {
          id: "abc123def456",
          short_id: "abc123d",
          title: "Add feature X",
          message: "Add feature X\n\nDetailed description here.",
          author_name: "Test User",
          author_email: "test@example.com",
          authored_date: "2024-06-15T10:30:00Z",
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("browse_commits");
        const result = await tool!.handler({
          action: "get",
          project_id: "123",
          sha: "abc123def456",
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/projects/123/repository/commits/abc123def456?");
        expect(result).toEqual(mockApiResponse);
      });

      it("should get commit with stats option", async () => {
        // Test: Get commit with file change statistics
        // Why this matters: Adds additions/deletions counts per file
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest
            .fn()
            .mockResolvedValue({ id: "abc123", stats: { additions: 10, deletions: 5 } }),
        } as any);

        const tool = coreToolRegistry.get("browse_commits");
        await tool!.handler({
          action: "get",
          project_id: "123",
          sha: "abc123",
          stats: true,
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("stats=true");
      });

      it("should get commit diff with action: diff", async () => {
        // Test: Get actual code changes from a commit
        // Why this matters: Review what code was changed in a commit
        const mockApiResponse = [
          {
            old_path: "src/index.ts",
            new_path: "src/index.ts",
            diff: "@@ -1,3 +1,5 @@\n+import { feature } from './feature';\n+\n export default function main() {",
          },
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("browse_commits");
        const result = await tool!.handler({
          action: "diff",
          project_id: "123",
          sha: "abc123",
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/projects/123/repository/commits/abc123/diff?");
        expect(result).toEqual(mockApiResponse);
      });

      it("should get commit diff with unidiff option", async () => {
        // Test: Get commit diff in unified format
        // Why this matters: Useful for patch generation
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("browse_commits");
        await tool!.handler({
          action: "diff",
          project_id: "123",
          sha: "abc123",
          unidiff: true,
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("unidiff=true");
      });

      it("should handle API error for list action", async () => {
        // Test: Error handling for commit list
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as any);

        const tool = coreToolRegistry.get("browse_commits");
        await expect(tool!.handler({ action: "list", project_id: "nonexistent" })).rejects.toThrow(
          "GitLab API error: 404 Not Found"
        );
      });

      it("should handle API error for get action", async () => {
        // Test: Error handling for getting specific commit
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as any);

        const tool = coreToolRegistry.get("browse_commits");
        await expect(
          tool!.handler({ action: "get", project_id: "123", sha: "invalid" })
        ).rejects.toThrow("GitLab API error: 404 Not Found");
      });

      it("should handle API error for diff action", async () => {
        // Test: Error handling for commit diff
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as any);

        const tool = coreToolRegistry.get("browse_commits");
        await expect(
          tool!.handler({ action: "diff", project_id: "123", sha: "abc123" })
        ).rejects.toThrow("GitLab API error: 500 Internal Server Error");
      });
    });

    describe("browse_events Handler", () => {
      it("should list user events with action: user (basic)", async () => {
        // Test: List current user's activity feed
        // Why this matters: Track user's own activity across all projects
        const mockApiResponse = [
          {
            id: 1,
            action_name: "pushed",
            target_type: "Project",
            created_at: "2024-06-15T10:00:00Z",
          },
          {
            id: 2,
            action_name: "commented",
            target_type: "Issue",
            created_at: "2024-06-15T09:00:00Z",
          },
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("browse_events");
        const result = await tool!.handler({ action: "user" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/events?");
        expect(result).toEqual(mockApiResponse);
      });

      it("should list user events with all filter parameters", async () => {
        // Test: List user events with all optional filters
        // Why this matters: Filter activity by type, action, date range
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("browse_events");
        await tool!.handler({
          action: "user",
          target_type: "merge_request",
          event_action: "merged",
          before: "2024-12-31",
          after: "2024-01-01",
          sort: "desc",
          per_page: 50,
          page: 2,
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("target_type=merge_request");
        expect(calledUrl).toContain("action=merged");
        expect(calledUrl).toContain("before=2024-12-31");
        expect(calledUrl).toContain("after=2024-01-01");
        expect(calledUrl).toContain("sort=desc");
        expect(calledUrl).toContain("per_page=50");
        expect(calledUrl).toContain("page=2");
      });

      it("should list project events with action: project (basic)", async () => {
        // Test: List activity feed for a specific project
        // Why this matters: Monitor project-specific activity
        const mockApiResponse = [
          { id: 1, action_name: "pushed", project_id: 123, created_at: "2024-06-15T10:00:00Z" },
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("browse_events");
        const result = await tool!.handler({ action: "project", project_id: "123" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/projects/123/events?");
        expect(result).toEqual(mockApiResponse);
      });

      it("should list project events with all filter parameters", async () => {
        // Test: List project events with all optional filters
        // Why this matters: Filter project activity by type, action, date range
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("browse_events");
        await tool!.handler({
          action: "project",
          project_id: "test/project",
          target_type: "issue",
          event_action: "created",
          before: "2024-06-30",
          after: "2024-06-01",
          sort: "asc",
          per_page: 25,
          page: 1,
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/projects/test%2Fproject/events?");
        expect(calledUrl).toContain("target_type=issue");
        expect(calledUrl).toContain("action=created");
        expect(calledUrl).toContain("before=2024-06-30");
        expect(calledUrl).toContain("after=2024-06-01");
        expect(calledUrl).toContain("sort=asc");
        expect(calledUrl).toContain("per_page=25");
        expect(calledUrl).toContain("page=1");
      });

      it("should handle API error for user events", async () => {
        // Test: Error handling for user events
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        } as any);

        const tool = coreToolRegistry.get("browse_events");
        await expect(tool!.handler({ action: "user" })).rejects.toThrow(
          "GitLab API error: 401 Unauthorized"
        );
      });

      it("should handle API error for project events", async () => {
        // Test: Error handling for project events
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as any);

        const tool = coreToolRegistry.get("browse_events");
        await expect(
          tool!.handler({ action: "project", project_id: "nonexistent" })
        ).rejects.toThrow("GitLab API error: 404 Not Found");
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

      it("should throw error for mark_all_done API failure", async () => {
        // Test: Error handling for mark_all_done operation
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as any);

        const tool = coreToolRegistry.get("manage_todos");
        await expect(tool!.handler({ action: "mark_all_done" })).rejects.toThrow(
          "GitLab API error: 500 Internal Server Error"
        );
      });

      it("should throw error for restore API failure", async () => {
        // Test: Error handling for restore operation
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as any);

        const tool = coreToolRegistry.get("manage_todos");
        await expect(tool!.handler({ action: "restore", id: 123 })).rejects.toThrow(
          "GitLab API error: 404 Not Found"
        );
      });
    });

    describe("get_users Handler", () => {
      it("should get users with basic parameters (non-smart search)", async () => {
        // Test: Get users without smart search (direct API call)
        // Why this matters: Basic user listing functionality
        const mockApiResponse = [
          { id: 1, username: "user1", name: "User One" },
          { id: 2, username: "user2", name: "User Two" },
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("get_users");
        const result = await tool!.handler({ smart_search: false });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/users?");
        expect(result).toEqual(mockApiResponse);
      });

      it("should get users with filter parameters", async () => {
        // Test: Get users with various filters
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("get_users");
        await tool!.handler({
          smart_search: false,
          active: true,
          blocked: false,
          per_page: 50,
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("active=true");
        expect(calledUrl).toContain("blocked=false");
        expect(calledUrl).toContain("per_page=50");
      });

      it("should handle API error for get_users", async () => {
        // Test: Error handling for user listing
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        } as any);

        const tool = coreToolRegistry.get("get_users");
        await expect(tool!.handler({ smart_search: false })).rejects.toThrow(
          "GitLab API error: 401 Unauthorized"
        );
      });
    });

    describe("list_project_members Handler", () => {
      it("should list project members with basic parameters", async () => {
        // Test: List members of a project
        // Why this matters: Team management and access control
        const mockApiResponse = [
          { id: 1, username: "member1", access_level: 30 },
          { id: 2, username: "member2", access_level: 40 },
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("list_project_members");
        const result = await tool!.handler({ project_id: "123" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/projects/123/members?");
        expect(result).toEqual(mockApiResponse);
      });

      it("should list project members with query filter", async () => {
        // Test: Filter members by search query
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("list_project_members");
        await tool!.handler({ project_id: "test/project", query: "john", per_page: 20 });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/projects/test%2Fproject/members?");
        expect(calledUrl).toContain("query=john");
        expect(calledUrl).toContain("per_page=20");
      });

      it("should handle API error for list_project_members", async () => {
        // Test: Error handling for project members
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as any);

        const tool = coreToolRegistry.get("list_project_members");
        await expect(tool!.handler({ project_id: "nonexistent" })).rejects.toThrow(
          "GitLab API error: 404 Not Found"
        );
      });
    });

    describe("list_group_iterations Handler", () => {
      it("should list group iterations with basic parameters", async () => {
        // Test: List iterations/sprints for a group
        // Why this matters: Agile planning and sprint tracking
        const mockApiResponse = [
          { id: 1, title: "Sprint 1", state: "current" },
          { id: 2, title: "Sprint 2", state: "upcoming" },
        ];

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("list_group_iterations");
        const result = await tool!.handler({ group_id: "my-group" });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/groups/my-group/iterations?");
        expect(result).toEqual(mockApiResponse);
      });

      it("should list group iterations with all filters", async () => {
        // Test: Filter iterations by state and search
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue([]),
        } as any);

        const tool = coreToolRegistry.get("list_group_iterations");
        await tool!.handler({
          group_id: "test/group",
          state: "current",
          search: "Sprint",
          include_ancestors: true,
          per_page: 10,
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/groups/test%2Fgroup/iterations?");
        expect(calledUrl).toContain("state=current");
        expect(calledUrl).toContain("search=Sprint");
        expect(calledUrl).toContain("include_ancestors=true");
        expect(calledUrl).toContain("per_page=10");
      });

      it("should handle API error for list_group_iterations", async () => {
        // Test: Error handling for iterations (Premium feature)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Forbidden",
        } as any);

        const tool = coreToolRegistry.get("list_group_iterations");
        await expect(tool!.handler({ group_id: "non-premium" })).rejects.toThrow(
          "GitLab API error: 403 Forbidden"
        );
      });
    });

    describe("download_attachment Handler", () => {
      it("should download attachment successfully", async () => {
        // Test: Download file attachment from issue/MR
        // Why this matters: Access uploaded files from GitLab
        const mockContent = Buffer.from("file content here");

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: jest.fn().mockResolvedValue(mockContent.buffer),
          headers: new Map([["content-type", "image/png"]]) as any,
        } as any);

        const tool = coreToolRegistry.get("download_attachment");
        const result = await tool!.handler({
          project_id: "123",
          secret: "abc123secret",
          filename: "screenshot.png",
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/projects/123/uploads/abc123secret/screenshot.png");
        expect(result).toMatchObject({
          filename: "screenshot.png",
          content: expect.any(String), // base64 encoded
          contentType: "image/png",
        });
      });

      it("should handle missing content-type header", async () => {
        // Test: Default content-type when header is missing
        const mockContent = Buffer.from("binary data");

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: jest.fn().mockResolvedValue(mockContent.buffer),
          headers: { get: () => null } as any,
        } as any);

        const tool = coreToolRegistry.get("download_attachment");
        const result = (await tool!.handler({
          project_id: "test/project",
          secret: "xyz789",
          filename: "data.bin",
        })) as { contentType: string };

        expect(result.contentType).toBe("application/octet-stream");
      });

      it("should handle API error for download_attachment", async () => {
        // Test: Error handling for attachment download
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as any);

        const tool = coreToolRegistry.get("download_attachment");
        await expect(
          tool!.handler({ project_id: "123", secret: "invalid", filename: "missing.png" })
        ).rejects.toThrow("GitLab API error: 404 Not Found");
      });
    });

    describe("create_branch Handler", () => {
      it("should create branch successfully", async () => {
        // Test: Create a new branch from existing ref
        // Why this matters: Required before creating MRs
        const mockApiResponse = {
          name: "feature-branch",
          commit: { id: "abc123", short_id: "abc", title: "Initial commit" },
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("create_branch");
        const result = await tool!.handler({
          project_id: "123",
          branch: "feature-branch",
          ref: "main",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/projects/123/repository/branches",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          })
        );
        expect(result).toEqual(mockApiResponse);
      });

      it("should handle API error for create_branch", async () => {
        // Test: Error handling for branch creation
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
        } as any);

        const tool = coreToolRegistry.get("create_branch");
        await expect(
          tool!.handler({ project_id: "123", branch: "invalid branch", ref: "main" })
        ).rejects.toThrow("GitLab API error: 400 Bad Request");
      });
    });

    describe("create_group Handler", () => {
      it("should create group with basic parameters", async () => {
        // Test: Create a new GitLab group
        // Why this matters: Group creation for project organization
        const mockApiResponse = {
          id: 100,
          name: "New Group",
          path: "new-group",
          visibility: "private",
        };

        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any);

        const tool = coreToolRegistry.get("create_group");
        const result = await tool!.handler({
          name: "New Group",
          path: "new-group",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledWith(
          "https://gitlab.example.com/api/v4/groups",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          })
        );
        expect(result).toEqual(mockApiResponse);
      });

      it("should create group with all optional parameters", async () => {
        // Test: Create group with all optional settings
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ id: 101, name: "Full Group" }),
        } as any);

        const tool = coreToolRegistry.get("create_group");
        await tool!.handler({
          name: "Full Group",
          path: "full-group",
          description: "A fully configured group",
          visibility: "internal",
          parent_id: 50,
          lfs_enabled: true,
          request_access_enabled: false,
          default_branch_protection: 2,
          avatar: "https://example.com/avatar.png",
        });

        const calledBody = (mockEnhancedFetch.mock.calls[0][1] as { body: string }).body;
        expect(calledBody).toContain("name=Full+Group");
        expect(calledBody).toContain("path=full-group");
        expect(calledBody).toContain("description=A+fully+configured+group");
        expect(calledBody).toContain("visibility=internal");
        expect(calledBody).toContain("parent_id=50");
        expect(calledBody).toContain("lfs_enabled=true");
        expect(calledBody).toContain("request_access_enabled=false");
        expect(calledBody).toContain("default_branch_protection=2");
        expect(calledBody).toContain("avatar=https%3A%2F%2Fexample.com%2Favatar.png");
      });

      it("should handle API error for create_group", async () => {
        // Test: Error handling for group creation
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 409,
          statusText: "Conflict",
        } as any);

        const tool = coreToolRegistry.get("create_group");
        await expect(tool!.handler({ name: "Existing", path: "existing" })).rejects.toThrow(
          "GitLab API error: 409 Conflict"
        );
      });
    });

    describe("manage_repository Handler (additional edge cases)", () => {
      it("should fork with all optional parameters", async () => {
        // Test: Fork with custom name, path, and namespace
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({
            id: 3000,
            name: "my-custom-fork",
            path: "custom-path",
          }),
        } as any);

        const tool = coreToolRegistry.get("manage_repository");
        const result = await tool!.handler({
          action: "fork",
          project_id: "original/project",
          namespace: "my-namespace",
          namespace_path: "my-namespace-path",
          fork_name: "my-custom-fork",
          fork_path: "custom-path",
        });

        const calledUrl = mockEnhancedFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/api/v4/projects/original%2Fproject/fork");

        const calledBody = (mockEnhancedFetch.mock.calls[0][1] as { body: string }).body;
        expect(calledBody).toContain("namespace=my-namespace");
        expect(calledBody).toContain("namespace_path=my-namespace-path");
        expect(calledBody).toContain("name=my-custom-fork");
        expect(calledBody).toContain("path=custom-path");

        expect(result).toMatchObject({
          id: 3000,
          name: "my-custom-fork",
        });
      });

      it("should handle fork API error", async () => {
        // Test: Error handling for fork operation
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Forbidden",
        } as any);

        const tool = coreToolRegistry.get("manage_repository");
        await expect(tool!.handler({ action: "fork", project_id: "private/repo" })).rejects.toThrow(
          "GitLab API error: 403 Forbidden"
        );
      });

      it("should handle create with namespace resolution failure", async () => {
        // Test: Error when namespace doesn't exist
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as any);

        const tool = coreToolRegistry.get("manage_repository");
        await expect(
          tool!.handler({
            action: "create",
            name: "new-project",
            namespace: "nonexistent-namespace",
          })
        ).rejects.toThrow("Namespace 'nonexistent-namespace' not found or not accessible");
      });

      it("should handle create when project already exists", async () => {
        // Test: Error when trying to create a project that already exists
        // Mock namespace check (exists)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 10, full_path: "my-group" }),
        } as any);

        // Mock project check (already exists)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 999 }),
        } as any);

        const tool = coreToolRegistry.get("manage_repository");
        await expect(
          tool!.handler({
            action: "create",
            name: "existing-project",
            namespace: "my-group",
          })
        ).rejects.toThrow("Project 'my-group/existing-project' already exists (ID: 999).");
      });

      it("should create repository with all optional feature flags", async () => {
        // Test: Create with all feature flags enabled
        // Mock namespace check (doesn't exist for current user)
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any);

        // Mock project creation success
        mockEnhancedFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ id: 4000, name: "full-featured" }),
        } as any);

        const tool = coreToolRegistry.get("manage_repository");
        await tool!.handler({
          action: "create",
          name: "full-featured",
          description: "Full featured project",
          visibility: "public",
          initialize_with_readme: true,
          issues_enabled: true,
          merge_requests_enabled: true,
          jobs_enabled: true,
          wiki_enabled: false,
          snippets_enabled: false,
          lfs_enabled: true,
          request_access_enabled: false,
          only_allow_merge_if_pipeline_succeeds: true,
          only_allow_merge_if_all_discussions_are_resolved: true,
        });

        // Second call is the project creation
        const calledBody = (mockEnhancedFetch.mock.calls[1][1] as { body: string }).body;
        expect(calledBody).toContain("issues_enabled=true");
        expect(calledBody).toContain("merge_requests_enabled=true");
        expect(calledBody).toContain("jobs_enabled=true");
        expect(calledBody).toContain("wiki_enabled=false");
        expect(calledBody).toContain("snippets_enabled=false");
        expect(calledBody).toContain("lfs_enabled=true");
        expect(calledBody).toContain("request_access_enabled=false");
        expect(calledBody).toContain("only_allow_merge_if_pipeline_succeeds=true");
        expect(calledBody).toContain("only_allow_merge_if_all_discussions_are_resolved=true");
      });
    });
  });
});
