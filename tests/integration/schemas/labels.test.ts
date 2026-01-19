/**
 * Labels Schema Integration Tests
 * Tests schemas using handler functions with real GitLab API
 */

import { BrowseLabelsSchema } from "../../../src/entities/labels/schema-readonly";
import { ManageLabelSchema } from "../../../src/entities/labels/schema";
import { IntegrationTestHelper } from "../helpers/registry-helper";

describe("Labels Schema - GitLab Integration", () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error("GITLAB_TOKEN environment variable is required");
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("Integration test helper initialized for labels testing");
  });

  describe("BrowseLabelsSchema - list action", () => {
    it("should validate and test with real project data using handler functions", async () => {
      console.log("Getting real project for labels testing");

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
        with_counts: true,
        include_ancestor_groups: true,
        per_page: 10,
      };

      // Validate schema
      const result = BrowseLabelsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const labels = (await helper.executeTool("browse_labels", result.data)) as {
          id: number;
          name: string;
          color: string;
          description: string;
        }[];
        expect(Array.isArray(labels)).toBe(true);
        console.log(`Retrieved ${labels.length} labels via handler`);

        // Validate structure if we have labels
        if (labels.length > 0) {
          const label = labels[0];
          expect(label).toHaveProperty("id");
          expect(label).toHaveProperty("name");
          expect(label).toHaveProperty("color");
          console.log(`Validated label structure: ${label.name}`);
        }
      }

      console.log("BrowseLabelsSchema list action test completed with real data");
    });

    it("should validate group-level labels", async () => {
      // Get a group for testing
      const namespaces = (await helper.executeTool("browse_namespaces", {
        action: "list",
        per_page: 1,
      })) as { kind: string; id: number; full_path: string }[];
      if (namespaces.length === 0) {
        console.log("No namespaces available for group labels testing");
        return;
      }

      const testGroup = namespaces.find(ns => ns.kind === "group");
      if (!testGroup) {
        console.log("No groups found for group labels testing");
        return;
      }

      const validParams = {
        action: "list" as const,
        namespace: testGroup.full_path,
        with_counts: true,
        per_page: 5,
      };

      const result = BrowseLabelsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const labels = (await helper.executeTool("browse_labels", result.data)) as {
          name: string;
        }[];
        expect(Array.isArray(labels)).toBe(true);
        console.log(`Retrieved ${labels.length} group labels via handler`);
      }

      console.log("BrowseLabelsSchema group-level test completed");
    });

    it("should validate search and filtering parameters", async () => {
      // Get actual project for validation
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        path_with_namespace: string;
      }[];
      if (projects.length === 0) {
        console.log("No projects available for search parameter testing");
        return;
      }

      const testProject = projects[0];
      const searchParams = {
        action: "list" as const,
        namespace: testProject.path_with_namespace,
        search: "bug",
        with_counts: true,
      };

      const result = BrowseLabelsSchema.safeParse(searchParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.search).toBe("bug");
        expect(result.data.with_counts).toBe(true);
        expect(result.data.namespace).toBe(testProject.path_with_namespace);
      }

      console.log("BrowseLabelsSchema validates search parameters");
    });

    it("should reject invalid parameters", async () => {
      const invalidParams = {
        action: "list",
        namespace: "test/project",
        with_counts: "invalid", // Should be boolean
      };

      const result = BrowseLabelsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log("BrowseLabelsSchema correctly rejects invalid parameters");
    });
  });

  describe("BrowseLabelsSchema - get action", () => {
    it("should validate get label parameters with real data", async () => {
      // Get a project and its labels for testing
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        path_with_namespace: string;
      }[];
      if (projects.length === 0) {
        console.log("No projects available for get label testing");
        return;
      }

      const testProject = projects[0];
      const labels = (await helper.executeTool("browse_labels", {
        action: "list",
        namespace: testProject.path_with_namespace,
        per_page: 1,
      })) as { id: number }[];

      if (labels.length === 0) {
        console.log("No labels found for get label testing");
        return;
      }

      const testLabel = labels[0];
      const validParams = {
        action: "get" as const,
        namespace: testProject.path_with_namespace,
        label_id: testLabel.id.toString(),
      };

      const result = BrowseLabelsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.namespace).toBe(testProject.path_with_namespace);
        expect(result.data.label_id).toBe(testLabel.id.toString());
      }

      console.log("BrowseLabelsSchema get action validates parameters correctly");
    });

    it("should test handler function for single label", async () => {
      // Get a project and its labels for testing
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        path_with_namespace: string;
      }[];
      if (projects.length === 0) {
        console.log("No projects available for handler testing");
        return;
      }

      const testProject = projects[0];
      const labels = (await helper.executeTool("browse_labels", {
        action: "list",
        namespace: testProject.path_with_namespace,
        per_page: 1,
      })) as { id: number; name: string }[];

      if (labels.length === 0) {
        console.log("No labels found for handler testing");
        return;
      }

      const testLabel = labels[0];
      const params = {
        action: "get" as const,
        namespace: testProject.path_with_namespace,
        label_id: testLabel.id.toString(),
      };

      // Validate parameters first
      const paramResult = BrowseLabelsSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (paramResult.success) {
        // Test handler function
        const label = (await helper.executeTool("browse_labels", paramResult.data)) as {
          id: number;
          name: string;
          color: string;
          description: string;
        };

        // Validate label structure
        expect(label).toHaveProperty("id");
        expect(label).toHaveProperty("name");
        expect(label).toHaveProperty("color");

        console.log(`BrowseLabelsSchema get action handler test successful: ${label.name}`);
      }
    });

    it("should require label_id for get action", async () => {
      const invalidParams = {
        action: "get",
        namespace: "test/project",
        // Missing label_id
      };

      const result = BrowseLabelsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log("BrowseLabelsSchema correctly requires label_id for get action");
    });
  });

  describe("ManageLabelSchema - create action", () => {
    it("should validate create label parameters", async () => {
      const params = {
        action: "create" as const,
        namespace: "test/project",
        name: "test-label",
        color: "#ff0000",
        description: "A test label",
      };

      const result = ManageLabelSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.action).toBe("create");
        expect(result.data.name).toBe("test-label");
        expect(result.data.color).toBe("#ff0000");
        expect(result.data.description).toBe("A test label");
      }

      console.log("ManageLabelSchema create action validates correctly");
    });

    it("should require name for create action", async () => {
      const invalidParams = {
        action: "create",
        namespace: "test/project",
        color: "#ff0000",
        // Missing name
      };

      const result = ManageLabelSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageLabelSchema correctly requires name for create action");
    });

    it("should require color for create action", async () => {
      const invalidParams = {
        action: "create",
        namespace: "test/project",
        name: "test-label",
        // Missing color
      };

      const result = ManageLabelSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageLabelSchema correctly requires color for create action");
    });
  });

  describe("ManageLabelSchema - update action", () => {
    it("should validate update label parameters", async () => {
      const params = {
        action: "update" as const,
        namespace: "test/project",
        label_id: "1",
        new_name: "updated-label",
        color: "#00ff00",
      };

      const result = ManageLabelSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.action).toBe("update");
        expect(result.data.label_id).toBe("1");
        expect(result.data.new_name).toBe("updated-label");
        expect(result.data.color).toBe("#00ff00");
      }

      console.log("ManageLabelSchema update action validates correctly");
    });

    it("should require label_id for update action", async () => {
      const invalidParams = {
        action: "update",
        namespace: "test/project",
        new_name: "updated-label",
        // Missing label_id
      };

      const result = ManageLabelSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageLabelSchema correctly requires label_id for update action");
    });
  });

  describe("ManageLabelSchema - delete action", () => {
    it("should validate delete label parameters", async () => {
      const params = {
        action: "delete" as const,
        namespace: "test/project",
        label_id: "1",
      };

      const result = ManageLabelSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.action).toBe("delete");
        expect(result.data.label_id).toBe("1");
      }

      console.log("ManageLabelSchema delete action validates correctly");
    });

    it("should require label_id for delete action", async () => {
      const invalidParams = {
        action: "delete",
        namespace: "test/project",
        // Missing label_id
      };

      const result = ManageLabelSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageLabelSchema correctly requires label_id for delete action");
    });
  });

  describe("ManageLabelSchema - priority option", () => {
    it("should accept priority parameter", async () => {
      const params = {
        action: "create" as const,
        namespace: "test/project",
        name: "priority-label",
        color: "#0000ff",
        priority: 5,
      };

      const result = ManageLabelSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.priority).toBe(5);
      }

      console.log("ManageLabelSchema accepts priority parameter");
    });
  });
});
