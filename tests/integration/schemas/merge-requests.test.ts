/**
 * Merge Requests Schema Integration Tests
 * Tests schemas using handler functions with real GitLab API
 */

import { BrowseMergeRequestsSchema } from "../../../src/entities/mrs/schema-readonly";
import { IntegrationTestHelper } from "../helpers/registry-helper";

describe("Merge Requests Schema - GitLab Integration", () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error("GITLAB_TOKEN environment variable is required");
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("✅ Integration test helper initialized for merge requests testing");
  });

  describe("BrowseMergeRequestsSchema", () => {
    it("should validate and test with real project data using handler functions", async () => {
      console.log("🔍 Getting real project for merge requests testing");

      // Get actual project from data lifecycle
      const projects = (await helper.listProjects({ per_page: 1 })) as any[];
      if (projects.length === 0) {
        console.log("⚠️  No projects available for testing");
        return;
      }

      const testProject = projects[0];
      console.log(`📋 Using project: ${testProject.name} (ID: ${testProject.id})`);

      const validParams = {
        action: "list" as const,
        project_id: testProject.id.toString(),
        state: "all" as const,
        per_page: 5,
        order_by: "updated_at" as const,
        sort: "desc" as const,
      };

      // Validate schema
      const result = BrowseMergeRequestsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function using CQRS tool
        const mergeRequests = (await helper.executeTool(
          "browse_merge_requests",
          result.data
        )) as any[];
        expect(Array.isArray(mergeRequests)).toBe(true);
        console.log(`📋 Retrieved ${mergeRequests.length} merge requests via handler`);

        // Comprehensive validation if we have MRs
        if (mergeRequests.length > 0) {
          const mr = mergeRequests[0];

          // Core MR properties
          expect(mr).toHaveProperty("id");
          expect(mr).toHaveProperty("iid");
          expect(mr).toHaveProperty("project_id");
          expect(mr).toHaveProperty("title");
          expect(mr).toHaveProperty("description");
          expect(mr).toHaveProperty("state");
          expect(mr).toHaveProperty("created_at");
          expect(mr).toHaveProperty("updated_at");
          expect(mr).toHaveProperty("merged_by");
          expect(mr).toHaveProperty("merged_at");
          expect(mr).toHaveProperty("closed_by");
          expect(mr).toHaveProperty("closed_at");

          // Branch information
          expect(mr).toHaveProperty("target_branch");
          expect(mr).toHaveProperty("source_branch");
          expect(mr).toHaveProperty("source_project_id");
          expect(mr).toHaveProperty("target_project_id");

          // Voting and engagement
          expect(mr).toHaveProperty("upvotes");
          expect(mr).toHaveProperty("downvotes");
          expect(mr).toHaveProperty("user_notes_count");

          // People involved
          expect(mr).toHaveProperty("author");
          expect(mr).toHaveProperty("assignees");
          expect(mr).toHaveProperty("reviewers");

          // Status and metadata
          expect(mr).toHaveProperty("labels");
          expect(mr).toHaveProperty("milestone");
          expect(mr).toHaveProperty("draft");
          expect(mr).toHaveProperty("work_in_progress");
          expect(mr).toHaveProperty("merge_when_pipeline_succeeds");
          expect(mr).toHaveProperty("merge_status");
          expect(mr).toHaveProperty("detailed_merge_status");

          // Git information
          expect(mr).toHaveProperty("sha");
          expect(mr).toHaveProperty("merge_commit_sha");
          expect(mr).toHaveProperty("squash_commit_sha");
          expect(mr).toHaveProperty("should_remove_source_branch");
          expect(mr).toHaveProperty("force_remove_source_branch");

          // URLs and other properties
          expect(mr).toHaveProperty("web_url");
          expect(mr).toHaveProperty("time_stats");
          expect(mr).toHaveProperty("squash");
          expect(mr).toHaveProperty("task_completion_status");
          expect(mr).toHaveProperty("has_conflicts");

          // Validate author structure
          if (mr.author) {
            expect(mr.author).toHaveProperty("id");
            expect(mr.author).toHaveProperty("username");
            expect(mr.author).toHaveProperty("name");
            expect(mr.author).toHaveProperty("state");
            expect(mr.author).toHaveProperty("avatar_url");
            expect(mr.author).toHaveProperty("web_url");
          }

          // Validate data types
          expect(typeof mr.id).toBe("number");
          expect(typeof mr.iid).toBe("number");
          expect(typeof mr.project_id).toBe("number");
          expect(typeof mr.title).toBe("string");
          expect(["opened", "closed", "locked", "merged"]).toContain(mr.state);
          expect(Array.isArray(mr.assignees)).toBe(true);
          expect(Array.isArray(mr.reviewers)).toBe(true);
          expect(Array.isArray(mr.labels)).toBe(true);

          console.log(
            `✅ Comprehensively validated MR: ${mr.title} (IID: ${mr.iid}, State: ${mr.state})`
          );
        }
      }

      console.log("✅ BrowseMergeRequestsSchema test completed with real data");
    });

    it("should test comprehensive filtering with actual data", async () => {
      // Get a project with actual data
      const projects = (await helper.listProjects({ per_page: 1 })) as any[];
      if (projects.length === 0) {
        console.log("⚠️  No projects available for advanced filtering test");
        return;
      }

      const testProject = projects[0];

      // Test different filtering combinations with real API calls
      const filterTests = [
        {
          name: "All MRs",
          params: {
            action: "list" as const,
            project_id: testProject.id.toString(),
            state: "all" as const,
            per_page: 20,
          },
        },
        {
          name: "Opened MRs only",
          params: {
            action: "list" as const,
            project_id: testProject.id.toString(),
            state: "opened" as const,
            per_page: 10,
          },
        },
        {
          name: "Closed MRs only",
          params: {
            action: "list" as const,
            project_id: testProject.id.toString(),
            state: "closed" as const,
            per_page: 10,
          },
        },
        {
          name: "Merged MRs only",
          params: {
            action: "list" as const,
            project_id: testProject.id.toString(),
            state: "merged" as const,
            per_page: 10,
          },
        },
        {
          name: "Ordered by creation date",
          params: {
            action: "list" as const,
            project_id: testProject.id.toString(),
            order_by: "created_at" as const,
            sort: "desc" as const,
            per_page: 5,
          },
        },
        {
          name: "With label details",
          params: {
            action: "list" as const,
            project_id: testProject.id.toString(),
            with_labels_details: true,
            per_page: 5,
          },
        },
        {
          name: "With merge status recheck",
          params: {
            action: "list" as const,
            project_id: testProject.id.toString(),
            with_merge_status_recheck: true,
            per_page: 5,
          },
        },
      ];

      for (const test of filterTests) {
        console.log(`🔍 Testing filter: ${test.name}`);

        // Validate schema first
        const schemaResult = BrowseMergeRequestsSchema.safeParse(test.params);
        expect(schemaResult.success).toBe(true);

        if (schemaResult.success) {
          // Test with handler function using CQRS tool
          const mergeRequests = (await helper.executeTool(
            "browse_merge_requests",
            schemaResult.data
          )) as any[];
          expect(Array.isArray(mergeRequests)).toBe(true);

          // Validate filtering worked correctly
          if (mergeRequests.length > 0) {
            const mr = mergeRequests[0];

            // Validate state filtering
            if (test.params.state && test.params.state !== "all") {
              expect(mr.state).toBe(test.params.state);
            }

            // Validate ordering
            if (test.params.order_by && mergeRequests.length > 1) {
              const first = mergeRequests[0];
              const second = mergeRequests[1];

              if (test.params.order_by === "created_at" && test.params.sort === "desc") {
                expect(new Date(first.created_at).getTime()).toBeGreaterThanOrEqual(
                  new Date(second.created_at).getTime()
                );
              }
            }

            // Validate labels details if requested
            if (test.params.with_labels_details && mr.labels.length > 0) {
              const label = mr.labels[0];
              if (typeof label === "object") {
                expect(label).toHaveProperty("name");
                expect(label).toHaveProperty("color");
              }
            }
          }

          console.log(`  ✅ ${test.name}: Retrieved ${mergeRequests.length} MRs`);
        }
      }

      console.log("✅ Comprehensive filtering tests completed");
    }, 30000);

    it("should validate schema with different state combinations", async () => {
      const testCases = [
        { action: "list" as const, state: "opened" as const },
        { action: "list" as const, state: "closed" as const },
        { action: "list" as const, state: "locked" as const },
        { action: "list" as const, state: "merged" as const },
        { action: "list" as const, state: "all" as const },
      ];

      for (const testCase of testCases) {
        const result = BrowseMergeRequestsSchema.safeParse(testCase);
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.state).toBe(testCase.state);
        }
      }

      console.log("✅ BrowseMergeRequestsSchema validates all state combinations");
    });

    it("should reject invalid parameters", async () => {
      const invalidParams = {
        action: "list" as const,
        state: "invalid_state", // Invalid enum value
        order_by: "invalid_field", // Invalid enum value
        sort: "sideways", // Invalid enum value
        per_page: 150, // Exceeds max of 100
        scope: "invalid_scope", // Invalid enum value
        wip: "maybe", // Invalid enum value
      };

      const result = BrowseMergeRequestsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log("✅ BrowseMergeRequestsSchema correctly rejects invalid parameters");
    });
  });

  describe("BrowseMergeRequestsSchema - get action", () => {
    it("should validate get merge request parameters", async () => {
      // Get actual project and its MRs for testing
      const projects = (await helper.listProjects({ per_page: 1 })) as any[];
      if (projects.length === 0) {
        console.log("⚠️  No projects available for BrowseMergeRequestsSchema testing");
        return;
      }

      const testProject = projects[0];
      const mergeRequests = (await helper.executeTool("browse_merge_requests", {
        action: "list",
        project_id: testProject.id.toString(),
        per_page: 1,
      })) as any[];

      if (mergeRequests.length === 0) {
        console.log("⚠️  No merge requests found for BrowseMergeRequestsSchema testing");
        return;
      }

      const testMR = mergeRequests[0];
      const validParams = {
        action: "get" as const,
        project_id: testProject.id.toString(),
        merge_request_iid: testMR.iid.toString(),
        include_diverged_commits_count: true,
        include_rebase_in_progress: true,
      };

      const result = BrowseMergeRequestsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "get") {
        expect(result.data.project_id).toBe(testProject.id.toString());
        expect(result.data.merge_request_iid).toBe(testMR.iid.toString());
        expect(result.data.include_diverged_commits_count).toBe(true);
        expect(result.data.include_rebase_in_progress).toBe(true);
      }

      console.log("✅ BrowseMergeRequestsSchema validates parameters correctly");
    });

    it("should test handler function for single merge request", async () => {
      // Get actual project and its MRs for testing
      const projects = (await helper.listProjects({ per_page: 1 })) as any[];
      if (projects.length === 0) {
        console.log("⚠️  No projects available for handler testing");
        return;
      }

      const testProject = projects[0];
      const mergeRequests = (await helper.executeTool("browse_merge_requests", {
        action: "list",
        project_id: testProject.id.toString(),
        per_page: 1,
      })) as any[];

      if (mergeRequests.length === 0) {
        console.log("⚠️  No merge requests found for handler testing");
        return;
      }

      const testMR = mergeRequests[0];
      const params = {
        action: "get" as const,
        project_id: testProject.id.toString(),
        merge_request_iid: testMR.iid.toString(),
        include_diverged_commits_count: true,
        include_rebase_in_progress: true,
      };

      // Validate parameters first
      const paramResult = BrowseMergeRequestsSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (paramResult.success) {
        // Test handler function using CQRS tool
        const mr = (await helper.executeTool("browse_merge_requests", paramResult.data)) as any;

        // Comprehensive single MR validation
        expect(mr).toHaveProperty("id");
        expect(mr).toHaveProperty("iid");
        expect(mr).toHaveProperty("project_id");
        expect(mr).toHaveProperty("title");
        expect(mr).toHaveProperty("description");
        expect(mr).toHaveProperty("state");
        expect(mr).toHaveProperty("created_at");
        expect(mr).toHaveProperty("updated_at");
        expect(mr).toHaveProperty("target_branch");
        expect(mr).toHaveProperty("source_branch");
        expect(mr).toHaveProperty("author");
        expect(mr).toHaveProperty("assignees");
        expect(mr).toHaveProperty("reviewers");
        expect(mr).toHaveProperty("labels");
        expect(mr).toHaveProperty("milestone");
        expect(mr).toHaveProperty("merge_status");
        expect(mr).toHaveProperty("detailed_merge_status");
        expect(mr).toHaveProperty("has_conflicts");
        expect(mr).toHaveProperty("blocking_discussions_resolved");
        expect(mr).toHaveProperty("work_in_progress");
        expect(mr).toHaveProperty("draft");
        expect(mr).toHaveProperty("merge_when_pipeline_succeeds");
        expect(mr).toHaveProperty("merge_commit_sha");
        expect(mr).toHaveProperty("squash_commit_sha");
        expect(mr).toHaveProperty("user_notes_count");
        expect(mr).toHaveProperty("upvotes");
        expect(mr).toHaveProperty("downvotes");
        expect(mr).toHaveProperty("web_url");
        expect(mr).toHaveProperty("time_stats");
        expect(mr).toHaveProperty("squash");
        expect(mr).toHaveProperty("task_completion_status");

        // Validate IID matches what we requested
        expect(mr.iid).toBe(testMR.iid);
        expect(mr.project_id).toBe(testProject.id);

        // Validate complex nested structures
        if (mr.author) {
          expect(mr.author).toHaveProperty("id");
          expect(mr.author).toHaveProperty("username");
          expect(mr.author).toHaveProperty("name");
          expect(mr.author).toHaveProperty("state");
        }

        if (mr.time_stats) {
          expect(mr.time_stats).toHaveProperty("time_estimate");
          expect(mr.time_stats).toHaveProperty("total_time_spent");
          expect(mr.time_stats).toHaveProperty("human_time_estimate");
          expect(mr.time_stats).toHaveProperty("human_total_time_spent");
        }

        if (mr.task_completion_status) {
          expect(mr.task_completion_status).toHaveProperty("count");
          expect(mr.task_completion_status).toHaveProperty("completed_count");
        }

        // Validate data types
        expect(typeof mr.id).toBe("number");
        expect(typeof mr.iid).toBe("number");
        expect(typeof mr.title).toBe("string");
        expect(["opened", "closed", "locked", "merged"]).toContain(mr.state);
        expect(Array.isArray(mr.assignees)).toBe(true);
        expect(Array.isArray(mr.reviewers)).toBe(true);
        expect(Array.isArray(mr.labels)).toBe(true);

        console.log(
          `✅ BrowseMergeRequestsSchema comprehensive validation: ${mr.title} (IID: ${mr.iid})`
        );
        console.log(
          `  📊 Details: State=${mr.state}, Conflicts=${mr.has_conflicts}, WIP=${mr.work_in_progress}`
        );
        console.log(
          `  👥 People: Assignees=${mr.assignees.length}, Reviewers=${mr.reviewers.length}`
        );
        console.log(
          `  🏷️  Metadata: Labels=${mr.labels.length}, Milestone=${mr.milestone ? mr.milestone.title : "None"}`
        );
      }
    });

    it("should reject invalid merge request parameters", async () => {
      const invalidParams = {
        action: "get" as const,
        project_id: "", // Empty project ID
        // No merge_request_iid or branch_name - violates schema refine rule
      };

      const result = BrowseMergeRequestsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log("✅ BrowseMergeRequestsSchema correctly rejects invalid parameters");
    });
  });
});
