/**
 * Refs Schema Integration Tests
 * Tests schemas using handler functions with real GitLab API
 * Full CRUD lifecycle tests for branches and tags
 */

import { BrowseRefsSchema } from "../../../src/entities/refs/schema-readonly";
import { ManageRefSchema } from "../../../src/entities/refs/schema";
import { IntegrationTestHelper } from "../helpers/registry-helper";

describe("Refs Schema - GitLab Integration", () => {
  let helper: IntegrationTestHelper;
  let testProjectId: string;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error("GITLAB_TOKEN environment variable is required");
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("Integration test helper initialized for refs testing");

    // Get a test project - preferably from the test group
    const projects = (await helper.listProjects({ search: "test", per_page: 5 })) as {
      id: number;
      path_with_namespace: string;
      name: string;
    }[];

    if (projects.length === 0) {
      console.log("No projects available for refs testing");
      return;
    }

    // Prefer a project in the 'test' group
    const testGroupProject = projects.find(p => p.path_with_namespace.startsWith("test/"));
    const selectedProject = testGroupProject ?? projects[0];

    testProjectId = selectedProject.id.toString();
    console.log(
      `Using project: ${selectedProject.path_with_namespace} (ID: ${testProjectId}) for refs testing`
    );
  });

  describe("BrowseRefsSchema - Branches", () => {
    it("should validate and list branches with real project data", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      const validParams = {
        action: "list_branches" as const,
        project_id: testProjectId,
        per_page: 20,
      };

      // Validate schema
      const result = BrowseRefsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const branches = (await helper.executeTool("browse_refs", result.data)) as {
          name: string;
          protected: boolean;
          commit: { id: string };
        }[];
        expect(Array.isArray(branches)).toBe(true);
        console.log(`Retrieved ${branches.length} branches via handler`);

        // Validate structure if we have branches
        if (branches.length > 0) {
          const branch = branches[0];
          expect(branch).toHaveProperty("name");
          expect(branch).toHaveProperty("commit");
          console.log(`Validated branch structure: ${branch.name}`);
        }
      }
    });

    it("should list branches with search filter", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      const params = {
        action: "list_branches" as const,
        project_id: testProjectId,
        search: "main",
      };

      const result = BrowseRefsSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "list_branches") {
        expect(result.data.search).toBe("main");

        const branches = (await helper.executeTool("browse_refs", result.data)) as {
          name: string;
        }[];
        console.log(`Found ${branches.length} branches matching 'main'`);
      }
    });
  });

  describe("BrowseRefsSchema - Tags", () => {
    it("should validate and list tags with real project data", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      const validParams = {
        action: "list_tags" as const,
        project_id: testProjectId,
        per_page: 20,
      };

      const result = BrowseRefsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const tags = (await helper.executeTool("browse_refs", result.data)) as {
          name: string;
          message: string | null;
          commit: { id: string };
        }[];
        expect(Array.isArray(tags)).toBe(true);
        console.log(`Retrieved ${tags.length} tags via handler`);

        if (tags.length > 0) {
          const tag = tags[0];
          expect(tag).toHaveProperty("name");
          expect(tag).toHaveProperty("commit");
          console.log(`Validated tag structure: ${tag.name}`);
        }
      }
    });

    it("should list tags with order_by and sort", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      const params = {
        action: "list_tags" as const,
        project_id: testProjectId,
        order_by: "updated" as const,
        sort: "desc" as const,
      };

      const result = BrowseRefsSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "list_tags") {
        expect(result.data.order_by).toBe("updated");
        expect(result.data.sort).toBe("desc");
      }
    });
  });

  describe("BrowseRefsSchema - Protected Branches", () => {
    it("should list protected branches", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      const params = {
        action: "list_protected_branches" as const,
        project_id: testProjectId,
      };

      const result = BrowseRefsSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success) {
        const protectedBranches = (await helper.executeTool("browse_refs", result.data)) as {
          name: string;
          push_access_levels: unknown[];
          merge_access_levels: unknown[];
        }[];
        expect(Array.isArray(protectedBranches)).toBe(true);
        console.log(`Retrieved ${protectedBranches.length} protected branches`);
      }
    });
  });

  describe("ManageRefSchema - Action validation", () => {
    it("should validate create_branch parameters", () => {
      const params = {
        action: "create_branch" as const,
        project_id: "123",
        branch: "feature/test-branch",
        ref: "main",
      };

      const result = ManageRefSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "create_branch") {
        expect(result.data.branch).toBe("feature/test-branch");
        expect(result.data.ref).toBe("main");
      }
    });

    it("should validate protect_branch parameters", () => {
      const params = {
        action: "protect_branch" as const,
        project_id: "123",
        name: "main",
        push_access_level: 40,
        merge_access_level: 30,
        allow_force_push: false,
      };

      const result = ManageRefSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "protect_branch") {
        expect(result.data.push_access_level).toBe(40);
        expect(result.data.merge_access_level).toBe(30);
        expect(result.data.allow_force_push).toBe(false);
      }
    });

    it("should validate create_tag parameters", () => {
      const params = {
        action: "create_tag" as const,
        project_id: "123",
        tag_name: "v1.0.0",
        ref: "main",
        message: "Release version 1.0.0",
      };

      const result = ManageRefSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "create_tag") {
        expect(result.data.tag_name).toBe("v1.0.0");
        expect(result.data.message).toBe("Release version 1.0.0");
      }
    });

    it("should validate protect_tag parameters", () => {
      const params = {
        action: "protect_tag" as const,
        project_id: "123",
        name: "v*",
        create_access_level: 40,
      };

      const result = ManageRefSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "protect_tag") {
        expect(result.data.name).toBe("v*");
        expect(result.data.create_access_level).toBe(40);
      }
    });

    it("should reject invalid parameters", () => {
      const params = {
        action: "create_branch",
        project_id: "123",
        // Missing branch and ref
      };

      const result = ManageRefSchema.safeParse(params);
      expect(result.success).toBe(false);
    });
  });

  /**
   * Branch Lifecycle Tests
   * Tests actual create/delete operations against real GitLab instance
   */
  describe("Branch Lifecycle - Full CRUD", () => {
    const testBranchName = `test-branch-${Date.now()}`;
    let branchCreated = false;

    it("should create a new branch", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      try {
        // First, get the default branch to use as ref
        const branches = (await helper.executeTool("browse_refs", {
          action: "list_branches",
          project_id: testProjectId,
          per_page: 1,
        })) as { name: string }[];

        if (branches.length === 0) {
          console.log("No branches available to create from");
          return;
        }

        const sourceBranch = branches[0].name;

        const result = (await helper.executeTool("manage_ref", {
          action: "create_branch",
          project_id: testProjectId,
          branch: testBranchName,
          ref: sourceBranch,
        })) as {
          name: string;
          protected: boolean;
        };

        expect(result).toBeDefined();
        expect(result.name).toBe(testBranchName);
        branchCreated = true;

        console.log(`Created test branch: ${result.name} from ${sourceBranch}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        // Handle permission or branch creation issues gracefully
        if (errorMsg.includes("403") || errorMsg.includes("permission")) {
          console.log("Skipping branch creation: insufficient permissions");
          return;
        }
        throw error;
      }
    });

    it("should get the created branch", async () => {
      if (!branchCreated) {
        console.log("Skipping: no branch was created");
        return;
      }

      const result = (await helper.executeTool("browse_refs", {
        action: "get_branch",
        project_id: testProjectId,
        branch: testBranchName,
      })) as {
        name: string;
        protected: boolean;
        commit: { id: string };
      };

      expect(result).toBeDefined();
      expect(result.name).toBe(testBranchName);
      expect(result).toHaveProperty("commit");

      console.log(`Retrieved branch: ${result.name} (commit: ${result.commit.id.substring(0, 8)})`);
    });

    it("should delete the branch", async () => {
      if (!branchCreated) {
        console.log("Skipping: no branch was created");
        return;
      }

      const result = (await helper.executeTool("manage_ref", {
        action: "delete_branch",
        project_id: testProjectId,
        branch: testBranchName,
      })) as {
        deleted: boolean;
        branch: string;
      };

      expect(result).toBeDefined();
      expect(result.deleted).toBe(true);

      console.log(`Deleted branch: ${testBranchName}`);
    });

    it("should verify branch is deleted", async () => {
      if (!branchCreated) {
        console.log("Skipping: no branch was created");
        return;
      }

      try {
        await helper.executeTool("browse_refs", {
          action: "get_branch",
          project_id: testProjectId,
          branch: testBranchName,
        });
        throw new Error("Expected branch to be deleted but it still exists");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("Expected branch to be deleted")) {
          throw error;
        }
        // 404 is expected - branch was deleted
        expect(errorMsg).toMatch(/404|not found/i);
        console.log("Verified: branch was successfully deleted");
      }
    });
  });

  /**
   * Tag Lifecycle Tests
   * Tests actual create/delete operations against real GitLab instance
   */
  describe("Tag Lifecycle - Full CRUD", () => {
    const testTagName = `test-tag-${Date.now()}`;
    let tagCreated = false;

    it("should create a new tag", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      try {
        // First, get the default branch to use as ref
        const branches = (await helper.executeTool("browse_refs", {
          action: "list_branches",
          project_id: testProjectId,
          per_page: 1,
        })) as { name: string }[];

        if (branches.length === 0) {
          console.log("No branches available to create tag from");
          return;
        }

        const sourceBranch = branches[0].name;

        const result = (await helper.executeTool("manage_ref", {
          action: "create_tag",
          project_id: testProjectId,
          tag_name: testTagName,
          ref: sourceBranch,
          message: "Integration test tag - will be deleted",
        })) as {
          name: string;
          message: string;
        };

        expect(result).toBeDefined();
        expect(result.name).toBe(testTagName);
        tagCreated = true;

        console.log(`Created test tag: ${result.name} from ${sourceBranch}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("403") || errorMsg.includes("permission")) {
          console.log("Skipping tag creation: insufficient permissions");
          return;
        }
        throw error;
      }
    });

    it("should get the created tag", async () => {
      if (!tagCreated) {
        console.log("Skipping: no tag was created");
        return;
      }

      const result = (await helper.executeTool("browse_refs", {
        action: "get_tag",
        project_id: testProjectId,
        tag_name: testTagName,
      })) as {
        name: string;
        message: string | null;
        commit: { id: string };
      };

      expect(result).toBeDefined();
      expect(result.name).toBe(testTagName);
      expect(result).toHaveProperty("commit");

      console.log(`Retrieved tag: ${result.name} (commit: ${result.commit.id.substring(0, 8)})`);
    });

    it("should delete the tag", async () => {
      if (!tagCreated) {
        console.log("Skipping: no tag was created");
        return;
      }

      const result = (await helper.executeTool("manage_ref", {
        action: "delete_tag",
        project_id: testProjectId,
        tag_name: testTagName,
      })) as {
        deleted: boolean;
        tag_name: string;
      };

      expect(result).toBeDefined();
      expect(result.deleted).toBe(true);

      console.log(`Deleted tag: ${testTagName}`);
    });

    it("should verify tag is deleted", async () => {
      if (!tagCreated) {
        console.log("Skipping: no tag was created");
        return;
      }

      try {
        await helper.executeTool("browse_refs", {
          action: "get_tag",
          project_id: testProjectId,
          tag_name: testTagName,
        });
        throw new Error("Expected tag to be deleted but it still exists");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("Expected tag to be deleted")) {
          throw error;
        }
        // 404 is expected - tag was deleted
        expect(errorMsg).toMatch(/404|not found/i);
        console.log("Verified: tag was successfully deleted");
      }
    });
  });
});
