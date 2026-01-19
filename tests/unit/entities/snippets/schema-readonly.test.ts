import {
  ListSnippetsSchema,
  GetSnippetSchema,
} from "../../../../src/entities/snippets/schema-readonly";

describe("Snippets Read-Only Schemas", () => {
  describe("ListSnippetsSchema", () => {
    describe("Valid inputs", () => {
      it("should accept personal scope without projectId", () => {
        const result = ListSnippetsSchema.safeParse({
          scope: "personal",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.scope).toBe("personal");
        }
      });

      it("should accept public scope without projectId", () => {
        const result = ListSnippetsSchema.safeParse({
          scope: "public",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.scope).toBe("public");
        }
      });

      it("should accept project scope with projectId", () => {
        const result = ListSnippetsSchema.safeParse({
          scope: "project",
          projectId: "123",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.scope).toBe("project");
          expect(result.data.projectId).toBe("123");
        }
      });

      it("should accept project scope with URL-encoded project path", () => {
        const result = ListSnippetsSchema.safeParse({
          scope: "project",
          projectId: "group/project",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("group/project");
        }
      });

      it("should accept visibility filter", () => {
        const result = ListSnippetsSchema.safeParse({
          scope: "personal",
          visibility: "private",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.visibility).toBe("private");
        }
      });

      it("should accept all visibility values", () => {
        for (const visibility of ["private", "internal", "public"]) {
          const result = ListSnippetsSchema.safeParse({
            scope: "personal",
            visibility,
          });
          expect(result.success).toBe(true);
        }
      });

      it("should accept date filters", () => {
        const result = ListSnippetsSchema.safeParse({
          scope: "personal",
          created_after: "2024-01-01T00:00:00Z",
          created_before: "2024-12-31T23:59:59Z",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.created_after).toBe("2024-01-01T00:00:00Z");
          expect(result.data.created_before).toBe("2024-12-31T23:59:59Z");
        }
      });

      it("should accept pagination options", () => {
        const result = ListSnippetsSchema.safeParse({
          scope: "personal",
          per_page: 50,
          page: 2,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.per_page).toBe(50);
          expect(result.data.page).toBe(2);
        }
      });

      it("should accept all options combined", () => {
        const result = ListSnippetsSchema.safeParse({
          scope: "project",
          projectId: "test/repo",
          visibility: "internal",
          created_after: "2024-01-01T00:00:00Z",
          created_before: "2024-12-31T23:59:59Z",
          per_page: 100,
          page: 1,
        });
        expect(result.success).toBe(true);
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing scope", () => {
        const result = ListSnippetsSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it("should reject invalid scope value", () => {
        const result = ListSnippetsSchema.safeParse({
          scope: "invalid",
        });
        expect(result.success).toBe(false);
      });

      it("should reject project scope without projectId", () => {
        const result = ListSnippetsSchema.safeParse({
          scope: "project",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("projectId");
        }
      });

      it("should reject invalid visibility value", () => {
        const result = ListSnippetsSchema.safeParse({
          scope: "personal",
          visibility: "invalid",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid per_page type", () => {
        const result = ListSnippetsSchema.safeParse({
          scope: "personal",
          per_page: "fifty",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("GetSnippetSchema", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = GetSnippetSchema.safeParse({
          action: "read",
          id: 123,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.action).toBe("read");
          expect(result.data.id).toBe(123);
        }
      });

      it("should accept projectId for project snippets", () => {
        const result = GetSnippetSchema.safeParse({
          action: "read",
          id: 456,
          projectId: "my-project",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("my-project");
        }
      });

      it("should accept raw flag to get raw content", () => {
        const result = GetSnippetSchema.safeParse({
          action: "read",
          id: 789,
          raw: true,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.raw).toBe(true);
        }
      });

      it("should default raw to false", () => {
        const result = GetSnippetSchema.safeParse({
          action: "read",
          id: 100,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.raw).toBe(false);
        }
      });

      it("should accept all options combined", () => {
        const result = GetSnippetSchema.safeParse({
          action: "read",
          id: 200,
          projectId: "group/subgroup/project",
          raw: true,
        });
        expect(result.success).toBe(true);
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing action", () => {
        const result = GetSnippetSchema.safeParse({
          id: 123,
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid action value", () => {
        const result = GetSnippetSchema.safeParse({
          action: "invalid",
          id: 123,
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing id", () => {
        const result = GetSnippetSchema.safeParse({
          action: "read",
        });
        expect(result.success).toBe(false);
      });

      it("should reject non-positive id", () => {
        const result = GetSnippetSchema.safeParse({
          action: "read",
          id: 0,
        });
        expect(result.success).toBe(false);
      });

      it("should reject negative id", () => {
        const result = GetSnippetSchema.safeParse({
          action: "read",
          id: -5,
        });
        expect(result.success).toBe(false);
      });

      it("should reject non-integer id", () => {
        const result = GetSnippetSchema.safeParse({
          action: "read",
          id: 12.5,
        });
        expect(result.success).toBe(false);
      });

      it("should reject string id", () => {
        const result = GetSnippetSchema.safeParse({
          action: "read",
          id: "123",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid raw type", () => {
        const result = GetSnippetSchema.safeParse({
          action: "read",
          id: 123,
          raw: "yes",
        });
        expect(result.success).toBe(false);
      });
    });
  });
});
