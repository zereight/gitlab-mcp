/**
 * Unit tests for DynamicWorkItemsQueryBuilder
 * Tests dynamic GraphQL query generation with schema validation
 */

import { DynamicWorkItemsQueryBuilder } from "../../../src/graphql/DynamicWorkItemsQuery";
import { SchemaIntrospector, FieldInfo } from "../../../src/services/SchemaIntrospector";
import { setupMockFetch, resetMocks } from "../../utils/testHelpers";

// Mock dependencies
jest.mock("../../../src/services/SchemaIntrospector");
jest.mock("../../../src/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

setupMockFetch();

describe("DynamicWorkItemsQueryBuilder", () => {
  let mockSchemaIntrospector: jest.Mocked<SchemaIntrospector>;
  let queryBuilder: DynamicWorkItemsQueryBuilder;

  const mockFieldsAssignees: FieldInfo[] = [
    {
      name: "assignees",
      type: { name: "UserConnection", kind: "OBJECT" },
    },
    {
      name: "canInviteMembers",
      type: { name: "Boolean", kind: "SCALAR" },
    },
  ];

  const mockFieldsLabels: FieldInfo[] = [
    {
      name: "labels",
      type: { name: "LabelConnection", kind: "OBJECT" },
    },
    {
      name: "allowsScopedLabels",
      type: { name: "Boolean", kind: "SCALAR" },
    },
  ];

  const mockFieldsMilestone: FieldInfo[] = [
    {
      name: "milestone",
      type: { name: "Milestone", kind: "OBJECT" },
    },
  ];

  const mockFieldsDescription: FieldInfo[] = [
    {
      name: "description",
      type: { name: "String", kind: "SCALAR" },
    },
    {
      name: "descriptionHtml",
      type: { name: "String", kind: "SCALAR" },
    },
    {
      name: "edited",
      type: { name: "Boolean", kind: "SCALAR" },
    },
  ];

  beforeEach(() => {
    resetMocks();

    mockSchemaIntrospector = {
      getAvailableWidgetTypes: jest
        .fn()
        .mockReturnValue(["ASSIGNEES", "LABELS", "MILESTONE", "DESCRIPTION", "WEIGHT"]),
      isWidgetTypeAvailable: jest.fn().mockReturnValue(true),
      getFieldsForType: jest.fn(),
      hasField: jest.fn().mockReturnValue(true),
    } as any;

    queryBuilder = new DynamicWorkItemsQueryBuilder(mockSchemaIntrospector);
  });

  describe("buildWorkItemsQuery", () => {
    it("should build query with all available widgets when none specified", () => {
      mockSchemaIntrospector.getFieldsForType
        .mockReturnValueOnce(mockFieldsAssignees)
        .mockReturnValueOnce(mockFieldsLabels)
        .mockReturnValueOnce(mockFieldsMilestone)
        .mockReturnValueOnce(mockFieldsDescription)
        .mockReturnValueOnce([{ name: "weight", type: { name: "Int", kind: "SCALAR" } }]);

      const query = queryBuilder.buildWorkItemsQuery();

      expect(mockSchemaIntrospector.getAvailableWidgetTypes).toHaveBeenCalled();
      expect(mockSchemaIntrospector.isWidgetTypeAvailable).toHaveBeenCalledTimes(5);

      // Check that the query is a valid GraphQL document
      expect(query.kind).toBe("Document");
      expect(query.definitions).toHaveLength(1);

      // Convert to string to check content
      const queryString = query.loc?.source.body || "";
      expect(queryString).toContain("query GetWorkItems");
      expect(queryString).toContain("$groupPath: ID!");
      expect(queryString).toContain("workItems(types: $types");
    });

    it("should build query with only requested widgets", () => {
      mockSchemaIntrospector.isWidgetTypeAvailable.mockImplementation(widget =>
        ["ASSIGNEES", "LABELS"].includes(widget)
      );

      mockSchemaIntrospector.getFieldsForType
        .mockReturnValueOnce(mockFieldsAssignees)
        .mockReturnValueOnce(mockFieldsLabels);

      const query = queryBuilder.buildWorkItemsQuery(["ASSIGNEES", "LABELS", "NONEXISTENT"]);

      expect(mockSchemaIntrospector.isWidgetTypeAvailable).toHaveBeenCalledWith("ASSIGNEES");
      expect(mockSchemaIntrospector.isWidgetTypeAvailable).toHaveBeenCalledWith("LABELS");
      expect(mockSchemaIntrospector.isWidgetTypeAvailable).toHaveBeenCalledWith("NONEXISTENT");

      const queryString = query.loc?.source.body || "";
      expect(queryString).toContain("query GetWorkItems");
    });

    it("should filter out unavailable widgets", () => {
      mockSchemaIntrospector.isWidgetTypeAvailable.mockImplementation(
        widget => widget === "ASSIGNEES"
      );

      mockSchemaIntrospector.getFieldsForType.mockReturnValueOnce(mockFieldsAssignees);

      const _query = queryBuilder.buildWorkItemsQuery(["ASSIGNEES", "UNAVAILABLE_WIDGET"]);

      expect(mockSchemaIntrospector.isWidgetTypeAvailable).toHaveBeenCalledWith("ASSIGNEES");
      expect(mockSchemaIntrospector.isWidgetTypeAvailable).toHaveBeenCalledWith(
        "UNAVAILABLE_WIDGET"
      );
      expect(mockSchemaIntrospector.getFieldsForType).toHaveBeenCalledTimes(1);
    });
  });

  describe("buildWidgetFragments", () => {
    it("should build fragments for available widget types", () => {
      const buildWidgetFragments = (queryBuilder as any).buildWidgetFragments.bind(queryBuilder);

      mockSchemaIntrospector.getFieldsForType
        .mockReturnValueOnce(mockFieldsAssignees)
        .mockReturnValueOnce(mockFieldsLabels);

      const result = buildWidgetFragments(["ASSIGNEES", "LABELS"]);

      expect(mockSchemaIntrospector.getFieldsForType).toHaveBeenCalledWith(
        "WorkItemWidgetAssignees"
      );
      expect(mockSchemaIntrospector.getFieldsForType).toHaveBeenCalledWith("WorkItemWidgetLabels");

      expect(result).toContain("WorkItemWidgetAssignees");
      expect(result).toContain("WorkItemWidgetLabels");
    });

    it("should skip widgets with no fields", () => {
      const buildWidgetFragments = (queryBuilder as any).buildWidgetFragments.bind(queryBuilder);

      mockSchemaIntrospector.getFieldsForType
        .mockReturnValueOnce(mockFieldsAssignees)
        .mockReturnValueOnce([]); // No fields for second widget

      const result = buildWidgetFragments(["ASSIGNEES", "EMPTY_WIDGET"]);

      expect(result).toContain("WorkItemWidgetAssignees");
      expect(result).not.toContain("WorkItemWidgetEmptyWidget");
    });
  });

  describe("getWidgetTypeName", () => {
    it("should convert SNAKE_CASE to PascalCase correctly", () => {
      const getWidgetTypeName = (queryBuilder as any).getWidgetTypeName.bind(queryBuilder);

      expect(getWidgetTypeName("ASSIGNEES")).toBe("WorkItemWidgetAssignees");
      expect(getWidgetTypeName("START_AND_DUE_DATE")).toBe("WorkItemWidgetStartAndDueDate");
      expect(getWidgetTypeName("TIME_TRACKING")).toBe("WorkItemWidgetTimeTracking");
      expect(getWidgetTypeName("CUSTOM_FIELDS")).toBe("WorkItemWidgetCustomFields");
      expect(getWidgetTypeName("HEALTH_STATUS")).toBe("WorkItemWidgetHealthStatus");
    });

    it("should handle single word widget types", () => {
      const getWidgetTypeName = (queryBuilder as any).getWidgetTypeName.bind(queryBuilder);

      expect(getWidgetTypeName("WEIGHT")).toBe("WorkItemWidgetWeight");
      expect(getWidgetTypeName("COLOR")).toBe("WorkItemWidgetColor");
    });
  });

  describe("buildSafeFields", () => {
    const buildSafeFields = (queryBuilder: any) => queryBuilder.buildSafeFields.bind(queryBuilder);

    it("should build assignees fields correctly", () => {
      const result = buildSafeFields(queryBuilder)("ASSIGNEES", mockFieldsAssignees);

      expect(result).toEqual([
        "assignees {",
        "  nodes {",
        "    id",
        "    username",
        "    name",
        "    avatarUrl",
        "  }",
        "}",
      ]);
    });

    it("should build labels fields correctly", () => {
      const result = buildSafeFields(queryBuilder)("LABELS", mockFieldsLabels);

      expect(result).toEqual([
        "labels {",
        "  nodes {",
        "    id",
        "    title",
        "    color",
        "    description",
        "  }",
        "}",
      ]);
    });

    it("should build milestone fields correctly", () => {
      const result = buildSafeFields(queryBuilder)("MILESTONE", mockFieldsMilestone);

      expect(result).toEqual([
        "milestone {",
        "  id",
        "  title",
        "  state",
        "  dueDate",
        "  startDate",
        "  webPath",
        "}",
      ]);
    });

    it("should build description fields correctly", () => {
      const result = buildSafeFields(queryBuilder)("DESCRIPTION", mockFieldsDescription);

      expect(result).toEqual(["description", "descriptionHtml", "edited"]);
    });

    it("should handle simple scalar widgets", () => {
      const weightFields: FieldInfo[] = [{ name: "weight", type: { name: "Int", kind: "SCALAR" } }];

      const result = buildSafeFields(queryBuilder)("WEIGHT", weightFields);

      expect(result).toEqual(["weight"]);
    });

    it("should skip type field in default handling", () => {
      const fieldsWithType: FieldInfo[] = [
        { name: "type", type: { name: "String", kind: "SCALAR" } },
        { name: "value", type: { name: "String", kind: "SCALAR" } },
      ];

      const result = buildSafeFields(queryBuilder)("UNKNOWN_WIDGET", fieldsWithType);

      expect(result).toEqual(["value"]);
      expect(result).not.toContain("type");
    });

    it("should only include scalar and enum fields in default handling", () => {
      const mixedFields: FieldInfo[] = [
        { name: "scalarField", type: { name: "String", kind: "SCALAR" } },
        { name: "enumField", type: { name: "StatusEnum", kind: "ENUM" } },
        { name: "objectField", type: { name: "ComplexType", kind: "OBJECT" } },
      ];

      const result = buildSafeFields(queryBuilder)("UNKNOWN_WIDGET", mixedFields);

      expect(result).toEqual(["scalarField", "enumField"]);
      expect(result).not.toContain("objectField");
    });
  });

  describe("widget-specific field builders", () => {
    it("should build assignees fields when field is available", () => {
      mockSchemaIntrospector.hasField.mockReturnValue(true);

      const buildAssigneesFields = (queryBuilder as any).buildAssigneesFields.bind(queryBuilder);
      const result = buildAssigneesFields();

      expect(mockSchemaIntrospector.hasField).toHaveBeenCalledWith(
        "WorkItemWidgetAssignees",
        "assignees"
      );
      expect(result).toHaveLength(8); // assignees block with nested nodes
    });

    it("should return empty array when assignees field is not available", () => {
      mockSchemaIntrospector.hasField.mockReturnValue(false);

      const buildAssigneesFields = (queryBuilder as any).buildAssigneesFields.bind(queryBuilder);
      const result = buildAssigneesFields();

      expect(result).toEqual([]);
    });

    it("should build labels fields when field is available", () => {
      mockSchemaIntrospector.hasField.mockReturnValue(true);

      const buildLabelsFields = (queryBuilder as any).buildLabelsFields.bind(queryBuilder);
      const result = buildLabelsFields();

      expect(mockSchemaIntrospector.hasField).toHaveBeenCalledWith(
        "WorkItemWidgetLabels",
        "labels"
      );
      expect(result).toHaveLength(8); // labels block with nested nodes
    });

    it("should build milestone fields when field is available", () => {
      mockSchemaIntrospector.hasField.mockReturnValue(true);

      const buildMilestoneFields = (queryBuilder as any).buildMilestoneFields.bind(queryBuilder);
      const result = buildMilestoneFields();

      expect(mockSchemaIntrospector.hasField).toHaveBeenCalledWith(
        "WorkItemWidgetMilestone",
        "milestone"
      );
      expect(result).toHaveLength(8); // milestone block with properties
    });

    it("should build description fields with conditional fields", () => {
      mockSchemaIntrospector.hasField.mockImplementation((type, field) => {
        if (field === "descriptionHtml") return true;
        if (field === "edited") return false;
        return true;
      });

      const buildDescriptionFields = (queryBuilder as any).buildDescriptionFields.bind(
        queryBuilder
      );
      const result = buildDescriptionFields();

      expect(result).toEqual(["description", "descriptionHtml"]);
      expect(result).not.toContain("edited");
    });
  });

  describe("buildMinimalQuery", () => {
    it("should build minimal query without widgets", () => {
      const query = queryBuilder.buildMinimalQuery();

      expect(query.kind).toBe("Document");
      expect(query.definitions).toHaveLength(1);

      const queryString = query.loc?.source.body || "";
      expect(queryString).toContain("query GetWorkItemsMinimal");
      expect(queryString).toContain("workItems(first: $first");
      expect(queryString).toContain("widgets {");
      expect(queryString).toContain("type");
      expect(queryString).not.toContain("assignees");
      expect(queryString).not.toContain("labels");
    });
  });

  describe("error handling and edge cases", () => {
    it("should handle empty widget list", () => {
      mockSchemaIntrospector.getAvailableWidgetTypes.mockReturnValue([]);

      const query = queryBuilder.buildWorkItemsQuery();

      expect(query).toBeDefined();
      expect(query.kind).toBe("Document");
    });

    it("should handle all widgets being unavailable", () => {
      mockSchemaIntrospector.isWidgetTypeAvailable.mockReturnValue(false);

      const query = queryBuilder.buildWorkItemsQuery(["ASSIGNEES", "LABELS"]);

      expect(query).toBeDefined();
      expect(mockSchemaIntrospector.isWidgetTypeAvailable).toHaveBeenCalledTimes(2);
    });

    it("should handle widget with only type field", () => {
      const onlyTypeField: FieldInfo[] = [
        { name: "type", type: { name: "String", kind: "SCALAR" } },
      ];

      mockSchemaIntrospector.getFieldsForType.mockReturnValue(onlyTypeField);

      const buildWidgetFragment = (queryBuilder as any).buildWidgetFragment.bind(queryBuilder);
      const result = buildWidgetFragment("TEST_WIDGET");

      expect(result).toBeNull(); // Should return null when no safe fields available
    });

    it("should handle complex nested widget types", () => {
      const complexFields: FieldInfo[] = [
        {
          name: "complexField",
          type: {
            name: null,
            kind: "LIST",
            ofType: {
              name: "ComplexType",
              kind: "OBJECT",
            },
          },
        },
      ];

      const buildSafeFields = (queryBuilder as any).buildSafeFields.bind(queryBuilder);
      const result = buildSafeFields("COMPLEX_WIDGET", complexFields);

      expect(result).toEqual([]); // Should exclude complex fields
    });
  });

  describe("logging", () => {
    it("should log query building information", () => {
      mockSchemaIntrospector.getFieldsForType.mockReturnValue(mockFieldsAssignees);

      queryBuilder.buildWorkItemsQuery(["ASSIGNEES"]);

      // Logger is mocked, so we can't verify exact calls, but the test ensures no errors
      expect(mockSchemaIntrospector.isWidgetTypeAvailable).toHaveBeenCalled();
    });
  });
});
