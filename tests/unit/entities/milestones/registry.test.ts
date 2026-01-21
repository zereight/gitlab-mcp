import {
  milestonesToolRegistry,
  getMilestonesReadOnlyToolNames,
  getMilestonesToolDefinitions,
  getFilteredMilestonesTools,
} from "../../../../src/entities/milestones/registry";
import { enhancedFetch } from "../../../../src/utils/fetch";
import * as config from "../../../../src/config";

// Mock enhancedFetch to avoid actual API calls
jest.mock("../../../../src/utils/fetch", () => ({
  enhancedFetch: jest.fn(),
}));

// Mock isActionDenied function from config
jest.mock("../../../../src/config", () => {
  const actual = jest.requireActual("../../../../src/config");
  return {
    ...actual,
    isActionDenied: jest.fn().mockReturnValue(false),
  };
});

const mockIsActionDenied = config.isActionDenied as jest.MockedFunction<
  typeof config.isActionDenied
>;

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

describe("Milestones Registry - CQRS Tools", () => {
  describe("Registry Structure", () => {
    it("should be a Map instance", () => {
      expect(milestonesToolRegistry instanceof Map).toBe(true);
    });

    it("should contain exactly 2 CQRS tools", () => {
      const toolNames = Array.from(milestonesToolRegistry.keys());

      expect(toolNames).toContain("browse_milestones");
      expect(toolNames).toContain("manage_milestone");
      expect(milestonesToolRegistry.size).toBe(2);
    });

    it("should have tools with valid structure", () => {
      for (const [toolName, tool] of milestonesToolRegistry) {
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
      const toolNames = Array.from(milestonesToolRegistry.keys());
      const uniqueNames = new Set(toolNames);

      expect(toolNames.length).toBe(uniqueNames.size);
    });
  });

  describe("Tool Definitions", () => {
    it("should have proper browse_milestones tool", () => {
      const tool = milestonesToolRegistry.get("browse_milestones");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("browse_milestones");
      expect(tool?.description).toContain("BROWSE milestones");
      expect(tool?.description).toContain("list");
      expect(tool?.description).toContain("get");
      expect(tool?.description).toContain("issues");
      expect(tool?.description).toContain("merge_requests");
      expect(tool?.description).toContain("burndown");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper manage_milestone tool", () => {
      const tool = milestonesToolRegistry.get("manage_milestone");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("manage_milestone");
      expect(tool?.description).toContain("MANAGE milestones");
      expect(tool?.description).toContain("create");
      expect(tool?.description).toContain("update");
      expect(tool?.description).toContain("delete");
      expect(tool?.description).toContain("promote");
      expect(tool?.inputSchema).toBeDefined();
    });
  });

  describe("Read-Only Tools Function", () => {
    it("should return an array of read-only tool names", () => {
      const readOnlyTools = getMilestonesReadOnlyToolNames();

      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it("should include only browse_milestones as read-only", () => {
      const readOnlyTools = getMilestonesReadOnlyToolNames();

      expect(readOnlyTools).toContain("browse_milestones");
      expect(readOnlyTools).toEqual(["browse_milestones"]);
    });

    it("should not include manage tools (write tools)", () => {
      const readOnlyTools = getMilestonesReadOnlyToolNames();

      expect(readOnlyTools).not.toContain("manage_milestone");
    });

    it("should return exactly 1 read-only tool", () => {
      const readOnlyTools = getMilestonesReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(1);
    });

    it("should return tools that exist in the registry", () => {
      const readOnlyTools = getMilestonesReadOnlyToolNames();
      const registryKeys = Array.from(milestonesToolRegistry.keys());

      for (const toolName of readOnlyTools) {
        expect(registryKeys).toContain(toolName);
      }
    });
  });

  describe("Milestones Tool Definitions Function", () => {
    it("should return an array of tool definitions", () => {
      const definitions = getMilestonesToolDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBe(milestonesToolRegistry.size);
    });

    it("should return all 2 CQRS tools from registry", () => {
      const definitions = getMilestonesToolDefinitions();

      expect(definitions.length).toBe(2);
    });

    it("should return tool definitions with proper structure", () => {
      const definitions = getMilestonesToolDefinitions();

      for (const definition of definitions) {
        expect(definition).toHaveProperty("name");
        expect(definition).toHaveProperty("description");
        expect(definition).toHaveProperty("inputSchema");
        expect(definition).toHaveProperty("handler");
      }
    });
  });

  describe("Filtered Milestones Tools Function", () => {
    it("should return all tools in normal mode", () => {
      const allTools = getFilteredMilestonesTools(false);
      const allDefinitions = getMilestonesToolDefinitions();

      expect(allTools.length).toBe(allDefinitions.length);
      expect(allTools.length).toBe(2);
    });

    it("should return only read-only tools in read-only mode", () => {
      const readOnlyTools = getFilteredMilestonesTools(true);
      const readOnlyNames = getMilestonesReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(readOnlyTools.length).toBe(1);
    });

    it("should filter tools correctly in read-only mode", () => {
      const readOnlyTools = getFilteredMilestonesTools(true);
      const readOnlyNames = getMilestonesReadOnlyToolNames();

      for (const tool of readOnlyTools) {
        expect(readOnlyNames).toContain(tool.name);
      }
    });

    it("should not include manage tools in read-only mode", () => {
      const readOnlyTools = getFilteredMilestonesTools(true);

      for (const tool of readOnlyTools) {
        expect(tool.name).not.toBe("manage_milestone");
      }
    });
  });

  describe("Tool Handlers", () => {
    it("should have handlers that are async functions", () => {
      for (const [, tool] of milestonesToolRegistry) {
        expect(tool.handler.constructor.name).toBe("AsyncFunction");
      }
    });

    it("should have handlers that accept arguments", () => {
      for (const [, tool] of milestonesToolRegistry) {
        expect(tool.handler.length).toBe(1);
      }
    });
  });

  describe("Registry Consistency", () => {
    it("should have all expected CQRS tools", () => {
      const expectedTools = ["browse_milestones", "manage_milestone"];

      for (const toolName of expectedTools) {
        expect(milestonesToolRegistry.has(toolName)).toBe(true);
      }
    });

    it("should have consistent tool count between functions", () => {
      const allDefinitions = getMilestonesToolDefinitions();
      const readOnlyNames = getMilestonesReadOnlyToolNames();
      const readOnlyTools = getFilteredMilestonesTools(true);

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(allDefinitions.length).toBe(milestonesToolRegistry.size);
      expect(allDefinitions.length).toBeGreaterThan(readOnlyNames.length);
    });

    it("should have more tools than just read-only ones", () => {
      const totalTools = milestonesToolRegistry.size;
      const readOnlyCount = getMilestonesReadOnlyToolNames().length;

      expect(totalTools).toBeGreaterThan(readOnlyCount);
      expect(totalTools).toBe(2);
      expect(readOnlyCount).toBe(1);
    });
  });

  describe("Tool Input Schemas", () => {
    it("should have valid JSON schema structure for all tools", () => {
      for (const [, tool] of milestonesToolRegistry) {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe("object");
        const schema = tool.inputSchema;
        const hasValidStructure = "type" in schema || "anyOf" in schema || "oneOf" in schema;
        expect(hasValidStructure).toBe(true);
      }
    });

    it("should have consistent schema format", () => {
      for (const [toolName, tool] of milestonesToolRegistry) {
        expect(tool.inputSchema).toBeDefined();

        if (typeof tool.inputSchema === "object" && tool.inputSchema !== null) {
          const schema = tool.inputSchema;
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

    describe("browse_milestones handler - list action", () => {
      it("should list milestones with basic parameters", async () => {
        // First mock for namespace resolution (project lookup)
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        // Second mock for milestones list
        const mockMilestones = [
          { id: 1, title: "v1.0", state: "active" },
          { id: 2, title: "v2.0", state: "closed" },
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestones) as never);

        const tool = milestonesToolRegistry.get("browse_milestones")!;
        const result = await tool.handler({
          action: "list",
          namespace: "test/project",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockMilestones);
      });

      it("should list milestones with filtering options", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockMilestones = [{ id: 1, title: "v1.0", state: "active" }];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestones) as never);

        const tool = milestonesToolRegistry.get("browse_milestones")!;
        await tool.handler({
          action: "list",
          namespace: "test/project",
          state: "active",
          search: "v1",
          per_page: 50,
          page: 1,
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const url = call[0];
        expect(url).toContain("state=active");
        expect(url).toContain("search=v1");
        expect(url).toContain("per_page=50");
        expect(url).toContain("page=1");
      });

      it("should handle API errors", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as never);

        const tool = milestonesToolRegistry.get("browse_milestones")!;

        await expect(
          tool.handler({
            action: "list",
            namespace: "nonexistent/project",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });
    });

    describe("browse_milestones handler - get action", () => {
      it("should get milestone by ID", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockMilestone = {
          id: 1,
          title: "v1.0",
          state: "active",
          description: "First release",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestone) as never);

        const tool = milestonesToolRegistry.get("browse_milestones")!;
        const result = await tool.handler({
          action: "get",
          namespace: "test/project",
          milestone_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockMilestone);
      });

      it("should handle milestone not found", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null, false, 404) as never);

        const tool = milestonesToolRegistry.get("browse_milestones")!;

        await expect(
          tool.handler({
            action: "get",
            namespace: "test/project",
            milestone_id: "999",
          })
        ).rejects.toThrow("GitLab API error: 404 Error");
      });
    });

    describe("browse_milestones handler - issues action", () => {
      it("should list issues in milestone", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockIssues = [
          { id: 1, title: "Fix bug", state: "opened" },
          { id: 2, title: "Add feature", state: "closed" },
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockIssues) as never);

        const tool = milestonesToolRegistry.get("browse_milestones")!;
        const result = await tool.handler({
          action: "issues",
          namespace: "test/project",
          milestone_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockIssues);
      });
    });

    describe("browse_milestones handler - merge_requests action", () => {
      it("should list merge requests in milestone", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockMRs = [
          { id: 1, title: "Feature MR", state: "merged" },
          { id: 2, title: "Bugfix MR", state: "opened" },
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMRs) as never);

        const tool = milestonesToolRegistry.get("browse_milestones")!;
        const result = await tool.handler({
          action: "merge_requests",
          namespace: "test/project",
          milestone_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockMRs);
      });
    });

    describe("browse_milestones handler - burndown action", () => {
      it("should get burndown events", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockEvents = [
          { date: "2024-01-01", scope_count: 10 },
          { date: "2024-01-02", scope_count: 8 },
        ];
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockEvents) as never);

        const tool = milestonesToolRegistry.get("browse_milestones")!;
        const result = await tool.handler({
          action: "burndown",
          namespace: "test/project",
          milestone_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockEvents);
      });
    });

    describe("manage_milestone handler - create action", () => {
      it("should create milestone", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockMilestone = {
          id: 3,
          title: "v3.0",
          state: "active",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestone) as never);

        const tool = milestonesToolRegistry.get("manage_milestone")!;
        const result = await tool.handler({
          action: "create",
          namespace: "test/project",
          title: "v3.0",
          description: "Major release",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockMilestone);
      });

      it("should create milestone with dates", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockMilestone = { id: 4, title: "v4.0", state: "active" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestone) as never);

        const tool = milestonesToolRegistry.get("manage_milestone")!;
        await tool.handler({
          action: "create",
          namespace: "test/project",
          title: "v4.0",
          start_date: "2024-01-01",
          due_date: "2024-03-31",
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.title).toBe("v4.0");
        expect(body.start_date).toBe("2024-01-01");
        expect(body.due_date).toBe("2024-03-31");
      });
    });

    describe("manage_milestone handler - update action", () => {
      it("should update milestone", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockMilestone = {
          id: 1,
          title: "v1.0 Updated",
          state: "active",
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestone) as never);

        const tool = milestonesToolRegistry.get("manage_milestone")!;
        const result = await tool.handler({
          action: "update",
          namespace: "test/project",
          milestone_id: "1",
          title: "v1.0 Updated",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockMilestone);
      });

      it("should close milestone with state_event", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockMilestone = { id: 1, title: "v1.0", state: "closed" };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestone) as never);

        const tool = milestonesToolRegistry.get("manage_milestone")!;
        await tool.handler({
          action: "update",
          namespace: "test/project",
          milestone_id: "1",
          state_event: "close",
        });

        const call = mockEnhancedFetch.mock.calls[1];
        const body = JSON.parse(call[1]?.body as string);
        expect(body.state_event).toBe("close");
      });
    });

    describe("manage_milestone handler - delete action", () => {
      it("should delete milestone", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(null) as never);

        const tool = milestonesToolRegistry.get("manage_milestone")!;
        const result = await tool.handler({
          action: "delete",
          namespace: "test/project",
          milestone_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ deleted: true });
      });
    });

    describe("manage_milestone handler - promote action", () => {
      it("should promote project milestone to group", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        const mockMilestone = {
          id: 1,
          title: "v1.0",
          group_id: 1,
        };
        mockEnhancedFetch.mockResolvedValueOnce(mockResponse(mockMilestone) as never);

        const tool = milestonesToolRegistry.get("manage_milestone")!;
        const result = await tool.handler({
          action: "promote",
          namespace: "test/project",
          milestone_id: "1",
        });

        expect(mockEnhancedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockMilestone);
      });

      it("should throw error when promoting group milestone", async () => {
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-group", kind: "group" }) as never
        );

        const tool = milestonesToolRegistry.get("manage_milestone")!;

        await expect(
          tool.handler({
            action: "promote",
            namespace: "test-group",
            milestone_id: "1",
          })
        ).rejects.toThrow("Milestone promotion is only available for projects, not groups");
      });
    });

    describe("Error Handling", () => {
      it("should handle schema validation errors for browse_milestones", async () => {
        const tool = milestonesToolRegistry.get("browse_milestones")!;

        // Missing required action
        await expect(tool.handler({})).rejects.toThrow();

        // Invalid action
        await expect(tool.handler({ action: "invalid", namespace: "test" })).rejects.toThrow();

        // Missing namespace for list
        await expect(tool.handler({ action: "list" })).rejects.toThrow();

        // Missing milestone_id for get
        await expect(tool.handler({ action: "get", namespace: "test" })).rejects.toThrow();
      });

      it("should handle schema validation errors for manage_milestone", async () => {
        const tool = milestonesToolRegistry.get("manage_milestone")!;

        // Missing required action
        await expect(tool.handler({})).rejects.toThrow();

        // Invalid action
        await expect(tool.handler({ action: "invalid", namespace: "test" })).rejects.toThrow();

        // Missing title for create
        await expect(tool.handler({ action: "create", namespace: "test" })).rejects.toThrow();

        // Missing milestone_id for update
        await expect(tool.handler({ action: "update", namespace: "test" })).rejects.toThrow();
      });

      it("should handle network errors", async () => {
        // First call for namespace resolution succeeds
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        // Second call (actual API) fails with network error
        mockEnhancedFetch.mockRejectedValueOnce(new Error("Connection timeout"));

        const tool = milestonesToolRegistry.get("browse_milestones")!;

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

        const tool = milestonesToolRegistry.get("browse_milestones")!;

        await expect(
          tool.handler({
            action: "list",
            namespace: "private/project",
          })
        ).rejects.toThrow("GitLab API error: 403 Error");
      });
    });

    describe("Runtime Validation - Denied Actions", () => {
      beforeEach(() => {
        // Reset isActionDenied mock to default (allow all)
        mockIsActionDenied.mockReturnValue(false);
      });

      it("should reject denied action for manage_milestone", async () => {
        // Configure delete action as denied
        mockIsActionDenied.mockImplementation((toolName, actionName) => {
          return toolName === "manage_milestone" && actionName === "delete";
        });

        const tool = milestonesToolRegistry.get("manage_milestone")!;

        await expect(
          tool.handler({
            action: "delete",
            namespace: "test/project",
            milestone_id: "1",
          })
        ).rejects.toThrow("Action 'delete' is not allowed for manage_milestone tool");
      });

      it("should reject denied action for browse_milestones", async () => {
        // Configure burndown action as denied
        mockIsActionDenied.mockImplementation((toolName, actionName) => {
          return toolName === "browse_milestones" && actionName === "burndown";
        });

        const tool = milestonesToolRegistry.get("browse_milestones")!;

        await expect(
          tool.handler({
            action: "burndown",
            namespace: "test/project",
            milestone_id: "1",
          })
        ).rejects.toThrow("Action 'burndown' is not allowed for browse_milestones tool");
      });

      it("should allow non-denied actions to proceed", async () => {
        // Configure only delete as denied
        mockIsActionDenied.mockImplementation((toolName, actionName) => {
          return toolName === "manage_milestone" && actionName === "delete";
        });

        // Mock successful API response
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, path: "test-project", kind: "project" }) as never
        );
        mockEnhancedFetch.mockResolvedValueOnce(
          mockResponse({ id: 1, title: "v1.0", state: "active" }) as never
        );

        const tool = milestonesToolRegistry.get("manage_milestone")!;

        // Create action should work (not denied)
        const result = await tool.handler({
          action: "create",
          namespace: "test/project",
          title: "v1.0",
        });

        expect(result).toEqual({ id: 1, title: "v1.0", state: "active" });
      });

      it("should reject multiple denied actions", async () => {
        // Configure multiple actions as denied
        mockIsActionDenied.mockImplementation((toolName, actionName) => {
          return toolName === "manage_milestone" && ["delete", "promote"].includes(actionName);
        });

        const tool = milestonesToolRegistry.get("manage_milestone")!;

        // Both should be rejected
        await expect(
          tool.handler({
            action: "delete",
            namespace: "test/project",
            milestone_id: "1",
          })
        ).rejects.toThrow("Action 'delete' is not allowed for manage_milestone tool");

        await expect(
          tool.handler({
            action: "promote",
            namespace: "test/project",
            milestone_id: "1",
          })
        ).rejects.toThrow("Action 'promote' is not allowed for manage_milestone tool");
      });

      it("should call isActionDenied with correct parameters", async () => {
        mockIsActionDenied.mockReturnValue(true);

        const tool = milestonesToolRegistry.get("manage_milestone")!;

        await expect(
          tool.handler({
            action: "delete",
            namespace: "test/project",
            milestone_id: "1",
          })
        ).rejects.toThrow();

        expect(mockIsActionDenied).toHaveBeenCalledWith("manage_milestone", "delete");
      });
    });
  });
});
