import { SchemaIntrospector } from "../../../src/services/SchemaIntrospector";
import { GraphQLClient } from "../../../src/graphql/client";

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

const mockGraphQLClient = {
  request: jest.fn(),
} as unknown as jest.Mocked<GraphQLClient>;

describe("SchemaIntrospector", () => {
  let introspector: SchemaIntrospector;

  // Mock schema data that matches GitLab's structure
  const mockIntrospectionResult = {
    __schema: {
      types: [
        {
          name: "WorkItemWidgetType",
          kind: "ENUM",
          enumValues: [
            { name: "ASSIGNEES", description: "Widget for assignees" },
            { name: "LABELS", description: "Widget for labels" },
            { name: "MILESTONE", description: "Widget for milestones" },
            { name: "DESCRIPTION", description: "Widget for description" },
          ],
        },
        {
          name: "WorkItemWidgetAssignees",
          kind: "OBJECT",
          fields: [
            {
              name: "assignees",
              type: { name: "UserConnection", kind: "OBJECT" },
            },
            {
              name: "canInviteMembers",
              type: { name: "Boolean", kind: "SCALAR" },
            },
          ],
        },
        {
          name: "WorkItemWidgetLabels",
          kind: "OBJECT",
          fields: [
            {
              name: "labels",
              type: { name: "LabelConnection", kind: "OBJECT" },
            },
            {
              name: "allowsScopedLabels",
              type: { name: "Boolean", kind: "SCALAR" },
            },
          ],
        },
        {
          name: "WorkItemWidgetMilestone",
          kind: "OBJECT",
          fields: [
            {
              name: "milestone",
              type: { name: "Milestone", kind: "OBJECT" },
            },
          ],
        },
        {
          name: "WorkItem",
          kind: "OBJECT",
          fields: [
            {
              name: "id",
              type: { name: "WorkItemID", kind: "SCALAR" },
            },
            {
              name: "widgets",
              type: { name: "WorkItemWidget", kind: "INTERFACE" },
            },
          ],
        },
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    introspector = new SchemaIntrospector(mockGraphQLClient);
  });

  describe("Constructor", () => {
    it("should initialize with GraphQL client", () => {
      expect(introspector).toBeInstanceOf(SchemaIntrospector);
    });

    it("should start with no cached schema", () => {
      expect(introspector.getCachedSchema()).toBeNull();
    });
  });

  describe("introspectSchema", () => {
    it("should successfully introspect schema and cache results", async () => {
      mockGraphQLClient.request.mockResolvedValueOnce(mockIntrospectionResult);

      const schema = await introspector.introspectSchema();

      expect(schema).toBeDefined();
      expect(schema.workItemWidgetTypes).toEqual([
        "ASSIGNEES",
        "LABELS",
        "MILESTONE",
        "DESCRIPTION",
      ]);
      expect(schema.typeDefinitions).toBeInstanceOf(Map);
      expect(schema.availableFeatures).toBeInstanceOf(Set);
      expect(introspector.getCachedSchema()).toBe(schema);
    });

    it("should return cached schema on subsequent calls", async () => {
      mockGraphQLClient.request.mockResolvedValueOnce(mockIntrospectionResult);

      const firstCall = await introspector.introspectSchema();
      jest.clearAllMocks();

      const secondCall = await introspector.introspectSchema();

      expect(secondCall).toBe(firstCall);
      expect(mockGraphQLClient.request).not.toHaveBeenCalled();
    });

    it("should handle introspection errors gracefully", async () => {
      mockGraphQLClient.request.mockRejectedValueOnce(new Error("GraphQL introspection failed"));

      const schema = await introspector.introspectSchema();

      // Should provide fallback widget types when introspection fails
      expect(schema.workItemWidgetTypes).toEqual([
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
      expect(schema.typeDefinitions).toBeInstanceOf(Map);
      expect(schema.typeDefinitions.size).toBe(0);
      expect(schema.availableFeatures).toBeInstanceOf(Set);
      expect(schema.availableFeatures).toEqual(new Set(["workItems", "epics", "issues"]));
    });

    it("should handle empty schema response", async () => {
      mockGraphQLClient.request.mockResolvedValueOnce({
        __schema: { types: [] },
      });

      const schema = await introspector.introspectSchema();

      expect(schema.workItemWidgetTypes).toEqual([]);
      expect(schema.typeDefinitions.size).toBe(0);
      expect(schema.availableFeatures.size).toBe(0);
    });
  });

  describe("isWidgetTypeAvailable", () => {
    beforeEach(async () => {
      mockGraphQLClient.request.mockResolvedValueOnce(mockIntrospectionResult);
      await introspector.introspectSchema();
    });

    it("should return true for available widget types", () => {
      expect(introspector.isWidgetTypeAvailable("ASSIGNEES")).toBe(true);
      expect(introspector.isWidgetTypeAvailable("LABELS")).toBe(true);
      expect(introspector.isWidgetTypeAvailable("MILESTONE")).toBe(true);
    });

    it("should return false for unavailable widget types", () => {
      expect(introspector.isWidgetTypeAvailable("NONEXISTENT")).toBe(false);
      expect(introspector.isWidgetTypeAvailable("INVALID_WIDGET")).toBe(false);
    });

    it("should throw error when schema not introspected", () => {
      const newIntrospector = new SchemaIntrospector(mockGraphQLClient);

      expect(() => {
        newIntrospector.isWidgetTypeAvailable("ASSIGNEES");
      }).toThrow("Schema not introspected yet. Call introspectSchema() first.");
    });
  });

  describe("getFieldsForType", () => {
    beforeEach(async () => {
      mockGraphQLClient.request.mockResolvedValueOnce(mockIntrospectionResult);
      await introspector.introspectSchema();
    });

    it("should return fields for existing types", () => {
      const assigneeFields = introspector.getFieldsForType("WorkItemWidgetAssignees");
      expect(assigneeFields).toHaveLength(2);
      expect(assigneeFields[0].name).toBe("assignees");
      expect(assigneeFields[1].name).toBe("canInviteMembers");
    });

    it("should return fallback fields for common widget types", async () => {
      // Create a new introspector and trigger failed introspection
      const fallbackIntrospector = new SchemaIntrospector(mockGraphQLClient);
      mockGraphQLClient.request.mockRejectedValueOnce(new Error("Schema introspection failed"));
      await fallbackIntrospector.introspectSchema();

      // When typeDefinitions is empty, should use hardcoded fallback fields
      const assigneeFields = fallbackIntrospector.getFieldsForType("WorkItemWidgetAssignees");
      expect(assigneeFields).toHaveLength(1);
      expect(assigneeFields[0].name).toBe("assignees");
      expect(assigneeFields[0].type.name).toBe("UserConnection");

      const labelFields = fallbackIntrospector.getFieldsForType("WorkItemWidgetLabels");
      expect(labelFields).toHaveLength(1);
      expect(labelFields[0].name).toBe("labels");

      const milestoneFields = fallbackIntrospector.getFieldsForType("WorkItemWidgetMilestone");
      expect(milestoneFields).toHaveLength(1);
      expect(milestoneFields[0].name).toBe("milestone");
    });

    it("should return empty array for unknown types", () => {
      const unknownFields = introspector.getFieldsForType("UnknownType");
      expect(unknownFields).toEqual([]);
    });

    it("should throw error when schema not introspected", () => {
      const newIntrospector = new SchemaIntrospector(mockGraphQLClient);

      expect(() => {
        newIntrospector.getFieldsForType("WorkItemWidgetAssignees");
      }).toThrow("Schema not introspected yet. Call introspectSchema() first.");
    });
  });

  describe("hasField", () => {
    beforeEach(async () => {
      mockGraphQLClient.request.mockResolvedValueOnce(mockIntrospectionResult);
      await introspector.introspectSchema();
    });

    it("should return true for existing fields", () => {
      expect(introspector.hasField("WorkItemWidgetAssignees", "assignees")).toBe(true);
      expect(introspector.hasField("WorkItemWidgetAssignees", "canInviteMembers")).toBe(true);
      expect(introspector.hasField("WorkItemWidgetLabels", "labels")).toBe(true);
    });

    it("should return false for non-existing fields", () => {
      expect(introspector.hasField("WorkItemWidgetAssignees", "nonExistentField")).toBe(false);
      expect(introspector.hasField("UnknownType", "anyField")).toBe(false);
    });
  });

  describe("getAvailableWidgetTypes", () => {
    beforeEach(async () => {
      mockGraphQLClient.request.mockResolvedValueOnce(mockIntrospectionResult);
      await introspector.introspectSchema();
    });

    it("should return all available widget types", () => {
      const widgetTypes = introspector.getAvailableWidgetTypes();
      expect(widgetTypes).toEqual(["ASSIGNEES", "LABELS", "MILESTONE", "DESCRIPTION"]);
    });

    it("should throw error when schema not introspected", () => {
      const newIntrospector = new SchemaIntrospector(mockGraphQLClient);

      expect(() => {
        newIntrospector.getAvailableWidgetTypes();
      }).toThrow("Schema not introspected yet. Call introspectSchema() first.");
    });
  });

  describe("generateSafeWidgetQuery", () => {
    beforeEach(async () => {
      mockGraphQLClient.request.mockResolvedValueOnce(mockIntrospectionResult);
      await introspector.introspectSchema();
    });

    it("should generate safe queries for available widgets", () => {
      const query = introspector.generateSafeWidgetQuery(["ASSIGNEES", "LABELS"]);

      expect(query).toContain("assignees");
      expect(query).toContain("labels");
      expect(typeof query).toBe("string");
      expect(query.length).toBeGreaterThan(0);
    });

    it("should filter out unavailable widgets", () => {
      const query = introspector.generateSafeWidgetQuery(["ASSIGNEES", "NONEXISTENT", "LABELS"]);

      expect(query).toContain("assignees");
      expect(query).toContain("labels");
      expect(query).not.toContain("NONEXISTENT");
    });

    it("should handle empty widget list", () => {
      const query = introspector.generateSafeWidgetQuery([]);

      expect(typeof query).toBe("string");
      expect(query.length).toBe(0);
    });

    it("should throw error when schema not introspected", () => {
      const newIntrospector = new SchemaIntrospector(mockGraphQLClient);

      expect(() => {
        newIntrospector.generateSafeWidgetQuery(["ASSIGNEES"]);
      }).toThrow("Schema not introspected yet. Call introspectSchema() first.");
    });
  });

  describe("Cache Management", () => {
    it("should cache schema after introspection", async () => {
      expect(introspector.getCachedSchema()).toBeNull();

      mockGraphQLClient.request.mockResolvedValueOnce(mockIntrospectionResult);
      const schema = await introspector.introspectSchema();

      expect(introspector.getCachedSchema()).toBe(schema);
    });

    it("should clear cache when requested", async () => {
      mockGraphQLClient.request.mockResolvedValueOnce(mockIntrospectionResult);
      await introspector.introspectSchema();

      expect(introspector.getCachedSchema()).not.toBeNull();

      introspector.clearCache();

      expect(introspector.getCachedSchema()).toBeNull();
    });

    it("should re-introspect after cache is cleared", async () => {
      // First introspection
      mockGraphQLClient.request.mockResolvedValueOnce(mockIntrospectionResult);
      await introspector.introspectSchema();

      introspector.clearCache();
      jest.clearAllMocks();

      // Second introspection after cache clear
      mockGraphQLClient.request.mockResolvedValueOnce(mockIntrospectionResult);
      const newSchema = await introspector.introspectSchema();

      expect(mockGraphQLClient.request).toHaveBeenCalledTimes(1);
      expect(newSchema).toBeDefined();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle malformed introspection response", async () => {
      mockGraphQLClient.request.mockResolvedValueOnce({
        __schema: {
          types: [
            { name: null, kind: "INVALID" }, // Invalid type
            { name: "WorkItemWidgetType", kind: "ENUM" }, // Missing enumValues
          ],
        },
      });

      const schema = await introspector.introspectSchema();

      expect(schema).toBeDefined();
      // Should extract empty widget types from malformed WorkItemWidgetType
      expect(schema.workItemWidgetTypes).toEqual([]);
    });

    it("should handle network timeouts gracefully", async () => {
      // Create a new introspector to ensure clean state
      const timeoutIntrospector = new SchemaIntrospector(mockGraphQLClient);
      mockGraphQLClient.request.mockRejectedValueOnce(new Error("Request timeout"));

      const schema = await timeoutIntrospector.introspectSchema();

      // Should provide fallback widget types when network fails
      expect(schema.workItemWidgetTypes).toEqual([
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
      expect(schema.typeDefinitions).toBeInstanceOf(Map);
      expect(schema.typeDefinitions.size).toBe(0);
    });

    it("should cache schema results for sequential calls", async () => {
      // Create a completely fresh mock client and introspector for this test
      const freshMockClient = {
        request: jest.fn(),
      } as unknown as jest.Mocked<GraphQLClient>;

      const cachingIntrospector = new SchemaIntrospector(freshMockClient);
      freshMockClient.request.mockResolvedValueOnce(mockIntrospectionResult);

      // First call should trigger introspection
      const result1 = await cachingIntrospector.introspectSchema();

      // Second call should use cached result without calling GraphQL again
      const result2 = await cachingIntrospector.introspectSchema();

      // Third call should also use cached result
      const result3 = await cachingIntrospector.introspectSchema();

      // All should return the exact same cached result object
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      // Verify successful introspection result structure
      expect(result1.workItemWidgetTypes).toEqual([
        "ASSIGNEES",
        "LABELS",
        "MILESTONE",
        "DESCRIPTION",
      ]);
      expect(result1.typeDefinitions.size).toBeGreaterThan(0);
      expect(result1.availableFeatures.has("ASSIGNEES")).toBe(true);
      // Should only call GraphQL once for all sequential requests
      expect(freshMockClient.request).toHaveBeenCalledTimes(1);
    });
  });

  describe("Widget Type Processing", () => {
    it("should correctly process widget type enums", async () => {
      const customMockResult = {
        __schema: {
          types: [
            {
              name: "WorkItemWidgetType",
              kind: "ENUM",
              enumValues: [
                { name: "ASSIGNEES", description: "Assignees widget" },
                { name: "LABELS", description: "Labels widget" },
                { name: "CUSTOM_WIDGET", description: "Custom widget type" },
              ],
            },
          ],
        },
      };

      mockGraphQLClient.request.mockResolvedValueOnce(customMockResult);
      const schema = await introspector.introspectSchema();

      expect(schema.workItemWidgetTypes).toContain("ASSIGNEES");
      expect(schema.workItemWidgetTypes).toContain("LABELS");
      expect(schema.workItemWidgetTypes).toContain("CUSTOM_WIDGET");
      expect(schema.availableFeatures.has("ASSIGNEES")).toBe(true);
    });

    it("should handle missing WorkItemWidgetType", async () => {
      const mockResultWithoutWidgetType = {
        __schema: {
          types: [
            {
              name: "SomeOtherType",
              kind: "OBJECT",
              fields: [],
            },
          ],
        },
      };

      mockGraphQLClient.request.mockResolvedValueOnce(mockResultWithoutWidgetType);
      const schema = await introspector.introspectSchema();

      expect(schema.workItemWidgetTypes).toEqual([]);
      expect(schema.availableFeatures.size).toBe(0);
    });
  });
});
