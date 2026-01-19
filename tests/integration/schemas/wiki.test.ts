/**
 * Wiki Schema Integration Tests
 * Tests schemas using handler functions with real GitLab API
 */

import { BrowseWikiSchema } from "../../../src/entities/wiki/schema-readonly";
import { ManageWikiSchema } from "../../../src/entities/wiki/schema";
import { IntegrationTestHelper } from "../helpers/registry-helper";

describe("Wiki Schema - GitLab Integration", () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error("GITLAB_TOKEN environment variable is required");
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("Integration test helper initialized for wiki testing");
  });

  describe("BrowseWikiSchema - list action", () => {
    it("should validate and test with real project data using handler functions", async () => {
      console.log("Getting real project for wiki testing");

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
        with_content: true,
        per_page: 10,
      };

      // Validate schema
      const result = BrowseWikiSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const wikiPages = (await helper.executeTool("browse_wiki", result.data)) as {
          title: string;
          slug: string;
          format: string;
          content?: string;
        }[];
        expect(Array.isArray(wikiPages)).toBe(true);
        console.log(`Retrieved ${wikiPages.length} wiki pages via handler`);

        // Validate structure if we have wiki pages
        if (wikiPages.length > 0) {
          const page = wikiPages[0];
          expect(page).toHaveProperty("title");
          expect(page).toHaveProperty("slug");
          expect(page).toHaveProperty("format");
          console.log(`Validated wiki page structure: ${page.title}`);
        }
      }

      console.log("BrowseWikiSchema list action test completed with real data");
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
        with_content: false,
      };

      const result = BrowseWikiSchema.safeParse(paginationParams);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "list") {
        expect(result.data.per_page).toBe(5);
        expect(result.data.page).toBe(1);
        expect(result.data.with_content).toBe(false);
        expect(result.data.namespace).toBe(testProject.path_with_namespace);
      }

      console.log("BrowseWikiSchema validates pagination parameters");
    });

    it("should reject invalid action type", async () => {
      const invalidParams = {
        action: "invalid_action", // Invalid action type
        namespace: "test/project",
      };

      const result = BrowseWikiSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log("BrowseWikiSchema correctly rejects invalid action type");
    });
  });

  describe("BrowseWikiSchema - get action", () => {
    it("should validate get wiki page parameters with real data", async () => {
      // Get a project and its wiki pages for testing
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        path_with_namespace: string;
      }[];
      if (projects.length === 0) {
        console.log("No projects available for get wiki page testing");
        return;
      }

      const testProject = projects[0];
      const wikiPages = (await helper.executeTool("browse_wiki", {
        action: "list",
        namespace: testProject.path_with_namespace,
        per_page: 1,
      })) as { slug: string }[];

      if (wikiPages.length === 0) {
        console.log("No wiki pages found for get wiki page testing");
        return;
      }

      const testPage = wikiPages[0];
      const validParams = {
        action: "get" as const,
        namespace: testProject.path_with_namespace,
        slug: testPage.slug,
      };

      const result = BrowseWikiSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "get") {
        expect(result.data.namespace).toBe(testProject.path_with_namespace);
        expect(result.data.slug).toBe(testPage.slug);
      }

      console.log("BrowseWikiSchema get action validates parameters correctly");
    });

    it("should test handler function for single wiki page", async () => {
      // Get a project and its wiki pages for testing
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        path_with_namespace: string;
      }[];
      if (projects.length === 0) {
        console.log("No projects available for handler testing");
        return;
      }

      const testProject = projects[0];
      const wikiPages = (await helper.executeTool("browse_wiki", {
        action: "list",
        namespace: testProject.path_with_namespace,
        per_page: 1,
      })) as { slug: string; title: string }[];

      if (wikiPages.length === 0) {
        console.log("No wiki pages found for handler testing");
        return;
      }

      const testPage = wikiPages[0];
      const params = {
        action: "get" as const,
        namespace: testProject.path_with_namespace,
        slug: testPage.slug,
      };

      // Validate parameters first
      const paramResult = BrowseWikiSchema.safeParse(params);
      expect(paramResult.success).toBe(true);

      if (paramResult.success) {
        // Test handler function
        const page = (await helper.executeTool("browse_wiki", paramResult.data)) as {
          title: string;
          slug: string;
          content: string;
          format: string;
        };

        // Validate wiki page structure
        expect(page).toHaveProperty("title");
        expect(page).toHaveProperty("slug");
        expect(page).toHaveProperty("content");
        expect(page).toHaveProperty("format");

        console.log(`BrowseWikiSchema get action handler test successful: ${page.title}`);
      }
    });

    it("should require slug for get action", async () => {
      const invalidParams = {
        action: "get",
        namespace: "test/project",
        // Missing slug
      };

      const result = BrowseWikiSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log("BrowseWikiSchema correctly requires slug for get action");
    });
  });

  describe("ManageWikiSchema - create action", () => {
    it("should validate create wiki page parameters", async () => {
      const params = {
        action: "create" as const,
        namespace: "test/project",
        title: "Test Wiki Page",
        content: "This is test content",
        format: "markdown" as const,
      };

      const result = ManageWikiSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "create") {
        expect(result.data.action).toBe("create");
        expect(result.data.title).toBe("Test Wiki Page");
        expect(result.data.content).toBe("This is test content");
        expect(result.data.format).toBe("markdown");
      }

      console.log("ManageWikiSchema create action validates correctly");
    });

    it("should require title for create action", async () => {
      const invalidParams = {
        action: "create",
        namespace: "test/project",
        content: "Content without title",
        // Missing title
      };

      const result = ManageWikiSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageWikiSchema correctly requires title for create action");
    });

    it("should require content for create action", async () => {
      const invalidParams = {
        action: "create",
        namespace: "test/project",
        title: "Title without content",
        // Missing content
      };

      const result = ManageWikiSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageWikiSchema correctly requires content for create action");
    });
  });

  describe("ManageWikiSchema - update action", () => {
    it("should validate update wiki page parameters", async () => {
      const params = {
        action: "update" as const,
        namespace: "test/project",
        slug: "existing-page",
        title: "Updated Title",
        content: "Updated content",
      };

      const result = ManageWikiSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "update") {
        expect(result.data.action).toBe("update");
        expect(result.data.slug).toBe("existing-page");
        expect(result.data.title).toBe("Updated Title");
      }

      console.log("ManageWikiSchema update action validates correctly");
    });

    it("should require slug for update action", async () => {
      const invalidParams = {
        action: "update",
        namespace: "test/project",
        title: "Updated Title",
        // Missing slug
      };

      const result = ManageWikiSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageWikiSchema correctly requires slug for update action");
    });
  });

  describe("ManageWikiSchema - delete action", () => {
    it("should validate delete wiki page parameters", async () => {
      const params = {
        action: "delete" as const,
        namespace: "test/project",
        slug: "page-to-delete",
      };

      const result = ManageWikiSchema.safeParse(params);
      expect(result.success).toBe(true);

      // Type narrowing: check action to access action-specific properties
      if (result.success && result.data.action === "delete") {
        expect(result.data.action).toBe("delete");
        expect(result.data.slug).toBe("page-to-delete");
      }

      console.log("ManageWikiSchema delete action validates correctly");
    });

    it("should require slug for delete action", async () => {
      const invalidParams = {
        action: "delete",
        namespace: "test/project",
        // Missing slug
      };

      const result = ManageWikiSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageWikiSchema correctly requires slug for delete action");
    });
  });

  describe("ManageWikiSchema - format options", () => {
    it("should accept all valid format options", async () => {
      const formats = ["markdown", "rdoc", "asciidoc", "org"] as const;

      for (const format of formats) {
        const params = {
          action: "create" as const,
          namespace: "test/project",
          title: "Test Page",
          content: "Test content",
          format,
        };

        const result = ManageWikiSchema.safeParse(params);
        expect(result.success).toBe(true);

        // Type narrowing: check action to access action-specific properties
        if (result.success && result.data.action === "create") {
          expect(result.data.format).toBe(format);
        }
      }

      console.log("ManageWikiSchema accepts all valid format options");
    });

    it("should reject invalid format", async () => {
      const params = {
        action: "create",
        namespace: "test/project",
        title: "Test Page",
        content: "Test content",
        format: "invalid-format",
      };

      const result = ManageWikiSchema.safeParse(params);
      expect(result.success).toBe(false);

      console.log("ManageWikiSchema correctly rejects invalid format");
    });
  });
});
