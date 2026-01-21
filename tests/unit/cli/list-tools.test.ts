// Mock registry and console methods at the top
const mockManager = {
  getAllToolDefinitionsTierless: jest.fn(),
  getAllToolDefinitionsUnfiltered: jest.fn(),
};

const mockGetToolRequirement = jest.fn();
const mockGetHighestTier = jest.fn();
const mockGetTierRestrictedActions = jest.fn();
const mockGetActionRequirement = jest.fn();

const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockProcessExit = jest.fn() as unknown as jest.MockedFunction<typeof process.exit>;

jest.mock("../../../src/registry-manager", () => ({
  RegistryManager: {
    getInstance: () => mockManager,
  },
}));

jest.mock("../../../src/services/ToolAvailability", () => ({
  ToolAvailability: {
    getToolRequirement: (name: string, action?: string) => mockGetToolRequirement(name, action),
    getHighestTier: (name: string) => mockGetHighestTier(name),
    getTierRestrictedActions: (name: string, tier: string) =>
      mockGetTierRestrictedActions(name, tier),
    getActionRequirement: (name: string, action?: string) => mockGetActionRequirement(name, action),
  },
}));

// Mock ProfileLoader
const mockProfileLoader = {
  listProfiles: jest.fn(),
  loadPreset: jest.fn(),
  loadProfile: jest.fn(),
  validatePreset: jest.fn(),
  validateProfile: jest.fn(),
};

jest.mock("../../../src/profiles", () => ({
  ProfileLoader: jest.fn().mockImplementation(() => mockProfileLoader),
}));

// Mock console methods
beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(mockConsoleLog);
  jest.spyOn(console, "error").mockImplementation(mockConsoleError);
  jest.spyOn(process, "exit").mockImplementation(mockProcessExit);
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Simple test to achieve coverage of the script
describe("list-tools script", () => {
  let originalArgv: string[];

  beforeEach(() => {
    jest.clearAllMocks();
    originalArgv = process.argv;

    // Reset tier requirement mocks to return defaults
    mockGetToolRequirement.mockReturnValue(null);
    mockGetHighestTier.mockReturnValue("free");
    mockGetTierRestrictedActions.mockReturnValue([]);
    mockGetActionRequirement.mockReturnValue({ tier: "free", minVersion: 8.0 });

    // Reset profile loader mocks
    mockProfileLoader.listProfiles.mockResolvedValue([]);
    mockProfileLoader.loadPreset.mockRejectedValue(new Error("Not found"));
    mockProfileLoader.loadProfile.mockRejectedValue(new Error("Not found"));
    mockProfileLoader.validatePreset.mockResolvedValue({ valid: true, errors: [], warnings: [] });
    mockProfileLoader.validateProfile.mockResolvedValue({ valid: true, errors: [], warnings: [] });

    // Set up default mock return value for both methods
    const defaultTools = [
      {
        name: "test_tool",
        description: "Test tool description",
        inputSchema: { type: "object" },
      },
    ];
    mockManager.getAllToolDefinitionsTierless.mockReturnValue(defaultTools);
    mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue(defaultTools);
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it("should handle simple format output", async () => {
    process.argv = ["node", "list-tools.ts", "--simple"];

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith("test_tool");
  });

  it("should handle json format output", async () => {
    process.argv = ["node", "list-tools.ts", "--json"];

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"name": "test_tool"'));
  });

  it("should handle markdown format output with environment info", async () => {
    process.argv = ["node", "list-tools.ts", "--env"];

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("test_tool"));
  });

  it("should filter tools by entity", async () => {
    process.argv = ["node", "list-tools.ts", "--entity", "core"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "list_projects",
        description: "Core tool description",
        inputSchema: { type: "object" },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockManager.getAllToolDefinitionsTierless).toHaveBeenCalled();
  });

  it("should filter tools by specific tool name", async () => {
    process.argv = ["node", "list-tools.ts", "--tool", "specific_tool"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "specific_tool",
        description: "Specific tool description",
        inputSchema: { type: "object" },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockManager.getAllToolDefinitionsTierless).toHaveBeenCalled();
  });

  it("should handle environment variables for filtering", async () => {
    process.env.GITLAB_READ_ONLY_MODE = "true";

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockManager.getAllToolDefinitionsTierless).toHaveBeenCalled();

    delete process.env.GITLAB_READ_ONLY_MODE;
  });

  it("should handle errors gracefully", async () => {
    process.argv = ["node", "list-tools.ts"];

    mockManager.getAllToolDefinitionsTierless.mockImplementation(() => {
      throw new Error("Test error");
    });

    const { main } = await import("../../../src/cli/list-tools");

    // The main function should throw the error, not catch it
    await expect(main()).rejects.toThrow("Test error");

    // The error logging and exit happen in the script execution wrapper,
    // not in the main function itself
    expect(mockManager.getAllToolDefinitionsTierless).toHaveBeenCalled();
  });

  it("should handle complex schema types", async () => {
    process.argv = ["node", "list-tools.ts"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "complex_tool",
        description: "Complex tool with various schema types",
        inputSchema: {
          type: "object",
          properties: {
            stringParam: { type: "string", description: "String parameter" },
            numberParam: { type: "number", description: "Number parameter" },
            arrayParam: {
              type: "array",
              items: { type: "string" },
              description: "Array parameter",
            },
            enumParam: {
              type: "string",
              enum: ["option1", "option2"],
              description: "Enum parameter",
            },
            refParam: {
              $ref: "#/definitions/SomeType",
              description: "Reference parameter",
            },
            objectParam: {
              type: "object",
              properties: {
                nested: { type: "string" },
              },
              description: "Object parameter",
            },
          },
          required: ["stringParam"],
        },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("complex_tool"));
  });

  it("should handle help flag", async () => {
    process.argv = ["node", "list-tools.ts", "--help"];

    const { main } = await import("../../../src/cli/list-tools");

    // Help should exit the process
    await expect(main()).resolves.toBeUndefined();
    expect(mockProcessExit).toHaveBeenCalledWith(0);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("GitLab MCP Tool Lister"));
  });

  it("should handle -h flag", async () => {
    process.argv = ["node", "list-tools.ts", "-h"];

    const { main } = await import("../../../src/cli/list-tools");

    await expect(main()).resolves.toBeUndefined();
    expect(mockProcessExit).toHaveBeenCalledWith(0);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Usage: yarn list-tools"));
  });

  it("should handle verbose flag", async () => {
    process.argv = ["node", "list-tools.ts", "--verbose"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "verbose_tool",
        description: "Tool for verbose testing",
        inputSchema: {
          type: "object",
          properties: {
            param1: { type: "string", description: "First parameter" },
          },
          required: ["param1"],
        },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("verbose_tool"));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("**Parameters**:"));
  });

  it("should handle verbose flag with no parameters", async () => {
    // This test covers the "(no parameters)" branch in verbose mode (line 953)
    process.argv = ["node", "list-tools.ts", "--verbose"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "no_params_verbose_tool",
        description: "Tool with empty schema for verbose testing",
        inputSchema: {
          type: "object",
          // No properties defined
        },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("no_params_verbose_tool"));
    expect(mockConsoleLog).toHaveBeenCalledWith("  (no parameters)");
  });

  it("should display tier info badges for premium/ultimate tools", async () => {
    // This test covers lines 226-232 - getToolTierInfo with tier requirements
    process.argv = ["node", "list-tools.ts", "--verbose"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "premium_tool",
        description: "Tool that requires premium tier",
        inputSchema: { type: "object" },
      },
      {
        name: "ultimate_tool",
        description: "Tool that requires ultimate tier",
        inputSchema: { type: "object" },
      },
      {
        name: "free_tool",
        description: "Tool that requires free tier",
        inputSchema: { type: "object" },
      },
    ]);

    // Mock tier requirements for different tools
    mockGetToolRequirement.mockImplementation((name: string) => {
      if (name === "premium_tool") {
        return { requiredTier: "premium", minVersion: 10.0 };
      }
      if (name === "ultimate_tool") {
        return { requiredTier: "ultimate", minVersion: 12.0 };
      }
      if (name === "free_tool") {
        return { requiredTier: "free", minVersion: 8.0 };
      }
      return null;
    });

    // Mock getHighestTier for tool-level tier display
    mockGetHighestTier.mockImplementation((name: string) => {
      if (name === "premium_tool") return "premium";
      if (name === "ultimate_tool") return "ultimate";
      return "free";
    });

    // Mock getActionRequirement for default tier check (used in mixed tier detection)
    mockGetActionRequirement.mockImplementation((name: string) => {
      if (name === "premium_tool") return { tier: "premium", minVersion: 10.0 };
      if (name === "ultimate_tool") return { tier: "ultimate", minVersion: 12.0 };
      return { tier: "free", minVersion: 8.0 };
    });

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    // Verify tier badges are displayed
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("[tier: Premium]"));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("[tier: Ultimate]"));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("[tier: Free]"));
  });

  it("should handle detail flag", async () => {
    process.argv = ["node", "list-tools.ts", "--detail"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "detail_tool",
        description: "Tool for detail testing",
        inputSchema: {
          type: "object",
          properties: {
            detailParam: { type: "string", description: "Detail parameter" },
          },
        },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("detail_tool"));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("**Parameters**:"));
  });

  it("should handle unknown entity error", async () => {
    process.argv = ["node", "list-tools.ts", "--entity", "nonexistent"];

    const { main } = await import("../../../src/cli/list-tools");

    await expect(main()).resolves.toBeUndefined();
    expect(mockConsoleError).toHaveBeenCalledWith("No tools found for entity: nonexistent");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("should handle unknown tool error", async () => {
    process.argv = ["node", "list-tools.ts", "--tool", "nonexistent_tool"];

    const { main } = await import("../../../src/cli/list-tools");

    await expect(main()).resolves.toBeUndefined();
    expect(mockConsoleError).toHaveBeenCalledWith("Tool not found: nonexistent_tool");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("should error when --entity flag has no value", async () => {
    // --entity is the last argument with no value following it
    process.argv = ["node", "list-tools.ts", "--entity"];

    const { main } = await import("../../../src/cli/list-tools");

    await expect(main()).resolves.toBeUndefined();
    expect(mockConsoleError).toHaveBeenCalledWith("Error: --entity flag requires a value.");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("should error when --tool flag has no value", async () => {
    // --tool is the last argument with no value following it
    process.argv = ["node", "list-tools.ts", "--tool"];

    const { main } = await import("../../../src/cli/list-tools");

    await expect(main()).resolves.toBeUndefined();
    expect(mockConsoleError).toHaveBeenCalledWith("Error: --tool flag requires a value.");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("should error on unrecognized flags", async () => {
    // Test that unknown flags are rejected with helpful error message
    process.argv = ["node", "list-tools.ts", "--unknown-flag"];

    const { main } = await import("../../../src/cli/list-tools");

    await expect(main()).resolves.toBeUndefined();
    expect(mockConsoleError).toHaveBeenCalledWith("Error: Unrecognized option '--unknown-flag'.");
    expect(mockConsoleError).toHaveBeenCalledWith("Use '--help' to see available options.");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("should handle tools with no parameters", async () => {
    process.argv = ["node", "list-tools.ts", "--tool", "no_params_tool"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "no_params_tool",
        description: "Tool with no parameters",
        inputSchema: {
          type: "object",
        },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith("(no parameters)");
  });

  it("should handle schema with oneOf type", async () => {
    process.argv = ["node", "list-tools.ts", "--tool", "oneof_tool"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "oneof_tool",
        description: "Tool with oneOf schema",
        inputSchema: {
          type: "object",
          properties: {
            unionParam: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Union parameter",
            },
          },
        },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("string | number"));
  });

  it("should handle schema with anyOf type", async () => {
    process.argv = ["node", "list-tools.ts", "--tool", "anyof_tool"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "anyof_tool",
        description: "Tool with anyOf schema",
        inputSchema: {
          type: "object",
          properties: {
            anyParam: {
              anyOf: [{ type: "string" }, { type: "boolean" }],
              description: "Any parameter",
            },
          },
        },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("string | boolean"));
  });

  it("should handle schema with $ref type", async () => {
    process.argv = ["node", "list-tools.ts", "--tool", "ref_tool"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "ref_tool",
        description: "Tool with $ref schema",
        inputSchema: {
          type: "object",
          properties: {
            refParam: {
              $ref: "#/properties/SomeType",
              description: "Reference parameter",
            },
            SomeType: {
              type: "string",
              description: "The referenced type",
            },
          },
        },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("ref_tool"));
  });

  it("should handle unresolved $ref returning 'reference' type", async () => {
    // This test covers line 152 - unresolved $ref fallback
    process.argv = ["node", "list-tools.ts", "--tool", "unresolved_ref_tool"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "unresolved_ref_tool",
        description: "Tool with unresolved $ref",
        inputSchema: {
          type: "object",
          properties: {
            unresolvedParam: {
              $ref: "#/properties/NonExistentType",
              description: "Unresolved reference parameter",
            },
            // NonExistentType is NOT defined, so $ref won't resolve
          },
        },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    // Should show "reference" as the type since it can't be resolved
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("reference"));
  });

  it("should handle schema with enum-only type (no explicit type)", async () => {
    process.argv = ["node", "list-tools.ts", "--tool", "enum_tool"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "enum_tool",
        description: "Tool with enum-only schema",
        inputSchema: {
          type: "object",
          properties: {
            enumParam: {
              enum: ["value1", "value2", "value3"],
              description: "Enum without type",
            },
          },
        },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("enum_tool"));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("enum"));
  });

  it("should handle schema with array type items", async () => {
    process.argv = ["node", "list-tools.ts", "--tool", "array_tool"];

    mockManager.getAllToolDefinitionsTierless.mockReturnValue([
      {
        name: "array_tool",
        description: "Tool with array schema",
        inputSchema: {
          type: "object",
          properties: {
            arrayParam: {
              type: "array",
              items: { type: "string" },
              description: "Array of strings",
            },
          },
        },
      },
    ]);

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("array_tool"));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("string[]"));
  });

  it("should show environment info with env flag", async () => {
    process.argv = ["node", "list-tools.ts", "--env"];

    const originalEnv = process.env.GITLAB_READONLY;
    process.env.GITLAB_READONLY = "true";

    const { main } = await import("../../../src/cli/list-tools");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith("=== Environment Configuration ===\n");
    expect(mockConsoleLog).toHaveBeenCalledWith("GITLAB_READONLY: true");

    // Restore environment
    if (originalEnv !== undefined) {
      process.env.GITLAB_READONLY = originalEnv;
    } else {
      delete process.env.GITLAB_READONLY;
    }
  });

  describe("--export mode", () => {
    beforeEach(() => {
      // Set up mock for export mode (uses getAllToolDefinitionsUnfiltered)
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "browse_test",
          description: "Test CQRS browse tool",
          inputSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            oneOf: [
              {
                type: "object",
                properties: {
                  action: { type: "string", const: "list", description: "List items" },
                  page: { type: "integer", description: "Page number" },
                },
                required: ["action"],
              },
              {
                type: "object",
                properties: {
                  action: { type: "string", const: "get", description: "Get single item" },
                  id: { type: "string", description: "Item ID" },
                },
                required: ["action", "id"],
              },
            ],
          },
        },
      ]);
    });

    it("should generate markdown documentation with --export", async () => {
      process.argv = ["node", "list-tools.ts", "--export"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      // Check header
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("# GitLab MCP Tools Reference")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Auto-generated from source code")
      );
    });

    it("should extract actions from oneOf schema", async () => {
      process.argv = ["node", "list-tools.ts", "--export"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      // Check actions table (now includes Tier column)
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("#### Actions"));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("| `list` | Free | List items |")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("| `get` | Free | Get single item |")
      );
    });

    it("should extract parameters grouped by action", async () => {
      process.argv = ["node", "list-tools.ts", "--export"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      // Check parameters section with grouped format
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("#### Parameters"));
      // Action-specific parameters are grouped under their action
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("**Action `get`**:"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("| `id` |"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("**Action `list`**:"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("| `page` |"));
    });

    it("should include table of contents with --toc", async () => {
      process.argv = ["node", "list-tools.ts", "--export", "--toc"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("## Table of Contents"));
    });

    it("should skip examples with --no-examples", async () => {
      process.argv = ["node", "list-tools.ts", "--export", "--no-examples"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      // Should not contain example JSON block
      const allCalls = mockConsoleLog.mock.calls.flat().join("\n");
      expect(allCalls).not.toContain("#### Example");
    });

    it("should handle flat schema fallback", async () => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "flat_tool",
          description: "Tool with flat schema",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["create", "delete"],
                description: "Action to perform",
              },
              name: { type: "string", description: "Item name" },
            },
            required: ["action", "name"],
          },
        },
      ]);

      process.argv = ["node", "list-tools.ts", "--export"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      // Should use ACTION_DESCRIPTIONS fallback for flat schema
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("| `create` |"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("| `delete` |"));
    });

    it("should generate examples with various parameter naming patterns", async () => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "example_tool",
          description: "Tool with various parameter names",
          inputSchema: {
            type: "object",
            properties: {
              action: { type: "string", const: "test", description: "Test action" },
              project_id: { type: "string", description: "Project ID" },
              group_id: { type: "string", description: "Group ID" },
              namespace: { type: "string", description: "Namespace" },
              merge_request_iid: { type: "string", description: "MR IID" },
              user_id: { type: "string", description: "User ID" },
              title: { type: "string", description: "Title" },
              description: { type: "string", description: "Description" },
              url: { type: "string", description: "URL" },
              content: { type: "string", description: "Content" },
              file_path: { type: "string", description: "File path" },
              ref: { type: "string", description: "Git ref" },
              from: { type: "string", description: "From ref" },
              to: { type: "string", description: "To ref" },
              enabled: { type: "boolean", description: "Enabled flag" },
              count: { type: "integer", description: "Count" },
              items: { type: "array", description: "Items list" },
            },
            required: ["action"],
          },
        },
      ]);

      process.argv = ["node", "list-tools.ts", "--export"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      // Verify example was generated (includes various parameter patterns)
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("example_tool"));
    });

    it("should generate examples with ALL required parameter patterns", async () => {
      // This test covers lines 647-677 - example value generation for required params
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "all_required_patterns_tool",
          description: "Tool with all required parameter naming patterns",
          inputSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            oneOf: [
              {
                type: "object",
                properties: {
                  action: { type: "string", const: "create", description: "Create item" },
                  // Line 647: enum
                  status: { type: "string", enum: ["active", "inactive"], description: "Status" },
                  // Line 649: project_id
                  project_id: { type: "string", description: "Project ID" },
                  // Line 651: group_id
                  group_id: { type: "string", description: "Group ID" },
                  // Line 653: namespace
                  namespace: { type: "string", description: "Namespace" },
                  // Line 655: _iid
                  merge_request_iid: { type: "string", description: "MR IID" },
                  // Line 657: _id
                  user_id: { type: "string", description: "User ID" },
                  // Line 659: title
                  title: { type: "string", description: "Title" },
                  // Line 661: description
                  description: { type: "string", description: "Description" },
                  // Line 663: url
                  url: { type: "string", description: "URL" },
                  // Line 665: content
                  content: { type: "string", description: "Content" },
                  // Line 667: file_path
                  file_path: { type: "string", description: "File path" },
                  // Line 669: ref
                  ref: { type: "string", description: "Git ref" },
                  // Line 671: from/to
                  from: { type: "string", description: "From ref" },
                  to: { type: "string", description: "To ref" },
                  // Line 673: boolean
                  enabled: { type: "boolean", description: "Enabled" },
                  // Line 675: integer
                  count: { type: "integer", description: "Count" },
                  // Line 677: array
                  items: { type: "array", description: "Items" },
                },
                // Mark ALL params as required to exercise all example generation paths
                required: [
                  "action",
                  "status",
                  "project_id",
                  "group_id",
                  "namespace",
                  "merge_request_iid",
                  "user_id",
                  "title",
                  "description",
                  "url",
                  "content",
                  "file_path",
                  "ref",
                  "from",
                  "to",
                  "enabled",
                  "count",
                  "items",
                ],
              },
            ],
          },
        },
      ]);

      process.argv = ["node", "list-tools.ts", "--export"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      const allOutput = mockConsoleLog.mock.calls.flat().join("\n");

      // Verify example values are generated correctly for each pattern
      expect(allOutput).toContain('"status": "active"'); // enum first value
      expect(allOutput).toContain('"project_id": "my-group/my-project"');
      expect(allOutput).toContain('"group_id": "my-group"');
      expect(allOutput).toContain('"namespace": "my-group/my-project"');
      expect(allOutput).toContain('"merge_request_iid": "1"');
      expect(allOutput).toContain('"user_id": "123"');
      expect(allOutput).toContain('"title": "Example title"');
      expect(allOutput).toContain('"description": "Example description"');
      expect(allOutput).toContain('"url": "https://example.com/webhook"');
      expect(allOutput).toContain('"content": "File content here"');
      expect(allOutput).toContain('"file_path": "path/to/file.txt"');
      expect(allOutput).toContain('"ref": "main"');
      expect(allOutput).toContain('"from": "main"');
      expect(allOutput).toContain('"to": "feature-branch"');
      expect(allOutput).toContain('"enabled": true');
      expect(allOutput).toContain('"count": 10');
      expect(allOutput).toContain('"items": []');
    });

    it("should handle tool with unknown schema type", async () => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "unknown_type_tool",
          description: "Tool with unknown schema type",
          inputSchema: {
            type: "object",
            properties: {
              action: { type: "string", const: "test", description: "Test" },
              unknownParam: {
                // No type, no enum, no oneOf/anyOf - should return "unknown"
                description: "Unknown type parameter",
              },
            },
            required: ["action"],
          },
        },
      ]);

      process.argv = ["node", "list-tools.ts", "--export"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("unknown_type_tool"));
    });

    it("should show 'Common (all actions)' header when both common and action-specific params exist", async () => {
      // This test covers lines 795-796, 559, 569-570, 599-601
      // Common params appear in ALL actions, action-specific in some
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "mixed_params_tool",
          description: "Tool with both common and action-specific parameters",
          inputSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            oneOf: [
              {
                type: "object",
                properties: {
                  action: { type: "string", const: "list", description: "List items" },
                  // Common param - appears in all actions
                  project_id: { type: "string", description: "Project ID" },
                  // Action-specific - only in list
                  page: { type: "integer", description: "Page number" },
                  // Required action-specific
                  filter: { type: "string", description: "Filter query" },
                },
                required: ["action", "project_id", "filter"],
              },
              {
                type: "object",
                properties: {
                  action: { type: "string", const: "get", description: "Get single item" },
                  // Common param - same in all actions
                  project_id: { type: "string", description: "Project identifier for lookup" }, // Longer description
                  // Action-specific - only in get
                  id: { type: "string", description: "Item ID" },
                },
                required: ["action", "project_id", "id"],
              },
            ],
          },
        },
      ]);

      process.argv = ["node", "list-tools.ts", "--export"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      // Should show "Common (all actions)" header when there are both common and action-specific
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("**Common** (all actions):")
      );
      // Common param should use the longer description from the "get" action
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Project identifier for lookup")
      );
      // Action-specific sections
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("**Action `list`**:"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("**Action `get`**:"));
    });

    it("should sort action-specific params with required first", async () => {
      // This test covers lines 599-601 - sorting by requiredForAction
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "sorted_params_tool",
          description: "Tool with params that need sorting",
          inputSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            oneOf: [
              {
                type: "object",
                properties: {
                  action: { type: "string", const: "create", description: "Create item" },
                  // z_optional comes before a_required alphabetically, but required should be first
                  z_optional: { type: "string", description: "Optional param Z" },
                  a_required: { type: "string", description: "Required param A" },
                  m_optional: { type: "string", description: "Optional param M" },
                },
                required: ["action", "a_required"],
              },
            ],
          },
        },
      ]);

      process.argv = ["node", "list-tools.ts", "--export"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      const allCalls = mockConsoleLog.mock.calls.flat().join("\n");
      // a_required should appear before z_optional and m_optional
      const aRequiredPos = allCalls.indexOf("`a_required`");
      const zOptionalPos = allCalls.indexOf("`z_optional`");
      const mOptionalPos = allCalls.indexOf("`m_optional`");

      expect(aRequiredPos).toBeGreaterThan(-1);
      expect(zOptionalPos).toBeGreaterThan(-1);
      expect(aRequiredPos).toBeLessThan(zOptionalPos);
      expect(aRequiredPos).toBeLessThan(mOptionalPos);
    });
  });

  describe("--env-gates flag", () => {
    it("should output env gates in markdown format", async () => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "browse_labels",
          description: "Browse labels",
          inputSchema: { type: "object" },
          gate: { envVar: "USE_LABELS", defaultValue: true },
        },
        {
          name: "manage_label",
          description: "Manage labels",
          inputSchema: { type: "object" },
          gate: { envVar: "USE_LABELS", defaultValue: true },
        },
        {
          name: "browse_wiki",
          description: "Browse wiki",
          inputSchema: { type: "object" },
          gate: { envVar: "USE_GITLAB_WIKI", defaultValue: true },
        },
        {
          name: "browse_projects",
          description: "Core tool without gate",
          inputSchema: { type: "object" },
          // No gate - always enabled
        },
      ]);

      process.argv = ["node", "list-tools.ts", "--env-gates"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      const allCalls = mockConsoleLog.mock.calls.flat().join("\n");

      // Check header
      expect(allCalls).toContain("# Environment Variable Gates");
      // Check table structure
      expect(allCalls).toContain("| Variable | Default | Tools Controlled |");
      // Check gates
      expect(allCalls).toContain("`USE_LABELS`");
      expect(allCalls).toContain("`browse_labels`");
      expect(allCalls).toContain("`manage_label`");
      expect(allCalls).toContain("`USE_GITLAB_WIKI`");
      expect(allCalls).toContain("`browse_wiki`");
      // Check ungated tools
      expect(allCalls).toContain("*(none - always on)*");
      expect(allCalls).toContain("`browse_projects`");
    });

    it("should output env gates in JSON format", async () => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "browse_labels",
          description: "Browse labels",
          inputSchema: { type: "object" },
          gate: { envVar: "USE_LABELS", defaultValue: true },
        },
        {
          name: "browse_projects",
          description: "Core tool",
          inputSchema: { type: "object" },
        },
      ]);

      process.argv = ["node", "list-tools.ts", "--env-gates", "--json"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      // Find the JSON output call
      const jsonCall = mockConsoleLog.mock.calls.find(call => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.gates !== undefined;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0] as string);

      expect(output.gates).toBeDefined();
      expect(output.gates).toHaveLength(1);
      expect(output.gates[0].envVar).toBe("USE_LABELS");
      expect(output.gates[0].defaultValue).toBe(true);
      expect(output.gates[0].tools).toContain("browse_labels");

      expect(output.ungated).toBeDefined();
      expect(output.ungated.tools).toContain("browse_projects");
    });

    it("should group multiple tools under the same env var", async () => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "browse_merge_requests",
          description: "Browse MRs",
          inputSchema: { type: "object" },
          gate: { envVar: "USE_MRS", defaultValue: true },
        },
        {
          name: "manage_merge_request",
          description: "Manage MR",
          inputSchema: { type: "object" },
          gate: { envVar: "USE_MRS", defaultValue: true },
        },
        {
          name: "browse_mr_discussions",
          description: "Browse discussions",
          inputSchema: { type: "object" },
          gate: { envVar: "USE_MRS", defaultValue: true },
        },
      ]);

      process.argv = ["node", "list-tools.ts", "--env-gates", "--json"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      const jsonCall = mockConsoleLog.mock.calls.find(call => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.gates !== undefined;
        } catch {
          return false;
        }
      });

      const output = JSON.parse(jsonCall![0] as string);
      const mrsGate = output.gates.find((g: { envVar: string }) => g.envVar === "USE_MRS");

      expect(mrsGate).toBeDefined();
      expect(mrsGate.tools).toHaveLength(3);
      expect(mrsGate.tools).toContain("browse_merge_requests");
      expect(mrsGate.tools).toContain("manage_merge_request");
      expect(mrsGate.tools).toContain("browse_mr_discussions");
    });
  });

  describe("--presets flag", () => {
    beforeEach(() => {
      // Setup mock tools for preset testing
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "browse_projects",
          description: "Browse projects",
          inputSchema: { type: "object" },
        },
        { name: "manage_files", description: "Manage files", inputSchema: { type: "object" } },
        { name: "browse_wiki", description: "Browse wiki", inputSchema: { type: "object" } },
        { name: "manage_wiki", description: "Manage wiki", inputSchema: { type: "object" } },
      ]);

      // Setup mock presets
      mockProfileLoader.listProfiles.mockResolvedValue([
        {
          name: "admin",
          readOnly: false,
          isBuiltIn: true,
          isPreset: true,
          description: "Full admin access",
        },
        {
          name: "readonly",
          readOnly: true,
          isBuiltIn: true,
          isPreset: true,
          description: "Read-only access",
        },
      ]);

      mockProfileLoader.loadPreset.mockImplementation(async (name: string) => {
        if (name === "admin") {
          return { description: "Full admin access", read_only: false };
        }
        if (name === "readonly") {
          return { description: "Read-only access", read_only: true };
        }
        throw new Error(`Preset '${name}' not found`);
      });
    });

    it("should list all presets in markdown format", async () => {
      process.argv = ["node", "list-tools.ts", "--presets"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("# Available Presets"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("## Built-in Presets"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("`admin`"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("`readonly`"));
    });

    it("should list all presets in JSON format", async () => {
      process.argv = ["node", "list-tools.ts", "--presets", "--json"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      const jsonCall = mockConsoleLog.mock.calls.find(call => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.builtIn !== undefined;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0] as string);
      expect(output.builtIn).toHaveLength(2);
      expect(output.builtIn[0].name).toBe("admin");
    });

    it("should count tools correctly for read_only preset", async () => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        { name: "browse_projects", description: "Browse", inputSchema: { type: "object" } },
        { name: "manage_files", description: "Manage", inputSchema: { type: "object" } },
      ]);

      mockProfileLoader.listProfiles.mockResolvedValue([
        {
          name: "readonly",
          readOnly: true,
          isBuiltIn: true,
          isPreset: true,
          description: "Read-only",
        },
      ]);
      mockProfileLoader.loadPreset.mockResolvedValue({ description: "Read-only", read_only: true });

      process.argv = ["node", "list-tools.ts", "--presets"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      // read_only should filter out manage_* tools, leaving only 1 tool
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("| 1 |"));
    });

    it("should count tools correctly for preset with denied_tools_regex", async () => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        { name: "browse_projects", description: "Browse", inputSchema: { type: "object" } },
        { name: "browse_wiki", description: "Wiki", inputSchema: { type: "object" } },
      ]);

      mockProfileLoader.listProfiles.mockResolvedValue([
        {
          name: "no-wiki",
          readOnly: false,
          isBuiltIn: true,
          isPreset: true,
          description: "No wiki",
        },
      ]);
      mockProfileLoader.loadPreset.mockResolvedValue({
        description: "No wiki",
        read_only: false,
        denied_tools_regex: "wiki",
      });

      process.argv = ["node", "list-tools.ts", "--presets"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      // denied_tools_regex should filter out wiki tools, leaving only 1 tool
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("| 1 |"));
    });

    it("should count tools correctly for preset with allowed_tools whitelist", async () => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        { name: "browse_projects", description: "Browse", inputSchema: { type: "object" } },
        { name: "browse_wiki", description: "Wiki", inputSchema: { type: "object" } },
        { name: "manage_files", description: "Files", inputSchema: { type: "object" } },
      ]);

      mockProfileLoader.listProfiles.mockResolvedValue([
        {
          name: "minimal",
          readOnly: false,
          isBuiltIn: true,
          isPreset: true,
          description: "Minimal",
        },
      ]);
      mockProfileLoader.loadPreset.mockResolvedValue({
        description: "Minimal",
        read_only: false,
        allowed_tools: ["browse_projects"],
      });

      process.argv = ["node", "list-tools.ts", "--presets"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      // allowed_tools whitelist should keep only specified tools
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("| 1 |"));
    });

    it("should count tools correctly for preset with feature flags", async () => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        { name: "browse_projects", description: "Browse", inputSchema: { type: "object" } },
        { name: "browse_wiki", description: "Wiki", inputSchema: { type: "object" } },
        { name: "manage_wiki", description: "Manage wiki", inputSchema: { type: "object" } },
      ]);

      mockProfileLoader.listProfiles.mockResolvedValue([
        {
          name: "no-wiki",
          readOnly: false,
          isBuiltIn: true,
          isPreset: true,
          description: "No wiki",
        },
      ]);
      mockProfileLoader.loadPreset.mockResolvedValue({
        description: "No wiki",
        read_only: false,
        features: { wiki: false },
      });

      process.argv = ["node", "list-tools.ts", "--presets"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      // features.wiki: false should filter out wiki tools
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("| 1 |"));
    });

    it("should warn when preset has invalid denied_tools_regex", async () => {
      const mockConsoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        { name: "browse_projects", description: "Browse", inputSchema: { type: "object" } },
      ]);

      mockProfileLoader.listProfiles.mockResolvedValue([
        {
          name: "invalid-regex",
          readOnly: false,
          isBuiltIn: true,
          isPreset: true,
          description: "Invalid regex",
        },
      ]);
      mockProfileLoader.loadPreset.mockResolvedValue({
        description: "Invalid regex",
        read_only: false,
        denied_tools_regex: "[invalid(regex",
      });

      process.argv = ["node", "list-tools.ts", "--presets"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: invalid denied_tools_regex "[invalid(regex"')
      );

      mockConsoleWarn.mockRestore();
    });

    it("should show user profiles count when defined", async () => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        { name: "browse_projects", description: "Browse", inputSchema: { type: "object" } },
      ]);

      mockProfileLoader.listProfiles.mockResolvedValue([
        { name: "admin", readOnly: false, isBuiltIn: true, isPreset: true, description: "Admin" },
        {
          name: "work",
          host: "gitlab.example.com",
          authType: "pat",
          readOnly: false,
          isBuiltIn: false,
          isPreset: false,
        },
      ]);
      mockProfileLoader.loadPreset.mockResolvedValue({ description: "Admin", read_only: false });

      process.argv = ["node", "list-tools.ts", "--presets"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("## User Profiles"));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("1 user profile(s) defined")
      );
    });
  });

  describe("--profiles flag", () => {
    beforeEach(() => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "browse_projects",
          description: "Browse projects",
          inputSchema: { type: "object" },
        },
      ]);
    });

    it("should show empty profiles message when none defined", async () => {
      mockProfileLoader.listProfiles.mockResolvedValue([]);

      process.argv = ["node", "list-tools.ts", "--profiles"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("# User Profiles\n");
      expect(mockConsoleLog).toHaveBeenCalledWith("No user profiles defined.\n");
    });

    it("should list user profiles when defined", async () => {
      mockProfileLoader.listProfiles.mockResolvedValue([
        {
          name: "work",
          host: "gitlab.company.com",
          authType: "pat",
          readOnly: false,
          isBuiltIn: false,
          isPreset: false,
        },
      ]);

      process.argv = ["node", "list-tools.ts", "--profiles"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("# User Profiles\n");
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("`work`"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("gitlab.company.com"));
    });

    it("should list profiles in JSON format", async () => {
      mockProfileLoader.listProfiles.mockResolvedValue([
        {
          name: "work",
          host: "gitlab.company.com",
          authType: "pat",
          readOnly: false,
          isBuiltIn: false,
          isPreset: false,
        },
      ]);

      process.argv = ["node", "list-tools.ts", "--profiles", "--json"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      const jsonCall = mockConsoleLog.mock.calls.find(call => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return Array.isArray(parsed) && parsed.length > 0 && parsed[0].name === "work";
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
    });
  });

  describe("--preset <name> flag", () => {
    beforeEach(() => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "browse_projects",
          description: "Browse projects",
          inputSchema: { type: "object" },
        },
        { name: "manage_files", description: "Manage files", inputSchema: { type: "object" } },
        { name: "browse_wiki", description: "Browse wiki", inputSchema: { type: "object" } },
        { name: "manage_wiki", description: "Manage wiki", inputSchema: { type: "object" } },
        {
          name: "browse_pipelines",
          description: "Browse pipelines",
          inputSchema: { type: "object" },
        },
        {
          name: "manage_pipeline",
          description: "Manage pipeline",
          inputSchema: { type: "object" },
        },
      ]);
    });

    it("should show preset details", async () => {
      mockProfileLoader.loadPreset.mockResolvedValue({
        description: "Junior Developer preset",
        read_only: false,
        features: { wiki: false, pipelines: false },
        denied_tools_regex: "^manage_pipeline",
      });

      process.argv = ["node", "list-tools.ts", "--preset", "junior-dev"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("# Preset: junior-dev\n");
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("**Type:** Built-in"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("## Features"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("## Enabled Tools"));
    });

    it("should show preset details in JSON format", async () => {
      mockProfileLoader.loadPreset.mockResolvedValue({
        description: "Test preset",
        read_only: false,
        features: { wiki: true },
      });

      process.argv = ["node", "list-tools.ts", "--preset", "test", "--json"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      const jsonCall = mockConsoleLog.mock.calls.find(call => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.name === "test" && parsed.type === "builtin";
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
    });

    it("should error when preset not found", async () => {
      mockProfileLoader.loadPreset.mockRejectedValue(new Error("Preset not found"));

      process.argv = ["node", "list-tools.ts", "--preset", "nonexistent"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleError).toHaveBeenCalledWith("Error: Preset 'nonexistent' not found");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should validate preset with --validate flag", async () => {
      mockProfileLoader.loadPreset.mockResolvedValue({
        description: "Test preset",
        read_only: false,
      });
      mockProfileLoader.validatePreset.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });

      process.argv = ["node", "list-tools.ts", "--preset", "test", "--validate"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("## Validation\n");
      expect(mockConsoleLog).toHaveBeenCalledWith("**Status: VALID**\n");
    });

    it("should show validation warnings", async () => {
      mockProfileLoader.loadPreset.mockResolvedValue({
        description: "Test preset",
        read_only: false,
      });
      mockProfileLoader.validatePreset.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: ["Some warning"],
      });

      process.argv = ["node", "list-tools.ts", "--preset", "test", "--validate"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("VALID"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("1 warning"));
    });

    it("should show validation errors", async () => {
      mockProfileLoader.loadPreset.mockResolvedValue({
        description: "Test preset",
        read_only: false,
      });
      mockProfileLoader.validatePreset.mockResolvedValue({
        valid: false,
        errors: ["Invalid regex"],
        warnings: [],
      });

      process.argv = ["node", "list-tools.ts", "--preset", "test", "--validate"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("INVALID"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Invalid regex"));
    });

    it("should warn when showing preset details with invalid denied_tools_regex", async () => {
      const mockConsoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

      mockProfileLoader.loadPreset.mockResolvedValue({
        description: "Test preset with invalid regex",
        read_only: false,
        denied_tools_regex: "(unclosed[group",
      });

      process.argv = ["node", "list-tools.ts", "--preset", "test"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: invalid denied_tools_regex "(unclosed[group"')
      );

      mockConsoleWarn.mockRestore();
    });

    it("should error when --preset flag has no value", async () => {
      process.argv = ["node", "list-tools.ts", "--preset"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleError).toHaveBeenCalledWith("Error: --preset flag requires a value.");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("--profile <name> flag", () => {
    beforeEach(() => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "browse_projects",
          description: "Browse projects",
          inputSchema: { type: "object" },
        },
      ]);
    });

    it("should show profile details", async () => {
      mockProfileLoader.loadProfile.mockResolvedValue({
        host: "gitlab.company.com",
        auth: { type: "pat", token_env: "GITLAB_TOKEN" },
        read_only: false,
      });

      process.argv = ["node", "list-tools.ts", "--profile", "work"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("# Profile: work\n");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("**Host:** gitlab.company.com")
      );
    });

    it("should error when profile not found", async () => {
      mockProfileLoader.loadProfile.mockRejectedValue(new Error("Profile not found"));

      process.argv = ["node", "list-tools.ts", "--profile", "nonexistent"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleError).toHaveBeenCalledWith("Error: Profile 'nonexistent' not found");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should error when --profile flag has no value", async () => {
      process.argv = ["node", "list-tools.ts", "--profile"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleError).toHaveBeenCalledWith("Error: --profile flag requires a value.");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should show profile details in JSON format", async () => {
      mockProfileLoader.loadProfile.mockResolvedValue({
        host: "gitlab.company.com",
        auth: { type: "pat", token_env: "GITLAB_TOKEN" },
        read_only: true,
        features: { wiki: true },
        denied_tools_regex: "^manage_",
        allowed_tools: ["browse_projects"],
        denied_actions: ["delete"],
        allowed_projects: ["mygroup/myproject"],
        allowed_groups: ["mygroup"],
        default_project: "default-project",
        default_namespace: "default-namespace",
        timeout_ms: 30000,
        skip_tls_verify: true,
      });

      process.argv = ["node", "list-tools.ts", "--profile", "work", "--json"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      const jsonCall = mockConsoleLog.mock.calls.find(call => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.name === "work" && parsed.type === "user";
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0] as string);
      expect(output.host).toBe("gitlab.company.com");
      expect(output.authType).toBe("pat");
      expect(output.readOnly).toBe(true);
      expect(output.deniedToolsRegex).toBe("^manage_");
      expect(output.allowedTools).toEqual(["browse_projects"]);
      expect(output.deniedActions).toEqual(["delete"]);
      expect(output.allowedProjects).toEqual(["mygroup/myproject"]);
      expect(output.allowedGroups).toEqual(["mygroup"]);
      expect(output.defaultProject).toBe("default-project");
      expect(output.defaultNamespace).toBe("default-namespace");
      expect(output.timeoutMs).toBe(30000);
      expect(output.skipTlsVerify).toBe(true);
    });

    it("should show profile with default_project and default_namespace settings", async () => {
      mockProfileLoader.loadProfile.mockResolvedValue({
        host: "gitlab.company.com",
        auth: { type: "pat", token_env: "GITLAB_TOKEN" },
        read_only: false,
        default_project: "team/main-project",
        default_namespace: "team",
      });

      process.argv = ["node", "list-tools.ts", "--profile", "work"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("| Default Project | team/main-project |")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("| Default Namespace | team |")
      );
    });

    it("should show profile with access restrictions (allowed_projects)", async () => {
      mockProfileLoader.loadProfile.mockResolvedValue({
        host: "gitlab.company.com",
        auth: { type: "pat", token_env: "GITLAB_TOKEN" },
        read_only: false,
        allowed_projects: ["team/project1", "team/project2"],
      });

      process.argv = ["node", "list-tools.ts", "--profile", "work"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("## Access Restrictions\n");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("**Allowed Projects:** team/project1, team/project2")
      );
    });

    it("should show profile with access restrictions (allowed_groups)", async () => {
      mockProfileLoader.loadProfile.mockResolvedValue({
        host: "gitlab.company.com",
        auth: { type: "pat", token_env: "GITLAB_TOKEN" },
        read_only: false,
        allowed_groups: ["team-a", "team-b"],
      });

      process.argv = ["node", "list-tools.ts", "--profile", "work"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("## Access Restrictions\n");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("**Allowed Groups:** team-a, team-b")
      );
    });

    it("should show profile with tool restrictions (denied_tools_regex)", async () => {
      mockProfileLoader.loadProfile.mockResolvedValue({
        host: "gitlab.company.com",
        auth: { type: "pat", token_env: "GITLAB_TOKEN" },
        read_only: false,
        denied_tools_regex: "^manage_pipeline",
      });

      process.argv = ["node", "list-tools.ts", "--profile", "work"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("## Tool Restrictions\n");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("**Denied tools regex:** `^manage_pipeline`")
      );
    });

    it("should show profile with tool restrictions (allowed_tools whitelist)", async () => {
      mockProfileLoader.loadProfile.mockResolvedValue({
        host: "gitlab.company.com",
        auth: { type: "pat", token_env: "GITLAB_TOKEN" },
        read_only: false,
        allowed_tools: ["browse_projects", "browse_wiki", "browse_commits"],
      });

      process.argv = ["node", "list-tools.ts", "--profile", "work"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("## Tool Restrictions\n");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("**Allowed tools (whitelist):** 3 tools")
      );
    });

    it("should show profile with tool restrictions (denied_actions)", async () => {
      mockProfileLoader.loadProfile.mockResolvedValue({
        host: "gitlab.company.com",
        auth: { type: "pat", token_env: "GITLAB_TOKEN" },
        read_only: false,
        denied_actions: ["delete", "force_push", "rebase"],
      });

      process.argv = ["node", "list-tools.ts", "--profile", "work"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("## Tool Restrictions\n");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("**Denied actions:** delete, force_push, rebase")
      );
    });

    it("should show profile validation with warnings", async () => {
      mockProfileLoader.loadProfile.mockResolvedValue({
        host: "gitlab.company.com",
        auth: { type: "pat", token_env: "GITLAB_TOKEN" },
        read_only: false,
      });
      mockProfileLoader.validateProfile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: ["GITLAB_TOKEN env var not set", "Unknown feature flag"],
      });

      process.argv = ["node", "list-tools.ts", "--profile", "work", "--validate"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("## Validation\n");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("**Status: VALID** (2 warning(s))")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith("### Warnings\n");
      expect(mockConsoleLog).toHaveBeenCalledWith("- GITLAB_TOKEN env var not set");
      expect(mockConsoleLog).toHaveBeenCalledWith("- Unknown feature flag");
    });

    it("should show profile validation with errors", async () => {
      mockProfileLoader.loadProfile.mockResolvedValue({
        host: "gitlab.company.com",
        auth: { type: "pat", token_env: "GITLAB_TOKEN" },
        read_only: false,
      });
      mockProfileLoader.validateProfile.mockResolvedValue({
        valid: false,
        errors: ["Invalid host URL", "Missing required auth field"],
        warnings: [],
      });

      process.argv = ["node", "list-tools.ts", "--profile", "work", "--validate"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("## Validation\n");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("**Status: INVALID** (2 error(s))")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith("### Errors\n");
      expect(mockConsoleLog).toHaveBeenCalledWith("- Invalid host URL");
      expect(mockConsoleLog).toHaveBeenCalledWith("- Missing required auth field");
    });

    it("should show profile validation with JSON format including validation", async () => {
      mockProfileLoader.loadProfile.mockResolvedValue({
        host: "gitlab.company.com",
        auth: { type: "pat", token_env: "GITLAB_TOKEN" },
        read_only: false,
      });
      mockProfileLoader.validateProfile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: ["Some warning"],
      });

      process.argv = ["node", "list-tools.ts", "--profile", "work", "--json", "--validate"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      const jsonCall = mockConsoleLog.mock.calls.find(call => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.name === "work" && parsed.validation !== undefined;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0] as string);
      expect(output.validation.valid).toBe(true);
      expect(output.validation.warnings).toContain("Some warning");
    });
  });

  describe("--compare flag", () => {
    beforeEach(() => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "browse_projects",
          description: "Browse projects",
          inputSchema: { type: "object" },
        },
        { name: "browse_wiki", description: "Browse wiki", inputSchema: { type: "object" } },
        { name: "manage_wiki", description: "Manage wiki", inputSchema: { type: "object" } },
        {
          name: "browse_pipelines",
          description: "Browse pipelines",
          inputSchema: { type: "object" },
        },
      ]);
    });

    it("should compare two presets", async () => {
      mockProfileLoader.loadPreset.mockImplementation(async (name: string) => {
        if (name === "junior-dev") {
          return { description: "Junior dev", read_only: false, features: { wiki: false } };
        }
        if (name === "senior-dev") {
          return { description: "Senior dev", read_only: false, features: { wiki: true } };
        }
        throw new Error("Not found");
      });

      process.argv = ["node", "list-tools.ts", "--preset", "junior-dev", "--compare", "senior-dev"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("# Comparison: junior-dev vs senior-dev")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("## Summary"));
    });

    it("should compare presets in JSON format", async () => {
      mockProfileLoader.loadPreset.mockImplementation(async (name: string) => {
        if (name === "a") return { description: "A", read_only: false };
        if (name === "b") return { description: "B", read_only: true };
        throw new Error("Not found");
      });

      process.argv = ["node", "list-tools.ts", "--preset", "a", "--compare", "b", "--json"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      const jsonCall = mockConsoleLog.mock.calls.find(call => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.presetA !== undefined && parsed.presetB !== undefined;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
    });

    it("should error when first preset not found", async () => {
      mockProfileLoader.loadPreset.mockRejectedValue(new Error("Not found"));

      process.argv = ["node", "list-tools.ts", "--preset", "nonexistent", "--compare", "admin"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleError).toHaveBeenCalledWith("Error: Preset 'nonexistent' not found");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should error when second preset not found", async () => {
      mockProfileLoader.loadPreset.mockImplementation(async (name: string) => {
        if (name === "admin") return { description: "Admin" };
        throw new Error("Not found");
      });

      process.argv = ["node", "list-tools.ts", "--preset", "admin", "--compare", "nonexistent"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleError).toHaveBeenCalledWith("Error: Preset 'nonexistent' not found");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should error when --compare flag has no value", async () => {
      process.argv = ["node", "list-tools.ts", "--preset", "admin", "--compare"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleError).toHaveBeenCalledWith("Error: --compare flag requires a value.");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should error when --compare is used without --preset", async () => {
      process.argv = ["node", "list-tools.ts", "--compare", "admin"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error: --compare flag must be used with --preset."
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("--validate flag validation", () => {
    beforeEach(() => {
      mockManager.getAllToolDefinitionsUnfiltered.mockReturnValue([
        {
          name: "browse_projects",
          description: "Browse projects",
          inputSchema: { type: "object" },
        },
      ]);
    });

    it("should error when --validate is used without --preset or --profile", async () => {
      process.argv = ["node", "list-tools.ts", "--validate"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error: --validate flag must be used with --preset or --profile."
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should work when --validate is used with --preset", async () => {
      mockProfileLoader.loadPreset.mockResolvedValue({
        description: "Test preset",
        read_only: false,
      });
      mockProfileLoader.validatePreset.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });

      process.argv = ["node", "list-tools.ts", "--preset", "test", "--validate"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("## Validation\n");
      expect(mockProcessExit).not.toHaveBeenCalledWith(1);
    });

    it("should work when --validate is used with --profile", async () => {
      mockProfileLoader.loadProfile.mockResolvedValue({
        host: "gitlab.example.com",
        auth: { type: "pat", token_env: "GITLAB_TOKEN" },
        read_only: false,
      });
      mockProfileLoader.validateProfile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });

      process.argv = ["node", "list-tools.ts", "--profile", "test", "--validate"];

      const { main } = await import("../../../src/cli/list-tools");
      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith("## Validation\n");
      expect(mockProcessExit).not.toHaveBeenCalledWith(1);
    });
  });
});
