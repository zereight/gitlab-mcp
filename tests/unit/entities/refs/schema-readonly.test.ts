import { BrowseRefsSchema } from "../../../../src/entities/refs/schema-readonly";

describe("BrowseRefsSchema - Discriminated Union", () => {
  describe("list_branches action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_branches",
          project_id: "my-group/my-project",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_branches") {
          expect(result.data.project_id).toBe("my-group/my-project");
        }
      });

      it("should accept numeric project_id", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_branches",
          project_id: 123,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_branches") {
          expect(result.data.project_id).toBe("123");
        }
      });

      it("should accept search filter", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_branches",
          project_id: "test-project",
          search: "feature*",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_branches") {
          expect(result.data.search).toBe("feature*");
        }
      });

      it("should accept regex filter", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_branches",
          project_id: "test-project",
          regex: "^release/.*$",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_branches") {
          expect(result.data.regex).toBe("^release/.*$");
        }
      });

      it("should accept pagination options", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_branches",
          project_id: "test-project",
          per_page: 50,
          page: 2,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_branches") {
          expect(result.data.per_page).toBe(50);
          expect(result.data.page).toBe(2);
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing project_id", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_branches",
        });
        expect(result.success).toBe(false);
      });

      it("should reject per_page over 100", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_branches",
          project_id: "test-project",
          per_page: 101,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("get_branch action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "get_branch",
          project_id: "my-group/my-project",
          branch: "main",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get_branch") {
          expect(result.data.branch).toBe("main");
        }
      });

      it("should accept branch with slashes", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "get_branch",
          project_id: "test-project",
          branch: "feature/new-feature",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get_branch") {
          expect(result.data.branch).toBe("feature/new-feature");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing branch", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "get_branch",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("list_tags action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_tags",
          project_id: "my-group/my-project",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_tags") {
          expect(result.data.project_id).toBe("my-group/my-project");
        }
      });

      it("should accept order_by option", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_tags",
          project_id: "test-project",
          order_by: "version",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_tags") {
          expect(result.data.order_by).toBe("version");
        }
      });

      it("should accept sort option", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_tags",
          project_id: "test-project",
          sort: "asc",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_tags") {
          expect(result.data.sort).toBe("asc");
        }
      });

      it("should accept search filter", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_tags",
          project_id: "test-project",
          search: "v1.*",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_tags") {
          expect(result.data.search).toBe("v1.*");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject invalid order_by value", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_tags",
          project_id: "test-project",
          order_by: "invalid",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid sort value", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_tags",
          project_id: "test-project",
          sort: "invalid",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("get_tag action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "get_tag",
          project_id: "my-group/my-project",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get_tag") {
          expect(result.data.tag_name).toBe("v1.0.0");
        }
      });

      it("should accept tag with special characters", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "get_tag",
          project_id: "test-project",
          tag_name: "release/1.0.0-beta.1",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get_tag") {
          expect(result.data.tag_name).toBe("release/1.0.0-beta.1");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing tag_name", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "get_tag",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("list_protected_branches action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_protected_branches",
          project_id: "my-group/my-project",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_protected_branches") {
          expect(result.data.project_id).toBe("my-group/my-project");
        }
      });

      it("should accept search filter", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_protected_branches",
          project_id: "test-project",
          search: "main",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_protected_branches") {
          expect(result.data.search).toBe("main");
        }
      });
    });
  });

  describe("get_protected_branch action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "get_protected_branch",
          project_id: "my-group/my-project",
          name: "main",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get_protected_branch") {
          expect(result.data.name).toBe("main");
        }
      });

      it("should accept wildcard pattern", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "get_protected_branch",
          project_id: "test-project",
          name: "release-*",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get_protected_branch") {
          expect(result.data.name).toBe("release-*");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing name", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "get_protected_branch",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("list_protected_tags action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_protected_tags",
          project_id: "my-group/my-project",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_protected_tags") {
          expect(result.data.project_id).toBe("my-group/my-project");
        }
      });

      it("should accept pagination options", () => {
        const result = BrowseRefsSchema.safeParse({
          action: "list_protected_tags",
          project_id: "test-project",
          per_page: 25,
          page: 1,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list_protected_tags") {
          expect(result.data.per_page).toBe(25);
          expect(result.data.page).toBe(1);
        }
      });
    });
  });

  describe("Discriminated Union behavior", () => {
    it("should correctly narrow types based on action", () => {
      const listBranchesResult = BrowseRefsSchema.safeParse({
        action: "list_branches",
        project_id: "test",
      });
      const getBranchResult = BrowseRefsSchema.safeParse({
        action: "get_branch",
        project_id: "test",
        branch: "main",
      });
      const listTagsResult = BrowseRefsSchema.safeParse({
        action: "list_tags",
        project_id: "test",
      });
      const getTagResult = BrowseRefsSchema.safeParse({
        action: "get_tag",
        project_id: "test",
        tag_name: "v1.0.0",
      });

      expect(listBranchesResult.success).toBe(true);
      expect(getBranchResult.success).toBe(true);
      expect(listTagsResult.success).toBe(true);
      expect(getTagResult.success).toBe(true);

      if (listBranchesResult.success) {
        expect(listBranchesResult.data.action).toBe("list_branches");
      }
      if (getBranchResult.success) {
        expect(getBranchResult.data.action).toBe("get_branch");
      }
      if (listTagsResult.success) {
        expect(listTagsResult.data.action).toBe("list_tags");
      }
      if (getTagResult.success) {
        expect(getTagResult.data.action).toBe("get_tag");
      }
    });

    it("should reject unknown action values", () => {
      const result = BrowseRefsSchema.safeParse({
        action: "unknown",
        project_id: "test",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing action", () => {
      const result = BrowseRefsSchema.safeParse({
        project_id: "test",
      });
      expect(result.success).toBe(false);
    });
  });
});
