/**
 * BrowseVariablesSchema Unit Tests
 * Tests schema validation for browse_variables CQRS Query tool
 */

import { BrowseVariablesSchema } from "../../../../src/entities/variables/schema-readonly";

describe("BrowseVariablesSchema", () => {
  describe("action field validation", () => {
    it("should accept 'list' action", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "list",
        namespace: "test/project",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("list");
      }
    });

    it("should accept 'get' action with key", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "get",
        namespace: "test/project",
        key: "API_KEY",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("get");
        expect(result.data.key).toBe("API_KEY");
      }
    });

    it("should reject invalid action", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "invalid",
        namespace: "test/project",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing action", () => {
      const result = BrowseVariablesSchema.safeParse({
        namespace: "test/project",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("namespace field validation", () => {
    it("should accept project namespace", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "list",
        namespace: "group/subgroup/project",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.namespace).toBe("group/subgroup/project");
      }
    });

    it("should accept group namespace", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "list",
        namespace: "my-group",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing namespace", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "list",
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-string namespace", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "list",
        namespace: 123,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("list action fields", () => {
    it("should accept per_page parameter", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "list",
        namespace: "test/project",
        per_page: 50,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(50);
      }
    });

    it("should accept page parameter", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "list",
        namespace: "test/project",
        page: 2,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
      }
    });

    it("should accept both pagination parameters", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "list",
        namespace: "test/project",
        per_page: 25,
        page: 3,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(25);
        expect(result.data.page).toBe(3);
      }
    });

    it("should reject non-number per_page", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "list",
        namespace: "test/project",
        per_page: "fifty",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("get action fields", () => {
    it("should require key for get action", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "get",
        namespace: "test/project",
        // Missing key
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const keyError = result.error.issues.find(i => i.path.includes("key"));
        expect(keyError).toBeDefined();
      }
    });

    it("should accept key for get action", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "get",
        namespace: "test/project",
        key: "DATABASE_URL",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.key).toBe("DATABASE_URL");
      }
    });

    it("should allow key to be optional for list action", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "list",
        namespace: "test/project",
        // key is optional for list
      });
      expect(result.success).toBe(true);
    });
  });

  describe("filter field validation", () => {
    it("should accept filter with environment_scope", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "get",
        namespace: "test/project",
        key: "API_KEY",
        filter: {
          environment_scope: "production",
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filter?.environment_scope).toBe("production");
      }
    });

    it("should accept filter with wildcard environment_scope", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "get",
        namespace: "test/project",
        key: "API_KEY",
        filter: {
          environment_scope: "*",
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filter?.environment_scope).toBe("*");
      }
    });

    it("should accept empty filter object", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "get",
        namespace: "test/project",
        key: "API_KEY",
        filter: {},
      });
      expect(result.success).toBe(true);
    });

    it("should allow filter to be optional", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "get",
        namespace: "test/project",
        key: "API_KEY",
        // filter is optional
      });
      expect(result.success).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should accept minimal valid input for list", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "list",
        namespace: "n",
      });
      expect(result.success).toBe(true);
    });

    it("should accept minimal valid input for get", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "get",
        namespace: "n",
        key: "K",
      });
      expect(result.success).toBe(true);
    });

    it("should strip unknown fields", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "list",
        namespace: "test/project",
        unknownField: "should be stripped",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).unknownField).toBeUndefined();
      }
    });

    it("should handle special characters in key", () => {
      const result = BrowseVariablesSchema.safeParse({
        action: "get",
        namespace: "test/project",
        key: "MY_VAR_123",
      });
      expect(result.success).toBe(true);
    });
  });
});
