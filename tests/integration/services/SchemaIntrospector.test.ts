/**
 * Unit tests for SchemaIntrospector service
 * Tests GraphQL schema introspection and widget type detection
 */

import {
  SchemaIntrospector,
  SchemaInfo,
  FieldInfo,
} from "../../../src/services/SchemaIntrospector";
import { GraphQLClient } from "../../../src/graphql/client";
import { setupMockFetch, resetMocks } from "../../utils/testHelpers";

// Mock dependencies
jest.mock("../../../src/graphql/client");
jest.mock("../../../src/logger", () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

setupMockFetch();

describe("SchemaIntrospector", () => {
  let mockClient: jest.Mocked<GraphQLClient>;
  let introspector: SchemaIntrospector;

  const mockIntrospectionResponse = {
    __schema: {
      types: [
        {
          name: "WorkItemWidgetType",
          kind: "ENUM",
          fields: null,
          enumValues: [
            { name: "ASSIGNEES", description: "Assignee widget" },
            { name: "LABELS", description: "Labels widget" },
            { name: "MILESTONE", description: "Milestone widget" },
            { name: "DESCRIPTION", description: "Description widget" },
            { name: "WEIGHT", description: "Weight widget" },
            { name: "CUSTOM_FIELDS", description: "Custom fields widget" },
          ],
        },
        {
          name: "WorkItemWidgetAssignees",
          kind: "OBJECT",
          enumValues: null,
          fields: [
            {
              name: "assignees",
              type: { name: "UserConnection", kind: "OBJECT", ofType: null },
            },
            {
              name: "canInviteMembers",
              type: { name: "Boolean", kind: "SCALAR", ofType: null },
            },
          ],
        },
        {
          name: "WorkItemWidgetLabels",
          kind: "OBJECT",
          enumValues: null,
          fields: [
            {
              name: "labels",
              type: { name: "LabelConnection", kind: "OBJECT", ofType: null },
            },
            {
              name: "allowsScopedLabels",
              type: { name: "Boolean", kind: "SCALAR", ofType: null },
            },
          ],
        },
        {
          name: "WorkItemWidgetMilestone",
          kind: "OBJECT",
          enumValues: null,
          fields: [
            {
              name: "milestone",
              type: { name: "Milestone", kind: "OBJECT", ofType: null },
            },
          ],
        },
        {
          name: "WorkItemWidgetCustomFields",
          kind: "OBJECT",
          enumValues: null,
          fields: [
            {
              name: "customFields",
              type: { name: "CustomFieldConnection", kind: "OBJECT", ofType: null },
            },
          ],
        },
        {
          name: "AwardEmoji",
          kind: "OBJECT",
          enumValues: null,
          fields: [
            {
              name: "id",
              type: { name: "ID", kind: "SCALAR", ofType: null },
            },
            {
              name: "name",
              type: { name: "String", kind: "SCALAR", ofType: null },
            },
          ],
        },
        {
          name: "Milestone",
          kind: "OBJECT",
          enumValues: null,
          fields: [
            {
              name: "id",
              type: { name: "ID", kind: "SCALAR", ofType: null },
            },
            {
              name: "title",
              type: { name: "String", kind: "SCALAR", ofType: null },
            },
            {
              name: "state",
              type: { name: "MilestoneStateEnum", kind: "ENUM", ofType: null },
            },
          ],
        },
        {
          name: "User",
          kind: "OBJECT",
          enumValues: null,
          fields: [
            {
              name: "id",
              type: { name: "ID", kind: "SCALAR", ofType: null },
            },
            {
              name: "username",
              type: { name: "String", kind: "SCALAR", ofType: null },
            },
          ],
        },
        {
          name: "Label",
          kind: "OBJECT",
          enumValues: null,
          fields: [
            {
              name: "id",
              type: { name: "ID", kind: "SCALAR", ofType: null },
            },
            {
              name: "title",
              type: { name: "String", kind: "SCALAR", ofType: null },
            },
            {
              name: "color",
              type: { name: "String", kind: "SCALAR", ofType: null },
            },
          ],
        },
      ],
    },
  };

  beforeEach(() => {
    resetMocks();

    mockClient = {
      endpoint: "https://gitlab.example.com/api/graphql",
      request: jest.fn(),
    } as any;

    introspector = new SchemaIntrospector(mockClient);
  });

  describe("schema introspection", () => {
    it("should introspect schema successfully", async () => {
      mockClient.request.mockResolvedValue(mockIntrospectionResponse);

      const result = await introspector.introspectSchema();

      expect(result.workItemWidgetTypes).toContain("ASSIGNEES");
      expect(result.workItemWidgetTypes).toContain("LABELS");
      expect(result.workItemWidgetTypes).toContain("MILESTONE");
      expect(result.workItemWidgetTypes).toContain("DESCRIPTION");
      expect(result.workItemWidgetTypes.length).toBeGreaterThanOrEqual(4); // At least basic types
      expect(result.typeDefinitions.size).toBeGreaterThanOrEqual(6); // WorkItem-related types
      expect(result.availableFeatures.size).toBeGreaterThanOrEqual(6);
      expect(result.availableFeatures.has("ASSIGNEES")).toBe(true);
      expect(result.availableFeatures.has("CUSTOM_FIELDS")).toBe(true);
    });

    it("should cache schema info and return cached result on subsequent calls", async () => {
      mockClient.request.mockResolvedValue(mockIntrospectionResponse);

      const result1 = await introspector.introspectSchema();
      const result2 = await introspector.introspectSchema();

      expect(result1).toBe(result2);
      expect(mockClient.request).toHaveBeenCalledTimes(1);
    });

    it("should handle introspection failure with fallback schema", async () => {
      mockClient.request.mockRejectedValue(new Error("Introspection failed"));

      const result = await introspector.introspectSchema();

      expect(result.workItemWidgetTypes).toEqual([
        "ASSIGNEES",
        "LABELS",
        "MILESTONE",
        "DESCRIPTION",
        "START_AND_DUE_DATE",
        "WEIGHT",
        "TIME_TRACKING",
        "HEALTH_STATUS",
        "COLOR",
        "NOTIFICATIONS",
        "NOTES",
      ]);
      expect(result.typeDefinitions.size).toBe(0);
      expect(result.availableFeatures.size).toBe(3);
      expect(result.availableFeatures.has("workItems")).toBe(true);
      expect(result.availableFeatures.has("epics")).toBe(true);
      expect(result.availableFeatures.has("issues")).toBe(true);
    });

    it("should filter types correctly for WorkItem-related types", async () => {
      const responseWithExtraTypes = {
        __schema: {
          types: [
            ...mockIntrospectionResponse.__schema.types,
            {
              name: "Project",
              kind: "OBJECT",
              fields: [{ name: "id", type: { name: "ID", kind: "SCALAR" } }],
              enumValues: null,
            },
            {
              name: "RandomType",
              kind: "OBJECT",
              fields: [{ name: "name", type: { name: "String", kind: "SCALAR" } }],
              enumValues: null,
            },
          ],
        },
      };

      mockClient.request.mockResolvedValue(responseWithExtraTypes);

      const result = await introspector.introspectSchema();

      // Should only include WorkItem-related, Widget, AwardEmoji, Milestone, User, and Label types
      expect(result.typeDefinitions.has("Project")).toBe(false);
      expect(result.typeDefinitions.has("RandomType")).toBe(false);
      expect(result.typeDefinitions.has("WorkItemWidgetAssignees")).toBe(true);
      expect(result.typeDefinitions.has("AwardEmoji")).toBe(true);
    });
  });

  describe("widget type availability", () => {
    beforeEach(async () => {
      mockClient.request.mockResolvedValue(mockIntrospectionResponse);
      await introspector.introspectSchema();
    });

    it("should check widget type availability correctly", () => {
      expect(introspector.isWidgetTypeAvailable("ASSIGNEES")).toBe(true);
      expect(introspector.isWidgetTypeAvailable("LABELS")).toBe(true);
      expect(introspector.isWidgetTypeAvailable("CUSTOM_FIELDS")).toBe(true);
      expect(introspector.isWidgetTypeAvailable("NONEXISTENT_WIDGET")).toBe(false);
    });

    it("should throw error when checking availability before introspection", () => {
      const freshIntrospector = new SchemaIntrospector(mockClient);

      expect(() => freshIntrospector.isWidgetTypeAvailable("ASSIGNEES")).toThrow(
        "Schema not introspected yet. Call introspectSchema() first."
      );
    });
  });

  describe("field information", () => {
    beforeEach(async () => {
      mockClient.request.mockResolvedValue(mockIntrospectionResponse);
      await introspector.introspectSchema();
    });

    it("should get fields for type correctly", () => {
      const fields = introspector.getFieldsForType("WorkItemWidgetAssignees");

      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe("assignees");
      expect(fields[0].type.name).toBe("UserConnection");
      expect(fields[1].name).toBe("canInviteMembers");
      expect(fields[1].type.name).toBe("Boolean");
    });

    it("should return empty array for unknown type", () => {
      const fields = introspector.getFieldsForType("UnknownType");
      expect(fields).toEqual([]);
    });

    it("should provide fallback fields for common widget types", async () => {
      // Test with empty schema to trigger fallbacks
      const emptyIntrospector = new SchemaIntrospector(mockClient);
      mockClient.request.mockResolvedValue({ __schema: { types: [] } });
      await emptyIntrospector.introspectSchema();

      const assigneeFields = emptyIntrospector.getFieldsForType("WorkItemWidgetAssignees");
      expect(assigneeFields).toHaveLength(1);
      expect(assigneeFields[0].name).toBe("assignees");
      expect(assigneeFields[0].type.name).toBe("UserConnection");

      const labelFields = emptyIntrospector.getFieldsForType("WorkItemWidgetLabels");
      expect(labelFields).toHaveLength(1);
      expect(labelFields[0].name).toBe("labels");
      expect(labelFields[0].type.name).toBe("LabelConnection");

      const milestoneFields = emptyIntrospector.getFieldsForType("WorkItemWidgetMilestone");
      expect(milestoneFields).toHaveLength(1);
      expect(milestoneFields[0].name).toBe("milestone");
      expect(milestoneFields[0].type.name).toBe("Milestone");
    });

    it("should check if type has specific field", () => {
      expect(introspector.hasField("WorkItemWidgetAssignees", "assignees")).toBe(true);
      expect(introspector.hasField("WorkItemWidgetAssignees", "canInviteMembers")).toBe(true);
      expect(introspector.hasField("WorkItemWidgetAssignees", "nonExistentField")).toBe(false);
      expect(introspector.hasField("UnknownType", "anyField")).toBe(false);
    });

    it("should throw error when getting fields before introspection", () => {
      const freshIntrospector = new SchemaIntrospector(mockClient);

      expect(() => freshIntrospector.getFieldsForType("WorkItemWidgetAssignees")).toThrow(
        "Schema not introspected yet. Call introspectSchema() first."
      );
    });
  });

  describe("available widget types", () => {
    beforeEach(async () => {
      mockClient.request.mockResolvedValue(mockIntrospectionResponse);
      await introspector.introspectSchema();
    });

    it("should get all available widget types", () => {
      const widgets = introspector.getAvailableWidgetTypes();

      expect(widgets).toEqual([
        "ASSIGNEES",
        "LABELS",
        "MILESTONE",
        "DESCRIPTION",
        "WEIGHT",
        "CUSTOM_FIELDS",
      ]);
    });

    it("should throw error when getting widget types before introspection", () => {
      const freshIntrospector = new SchemaIntrospector(mockClient);

      expect(() => freshIntrospector.getAvailableWidgetTypes()).toThrow(
        "Schema not introspected yet. Call introspectSchema() first."
      );
    });
  });

  describe("safe widget query generation", () => {
    beforeEach(async () => {
      mockClient.request.mockResolvedValue(mockIntrospectionResponse);
      await introspector.introspectSchema();
    });

    it("should generate safe widget query for available widgets", () => {
      const query = introspector.generateSafeWidgetQuery(["ASSIGNEES", "LABELS", "MILESTONE"]);

      expect(query).toContain("... on WorkItemWidgetAssignees");
      expect(query).toContain("assignees { nodes { id username } }");
      expect(query).toContain("canInviteMembers");
      expect(query).toContain("... on WorkItemWidgetLabels");
      expect(query).toContain("labels { nodes { id title color } }");
      expect(query).toContain("... on WorkItemWidgetMilestone");
      expect(query).toContain("milestone { id title state }");
    });

    it("should skip unavailable widgets", () => {
      const query = introspector.generateSafeWidgetQuery(["ASSIGNEES", "NONEXISTENT_WIDGET"]);

      expect(query).toContain("... on WorkItemWidgetAssignees");
      expect(query).not.toContain("NONEXISTENT_WIDGET");
    });

    it("should handle widgets with no fields", async () => {
      // Mock widget with no fields
      const noFieldsResponse = {
        __schema: {
          types: [
            {
              name: "WorkItemWidgetType",
              kind: "ENUM",
              fields: null,
              enumValues: [{ name: "EMPTY_WIDGET", description: "Empty widget" }],
            },
            {
              name: "WorkItemWidgetEmptyWidget",
              kind: "OBJECT",
              fields: [],
              enumValues: null,
            },
          ],
        },
      };

      const emptyIntrospector = new SchemaIntrospector(mockClient);
      mockClient.request.mockReset().mockResolvedValue(noFieldsResponse);
      await emptyIntrospector.introspectSchema();

      const query = emptyIntrospector.generateSafeWidgetQuery(["EMPTY_WIDGET"]);
      expect(query).toBe(""); // Should be empty as no safe fields available
    });

    it("should throw error when generating query before introspection", () => {
      const freshIntrospector = new SchemaIntrospector(mockClient);

      expect(() => freshIntrospector.generateSafeWidgetQuery(["ASSIGNEES"])).toThrow(
        "Schema not introspected yet. Call introspectSchema() first."
      );
    });
  });

  describe("safe field selection generation", () => {
    it("should generate safe field selections based on field types", () => {
      const generateSafeFieldSelections = (introspector as any).generateSafeFieldSelections.bind(
        introspector
      );

      const fields: FieldInfo[] = [
        {
          name: "scalarField",
          type: { name: "String", kind: "SCALAR" },
        },
        {
          name: "enumField",
          type: { name: "StatusEnum", kind: "ENUM" },
        },
        {
          name: "milestone",
          type: { name: "Milestone", kind: "OBJECT" },
        },
        {
          name: "assignees",
          type: { name: "UserConnection", kind: "OBJECT" },
        },
        {
          name: "labels",
          type: { name: "LabelConnection", kind: "OBJECT" },
        },
        {
          name: "complexObject",
          type: { name: "ComplexType", kind: "OBJECT" },
        },
        {
          name: "type", // Should be skipped
          type: { name: "TypeObject", kind: "OBJECT" },
        },
      ];

      const safeFields = generateSafeFieldSelections(fields);

      expect(safeFields).toContain("scalarField");
      expect(safeFields).toContain("enumField");
      expect(safeFields).toContain("milestone { id title state }");
      expect(safeFields).toContain("assignees { nodes { id username } }");
      expect(safeFields).toContain("labels { nodes { id title color } }");
      expect(safeFields).not.toContain("complexObject"); // Should be excluded
      expect(safeFields).not.toContain("type"); // Should be excluded
    });
  });

  describe("cache management", () => {
    beforeEach(async () => {
      mockClient.request.mockResolvedValue(mockIntrospectionResponse);
      await introspector.introspectSchema();
    });

    it("should return cached schema", () => {
      const cached = introspector.getCachedSchema();

      expect(cached).toBeDefined();
      expect(cached!.workItemWidgetTypes.length).toBeGreaterThanOrEqual(4);
      expect(cached!.typeDefinitions.size).toBeGreaterThanOrEqual(6);
    });

    it("should clear cache correctly", () => {
      expect(introspector.getCachedSchema()).toBeDefined();

      introspector.clearCache();

      expect(introspector.getCachedSchema()).toBeNull();
    });

    it("should return null for cached schema initially", () => {
      const freshIntrospector = new SchemaIntrospector(mockClient);
      expect(freshIntrospector.getCachedSchema()).toBeNull();
    });

    it("should re-introspect after cache clear", async () => {
      expect(introspector.getCachedSchema()).toBeDefined();

      introspector.clearCache();
      mockClient.request.mockResolvedValue(mockIntrospectionResponse);

      const result = await introspector.introspectSchema();

      expect(result).toBeDefined();
      expect(mockClient.request).toHaveBeenCalledTimes(2); // Once before, once after clear
    });
  });

  describe("widget type name conversion", () => {
    it("should convert widget type names correctly in query generation", async () => {
      const convertedNames = [
        { input: "ASSIGNEES", expected: "WorkItemWidgetAssignees" },
        { input: "START_AND_DUE_DATE", expected: "WorkItemWidgetStartAndDueDate" },
        { input: "CUSTOM_FIELDS", expected: "WorkItemWidgetCustomFields" },
        { input: "TIME_TRACKING", expected: "WorkItemWidgetTimeTracking" },
      ];

      // We can test the conversion logic indirectly through query generation
      for (const { input, expected } of convertedNames) {
        const mockResponseForWidget = {
          __schema: {
            types: [
              {
                name: "WorkItemWidgetType",
                kind: "ENUM",
                fields: null,
                enumValues: [{ name: input, description: `${input} widget` }],
              },
              {
                name: expected,
                kind: "OBJECT",
                fields: [{ name: "testField", type: { name: "String", kind: "SCALAR" } }],
                enumValues: null,
              },
            ],
          },
        };

        const testIntrospector = new SchemaIntrospector(mockClient);
        mockClient.request.mockResolvedValue(mockResponseForWidget);
        await testIntrospector.introspectSchema();

        const query = testIntrospector.generateSafeWidgetQuery([input]);
        expect(query).toContain(`... on ${expected}`);
      }
    });
  });
});
