/**
 * Pipelines Schema Integration Tests - CQRS Pattern
 * Tests browse_pipelines CQRS tool with real GitLab API
 */

import { BrowsePipelinesSchema } from "../../../src/entities/pipelines/schema-readonly";
import { IntegrationTestHelper } from "../helpers/registry-helper";

describe("Pipelines Schema - GitLab Integration (CQRS)", () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error("GITLAB_TOKEN environment variable is required");
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("Integration test helper initialized for pipelines testing");
  });

  describe("BrowsePipelinesSchema - list action", () => {
    it("should validate and test with real project data using handler functions", async () => {
      console.log("Getting real project for pipelines testing");

      // Get actual project from data lifecycle
      const projects = (await helper.listProjects({ per_page: 1 })) as any[];
      if (projects.length === 0) {
        console.log("No projects available for testing");
        return;
      }

      const testProject = projects[0];
      console.log(`Using project: ${testProject.name} (ID: ${testProject.id})`);

      const validParams = {
        action: "list" as const,
        project_id: testProject.id.toString(),
        scope: "finished" as const,
        status: "success" as const,
        per_page: 10,
        order_by: "id" as const,
        sort: "desc" as const,
      };

      // Validate schema
      const result = BrowsePipelinesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const pipelines = (await helper.executeTool("browse_pipelines", result.data)) as any[];
        expect(Array.isArray(pipelines)).toBe(true);
        console.log(`Retrieved ${pipelines.length} pipelines via handler`);

        // Validate structure if we have pipelines
        if (pipelines.length > 0) {
          const pipeline = pipelines[0];
          expect(pipeline).toHaveProperty("id");
          expect(pipeline).toHaveProperty("status");
          expect(pipeline).toHaveProperty("ref");
          expect(pipeline).toHaveProperty("sha");
          expect(pipeline).toHaveProperty("source");
          console.log(`Validated pipeline structure: ${pipeline.id} (${pipeline.status})`);
        }
      }

      console.log("BrowsePipelinesSchema list action test completed with real data");
    });

    it("should validate scope and status filtering parameters", async () => {
      const testCases = [
        {
          action: "list" as const,
          project_id: "123",
          scope: "running" as const,
          status: "running" as const,
        },
        {
          action: "list" as const,
          project_id: "123",
          scope: "pending" as const,
          status: "pending" as const,
        },
        {
          action: "list" as const,
          project_id: "123",
          scope: "finished" as const,
          status: "success" as const,
        },
        {
          action: "list" as const,
          project_id: "123",
          scope: "branches" as const,
          status: "failed" as const,
        },
        {
          action: "list" as const,
          project_id: "123",
          scope: "tags" as const,
          status: "canceled" as const,
        },
      ];

      for (const testCase of testCases) {
        const result = BrowsePipelinesSchema.safeParse(testCase);
        expect(result.success).toBe(true);

        if (result.success && result.data.action === "list") {
          expect(result.data.scope).toBe(testCase.scope);
          expect(result.data.status).toBe(testCase.status);
        }
      }

      console.log("BrowsePipelinesSchema validates scope and status combinations");
    });

    it("should validate source and pipeline parameters with real commit data", async () => {
      // Get actual project from data lifecycle
      const projects = (await helper.listProjects({ per_page: 1 })) as any[];
      if (projects.length === 0) {
        console.log("No projects available for pipeline parameter testing");
        return;
      }

      const testProject = projects[0];

      // Get real commits from the repository to use actual SHAs (CQRS consolidation - Issue #16)
      const commits = (await helper.executeTool("browse_commits", {
        action: "list",
        project_id: testProject.id.toString(),
        per_page: 1,
      })) as any[];

      // Use real commit SHA and ref from data lifecycle
      const realSha = commits.length > 0 ? commits[0].id : undefined;
      const realRef =
        commits.length > 0 ? (commits[0].message.includes("Initial") ? "main" : "main") : "main";

      const sourceParams = {
        action: "list" as const,
        project_id: testProject.id.toString(),
        source: "push" as const,
        ref: realRef,
        sha: realSha,
        yaml_errors: true,
        per_page: 20,
      };

      const result = BrowsePipelinesSchema.safeParse(sourceParams);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "list") {
        expect(result.data.source).toBe("push");
        expect(result.data.ref).toBe(realRef);
        if (realSha) {
          expect(result.data.sha).toBe(realSha);
          console.log(`Using real commit SHA from data lifecycle: ${realSha.substring(0, 8)}...`);
        }
        expect(result.data.yaml_errors).toBe(true);
        expect(result.data.per_page).toBe(20);
      }

      console.log(
        "BrowsePipelinesSchema validates parameters with real commit data from data lifecycle"
      );
    });

    it("should validate date filtering parameters", async () => {
      const dateParams = {
        action: "list" as const,
        project_id: "123",
        updated_after: "2023-01-01T00:00:00Z",
        updated_before: "2023-12-31T23:59:59Z",
        order_by: "updated_at" as const,
        sort: "asc" as const,
      };

      const result = BrowsePipelinesSchema.safeParse(dateParams);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "list") {
        expect(result.data.updated_after).toBe("2023-01-01T00:00:00Z");
        expect(result.data.updated_before).toBe("2023-12-31T23:59:59Z");
        expect(result.data.order_by).toBe("updated_at");
        expect(result.data.sort).toBe("asc");
      }

      console.log("BrowsePipelinesSchema validates date filtering parameters");
    });

    it("should reject invalid parameters", async () => {
      const invalidParams = {
        action: "list",
        project_id: "123",
        scope: "invalid_scope", // Invalid enum value
        status: "invalid_status", // Invalid enum value
        source: "invalid_source", // Invalid enum value
        order_by: "invalid_field", // Invalid enum value
        sort: "sideways", // Invalid enum value
        per_page: 150, // Exceeds max of 100
        page: 0, // Below minimum of 1
      };

      const result = BrowsePipelinesSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log("BrowsePipelinesSchema correctly rejects invalid parameters");
    });
  });

  describe("BrowsePipelinesSchema - get action", () => {
    it("should validate get pipeline parameters with real data", async () => {
      // Get a project and its pipelines for testing
      const projects = (await helper.listProjects({ per_page: 1 })) as any[];
      if (projects.length === 0) {
        console.log("No projects available for get action testing");
        return;
      }

      const testProject = projects[0];
      const pipelines = (await helper.executeTool("browse_pipelines", {
        action: "list",
        project_id: testProject.id.toString(),
        per_page: 1,
      })) as any[];

      if (pipelines.length === 0) {
        console.log("No pipelines found for get action testing");
        return;
      }

      const testPipeline = pipelines[0];
      const validParams = {
        action: "get" as const,
        project_id: testProject.id.toString(),
        pipeline_id: testPipeline.id.toString(),
      };

      const result = BrowsePipelinesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "get") {
        expect(result.data.project_id).toBe(testProject.id.toString());
        expect(result.data.pipeline_id).toBe(testPipeline.id.toString());
      }

      console.log("BrowsePipelinesSchema get action validates parameters correctly");
    });

    it("should test handler function for single pipeline", async () => {
      // Get a project and its pipelines for testing
      const projects = (await helper.listProjects({ per_page: 1 })) as any[];
      if (projects.length === 0) {
        console.log("No projects available for handler testing");
        return;
      }

      const testProject = projects[0];
      const pipelines = (await helper.executeTool("browse_pipelines", {
        action: "list",
        project_id: testProject.id.toString(),
        per_page: 1,
      })) as any[];

      if (pipelines.length === 0) {
        console.log("No pipelines found for handler testing");
        return;
      }

      const testPipeline = pipelines[0];
      const params = {
        action: "get" as const,
        project_id: testProject.id.toString(),
        pipeline_id: testPipeline.id.toString(),
      };

      // Validate parameters first
      const paramResult = BrowsePipelinesSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (paramResult.success) {
        // Test handler function
        const pipeline = (await helper.executeTool("browse_pipelines", paramResult.data)) as any;

        // Validate pipeline structure
        expect(pipeline).toHaveProperty("id");
        expect(pipeline).toHaveProperty("status");
        expect(pipeline).toHaveProperty("ref");
        expect(pipeline).toHaveProperty("sha");
        expect(pipeline).toHaveProperty("source");
        expect(pipeline).toHaveProperty("created_at");
        expect(pipeline).toHaveProperty("updated_at");
        expect(pipeline).toHaveProperty("started_at");
        expect(pipeline).toHaveProperty("finished_at");
        expect(pipeline).toHaveProperty("duration");
        expect(pipeline).toHaveProperty("queued_duration");

        console.log(
          `BrowsePipelinesSchema get action handler test successful: ${pipeline.id} (${pipeline.status})`
        );
      }
    });

    it("should validate required pipeline parameters", async () => {
      // Test that valid parameters pass validation
      const validParams = {
        action: "get" as const,
        project_id: "123",
        pipeline_id: "456",
      };

      const result = BrowsePipelinesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "get") {
        expect(result.data.project_id).toBe("123");
        expect(result.data.pipeline_id).toBe("456");
      }

      console.log("BrowsePipelinesSchema get action validates required parameters correctly");
    });
  });

  describe("BrowsePipelinesSchema - jobs action", () => {
    it("should validate jobs action parameters", async () => {
      const validParams = {
        action: "jobs" as const,
        project_id: "123",
        pipeline_id: "456",
        scope: ["failed", "success"] as const,
        include_retried: true,
      };

      const result = BrowsePipelinesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "jobs") {
        expect(result.data.project_id).toBe("123");
        expect(result.data.pipeline_id).toBe("456");
        expect(result.data.scope).toEqual(["failed", "success"]);
        expect(result.data.include_retried).toBe(true);
      }

      console.log("BrowsePipelinesSchema jobs action validates parameters correctly");
    });
  });

  describe("BrowsePipelinesSchema - triggers action", () => {
    it("should validate triggers action parameters", async () => {
      const validParams = {
        action: "triggers" as const,
        project_id: "123",
        pipeline_id: "456",
      };

      const result = BrowsePipelinesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "triggers") {
        expect(result.data.project_id).toBe("123");
        expect(result.data.pipeline_id).toBe("456");
      }

      console.log("BrowsePipelinesSchema triggers action validates parameters correctly");
    });
  });

  describe("BrowsePipelinesSchema - job action", () => {
    it("should validate job action parameters", async () => {
      const validParams = {
        action: "job" as const,
        project_id: "123",
        job_id: "789",
      };

      const result = BrowsePipelinesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "job") {
        expect(result.data.project_id).toBe("123");
        expect(result.data.job_id).toBe("789");
      }

      console.log("BrowsePipelinesSchema job action validates parameters correctly");
    });
  });

  describe("BrowsePipelinesSchema - logs action", () => {
    it("should validate logs action parameters", async () => {
      const validParams = {
        action: "logs" as const,
        project_id: "123",
        job_id: "789",
        limit: 100,
        start: 50,
      };

      const result = BrowsePipelinesSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "logs") {
        expect(result.data.project_id).toBe("123");
        expect(result.data.job_id).toBe("789");
        expect(result.data.limit).toBe(100);
        expect(result.data.start).toBe(50);
      }

      console.log("BrowsePipelinesSchema logs action validates parameters correctly");
    });
  });
});
