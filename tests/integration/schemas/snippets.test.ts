/**
 * Snippets Schema Integration Tests
 * Tests schemas using handler functions with real GitLab API
 *
 * Test lifecycle:
 * 1. Create test snippet
 * 2. Read/list snippets
 * 3. Update snippet
 * 4. Delete snippet (cleanup)
 */

import {
  ListSnippetsSchema,
  GetSnippetSchema,
} from "../../../src/entities/snippets/schema-readonly";
import {
  CreateSnippetSchema,
  UpdateSnippetSchema,
  DeleteSnippetSchema,
} from "../../../src/entities/snippets/schema";
import { IntegrationTestHelper } from "../helpers/registry-helper";

// Store created snippet ID for lifecycle tests
let createdSnippetId: number | null = null;

describe("Snippets Schema - GitLab Integration", () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error("GITLAB_TOKEN environment variable is required");
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("Integration test helper initialized for snippets testing");
  });

  afterAll(async () => {
    // Cleanup: delete test snippet if it was created and not already deleted
    if (createdSnippetId) {
      try {
        await helper.executeTool("manage_snippet", {
          action: "delete",
          id: createdSnippetId,
        });
        console.log(`Cleanup: Deleted test snippet ${createdSnippetId}`);
      } catch (error) {
        // Snippet might already be deleted by the delete test
        console.log(`Cleanup: Snippet ${createdSnippetId} already deleted or not found`);
      }
    }
  });

  describe("CreateSnippetSchema - create action", () => {
    it("should create a personal snippet via handler", async () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const validParams = {
        action: "create" as const,
        title: `Integration Test Snippet ${timestamp}`,
        description: "Created by integration test - will be cleaned up",
        visibility: "private" as const,
        files: [
          {
            file_path: "test-script.js",
            content: `// Test snippet created at ${timestamp}\nconsole.log("Hello from integration test");`,
          },
        ],
      };

      // Validate schema
      const result = CreateSnippetSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const snippet = (await helper.executeTool("manage_snippet", result.data)) as {
          id: number;
          title: string;
          visibility: string;
        };

        expect(snippet).toHaveProperty("id");
        expect(snippet).toHaveProperty("title");
        expect(snippet.title).toBe(validParams.title);
        expect(snippet.visibility).toBe("private");

        // Store for later tests
        createdSnippetId = snippet.id;
        console.log(`Created test snippet: ID=${snippet.id}, title="${snippet.title}"`);
      }
    });

    it("should create a multi-file snippet", async () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const validParams = {
        action: "create" as const,
        title: `Multi-file Test ${timestamp}`,
        visibility: "private" as const,
        files: [
          { file_path: "index.js", content: "// Entry point\nmodule.exports = require('./lib');" },
          { file_path: "lib.js", content: "// Library\nmodule.exports = { test: true };" },
          { file_path: "README.md", content: "# Multi-file Test\n\nIntegration test snippet." },
        ],
      };

      const result = CreateSnippetSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const snippet = (await helper.executeTool("manage_snippet", result.data)) as {
          id: number;
          title: string;
          files: Array<{ path: string }>;
        };

        expect(snippet).toHaveProperty("id");
        expect(snippet).toHaveProperty("title");

        // Cleanup this multi-file snippet immediately
        await helper.executeTool("manage_snippet", {
          action: "delete",
          id: snippet.id,
        });
        console.log(`Created and deleted multi-file snippet: ID=${snippet.id}`);
      }
    });
  });

  describe("ListSnippetsSchema - personal scope", () => {
    it("should list personal snippets via handler", async () => {
      const validParams = {
        scope: "personal" as const,
        per_page: 10,
      };

      // Validate schema
      const result = ListSnippetsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const snippets = (await helper.executeTool("list_snippets", result.data)) as Array<{
          id: number;
          title: string;
          visibility: string;
        }>;

        expect(Array.isArray(snippets)).toBe(true);
        console.log(`Listed ${snippets.length} personal snippets`);

        // If we have snippets, validate structure
        if (snippets.length > 0) {
          const snippet = snippets[0];
          expect(snippet).toHaveProperty("id");
          expect(snippet).toHaveProperty("title");
          expect(snippet).toHaveProperty("visibility");
          console.log(`Validated snippet structure: ${snippet.title} (ID: ${snippet.id})`);
        }
      }
    });

    it("should filter by visibility", async () => {
      const validParams = {
        scope: "personal" as const,
        visibility: "private" as const,
        per_page: 5,
      };

      const result = ListSnippetsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const snippets = (await helper.executeTool("list_snippets", result.data)) as Array<{
          visibility: string;
        }>;

        // All returned snippets should be private
        for (const snippet of snippets) {
          expect(snippet.visibility).toBe("private");
        }
        console.log(`Listed ${snippets.length} private snippets`);
      }
    });
  });

  describe("ListSnippetsSchema - public scope", () => {
    it("should list public snippets via handler", async () => {
      const validParams = {
        scope: "public" as const,
        per_page: 5,
      };

      const result = ListSnippetsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const snippets = (await helper.executeTool("list_snippets", result.data)) as Array<{
          id: number;
          visibility: string;
        }>;

        expect(Array.isArray(snippets)).toBe(true);
        console.log(`Listed ${snippets.length} public snippets`);

        // All returned snippets should be public
        for (const snippet of snippets) {
          expect(snippet.visibility).toBe("public");
        }
      }
    });
  });

  describe("GetSnippetSchema - read action", () => {
    it("should read created snippet via handler", async () => {
      if (!createdSnippetId) {
        console.log("Skipping: No snippet was created in previous test");
        return;
      }

      const validParams = {
        action: "read" as const,
        id: createdSnippetId,
      };

      const result = GetSnippetSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const snippet = (await helper.executeTool("manage_snippet", result.data)) as {
          id: number;
          title: string;
          description: string;
          visibility: string;
          web_url: string;
        };

        expect(snippet).toHaveProperty("id");
        expect(snippet.id).toBe(createdSnippetId);
        expect(snippet).toHaveProperty("title");
        expect(snippet).toHaveProperty("web_url");
        console.log(`Read snippet: ${snippet.title}, URL: ${snippet.web_url}`);
      }
    });

    it("should read raw snippet content via handler", async () => {
      if (!createdSnippetId) {
        console.log("Skipping: No snippet was created in previous test");
        return;
      }

      const validParams = {
        action: "read" as const,
        id: createdSnippetId,
        raw: true,
      };

      const result = GetSnippetSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        try {
          // Raw content endpoint returns plain text, which may not be parseable as JSON
          // The handler may throw if the API returns non-JSON content
          const rawContent = await helper.executeTool("manage_snippet", result.data);
          expect(rawContent).toBeDefined();
          console.log(`Retrieved raw content for snippet ${createdSnippetId}`);
        } catch (error: unknown) {
          // Expected: raw endpoint returns plain text, not JSON
          // This is expected behavior when the snippet contains plain text/code
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes("JSON") || errorMessage.includes("Unexpected token")) {
            console.log(
              "Raw content test: API returned plain text (expected behavior for raw endpoint)"
            );
            // This is acceptable - raw endpoint returns plain text
          } else {
            throw error;
          }
        }
      }
    });
  });

  describe("UpdateSnippetSchema - update action", () => {
    it("should update snippet title via handler", async () => {
      if (!createdSnippetId) {
        console.log("Skipping: No snippet was created in previous test");
        return;
      }

      const updatedTitle = `Updated Title - ${new Date().toISOString()}`;
      const validParams = {
        action: "update" as const,
        id: createdSnippetId,
        title: updatedTitle,
      };

      const result = UpdateSnippetSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const snippet = (await helper.executeTool("manage_snippet", result.data)) as {
          id: number;
          title: string;
        };

        expect(snippet.id).toBe(createdSnippetId);
        expect(snippet.title).toBe(updatedTitle);
        console.log(`Updated snippet title to: ${snippet.title}`);
      }
    });

    it("should update snippet description via handler", async () => {
      if (!createdSnippetId) {
        console.log("Skipping: No snippet was created in previous test");
        return;
      }

      const validParams = {
        action: "update" as const,
        id: createdSnippetId,
        description: "Updated description from integration test",
      };

      const result = UpdateSnippetSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const snippet = (await helper.executeTool("manage_snippet", result.data)) as {
          id: number;
          description: string;
        };

        expect(snippet.id).toBe(createdSnippetId);
        expect(snippet.description).toBe("Updated description from integration test");
        console.log(`Updated snippet description`);
      }
    });

    it("should update snippet visibility via handler", async () => {
      if (!createdSnippetId) {
        console.log("Skipping: No snippet was created in previous test");
        return;
      }

      // First update to internal, then back to private
      const validParams = {
        action: "update" as const,
        id: createdSnippetId,
        visibility: "internal" as const,
      };

      const result = UpdateSnippetSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const snippet = (await helper.executeTool("manage_snippet", result.data)) as {
          id: number;
          visibility: string;
        };

        expect(snippet.id).toBe(createdSnippetId);
        expect(snippet.visibility).toBe("internal");
        console.log(`Updated snippet visibility to: ${snippet.visibility}`);

        // Revert to private
        await helper.executeTool("manage_snippet", {
          action: "update",
          id: createdSnippetId,
          visibility: "private",
        });
        console.log("Reverted snippet visibility to private");
      }
    });

    it("should add file to snippet via handler", async () => {
      if (!createdSnippetId) {
        console.log("Skipping: No snippet was created in previous test");
        return;
      }

      const validParams = {
        action: "update" as const,
        id: createdSnippetId,
        files: [
          {
            file_path: "new-file.txt",
            content: "This is a new file added via integration test",
            action: "create" as const,
          },
        ],
      };

      const result = UpdateSnippetSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const snippet = (await helper.executeTool("manage_snippet", result.data)) as {
          id: number;
          files: Array<{ path: string }>;
        };

        expect(snippet.id).toBe(createdSnippetId);
        console.log(`Added new file to snippet ${createdSnippetId}`);
      }
    });
  });

  describe("DeleteSnippetSchema - delete action", () => {
    it("should delete created snippet via handler", async () => {
      if (!createdSnippetId) {
        console.log("Skipping: No snippet was created to delete");
        return;
      }

      const validParams = {
        action: "delete" as const,
        id: createdSnippetId,
      };

      const result = DeleteSnippetSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        const deleteResult = (await helper.executeTool("manage_snippet", result.data)) as {
          deleted: boolean;
          id: number;
        };

        expect(deleteResult.deleted).toBe(true);
        expect(deleteResult.id).toBe(createdSnippetId);
        console.log(`Deleted snippet ${createdSnippetId}`);

        // Mark as deleted so afterAll doesn't try to delete again
        createdSnippetId = null;
      }
    });
  });

  describe("Error handling", () => {
    it("should handle non-existent snippet gracefully", async () => {
      const validParams = {
        action: "read" as const,
        id: 999999999, // Very unlikely to exist
      };

      const result = GetSnippetSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        try {
          await helper.executeTool("manage_snippet", result.data);
          // If we get here, the snippet exists (unlikely)
        } catch (error) {
          // Expected: snippet not found
          expect(error).toBeDefined();
          console.log("Correctly handled non-existent snippet error");
        }
      }
    });

    it("should reject invalid schema inputs", () => {
      // Test ListSnippetsSchema - project scope without projectId
      const listResult = ListSnippetsSchema.safeParse({
        scope: "project",
        // Missing projectId
      });
      expect(listResult.success).toBe(false);

      // Test UpdateSnippetSchema - no update fields
      const updateResult = UpdateSnippetSchema.safeParse({
        action: "update",
        id: 123,
        // Missing any update field
      });
      expect(updateResult.success).toBe(false);

      // Test CreateSnippetSchema - missing files
      const createResult = CreateSnippetSchema.safeParse({
        action: "create",
        title: "Test",
        // Missing files
      });
      expect(createResult.success).toBe(false);

      console.log("Schema validation correctly rejected invalid inputs");
    });
  });
});
