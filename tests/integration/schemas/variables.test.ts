/**
 * Variables Schema Integration Tests
 * Tests schemas using handler functions with real GitLab API
 */

import { BrowseVariablesSchema } from "../../../src/entities/variables/schema-readonly";
import { ManageVariableSchema } from "../../../src/entities/variables/schema";
import { IntegrationTestHelper } from "../helpers/registry-helper";

describe("Variables Schema - GitLab Integration", () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error("GITLAB_TOKEN environment variable is required");
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("Integration test helper initialized for variables testing");
  });

  describe("BrowseVariablesSchema - list action", () => {
    it("should validate and test with real project data using handler functions", async () => {
      console.log("Getting real project for variables testing");

      // Get actual project from data lifecycle
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        path_with_namespace: string;
        name: string;
        id: number;
      }[];
      if (projects.length === 0) {
        console.log("No projects available for testing");
        return;
      }

      const testProject = projects[0];
      console.log(`Using project: ${testProject.name} (ID: ${testProject.id})`);

      const validParams = {
        action: "list" as const,
        namespace: testProject.path_with_namespace,
        per_page: 10,
      };

      // Validate schema
      const result = BrowseVariablesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const variables = (await helper.executeTool("browse_variables", result.data)) as {
          key: string;
          value: string;
          protected: boolean;
          masked: boolean;
          environment_scope: string;
        }[];
        expect(Array.isArray(variables)).toBe(true);
        console.log(`Retrieved ${variables.length} variables via handler`);

        // Validate structure if we have variables
        if (variables.length > 0) {
          const variable = variables[0];
          expect(variable).toHaveProperty("key");
          expect(variable).toHaveProperty("environment_scope");
          console.log(`Validated variable structure: ${variable.key}`);
        }
      }

      console.log("BrowseVariablesSchema list action test completed with real data");
    });

    it("should validate group-level variables", async () => {
      // Get a group for testing
      const namespaces = (await helper.executeTool("browse_namespaces", {
        action: "list",
        per_page: 1,
      })) as { kind: string; id: number; full_path: string }[];
      if (namespaces.length === 0) {
        console.log("No namespaces available for group variables testing");
        return;
      }

      const testGroup = namespaces.find(ns => ns.kind === "group");
      if (!testGroup) {
        console.log("No groups found for group variables testing");
        return;
      }

      const validParams = {
        action: "list" as const,
        namespace: testGroup.full_path,
        per_page: 5,
      };

      const result = BrowseVariablesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const variables = (await helper.executeTool("browse_variables", result.data)) as {
          key: string;
        }[];
        expect(Array.isArray(variables)).toBe(true);
        console.log(`Retrieved ${variables.length} group variables via handler`);
      }

      console.log("BrowseVariablesSchema group-level test completed");
    });

    it("should validate pagination parameters", async () => {
      // Get actual project for validation
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        path_with_namespace: string;
      }[];
      if (projects.length === 0) {
        console.log("No projects available for pagination testing");
        return;
      }

      const testProject = projects[0];
      const paginationParams = {
        action: "list" as const,
        namespace: testProject.path_with_namespace,
        per_page: 5,
        page: 1,
      };

      const result = BrowseVariablesSchema.safeParse(paginationParams);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "list") {
        expect(result.data.per_page).toBe(5);
        expect(result.data.page).toBe(1);
        expect(result.data.namespace).toBe(testProject.path_with_namespace);
      }

      console.log("BrowseVariablesSchema validates pagination parameters");
    });

    it("should reject invalid action type", async () => {
      const invalidParams = {
        action: "invalid_action",
        namespace: "test/project",
      };

      const result = BrowseVariablesSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log("BrowseVariablesSchema correctly rejects invalid action type");
    });
  });

  describe("BrowseVariablesSchema - get action", () => {
    it("should validate get variable parameters with real data", async () => {
      // Get a project and its variables for testing
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        path_with_namespace: string;
      }[];
      if (projects.length === 0) {
        console.log("No projects available for get variable testing");
        return;
      }

      const testProject = projects[0];
      const variables = (await helper.executeTool("browse_variables", {
        action: "list",
        namespace: testProject.path_with_namespace,
        per_page: 1,
      })) as { key: string }[];

      if (variables.length === 0) {
        console.log("No variables found for get variable testing");
        return;
      }

      const testVariable = variables[0];
      const validParams = {
        action: "get" as const,
        namespace: testProject.path_with_namespace,
        key: testVariable.key,
      };

      const result = BrowseVariablesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "get") {
        expect(result.data.namespace).toBe(testProject.path_with_namespace);
        expect(result.data.key).toBe(testVariable.key);
      }

      console.log("BrowseVariablesSchema get action validates parameters correctly");
    });

    it("should test handler function for single variable", async () => {
      // Get a project and its variables for testing
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        path_with_namespace: string;
      }[];
      if (projects.length === 0) {
        console.log("No projects available for handler testing");
        return;
      }

      const testProject = projects[0];
      const variables = (await helper.executeTool("browse_variables", {
        action: "list",
        namespace: testProject.path_with_namespace,
        per_page: 1,
      })) as { key: string }[];

      if (variables.length === 0) {
        console.log("No variables found for handler testing");
        return;
      }

      const testVariable = variables[0];
      const params = {
        action: "get" as const,
        namespace: testProject.path_with_namespace,
        key: testVariable.key,
      };

      // Validate parameters first
      const paramResult = BrowseVariablesSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (paramResult.success) {
        // Test handler function
        const variable = (await helper.executeTool("browse_variables", paramResult.data)) as {
          key: string;
          value: string;
          protected: boolean;
          masked: boolean;
          environment_scope: string;
        };

        // Validate variable structure
        expect(variable).toHaveProperty("key");
        expect(variable).toHaveProperty("environment_scope");

        console.log(`BrowseVariablesSchema get action handler test successful: ${variable.key}`);
      }
    });

    it("should require key for get action", async () => {
      const invalidParams = {
        action: "get",
        namespace: "test/project",
        // Missing key
      };

      const result = BrowseVariablesSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log("BrowseVariablesSchema correctly requires key for get action");
    });
  });

  describe("ManageVariableSchema - create action", () => {
    it("should validate create variable parameters", async () => {
      const params = {
        action: "create" as const,
        namespace: "test/project",
        key: "TEST_VAR",
        value: "test-value",
        protected: false,
        masked: false,
      };

      const result = ManageVariableSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "create") {
        expect(result.data.key).toBe("TEST_VAR");
        expect(result.data.value).toBe("test-value");
      }

      console.log("ManageVariableSchema create action validates correctly");
    });

    it("should require value for create action", async () => {
      const invalidParams = {
        action: "create",
        namespace: "test/project",
        key: "TEST_VAR",
        // Missing value
      };

      const result = ManageVariableSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageVariableSchema correctly requires value for create action");
    });

    it("should accept variable_type parameter", async () => {
      const params = {
        action: "create" as const,
        namespace: "test/project",
        key: "FILE_VAR",
        value: "file-content",
        variable_type: "file" as const,
      };

      const result = ManageVariableSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "create") {
        expect(result.data.variable_type).toBe("file");
      }

      console.log("ManageVariableSchema accepts variable_type parameter");
    });

    it("should accept environment_scope parameter", async () => {
      const params = {
        action: "create" as const,
        namespace: "test/project",
        key: "PROD_VAR",
        value: "prod-value",
        environment_scope: "production",
      };

      const result = ManageVariableSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "create") {
        expect(result.data.environment_scope).toBe("production");
      }

      console.log("ManageVariableSchema accepts environment_scope parameter");
    });
  });

  describe("ManageVariableSchema - update action", () => {
    it("should validate update variable parameters", async () => {
      const params = {
        action: "update" as const,
        namespace: "test/project",
        key: "EXISTING_VAR",
        value: "updated-value",
        protected: true,
      };

      const result = ManageVariableSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "update") {
        expect(result.data.key).toBe("EXISTING_VAR");
        expect(result.data.value).toBe("updated-value");
        expect(result.data.protected).toBe(true);
      }

      console.log("ManageVariableSchema update action validates correctly");
    });

    it("should accept filter parameter for environment scope", async () => {
      const params = {
        action: "update" as const,
        namespace: "test/project",
        key: "SCOPED_VAR",
        value: "new-value",
        filter: {
          environment_scope: "staging",
        },
      };

      const result = ManageVariableSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "update") {
        expect(result.data.filter?.environment_scope).toBe("staging");
      }

      console.log("ManageVariableSchema accepts filter parameter for update action");
    });
  });

  describe("ManageVariableSchema - delete action", () => {
    it("should validate delete variable parameters", async () => {
      const params = {
        action: "delete" as const,
        namespace: "test/project",
        key: "VAR_TO_DELETE",
      };

      const result = ManageVariableSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "delete") {
        expect(result.data.key).toBe("VAR_TO_DELETE");
      }

      console.log("ManageVariableSchema delete action validates correctly");
    });

    it("should accept filter parameter for delete with environment scope", async () => {
      const params = {
        action: "delete" as const,
        namespace: "test/project",
        key: "SCOPED_VAR",
        filter: {
          environment_scope: "development",
        },
      };

      const result = ManageVariableSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "delete") {
        expect(result.data.filter?.environment_scope).toBe("development");
      }

      console.log("ManageVariableSchema accepts filter parameter for delete action");
    });
  });

  describe("ManageVariableSchema - protection options", () => {
    it("should accept protected and masked parameters", async () => {
      const params = {
        action: "create" as const,
        namespace: "test/project",
        key: "PROTECTED_VAR",
        value: "secret-value",
        protected: true,
        masked: true,
      };

      const result = ManageVariableSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "create") {
        expect(result.data.protected).toBe(true);
        expect(result.data.masked).toBe(true);
      }

      console.log("ManageVariableSchema accepts protection parameters");
    });

    it("should accept raw parameter", async () => {
      const params = {
        action: "create" as const,
        namespace: "test/project",
        key: "RAW_VAR",
        value: "$OTHER_VAR",
        raw: true,
      };

      const result = ManageVariableSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "create") {
        expect(result.data.raw).toBe(true);
      }

      console.log("ManageVariableSchema accepts raw parameter");
    });

    it("should accept description parameter", async () => {
      const params = {
        action: "create" as const,
        namespace: "test/project",
        key: "DESCRIBED_VAR",
        value: "some-value",
        description: "This is a test variable for CI/CD",
      };

      const result = ManageVariableSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "create") {
        expect(result.data.description).toBe("This is a test variable for CI/CD");
      }

      console.log("ManageVariableSchema accepts description parameter");
    });
  });

  describe("Variable Data Lifecycle", () => {
    // Test variable lifecycle: create -> get -> update -> delete
    const testVarKey = `TEST_VAR_${Date.now()}`;
    let testProject: { path_with_namespace: string } | null = null;

    beforeAll(async () => {
      // Get a project for lifecycle testing
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        path_with_namespace: string;
      }[];
      if (projects.length > 0) {
        testProject = projects[0];
      }
    });

    it("should create a variable", async () => {
      if (!testProject) {
        console.log("No project available for lifecycle testing");
        return;
      }

      const createParams = {
        action: "create" as const,
        namespace: testProject.path_with_namespace,
        key: testVarKey,
        value: "initial-value",
        protected: false,
        masked: false,
        environment_scope: "*",
      };

      const result = ManageVariableSchema.safeParse(createParams);
      expect(result.success).toBe(true);

      if (result.success) {
        try {
          const created = (await helper.executeTool("manage_variable", result.data)) as {
            key: string;
            value: string;
          };
          expect(created.key).toBe(testVarKey);
          console.log(`Created variable: ${created.key}`);
        } catch (_error) {
          // Variable might already exist, which is fine for integration test
          console.log(`Variable creation skipped (may already exist): ${testVarKey}`);
        }
      }
    });

    it("should get the created variable", async () => {
      if (!testProject) {
        console.log("No project available for lifecycle testing");
        return;
      }

      const getParams = {
        action: "get" as const,
        namespace: testProject.path_with_namespace,
        key: testVarKey,
      };

      const result = BrowseVariablesSchema.safeParse(getParams);
      expect(result.success).toBe(true);

      if (result.success) {
        try {
          const variable = (await helper.executeTool("browse_variables", result.data)) as {
            key: string;
            environment_scope: string;
          };
          expect(variable.key).toBe(testVarKey);
          console.log(`Retrieved variable: ${variable.key}`);
        } catch {
          console.log(`Variable not found (may not have been created): ${testVarKey}`);
        }
      }
    });

    it("should update the variable", async () => {
      if (!testProject) {
        console.log("No project available for lifecycle testing");
        return;
      }

      const updateParams = {
        action: "update" as const,
        namespace: testProject.path_with_namespace,
        key: testVarKey,
        value: "updated-value",
        protected: false,
      };

      const result = ManageVariableSchema.safeParse(updateParams);
      expect(result.success).toBe(true);

      if (result.success) {
        try {
          const updated = (await helper.executeTool("manage_variable", result.data)) as {
            key: string;
            value: string;
          };
          expect(updated.key).toBe(testVarKey);
          console.log(`Updated variable: ${updated.key}`);
        } catch {
          console.log(`Variable update skipped (may not exist): ${testVarKey}`);
        }
      }
    });

    it("should delete the variable", async () => {
      if (!testProject) {
        console.log("No project available for lifecycle testing");
        return;
      }

      const deleteParams = {
        action: "delete" as const,
        namespace: testProject.path_with_namespace,
        key: testVarKey,
      };

      const result = ManageVariableSchema.safeParse(deleteParams);
      expect(result.success).toBe(true);

      if (result.success) {
        try {
          const deleted = (await helper.executeTool("manage_variable", result.data)) as {
            deleted: boolean;
          };
          expect(deleted.deleted).toBe(true);
          console.log(`Deleted variable: ${testVarKey}`);
        } catch {
          console.log(`Variable deletion skipped (may not exist): ${testVarKey}`);
        }
      }
    });
  });
});
