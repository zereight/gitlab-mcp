import { BrowseSnippetsSchema } from "../../../../src/entities/snippets/schema-readonly";

describe("BrowseSnippetsSchema - Discriminated Union", () => {
  describe("list action", () => {
    describe("Valid inputs", () => {
      it("should accept personal scope without projectId", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "list",
          scope: "personal",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.scope).toBe("personal");
        }
      });

      it("should accept public scope without projectId", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "list",
          scope: "public",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.scope).toBe("public");
        }
      });

      it("should accept project scope with projectId", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "list",
          scope: "project",
          projectId: "123",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.scope).toBe("project");
          expect(result.data.projectId).toBe("123");
        }
      });

      it("should accept project scope with URL-encoded project path", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "list",
          scope: "project",
          projectId: "group/project",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.projectId).toBe("group/project");
        }
      });

      it("should accept visibility filter", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "list",
          scope: "personal",
          visibility: "private",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.visibility).toBe("private");
        }
      });

      it("should accept all visibility values", () => {
        for (const visibility of ["private", "internal", "public"]) {
          const result = BrowseSnippetsSchema.safeParse({
            action: "list",
            scope: "personal",
            visibility,
          });
          expect(result.success).toBe(true);
        }
      });

      it("should accept date filters", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "list",
          scope: "personal",
          created_after: "2024-01-01T00:00:00Z",
          created_before: "2024-12-31T23:59:59Z",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.created_after).toBe("2024-01-01T00:00:00Z");
          expect(result.data.created_before).toBe("2024-12-31T23:59:59Z");
        }
      });

      it("should accept pagination options", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "list",
          scope: "personal",
          per_page: 50,
          page: 2,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.per_page).toBe(50);
          expect(result.data.page).toBe(2);
        }
      });

      it("should accept all options combined", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "list",
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
      it("should reject missing action", () => {
        const result = BrowseSnippetsSchema.safeParse({
          scope: "personal",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing scope", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "list",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid scope value", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "list",
          scope: "invalid",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid visibility value", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "list",
          scope: "personal",
          visibility: "invalid",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid per_page type", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "list",
          scope: "personal",
          per_page: "fifty",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("get action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "get",
          id: 123,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get") {
          expect(result.data.action).toBe("get");
          // requiredId coerces to string
          expect(result.data.id).toBe("123");
        }
      });

      it("should accept projectId for project snippets", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "get",
          id: 456,
          projectId: "my-project",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get") {
          expect(result.data.projectId).toBe("my-project");
        }
      });

      it("should accept raw flag to get raw content", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "get",
          id: 789,
          raw: true,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get") {
          expect(result.data.raw).toBe(true);
        }
      });

      it("should default raw to false", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "get",
          id: 100,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get") {
          expect(result.data.raw).toBe(false);
        }
      });

      it("should accept all options combined", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "get",
          id: 200,
          projectId: "group/subgroup/project",
          raw: true,
        });
        expect(result.success).toBe(true);
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing action", () => {
        const result = BrowseSnippetsSchema.safeParse({
          id: 123,
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid action value", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "invalid",
          id: 123,
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing id", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "get",
        });
        expect(result.success).toBe(false);
      });

      it("should coerce zero id to string (requiredId uses z.coerce.string)", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "get",
          id: 0,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get") {
          expect(result.data.id).toBe("0");
        }
      });

      it("should coerce negative id to string", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "get",
          id: -5,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get") {
          expect(result.data.id).toBe("-5");
        }
      });

      it("should coerce float id to string", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "get",
          id: 12.5,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get") {
          expect(result.data.id).toBe("12.5");
        }
      });

      it("should accept string id", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "get",
          id: "123",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get") {
          expect(result.data.id).toBe("123");
        }
      });

      it("should reject invalid raw type", () => {
        const result = BrowseSnippetsSchema.safeParse({
          action: "get",
          id: 123,
          raw: "yes",
        });
        expect(result.success).toBe(false);
      });
    });
  });
});
