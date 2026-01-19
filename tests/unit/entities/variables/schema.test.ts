/**
 * ManageVariableSchema Unit Tests
 * Tests schema validation for manage_variable CQRS Command tool
 */

import { ManageVariableSchema } from "../../../../src/entities/variables/schema";

describe("ManageVariableSchema", () => {
  describe("action field validation", () => {
    it("should accept 'create' action", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "NEW_VAR",
        value: "test-value",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("create");
      }
    });

    it("should accept 'update' action", () => {
      const result = ManageVariableSchema.safeParse({
        action: "update",
        namespace: "test/project",
        key: "EXISTING_VAR",
        value: "new-value",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("update");
      }
    });

    it("should accept 'delete' action", () => {
      const result = ManageVariableSchema.safeParse({
        action: "delete",
        namespace: "test/project",
        key: "VAR_TO_DELETE",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("delete");
      }
    });

    it("should reject invalid action", () => {
      const result = ManageVariableSchema.safeParse({
        action: "invalid",
        namespace: "test/project",
        key: "VAR",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("create action validation", () => {
    it("should require value for create action", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "NEW_VAR",
        // Missing value
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const valueError = result.error.issues.find(i => i.path.includes("value"));
        expect(valueError).toBeDefined();
      }
    });

    it("should accept create with all optional fields", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "FULL_VAR",
        value: "my-value",
        variable_type: "env_var",
        environment_scope: "production",
        protected: true,
        masked: true,
        raw: false,
        description: "A test variable",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variable_type).toBe("env_var");
        expect(result.data.environment_scope).toBe("production");
        expect(result.data.protected).toBe(true);
        expect(result.data.masked).toBe(true);
        expect(result.data.raw).toBe(false);
        expect(result.data.description).toBe("A test variable");
      }
    });
  });

  describe("variable_type field validation", () => {
    it("should accept 'env_var' type", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "ENV_VAR",
        value: "value",
        variable_type: "env_var",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variable_type).toBe("env_var");
      }
    });

    it("should accept 'file' type", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "FILE_VAR",
        value: "file content",
        variable_type: "file",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variable_type).toBe("file");
      }
    });

    it("should coerce 'env' to 'env_var'", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        variable_type: "env",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variable_type).toBe("env_var");
      }
    });

    it("should coerce 'environment' to 'env_var'", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        variable_type: "environment",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variable_type).toBe("env_var");
      }
    });

    it("should coerce 'var' to 'env_var'", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        variable_type: "var",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variable_type).toBe("env_var");
      }
    });

    it("should coerce 'variable' to 'env_var'", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        variable_type: "variable",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variable_type).toBe("env_var");
      }
    });

    it("should coerce 'file_var' to 'file'", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        variable_type: "file_var",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variable_type).toBe("file");
      }
    });

    it("should be case-insensitive for variable_type coercion", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        variable_type: "ENV_VAR",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variable_type).toBe("env_var");
      }
    });

    it("should reject invalid variable_type", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        variable_type: "invalid_type",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("boolean field coercion (flexibleBoolean)", () => {
    it("should accept boolean true for protected", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        protected: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.protected).toBe(true);
      }
    });

    it("should accept boolean false for masked", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        masked: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.masked).toBe(false);
      }
    });

    it("should coerce string 'true' to boolean true", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        protected: "true",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.protected).toBe(true);
      }
    });

    it("should coerce string 'false' to boolean false", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        masked: "false",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.masked).toBe(false);
      }
    });

    it("should coerce string 't' to boolean true", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        raw: "t",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.raw).toBe(true);
      }
    });

    it("should coerce string '1' to boolean true", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        raw: "1",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.raw).toBe(true);
      }
    });

    it("should coerce non-truthy string to boolean false", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        raw: "no",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.raw).toBe(false);
      }
    });

    it("should coerce number 1 to boolean true", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        protected: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.protected).toBe(true);
      }
    });

    it("should coerce number 0 to boolean false", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        masked: 0,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.masked).toBe(false);
      }
    });
  });

  describe("update action validation", () => {
    it("should allow update without value", () => {
      const result = ManageVariableSchema.safeParse({
        action: "update",
        namespace: "test/project",
        key: "EXISTING_VAR",
        protected: true,
      });
      expect(result.success).toBe(true);
    });

    it("should accept update with filter", () => {
      const result = ManageVariableSchema.safeParse({
        action: "update",
        namespace: "test/project",
        key: "SCOPED_VAR",
        value: "new-value",
        filter: {
          environment_scope: "staging",
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filter?.environment_scope).toBe("staging");
      }
    });
  });

  describe("delete action validation", () => {
    it("should allow delete with only required fields", () => {
      const result = ManageVariableSchema.safeParse({
        action: "delete",
        namespace: "test/project",
        key: "VAR_TO_DELETE",
      });
      expect(result.success).toBe(true);
    });

    it("should accept delete with filter", () => {
      const result = ManageVariableSchema.safeParse({
        action: "delete",
        namespace: "test/project",
        key: "SCOPED_VAR",
        filter: {
          environment_scope: "development",
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filter?.environment_scope).toBe("development");
      }
    });

    it("should ignore value for delete action", () => {
      const result = ManageVariableSchema.safeParse({
        action: "delete",
        namespace: "test/project",
        key: "VAR",
        value: "ignored-value",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("key field validation", () => {
    it("should accept alphanumeric key", () => {
      const result = ManageVariableSchema.safeParse({
        action: "delete",
        namespace: "test/project",
        key: "MY_VAR_123",
      });
      expect(result.success).toBe(true);
    });

    it("should accept key with underscores", () => {
      const result = ManageVariableSchema.safeParse({
        action: "delete",
        namespace: "test/project",
        key: "DATABASE_CONNECTION_STRING",
      });
      expect(result.success).toBe(true);
    });

    it("should require key", () => {
      const result = ManageVariableSchema.safeParse({
        action: "delete",
        namespace: "test/project",
        // Missing key
      });
      expect(result.success).toBe(false);
    });
  });

  describe("environment_scope field", () => {
    it("should accept wildcard scope", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        environment_scope: "*",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.environment_scope).toBe("*");
      }
    });

    it("should accept specific environment scope", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        environment_scope: "production",
      });
      expect(result.success).toBe(true);
    });

    it("should accept environment scope with wildcards", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        environment_scope: "review/*",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("description field", () => {
    it("should accept description", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        description: "API key for external service",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe("API key for external service");
      }
    });

    it("should allow empty description", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        description: "",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty value for create", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "EMPTY_VAR",
        value: "",
      });
      expect(result.success).toBe(true);
    });

    it("should handle multiline value", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "CERT",
        value: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
        variable_type: "file",
      });
      expect(result.success).toBe(true);
    });

    it("should strip unknown fields", () => {
      const result = ManageVariableSchema.safeParse({
        action: "create",
        namespace: "test/project",
        key: "VAR",
        value: "value",
        unknownField: "should be stripped",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).unknownField).toBeUndefined();
      }
    });
  });
});
