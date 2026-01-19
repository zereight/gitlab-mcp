/**
 * Unit tests for schema-utils.ts
 * Tests schema transformation utilities for discriminated unions
 */

import {
  filterDiscriminatedUnionActions,
  flattenDiscriminatedUnion,
  applyDescriptionOverrides,
  transformToolSchema,
  shouldRemoveTool,
  extractActionsFromSchema,
} from "../../../src/utils/schema-utils";

// Mock config module
jest.mock("../../../src/config", () => ({
  GITLAB_DENIED_ACTIONS: new Map(),
  getActionDescriptionOverrides: jest.fn(() => new Map()),
  getParamDescriptionOverrides: jest.fn(() => new Map()),
}));

// Mock logger
jest.mock("../../../src/logger", () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  GITLAB_DENIED_ACTIONS,
  getActionDescriptionOverrides,
  getParamDescriptionOverrides,
} from "../../../src/config";

const mockGetActionDescriptionOverrides = getActionDescriptionOverrides as jest.Mock;
const mockGetParamDescriptionOverrides = getParamDescriptionOverrides as jest.Mock;

// Type for JSON Schema in tests
interface TestJSONSchema {
  $schema?: string;
  type?: string;
  oneOf?: TestJSONSchema[];
  properties?: Record<string, Record<string, unknown>>;
  required?: string[];
  [key: string]: unknown;
}

// Sample discriminated union schema (like manage_milestone would have)
const discriminatedUnionSchema: TestJSONSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  oneOf: [
    {
      type: "object",
      properties: {
        action: { const: "create" },
        namespace: { type: "string", description: "Namespace path" },
        title: { type: "string", description: "Milestone title" },
        description: { type: "string", description: "Milestone description" },
      },
      required: ["action", "namespace", "title"],
    },
    {
      type: "object",
      properties: {
        action: { const: "update" },
        namespace: { type: "string", description: "Namespace path" },
        milestone_id: { type: "string", description: "Milestone ID" },
        title: { type: "string", description: "New title" },
        state_event: { type: "string", enum: ["close", "activate"] },
      },
      required: ["action", "namespace", "milestone_id"],
    },
    {
      type: "object",
      properties: {
        action: { const: "delete" },
        namespace: { type: "string", description: "Namespace path" },
        milestone_id: { type: "string", description: "Milestone ID" },
      },
      required: ["action", "namespace", "milestone_id"],
    },
    {
      type: "object",
      properties: {
        action: { const: "promote" },
        namespace: { type: "string", description: "Namespace path" },
        milestone_id: { type: "string", description: "Milestone ID" },
      },
      required: ["action", "namespace", "milestone_id"],
    },
  ],
};

// Sample flat schema (current format)
const flatSchema: TestJSONSchema = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["create", "update", "delete", "promote"],
      description: "Action to perform",
    },
    namespace: { type: "string", description: "Namespace path" },
    milestone_id: { type: "string", description: "Milestone ID" },
    title: { type: "string", description: "Title" },
  },
  required: ["action", "namespace"],
};

describe("schema-utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset GITLAB_DENIED_ACTIONS
    (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).clear();
    mockGetActionDescriptionOverrides.mockReturnValue(new Map());
    mockGetParamDescriptionOverrides.mockReturnValue(new Map());
  });

  describe("filterDiscriminatedUnionActions", () => {
    it("should return schema unchanged when no denied actions", () => {
      const result = filterDiscriminatedUnionActions(discriminatedUnionSchema, "manage_milestone");
      expect(result.oneOf).toHaveLength(4);
    });

    it("should return schema unchanged when tool has no denied actions", () => {
      (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).set("other_tool", new Set(["delete"]));

      const result = filterDiscriminatedUnionActions(discriminatedUnionSchema, "manage_milestone");
      expect(result.oneOf).toHaveLength(4);
    });

    it("should filter out denied action branches", () => {
      (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).set(
        "manage_milestone",
        new Set(["delete"])
      );

      const result = filterDiscriminatedUnionActions(discriminatedUnionSchema, "manage_milestone");

      expect(result.oneOf).toHaveLength(3);
      const actions = result.oneOf!.map(b => b.properties?.action?.const);
      expect(actions).toContain("create");
      expect(actions).toContain("update");
      expect(actions).toContain("promote");
      expect(actions).not.toContain("delete");
    });

    it("should filter multiple denied actions", () => {
      (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).set(
        "manage_milestone",
        new Set(["delete", "promote"])
      );

      const result = filterDiscriminatedUnionActions(discriminatedUnionSchema, "manage_milestone");

      expect(result.oneOf).toHaveLength(2);
      const actions = result.oneOf!.map(b => b.properties?.action?.const);
      expect(actions).toContain("create");
      expect(actions).toContain("update");
    });

    it("should return empty schema when all actions denied", () => {
      (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).set(
        "manage_milestone",
        new Set(["create", "update", "delete", "promote"])
      );

      const result = filterDiscriminatedUnionActions(discriminatedUnionSchema, "manage_milestone");

      expect(result.type).toBe("object");
      expect(result.properties).toEqual({});
    });

    it("should be case-insensitive for tool name lookup", () => {
      // Real config parsing normalizes to lowercase, so Set contains lowercase values
      (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).set(
        "manage_milestone",
        new Set(["delete"])
      );

      // Tool name lookup should be case-insensitive
      const result = filterDiscriminatedUnionActions(discriminatedUnionSchema, "MANAGE_MILESTONE");

      expect(result.oneOf).toHaveLength(3);
      const actions = result.oneOf!.map(b => b.properties?.action?.const);
      expect(actions).not.toContain("delete");
    });

    it("should return non-discriminated-union schema unchanged", () => {
      const result = filterDiscriminatedUnionActions(flatSchema, "manage_milestone");
      expect(result).toEqual(flatSchema);
    });
  });

  describe("flattenDiscriminatedUnion", () => {
    it("should return non-union schema unchanged", () => {
      const result = flattenDiscriminatedUnion(flatSchema);
      expect(result).toEqual(flatSchema);
    });

    it("should merge all branches into flat schema", () => {
      const result = flattenDiscriminatedUnion(discriminatedUnionSchema);

      expect(result.type).toBe("object");
      expect(result.oneOf).toBeUndefined();
      expect(result.properties).toBeDefined();
    });

    it("should create action enum from all branches", () => {
      const result = flattenDiscriminatedUnion(discriminatedUnionSchema);

      expect(result.properties?.action?.enum).toEqual(
        expect.arrayContaining(["create", "update", "delete", "promote"])
      );
    });

    it("should include all properties from all branches", () => {
      const result = flattenDiscriminatedUnion(discriminatedUnionSchema);

      expect(result.properties).toHaveProperty("namespace");
      expect(result.properties).toHaveProperty("milestone_id");
      expect(result.properties).toHaveProperty("title");
      expect(result.properties).toHaveProperty("state_event");
      expect(result.properties).toHaveProperty("description");
    });

    it("should mark only shared required properties as required", () => {
      const result = flattenDiscriminatedUnion(discriminatedUnionSchema);

      // 'action' and 'namespace' are required in all branches
      expect(result.required).toContain("action");
      expect(result.required).toContain("namespace");

      // 'milestone_id' is not required in 'create' branch
      expect(result.required).not.toContain("milestone_id");

      // 'title' is not required in all branches
      expect(result.required).not.toContain("title");
    });

    it("should preserve $schema if present", () => {
      const result = flattenDiscriminatedUnion(discriminatedUnionSchema);
      expect(result.$schema).toBe("http://json-schema.org/draft-07/schema#");
    });

    it("should add action descriptions to branch-specific params", () => {
      const result = flattenDiscriminatedUnion(discriminatedUnionSchema);

      // state_event is only in 'update' branch
      const stateEventDesc = result.properties?.state_event?.description ?? "";
      expect(stateEventDesc).toContain("update");
    });
  });

  describe("applyDescriptionOverrides", () => {
    it("should return schema unchanged when no overrides", () => {
      const result = applyDescriptionOverrides(flatSchema, "manage_milestone");
      expect(result.properties?.namespace?.description).toBe("Namespace path");
    });

    it("should apply parameter description overrides", () => {
      mockGetParamDescriptionOverrides.mockReturnValue(
        new Map([["manage_milestone:namespace", "Custom namespace description"]])
      );

      const result = applyDescriptionOverrides(flatSchema, "manage_milestone");

      expect(result.properties?.namespace?.description).toBe("Custom namespace description");
    });

    it("should apply action description override", () => {
      mockGetActionDescriptionOverrides.mockReturnValue(
        new Map([["manage_milestone:action", "Custom action description"]])
      );

      const result = applyDescriptionOverrides(flatSchema, "manage_milestone");

      expect(result.properties?.action?.description).toBe("Custom action description");
    });

    it("should apply multiple overrides", () => {
      mockGetParamDescriptionOverrides.mockReturnValue(
        new Map([
          ["manage_milestone:namespace", "NS"],
          ["manage_milestone:title", "T"],
        ])
      );

      const result = applyDescriptionOverrides(flatSchema, "manage_milestone");

      expect(result.properties?.namespace?.description).toBe("NS");
      expect(result.properties?.title?.description).toBe("T");
    });

    it("should be case-insensitive for tool name", () => {
      mockGetParamDescriptionOverrides.mockReturnValue(
        new Map([["manage_milestone:namespace", "Overridden"]])
      );

      const result = applyDescriptionOverrides(flatSchema, "MANAGE_MILESTONE");

      expect(result.properties?.namespace?.description).toBe("Overridden");
    });
  });

  describe("transformToolSchema", () => {
    it("should apply full pipeline for discriminated union", () => {
      (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).set(
        "manage_milestone",
        new Set(["delete", "promote"])
      );
      mockGetParamDescriptionOverrides.mockReturnValue(
        new Map([["manage_milestone:namespace", "Path"]])
      );

      const result = transformToolSchema("manage_milestone", discriminatedUnionSchema);

      // Should be flattened
      expect(result.oneOf).toBeUndefined();
      expect(result.type).toBe("object");

      // Should have filtered actions
      expect(result.properties?.action?.enum).toEqual(expect.arrayContaining(["create", "update"]));
      expect(result.properties?.action?.enum).not.toContain("delete");
      expect(result.properties?.action?.enum).not.toContain("promote");

      // Should have applied description override
      expect(result.properties?.namespace?.description).toBe("Path");
    });

    it("should handle flat schema with action filtering", () => {
      (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).set(
        "manage_milestone",
        new Set(["delete"])
      );

      const result = transformToolSchema("manage_milestone", flatSchema);

      expect(result.properties?.action?.enum).toEqual(
        expect.arrayContaining(["create", "update", "promote"])
      );
      expect(result.properties?.action?.enum).not.toContain("delete");
    });
  });

  describe("shouldRemoveTool", () => {
    it("should return false when no denied actions", () => {
      const result = shouldRemoveTool("manage_milestone", ["create", "update", "delete"]);
      expect(result).toBe(false);
    });

    it("should return false when some actions allowed", () => {
      (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).set(
        "manage_milestone",
        new Set(["delete"])
      );

      const result = shouldRemoveTool("manage_milestone", ["create", "update", "delete"]);
      expect(result).toBe(false);
    });

    it("should return true when all actions denied", () => {
      (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).set(
        "manage_milestone",
        new Set(["create", "update", "delete"])
      );

      const result = shouldRemoveTool("manage_milestone", ["create", "update", "delete"]);
      expect(result).toBe(true);
    });

    it("should be case-insensitive for tool name", () => {
      // Real config parsing normalizes to lowercase, so Set contains lowercase values
      (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).set(
        "manage_milestone",
        new Set(["create", "update", "delete"])
      );

      // Tool name lookup should be case-insensitive
      const result = shouldRemoveTool("MANAGE_MILESTONE", ["create", "update", "delete"]);
      expect(result).toBe(true);
    });
  });

  describe("extractActionsFromSchema", () => {
    it("should extract actions from flat schema enum", () => {
      const actions = extractActionsFromSchema(flatSchema);
      expect(actions).toEqual(["create", "update", "delete", "promote"]);
    });

    it("should extract actions from discriminated union", () => {
      const actions = extractActionsFromSchema(discriminatedUnionSchema);
      expect(actions).toEqual(["create", "update", "delete", "promote"]);
    });

    it("should return empty array for schema without actions", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };

      const actions = extractActionsFromSchema(schema);
      expect(actions).toEqual([]);
    });

    it("should handle schema with enum action (not const)", () => {
      const schemaWithEnum = {
        oneOf: [
          {
            type: "object",
            properties: {
              action: { enum: ["list"] },
              namespace: { type: "string" },
            },
          },
        ],
      };

      const actions = extractActionsFromSchema(schemaWithEnum);
      expect(actions).toEqual(["list"]);
    });
  });

  describe("Integration: Parameter Removal with Discriminated Union", () => {
    it("should remove exclusive parameters when filtering actions", () => {
      // When we deny 'delete' and 'promote', and only 'create' remains,
      // milestone_id should be removed because it's only used by update/delete/promote
      (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).set(
        "manage_milestone",
        new Set(["update", "delete", "promote"])
      );

      const result = transformToolSchema("manage_milestone", discriminatedUnionSchema);

      // Only 'create' action remains
      expect(result.properties?.action?.enum).toEqual(["create"]);

      // 'create' branch doesn't have milestone_id, so it should not be in flattened schema
      // But namespace, title, description should be present (from create branch)
      expect(result.properties).toHaveProperty("namespace");
      expect(result.properties).toHaveProperty("title");
      expect(result.properties).toHaveProperty("description");

      // milestone_id and state_event should NOT be present (only in filtered-out branches)
      expect(result.properties).not.toHaveProperty("milestone_id");
      expect(result.properties).not.toHaveProperty("state_event");
    });

    it("should keep shared parameters when some actions remain", () => {
      // When we deny only 'delete', update/create/promote remain
      // milestone_id should still be present (used by update and promote)
      (GITLAB_DENIED_ACTIONS as Map<string, Set<string>>).set(
        "manage_milestone",
        new Set(["delete"])
      );

      const result = transformToolSchema("manage_milestone", discriminatedUnionSchema);

      expect(result.properties?.action?.enum).toHaveLength(3);
      expect(result.properties).toHaveProperty("milestone_id"); // Still used by update, promote
      expect(result.properties).toHaveProperty("namespace"); // Shared by all
    });
  });
});
