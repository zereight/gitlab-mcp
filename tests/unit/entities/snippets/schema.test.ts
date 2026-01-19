import {
  CreateSnippetSchema,
  UpdateSnippetSchema,
  DeleteSnippetSchema,
} from "../../../../src/entities/snippets/schema";

describe("Snippets Write Schemas", () => {
  describe("CreateSnippetSchema", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          title: "Test Snippet",
          files: [{ file_path: "test.js", content: "console.log('hello');" }],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.action).toBe("create");
          expect(result.data.title).toBe("Test Snippet");
          expect(result.data.files).toHaveLength(1);
        }
      });

      it("should default visibility to private", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          title: "Test",
          files: [{ file_path: "test.js", content: "code" }],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.visibility).toBe("private");
        }
      });

      it("should accept explicit visibility", () => {
        for (const visibility of ["private", "internal", "public"]) {
          const result = CreateSnippetSchema.safeParse({
            action: "create",
            title: "Test",
            visibility,
            files: [{ file_path: "test.js", content: "code" }],
          });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.visibility).toBe(visibility);
          }
        }
      });

      it("should coerce visibility aliases (priv, intern, pub)", () => {
        const testCases = [
          { input: "priv", expected: "private" },
          { input: "intern", expected: "internal" },
          { input: "pub", expected: "public" },
        ];

        for (const { input, expected } of testCases) {
          const result = CreateSnippetSchema.safeParse({
            action: "create",
            title: "Test",
            visibility: input,
            files: [{ file_path: "test.js", content: "code" }],
          });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.visibility).toBe(expected);
          }
        }
      });

      it("should accept projectId for project snippets", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          projectId: "my-project",
          title: "Project Snippet",
          files: [{ file_path: "test.py", content: "print('hello')" }],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("my-project");
        }
      });

      it("should accept description", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          title: "Test",
          description: "A test snippet for demo purposes",
          files: [{ file_path: "test.js", content: "code" }],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.description).toBe("A test snippet for demo purposes");
        }
      });

      it("should accept multiple files", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          title: "Multi-file Snippet",
          files: [
            { file_path: "index.js", content: "module.exports = require('./lib');" },
            { file_path: "lib.js", content: "module.exports = {};" },
            { file_path: "README.md", content: "# Documentation" },
          ],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.files).toHaveLength(3);
        }
      });

      it("should accept files with subdirectory paths", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          title: "Structured Snippet",
          files: [
            { file_path: "src/main.py", content: "# main" },
            { file_path: "src/utils/helper.py", content: "# helper" },
          ],
        });
        expect(result.success).toBe(true);
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing action", () => {
        const result = CreateSnippetSchema.safeParse({
          title: "Test",
          files: [{ file_path: "test.js", content: "code" }],
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid action value", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "update",
          title: "Test",
          files: [{ file_path: "test.js", content: "code" }],
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing title", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          files: [{ file_path: "test.js", content: "code" }],
        });
        expect(result.success).toBe(false);
      });

      it("should reject empty title", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          title: "",
          files: [{ file_path: "test.js", content: "code" }],
        });
        expect(result.success).toBe(false);
      });

      it("should reject title longer than 255 characters", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          title: "x".repeat(256),
          files: [{ file_path: "test.js", content: "code" }],
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing files", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          title: "Test",
        });
        expect(result.success).toBe(false);
      });

      it("should reject empty files array", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          title: "Test",
          files: [],
        });
        expect(result.success).toBe(false);
      });

      it("should reject file with empty file_path", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          title: "Test",
          files: [{ file_path: "", content: "code" }],
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid visibility value", () => {
        const result = CreateSnippetSchema.safeParse({
          action: "create",
          title: "Test",
          visibility: "secret",
          files: [{ file_path: "test.js", content: "code" }],
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("UpdateSnippetSchema", () => {
    describe("Valid inputs", () => {
      it("should accept update with title only", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 123,
          title: "Updated Title",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe("Updated Title");
        }
      });

      it("should accept update with description only", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 123,
          description: "Updated description",
        });
        expect(result.success).toBe(true);
      });

      it("should accept update with visibility only", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 123,
          visibility: "public",
        });
        expect(result.success).toBe(true);
      });

      it("should accept update with files only", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 123,
          files: [{ file_path: "new.js", content: "// new file", action: "create" }],
        });
        expect(result.success).toBe(true);
      });

      it("should accept file actions (create, update, delete, move)", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 123,
          files: [
            { file_path: "new.js", content: "// new", action: "create" },
            { file_path: "existing.js", content: "// modified", action: "update" },
            { file_path: "old.js", action: "delete" },
            { file_path: "renamed.js", previous_path: "original.js", action: "move" },
          ],
        });
        expect(result.success).toBe(true);
      });

      it("should accept projectId for project snippets", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 456,
          projectId: "my-project",
          title: "Updated",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("my-project");
        }
      });

      it("should accept multiple update fields", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 789,
          title: "New Title",
          description: "New description",
          visibility: "internal",
          files: [{ file_path: "test.js", content: "// updated", action: "update" }],
        });
        expect(result.success).toBe(true);
      });

      it("should coerce visibility aliases", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 123,
          visibility: "pub",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.visibility).toBe("public");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing action", () => {
        const result = UpdateSnippetSchema.safeParse({
          id: 123,
          title: "Updated",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid action value", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "create",
          id: 123,
          title: "Updated",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing id", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          title: "Updated",
        });
        expect(result.success).toBe(false);
      });

      it("should reject non-positive id", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 0,
          title: "Updated",
        });
        expect(result.success).toBe(false);
      });

      it("should reject no update fields provided", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 123,
        });
        expect(result.success).toBe(false);
      });

      it("should reject empty files array", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 123,
          files: [],
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid visibility value", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 123,
          visibility: "secret",
        });
        expect(result.success).toBe(false);
      });

      it("should reject title longer than 255 characters", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 123,
          title: "x".repeat(256),
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid file action", () => {
        const result = UpdateSnippetSchema.safeParse({
          action: "update",
          id: 123,
          files: [{ file_path: "test.js", action: "invalid" }],
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("DeleteSnippetSchema", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = DeleteSnippetSchema.safeParse({
          action: "delete",
          id: 123,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.action).toBe("delete");
          expect(result.data.id).toBe(123);
        }
      });

      it("should accept projectId for project snippets", () => {
        const result = DeleteSnippetSchema.safeParse({
          action: "delete",
          id: 456,
          projectId: "group/project",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("group/project");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing action", () => {
        const result = DeleteSnippetSchema.safeParse({
          id: 123,
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid action value", () => {
        const result = DeleteSnippetSchema.safeParse({
          action: "remove",
          id: 123,
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing id", () => {
        const result = DeleteSnippetSchema.safeParse({
          action: "delete",
        });
        expect(result.success).toBe(false);
      });

      it("should reject non-positive id", () => {
        const result = DeleteSnippetSchema.safeParse({
          action: "delete",
          id: 0,
        });
        expect(result.success).toBe(false);
      });

      it("should reject negative id", () => {
        const result = DeleteSnippetSchema.safeParse({
          action: "delete",
          id: -10,
        });
        expect(result.success).toBe(false);
      });

      it("should reject string id", () => {
        const result = DeleteSnippetSchema.safeParse({
          action: "delete",
          id: "123",
        });
        expect(result.success).toBe(false);
      });
    });
  });
});
