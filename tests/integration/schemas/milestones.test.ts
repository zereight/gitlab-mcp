/**
 * Milestones Schema Integration Tests
 * Tests schemas using handler functions with real GitLab API
 */

import {
  ListProjectMilestonesSchema,
  GetProjectMilestoneSchema,
} from "../../../src/entities/milestones/schema-readonly";
import { IntegrationTestHelper } from "../helpers/registry-helper";

describe("Milestones Schema - GitLab Integration", () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error("GITLAB_TOKEN environment variable is required");
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("✅ Integration test helper initialized for milestones testing");
  });

  describe("ListProjectMilestonesSchema", () => {
    it("should validate and test with real project data using handler functions", async () => {
      console.log("🔍 Getting real project for milestones testing");

      // Get actual project from data lifecycle
      const projects = (await helper.listProjects({ per_page: 1 })) as any[];
      if (projects.length === 0) {
        console.log("⚠️  No projects available for testing");
        return;
      }

      const testProject = projects[0];
      console.log(`📋 Using project: ${testProject.name} (ID: ${testProject.id})`);

      const validParams = {
        namespace: testProject.path_with_namespace,
        state: "active" as const,
        per_page: 10,
      };

      // Validate schema
      const result = ListProjectMilestonesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const milestones = (await helper.executeTool("list_milestones", result.data)) as any[];
        expect(Array.isArray(milestones)).toBe(true);
        console.log(`📋 Retrieved ${milestones.length} milestones via handler`);

        // Validate structure if we have milestones
        if (milestones.length > 0) {
          const milestone = milestones[0];
          expect(milestone).toHaveProperty("id");
          expect(milestone).toHaveProperty("title");
          expect(milestone).toHaveProperty("description");
          expect(milestone).toHaveProperty("state");
          expect(milestone).toHaveProperty("due_date");
          console.log(`✅ Validated milestone structure: ${milestone.title}`);
        }
      }

      console.log("✅ ListProjectMilestonesSchema test completed with real data");
    });

    it("should validate group-level milestones", async () => {
      // Get a group for testing
      const namespaces = (await helper.executeTool("browse_namespaces", {
        action: "list",
        per_page: 1,
      })) as any[];
      if (namespaces.length === 0) {
        console.log("⚠️  No namespaces available for group milestones testing");
        return;
      }

      const testGroup = namespaces.find(ns => ns.kind === "group");
      if (!testGroup) {
        console.log("⚠️  No groups found for group milestones testing");
        return;
      }

      const validParams = {
        group_id: testGroup.id.toString(),
        state: "active" as const,
        per_page: 5,
      };

      const result = ListProjectMilestonesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const milestones = (await helper.executeTool("list_milestones", result.data)) as any[];
        expect(Array.isArray(milestones)).toBe(true);
        console.log(`📋 Retrieved ${milestones.length} group milestones via handler`);
      }

      console.log("✅ ListProjectMilestonesSchema group-level test completed");
    });

    it("should validate search and filtering parameters", async () => {
      // Get real project from data lifecycle (CQRS consolidation - Issue #16)
      const projects = (await helper.executeTool("browse_projects", {
        action: "list",
        per_page: 1,
      })) as any[];
      if (projects.length === 0) {
        console.log("⚠️  No projects available for milestone search testing");
        return;
      }

      const searchParams = {
        namespace: projects[0].path_with_namespace, // Use namespace as expected by schema
        state: "closed" as const,
        search: "v1.0",
        include_ancestors: true,
        per_page: 20,
      };

      const result = ListProjectMilestonesSchema.safeParse(searchParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.namespace).toBe(projects[0].path_with_namespace);
        expect(result.data.state).toBe("closed");
        expect(result.data.search).toBe("v1.0");
        expect(result.data.include_ancestors).toBe(true);
        expect(result.data.per_page).toBe(20);
      }

      console.log("✅ ListProjectMilestonesSchema validates search parameters");
    });

    it("should reject invalid parameters", async () => {
      const invalidParams = {
        state: "invalid_state", // Invalid enum value
        per_page: 150, // Exceeds max of 100
        page: 0, // Below minimum of 1
      };

      const result = ListProjectMilestonesSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log("✅ ListProjectMilestonesSchema correctly rejects invalid parameters");
    });
  });

  describe("GetProjectMilestoneSchema", () => {
    it("should validate get milestone parameters with real data", async () => {
      // Get a project and its milestones for testing
      const projects = (await helper.listProjects({ per_page: 1 })) as any[];
      if (projects.length === 0) {
        console.log("⚠️  No projects available for GetProjectMilestoneSchema testing");
        return;
      }

      const testProject = projects[0];
      const milestones = (await helper.executeTool("list_milestones", {
        namespace: testProject.path_with_namespace,
        per_page: 1,
      })) as any[];

      if (milestones.length === 0) {
        console.log("⚠️  No milestones found for GetProjectMilestoneSchema testing");
        return;
      }

      const testMilestone = milestones[0];
      const validParams = {
        namespace: testProject.path_with_namespace,
        milestone_id: testMilestone.id.toString(),
      };

      const result = GetProjectMilestoneSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.namespace).toBe(testProject.path_with_namespace);
        expect(result.data.milestone_id).toBe(testMilestone.id.toString());
      }

      console.log("✅ GetProjectMilestoneSchema validates parameters correctly");
    });

    it("should test handler function for single milestone", async () => {
      // Get a project and its milestones for testing
      const projects = (await helper.listProjects({ per_page: 1 })) as any[];
      if (projects.length === 0) {
        console.log("⚠️  No projects available for handler testing");
        return;
      }

      const testProject = projects[0];
      const milestones = (await helper.executeTool("list_milestones", {
        namespace: testProject.path_with_namespace,
        per_page: 1,
      })) as any[];

      if (milestones.length === 0) {
        console.log("⚠️  No milestones found for handler testing");
        return;
      }

      const testMilestone = milestones[0];
      const params = {
        namespace: testProject.path_with_namespace,
        milestone_id: testMilestone.id.toString(),
      };

      // Validate parameters first
      const paramResult = GetProjectMilestoneSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (paramResult.success) {
        // Test handler function
        const milestone = (await helper.executeTool("get_milestone", paramResult.data)) as any;

        // Validate milestone structure
        expect(milestone).toHaveProperty("id");
        expect(milestone).toHaveProperty("title");
        expect(milestone).toHaveProperty("description");
        expect(milestone).toHaveProperty("state");
        expect(milestone).toHaveProperty("created_at");
        expect(milestone).toHaveProperty("updated_at");

        console.log(`✅ GetProjectMilestoneSchema handler test successful: ${milestone.title}`);
      }
    });

    it("should test group milestone retrieval", async () => {
      // Get a group for testing
      const namespaces = (await helper.executeTool("browse_namespaces", {
        action: "list",
        per_page: 1,
      })) as any[];
      if (namespaces.length === 0) {
        console.log("⚠️  No namespaces available for group milestone testing");
        return;
      }

      const testGroup = namespaces.find(ns => ns.kind === "group");
      if (!testGroup) {
        console.log("⚠️  No groups found for group milestone testing");
        return;
      }

      const milestones = (await helper.executeTool("list_milestones", {
        group_id: testGroup.id.toString(),
        per_page: 1,
      })) as any[];

      if (milestones.length === 0) {
        console.log("⚠️  No group milestones found for testing");
        return;
      }

      const testMilestone = milestones[0];
      const params = {
        group_id: testGroup.id.toString(),
        milestone_id: testMilestone.id.toString(),
      };

      // Validate parameters first
      const paramResult = GetProjectMilestoneSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (paramResult.success) {
        // Test handler function
        const milestone = (await helper.executeTool("get_milestone", paramResult.data)) as any;

        // Validate milestone structure
        expect(milestone).toHaveProperty("id");
        expect(milestone).toHaveProperty("title");
        expect(milestone).toHaveProperty("state");

        console.log(`✅ Group milestone handler test successful: ${milestone.title}`);
      }
    });

    it("should reject invalid milestone parameters", async () => {
      const invalidParams = {
        project_id: "", // Empty project ID
        milestone_id: -1, // Invalid milestone ID
      };

      const result = GetProjectMilestoneSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log("✅ GetProjectMilestoneSchema correctly rejects invalid parameters");
    });
  });
});
