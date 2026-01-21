import {
  workitemsToolRegistry,
  getWorkitemsReadOnlyToolNames,
  getWorkitemsToolDefinitions,
  getFilteredWorkitemsTools,
} from "../../../../src/entities/workitems/registry";

// Create mock client
const mockClient = {
  request: jest.fn(),
};

// Mock GraphQL client to avoid actual API calls
jest.mock("../../../../src/services/ConnectionManager", () => ({
  ConnectionManager: {
    getInstance: jest.fn(() => ({
      getClient: jest.fn(() => mockClient),
    })),
  },
}));

// Mock work item types utility
jest.mock("../../../../src/utils/workItemTypes", () => ({
  getWorkItemTypes: jest.fn(() =>
    Promise.resolve([
      { id: "gid://gitlab/WorkItems::Type/1", name: "Epic" },
      { id: "gid://gitlab/WorkItems::Type/2", name: "Issue" },
      { id: "gid://gitlab/WorkItems::Type/3", name: "Task" },
    ])
  ),
}));

describe("Workitems Registry - CQRS Tools", () => {
  describe("Registry Structure", () => {
    it("should be a Map instance", () => {
      expect(workitemsToolRegistry instanceof Map).toBe(true);
    });

    it("should contain exactly 2 CQRS tools", () => {
      const toolNames = Array.from(workitemsToolRegistry.keys());

      expect(toolNames).toContain("browse_work_items");
      expect(toolNames).toContain("manage_work_item");
      expect(workitemsToolRegistry.size).toBe(2);
    });

    it("should have tools with valid structure", () => {
      for (const [toolName, tool] of workitemsToolRegistry) {
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
      const toolNames = Array.from(workitemsToolRegistry.keys());
      const uniqueNames = new Set(toolNames);

      expect(toolNames.length).toBe(uniqueNames.size);
    });
  });

  describe("Tool Definitions", () => {
    it("should have proper browse_work_items tool", () => {
      const tool = workitemsToolRegistry.get("browse_work_items");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("browse_work_items");
      expect(tool?.description).toContain("BROWSE work items");
      expect(tool?.description).toContain("list");
      expect(tool?.description).toContain("get");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should have proper manage_work_item tool", () => {
      const tool = workitemsToolRegistry.get("manage_work_item");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("manage_work_item");
      expect(tool?.description).toContain("MANAGE work items");
      expect(tool?.description).toContain("create");
      expect(tool?.description).toContain("update");
      expect(tool?.description).toContain("delete");
      expect(tool?.inputSchema).toBeDefined();
    });
  });

  describe("Read-Only Tools Function", () => {
    it("should return an array of read-only tool names", () => {
      const readOnlyTools = getWorkitemsReadOnlyToolNames();

      expect(Array.isArray(readOnlyTools)).toBe(true);
      expect(readOnlyTools.length).toBeGreaterThan(0);
    });

    it("should include only browse_work_items as read-only", () => {
      const readOnlyTools = getWorkitemsReadOnlyToolNames();

      expect(readOnlyTools).toContain("browse_work_items");
      expect(readOnlyTools).toEqual(["browse_work_items"]);
    });

    it("should not include manage_work_item (write tool)", () => {
      const readOnlyTools = getWorkitemsReadOnlyToolNames();

      expect(readOnlyTools).not.toContain("manage_work_item");
    });

    it("should return exactly 1 read-only tool", () => {
      const readOnlyTools = getWorkitemsReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(1);
    });

    it("should return tools that exist in the registry", () => {
      const readOnlyTools = getWorkitemsReadOnlyToolNames();
      const registryKeys = Array.from(workitemsToolRegistry.keys());

      for (const toolName of readOnlyTools) {
        expect(registryKeys).toContain(toolName);
      }
    });
  });

  describe("Workitems Tool Definitions Function", () => {
    it("should return an array of tool definitions", () => {
      const definitions = getWorkitemsToolDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBe(workitemsToolRegistry.size);
    });

    it("should return all 2 CQRS tools from registry", () => {
      const definitions = getWorkitemsToolDefinitions();

      expect(definitions.length).toBe(2);
    });

    it("should return tool definitions with proper structure", () => {
      const definitions = getWorkitemsToolDefinitions();

      for (const definition of definitions) {
        expect(definition).toHaveProperty("name");
        expect(definition).toHaveProperty("description");
        expect(definition).toHaveProperty("inputSchema");
        expect(definition).toHaveProperty("handler");
      }
    });
  });

  describe("Filtered Workitems Tools Function", () => {
    it("should return all tools in normal mode", () => {
      const allTools = getFilteredWorkitemsTools(false);
      const allDefinitions = getWorkitemsToolDefinitions();

      expect(allTools.length).toBe(allDefinitions.length);
      expect(allTools.length).toBe(2);
    });

    it("should return only read-only tools in read-only mode", () => {
      const readOnlyTools = getFilteredWorkitemsTools(true);
      const readOnlyNames = getWorkitemsReadOnlyToolNames();

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(readOnlyTools.length).toBe(1);
    });

    it("should filter tools correctly in read-only mode", () => {
      const readOnlyTools = getFilteredWorkitemsTools(true);
      const readOnlyNames = getWorkitemsReadOnlyToolNames();

      for (const tool of readOnlyTools) {
        expect(readOnlyNames).toContain(tool.name);
      }
    });

    it("should not include manage_work_item in read-only mode", () => {
      const readOnlyTools = getFilteredWorkitemsTools(true);

      for (const tool of readOnlyTools) {
        expect(tool.name).not.toBe("manage_work_item");
      }
    });
  });

  describe("Tool Handlers", () => {
    it("should have handlers that are async functions", () => {
      for (const [, tool] of workitemsToolRegistry) {
        expect(tool.handler.constructor.name).toBe("AsyncFunction");
      }
    });

    it("should have handlers that accept arguments", () => {
      for (const [, tool] of workitemsToolRegistry) {
        expect(tool.handler.length).toBe(1); // Should accept one argument
      }
    });
  });

  describe("Registry Consistency", () => {
    it("should have all expected CQRS tools", () => {
      const expectedTools = ["browse_work_items", "manage_work_item"];

      for (const toolName of expectedTools) {
        expect(workitemsToolRegistry.has(toolName)).toBe(true);
      }
    });

    it("should have consistent tool count between functions", () => {
      const allDefinitions = getWorkitemsToolDefinitions();
      const readOnlyNames = getWorkitemsReadOnlyToolNames();
      const readOnlyTools = getFilteredWorkitemsTools(true);

      expect(readOnlyTools.length).toBe(readOnlyNames.length);
      expect(allDefinitions.length).toBe(workitemsToolRegistry.size);
      expect(allDefinitions.length).toBeGreaterThan(readOnlyNames.length);
    });

    it("should have more tools than just read-only ones", () => {
      const totalTools = workitemsToolRegistry.size;
      const readOnlyCount = getWorkitemsReadOnlyToolNames().length;

      expect(totalTools).toBeGreaterThan(readOnlyCount);
      expect(totalTools).toBe(2);
      expect(readOnlyCount).toBe(1);
    });
  });

  describe("Tool Input Schemas", () => {
    it("should have valid JSON schema structure for all tools", () => {
      for (const [, tool] of workitemsToolRegistry) {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe("object");
        // CQRS tools use discriminated unions which produce "anyOf" in JSON schema
        const schema = tool.inputSchema;
        const hasValidStructure = "type" in schema || "anyOf" in schema || "oneOf" in schema;
        expect(hasValidStructure).toBe(true);
      }
    });

    it("should have consistent schema format", () => {
      for (const [toolName, tool] of workitemsToolRegistry) {
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
    beforeEach(() => {
      mockClient.request.mockReset();
    });

    // Helper function to create complete mock work items
    const createMockWorkItem = (overrides: Record<string, unknown> = {}) => ({
      id: "gid://gitlab/WorkItem/1",
      iid: "1",
      title: "Test Work Item",
      state: "OPEN",
      workItemType: { id: "gid://gitlab/WorkItems::Type/8", name: "Epic" },
      webUrl: "https://gitlab.example.com/groups/test/-/epics/1",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      description: null,
      widgets: [],
      ...overrides,
    });

    describe("browse_work_items handler - list action", () => {
      it("should execute list action successfully with valid namespace path", async () => {
        const mockWorkItems = [
          createMockWorkItem({ id: "gid://gitlab/WorkItem/1", iid: "1", title: "Epic 1" }),
          createMockWorkItem({ id: "gid://gitlab/WorkItem/2", iid: "2", title: "Epic 2" }),
        ];

        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: "Group",
            workItems: {
              nodes: mockWorkItems,
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const tool = workitemsToolRegistry.get("browse_work_items");
        const result = await tool?.handler({ action: "list", namespace: "test-group" });

        expect(mockClient.request).toHaveBeenCalledWith(expect.any(Object), {
          namespacePath: "test-group",
          types: undefined,
          first: 20,
          after: undefined,
        });

        // With simple=true (default), expect simplified structure with converted IDs
        expect(result).toHaveProperty("items");
        expect(result).toHaveProperty("hasMore", false);
        expect(result).toHaveProperty("endCursor", null);
        expect(Array.isArray((result as { items: unknown[] }).items)).toBe(true);
        expect((result as { items: unknown[] }).items.length).toBe(2);
      });

      it("should return items array structure with list action", async () => {
        const mockWorkItems = [
          createMockWorkItem({
            description: "Test epic description",
            widgets: [
              {
                type: "ASSIGNEES",
                assignees: { nodes: [{ id: "user1", username: "test", name: "Test User" }] },
              },
            ],
          }),
        ];

        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: "Group",
            workItems: {
              nodes: mockWorkItems,
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const tool = workitemsToolRegistry.get("browse_work_items");
        const result = await tool?.handler({
          action: "list",
          namespace: "test-group",
          simple: false,
        });

        expect(result).toHaveProperty("items");
        expect(result).toHaveProperty("hasMore");
        expect(result).toHaveProperty("endCursor");
        expect(Array.isArray((result as { items: unknown[] }).items)).toBe(true);
      });

      it("should handle custom pagination parameters in list action", async () => {
        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: "Group",
            workItems: {
              nodes: [],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const tool = workitemsToolRegistry.get("browse_work_items");
        await tool?.handler({
          action: "list",
          namespace: "test-group",
          first: 50,
          after: "cursor-123",
        });

        expect(mockClient.request).toHaveBeenCalledWith(expect.any(Object), {
          namespacePath: "test-group",
          types: undefined,
          first: 50,
          after: "cursor-123",
        });
      });

      it("should return empty array when group has no work items", async () => {
        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: "Group",
            workItems: {
              nodes: [],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const tool = workitemsToolRegistry.get("browse_work_items");
        const result = await tool?.handler({ action: "list", namespace: "empty-group" });

        expect(result).toEqual({
          items: [],
          hasMore: false,
          endCursor: null,
        });
      });

      it("should handle types parameter in list action", async () => {
        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: "Group",
            workItems: {
              nodes: [],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const tool = workitemsToolRegistry.get("browse_work_items");
        await tool?.handler({
          action: "list",
          namespace: "test-group",
          types: ["EPIC", "ISSUE"],
        });

        expect(mockClient.request).toHaveBeenCalledWith(expect.any(Object), {
          namespacePath: "test-group",
          types: ["EPIC", "ISSUE"],
          first: 20,
          after: undefined,
        });
      });

      it("should validate required parameters for list action", async () => {
        const tool = workitemsToolRegistry.get("browse_work_items");

        // Missing namespace should throw validation error
        await expect(tool?.handler({ action: "list" })).rejects.toThrow();
      });

      it("should use simplified structure when simple=true", async () => {
        const mockWorkItem = createMockWorkItem({
          workItemType: { name: "Issue" },
          description: "Test description",
          widgets: [
            {
              type: "ASSIGNEES",
              assignees: {
                nodes: [{ id: "gid://gitlab/User/1", username: "test", name: "Test User" }],
              },
            },
            {
              type: "LABELS",
              labels: {
                nodes: [{ id: "gid://gitlab/ProjectLabel/1", title: "bug", color: "#ff0000" }],
              },
            },
          ],
        });

        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: "Project",
            workItems: {
              nodes: [mockWorkItem],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const tool = workitemsToolRegistry.get("browse_work_items");
        const result = (await tool?.handler({
          action: "list",
          namespace: "test-project",
          simple: true,
        })) as { items: Array<Record<string, unknown>> };

        expect(result.items[0]).toMatchObject({
          id: "1",
          iid: "1",
          title: "Test Work Item",
          state: "OPEN",
          workItemType: "Issue",
        });
      });

      it("should truncate long descriptions in simplified mode", async () => {
        const longDescription = "A".repeat(250);
        const mockWorkItem = createMockWorkItem({
          workItemType: { name: "Issue" },
          description: longDescription,
          widgets: [],
        });

        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: "Project",
            workItems: {
              nodes: [mockWorkItem],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const tool = workitemsToolRegistry.get("browse_work_items");
        const result = (await tool?.handler({
          action: "list",
          namespace: "test-project",
          simple: true,
        })) as { items: Array<{ description: string }> };

        expect(result.items[0].description).toBe("A".repeat(200) + "...");
      });

      it("should include MILESTONE widget in simplified mode", async () => {
        const mockWorkItem = createMockWorkItem({
          workItemType: { name: "Issue" },
          widgets: [
            {
              type: "MILESTONE",
              milestone: {
                id: "gid://gitlab/Milestone/5",
                title: "v1.0",
                state: "active",
              },
            },
          ],
        });

        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: "Project",
            workItems: {
              nodes: [mockWorkItem],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const tool = workitemsToolRegistry.get("browse_work_items");
        const result = (await tool?.handler({
          action: "list",
          namespace: "test-project",
          simple: true,
        })) as { items: Array<{ widgets?: Array<{ type: string; milestone?: unknown }> }> };

        expect(result.items[0].widgets).toBeDefined();
        // IDs are cleaned from GIDs to simple IDs
        expect(result.items[0].widgets).toContainEqual({
          type: "MILESTONE",
          milestone: {
            id: "5",
            title: "v1.0",
            state: "active",
          },
        });
      });

      it("should include HIERARCHY widget with parent in simplified mode", async () => {
        const mockWorkItem = createMockWorkItem({
          workItemType: { name: "Task" },
          widgets: [
            {
              type: "HIERARCHY",
              parent: {
                id: "gid://gitlab/WorkItem/100",
                iid: "10",
                title: "Parent Issue",
                workItemType: "Issue",
              },
              hasChildren: false,
            },
          ],
        });

        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: "Project",
            workItems: {
              nodes: [mockWorkItem],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const tool = workitemsToolRegistry.get("browse_work_items");
        const result = (await tool?.handler({
          action: "list",
          namespace: "test-project",
          simple: true,
        })) as {
          items: Array<{
            widgets?: Array<{ type: string; parent?: unknown; hasChildren?: boolean }>;
          }>;
        };

        expect(result.items[0].widgets).toBeDefined();
        // IDs are cleaned from GIDs to simple IDs
        expect(result.items[0].widgets).toContainEqual({
          type: "HIERARCHY",
          parent: {
            id: "100",
            iid: "10",
            title: "Parent Issue",
            workItemType: "Issue",
          },
          hasChildren: false,
        });
      });

      it("should include HIERARCHY widget with hasChildren in simplified mode", async () => {
        const mockWorkItem = createMockWorkItem({
          workItemType: { name: "Epic" },
          widgets: [
            {
              type: "HIERARCHY",
              parent: null,
              hasChildren: true,
            },
          ],
        });

        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: "Group",
            workItems: {
              nodes: [mockWorkItem],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const tool = workitemsToolRegistry.get("browse_work_items");
        const result = (await tool?.handler({
          action: "list",
          namespace: "test-group",
          simple: true,
        })) as {
          items: Array<{
            widgets?: Array<{ type: string; parent?: unknown; hasChildren?: boolean }>;
          }>;
        };

        expect(result.items[0].widgets).toBeDefined();
        expect(result.items[0].widgets).toContainEqual({
          type: "HIERARCHY",
          parent: null,
          hasChildren: true,
        });
      });

      it("should filter by state parameter", async () => {
        const mockWorkItems = [
          createMockWorkItem({ id: "gid://gitlab/WorkItem/1", state: "OPEN" }),
          createMockWorkItem({ id: "gid://gitlab/WorkItem/2", state: "CLOSED" }),
        ];

        mockClient.request.mockResolvedValueOnce({
          namespace: {
            __typename: "Group",
            workItems: {
              nodes: mockWorkItems,
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });

        const tool = workitemsToolRegistry.get("browse_work_items");
        const result = (await tool?.handler({
          action: "list",
          namespace: "test-group",
          state: ["OPEN"],
        })) as { items: unknown[] };

        // Client-side filtering should only return OPEN items
        expect(result.items.length).toBe(1);
      });
    });

    describe("browse_work_items handler - get action", () => {
      it("should execute get action successfully with valid work item ID", async () => {
        const mockWorkItem = createMockWorkItem({
          title: "Test Work Item",
          description: "Test description",
        });

        mockClient.request.mockResolvedValueOnce({
          workItem: mockWorkItem,
        });

        const tool = workitemsToolRegistry.get("browse_work_items");
        const result = await tool?.handler({ action: "get", id: "1" });

        expect(mockClient.request).toHaveBeenCalledWith(expect.any(Object), {
          id: "gid://gitlab/WorkItem/1",
        });

        expect(result).toMatchObject({
          id: "1",
          title: "Test Work Item",
          description: "Test description",
        });
      });

      it("should handle non-existent work item in get action", async () => {
        mockClient.request.mockResolvedValueOnce({ workItem: null });

        const tool = workitemsToolRegistry.get("browse_work_items");

        await expect(
          tool?.handler({ action: "get", id: "gid://gitlab/WorkItem/999" })
        ).rejects.toThrow('Work item with ID "gid://gitlab/WorkItem/999" not found');
      });

      it("should validate required id parameter for get action", async () => {
        const tool = workitemsToolRegistry.get("browse_work_items");

        // Missing id should throw validation error
        await expect(tool?.handler({ action: "get" })).rejects.toThrow();
      });
    });

    describe("manage_work_item handler - create action", () => {
      it("should execute create action successfully with valid parameters", async () => {
        const createdWorkItem = {
          id: "gid://gitlab/WorkItem/123",
          title: "New Epic",
          workItemType: { name: "EPIC" },
        };

        mockClient.request.mockResolvedValueOnce({
          workItemCreate: {
            workItem: createdWorkItem,
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        const result = await tool?.handler({
          action: "create",
          namespace: "test-group",
          workItemType: "EPIC",
          title: "New Epic",
        });

        expect(mockClient.request).toHaveBeenCalledTimes(1);

        expect(result).toMatchObject({
          id: "123",
          title: "New Epic",
          workItemType: "EPIC",
        });
      });

      it("should create work item with description", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemCreate: {
            workItem: {
              id: "gid://gitlab/WorkItem/124",
              title: "Epic with Description",
              description: "Detailed description",
              workItemType: { name: "EPIC" },
            },
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        await tool?.handler({
          action: "create",
          namespace: "test-group",
          workItemType: "EPIC",
          title: "Epic with Description",
          description: "Detailed description",
        });

        expect(mockClient.request).toHaveBeenCalledTimes(1);
      });

      it("should create work item with assignees", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemCreate: {
            workItem: {
              id: "gid://gitlab/WorkItem/125",
              title: "Epic with Assignees",
              workItemType: { name: "EPIC" },
            },
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        await tool?.handler({
          action: "create",
          namespace: "test-group",
          workItemType: "EPIC",
          title: "Epic with Assignees",
          assigneeIds: ["1", "2"],
        });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            input: expect.objectContaining({
              assigneesWidget: { assigneeIds: ["gid://gitlab/User/1", "gid://gitlab/User/2"] },
            }),
          })
        );
      });

      it("should create work item with labels", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemCreate: {
            workItem: {
              id: "gid://gitlab/WorkItem/126",
              title: "Epic with Labels",
              workItemType: { name: "EPIC" },
            },
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        await tool?.handler({
          action: "create",
          namespace: "test-group",
          workItemType: "EPIC",
          title: "Epic with Labels",
          labelIds: ["10", "20"],
        });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            input: expect.objectContaining({
              labelsWidget: {
                labelIds: ["gid://gitlab/ProjectLabel/10", "gid://gitlab/ProjectLabel/20"],
              },
            }),
          })
        );
      });

      it("should create work item with milestone", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemCreate: {
            workItem: {
              id: "gid://gitlab/WorkItem/127",
              title: "Epic with Milestone",
              workItemType: { name: "EPIC" },
            },
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        await tool?.handler({
          action: "create",
          namespace: "test-group",
          workItemType: "EPIC",
          title: "Epic with Milestone",
          milestoneId: "5",
        });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            input: expect.objectContaining({
              milestoneWidget: { milestoneId: "gid://gitlab/Milestone/5" },
            }),
          })
        );
      });

      it("should handle invalid work item type in create action", async () => {
        const tool = workitemsToolRegistry.get("manage_work_item");

        await expect(
          tool?.handler({
            action: "create",
            namespace: "test-group",
            workItemType: "INVALID_TYPE",
            title: "Failed Epic",
          })
        ).rejects.toThrow();
      });

      it("should handle work item type not found error", async () => {
        const tool = workitemsToolRegistry.get("manage_work_item");

        // INCIDENT is schema-valid but not in our mocked getWorkItemTypes
        await expect(
          tool?.handler({
            action: "create",
            namespace: "test-group",
            workItemType: "INCIDENT",
            title: "Test Epic",
          })
        ).rejects.toThrow('Work item type "INCIDENT" not found in namespace "test-group"');
      });

      it("should handle GraphQL errors in create action", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemCreate: {
            workItem: null,
            errors: ["Validation failed", "Title is required"],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");

        await expect(
          tool?.handler({
            action: "create",
            namespace: "test-group",
            workItemType: "EPIC",
            title: "",
          })
        ).rejects.toThrow("GitLab GraphQL errors: Validation failed, Title is required");
      });

      it("should handle empty work item creation response", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemCreate: {
            workItem: null,
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");

        await expect(
          tool?.handler({
            action: "create",
            namespace: "test-group",
            workItemType: "EPIC",
            title: "Test Epic",
          })
        ).rejects.toThrow("Work item creation failed - no work item returned");
      });
    });

    describe("manage_work_item handler - update action", () => {
      it("should execute update action successfully with valid parameters", async () => {
        const updatedWorkItem = {
          id: "gid://gitlab/WorkItem/123",
          title: "Updated Epic",
        };

        mockClient.request.mockResolvedValueOnce({
          workItemUpdate: {
            workItem: updatedWorkItem,
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        const result = await tool?.handler({
          action: "update",
          id: "123",
          title: "Updated Epic",
        });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            input: expect.objectContaining({
              id: "gid://gitlab/WorkItem/123",
              title: "Updated Epic",
            }),
          })
        );

        expect(result).toMatchObject({
          id: "123",
          title: "Updated Epic",
        });
      });

      it("should handle update with multiple fields", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemUpdate: {
            workItem: { id: "gid://gitlab/WorkItem/123" },
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        await tool?.handler({
          action: "update",
          id: "gid://gitlab/WorkItem/123",
          title: "Updated Title",
          description: "Updated description",
        });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            input: expect.objectContaining({
              id: "gid://gitlab/WorkItem/123",
              title: "Updated Title",
              descriptionWidget: { description: "Updated description" },
            }),
          })
        );
      });

      it("should handle update with state change", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemUpdate: {
            workItem: { id: "gid://gitlab/WorkItem/123", state: "CLOSED" },
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        await tool?.handler({
          action: "update",
          id: "123",
          state: "CLOSE",
        });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            input: expect.objectContaining({
              id: "gid://gitlab/WorkItem/123",
              stateEvent: "CLOSE",
            }),
          })
        );
      });

      it("should handle update with assignees", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemUpdate: {
            workItem: { id: "gid://gitlab/WorkItem/123" },
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        await tool?.handler({
          action: "update",
          id: "123",
          assigneeIds: ["1", "2"],
        });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            input: expect.objectContaining({
              assigneesWidget: { assigneeIds: ["gid://gitlab/User/1", "gid://gitlab/User/2"] },
            }),
          })
        );
      });

      it("should handle update with labels", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemUpdate: {
            workItem: { id: "gid://gitlab/WorkItem/123" },
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        await tool?.handler({
          action: "update",
          id: "123",
          labelIds: ["10", "20"],
        });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            input: expect.objectContaining({
              labelsWidget: {
                addLabelIds: ["gid://gitlab/ProjectLabel/10", "gid://gitlab/ProjectLabel/20"],
              },
            }),
          })
        );
      });

      it("should handle update with milestone", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemUpdate: {
            workItem: { id: "gid://gitlab/WorkItem/123" },
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        await tool?.handler({
          action: "update",
          id: "123",
          milestoneId: "5",
        });

        expect(mockClient.request).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            input: expect.objectContaining({
              milestoneWidget: { milestoneId: "gid://gitlab/Milestone/5" },
            }),
          })
        );
      });

      it("should handle GraphQL errors in update action", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemUpdate: {
            workItem: null,
            errors: ["Permission denied", "Work item not found"],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");

        await expect(
          tool?.handler({
            action: "update",
            id: "gid://gitlab/WorkItem/999",
            title: "Updated Title",
          })
        ).rejects.toThrow("GitLab GraphQL errors: Permission denied, Work item not found");
      });

      it("should handle empty update response", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemUpdate: {
            workItem: null,
            errors: [],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");

        await expect(
          tool?.handler({
            action: "update",
            id: "gid://gitlab/WorkItem/123",
            title: "Updated Title",
          })
        ).rejects.toThrow("Work item update failed - no work item returned");
      });
    });

    describe("manage_work_item handler - delete action", () => {
      it("should execute delete action successfully with valid work item ID", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemDelete: { errors: [] },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        const result = await tool?.handler({ action: "delete", id: "gid://gitlab/WorkItem/123" });

        expect(mockClient.request).toHaveBeenCalledWith(expect.any(Object), {
          id: "gid://gitlab/WorkItem/123",
        });
        expect(result).toEqual({ deleted: true });
      });

      it("should handle delete with simple ID", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemDelete: { errors: [] },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");
        const result = await tool?.handler({ action: "delete", id: "123" });

        expect(mockClient.request).toHaveBeenCalledWith(expect.any(Object), {
          id: "gid://gitlab/WorkItem/123",
        });
        expect(result).toEqual({ deleted: true });
      });

      it("should handle deletion errors", async () => {
        mockClient.request.mockRejectedValueOnce(new Error("Deletion failed"));

        const tool = workitemsToolRegistry.get("manage_work_item");

        await expect(
          tool?.handler({ action: "delete", id: "gid://gitlab/WorkItem/123" })
        ).rejects.toThrow("Deletion failed");
      });

      it("should handle GraphQL errors in delete action", async () => {
        mockClient.request.mockResolvedValueOnce({
          workItemDelete: {
            errors: ["Permission denied", "Work item cannot be deleted"],
          },
        });

        const tool = workitemsToolRegistry.get("manage_work_item");

        await expect(
          tool?.handler({
            action: "delete",
            id: "gid://gitlab/WorkItem/123",
          })
        ).rejects.toThrow("GitLab GraphQL errors: Permission denied, Work item cannot be deleted");
      });
    });

    describe("Error Handling", () => {
      it("should handle GraphQL client errors gracefully", async () => {
        mockClient.request.mockRejectedValueOnce(new Error("Network error"));

        const tool = workitemsToolRegistry.get("browse_work_items");

        await expect(tool?.handler({ action: "list", namespace: "test-group" })).rejects.toThrow(
          "Network error"
        );
      });

      it("should handle schema validation errors for browse_work_items", async () => {
        const tool = workitemsToolRegistry.get("browse_work_items");

        // Missing required action
        await expect(tool?.handler({})).rejects.toThrow();

        // Invalid action
        await expect(
          tool?.handler({ action: "invalid", namespace: "test-group" })
        ).rejects.toThrow();

        // Missing namespace for list
        await expect(tool?.handler({ action: "list" })).rejects.toThrow();

        // Missing id for get
        await expect(tool?.handler({ action: "get" })).rejects.toThrow();
      });

      it("should handle schema validation errors for manage_work_item", async () => {
        const tool = workitemsToolRegistry.get("manage_work_item");

        // Missing required action
        await expect(tool?.handler({})).rejects.toThrow();

        // Invalid action
        await expect(tool?.handler({ action: "invalid", id: "123" })).rejects.toThrow();

        // Missing namespace for create
        await expect(
          tool?.handler({ action: "create", title: "Test", workItemType: "EPIC" })
        ).rejects.toThrow();

        // Missing id for update
        await expect(tool?.handler({ action: "update", title: "Updated" })).rejects.toThrow();

        // Missing id for delete
        await expect(tool?.handler({ action: "delete" })).rejects.toThrow();
      });
    });
  });
});
