import { BrowseReleasesSchema } from "../../../../src/entities/releases/schema-readonly";

describe("BrowseReleasesSchema - Discriminated Union", () => {
  describe("list action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: "my-group/my-project",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.project_id).toBe("my-group/my-project");
        }
      });

      it("should accept numeric project_id", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: 123,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          // requiredId coerces to string
          expect(result.data.project_id).toBe("123");
        }
      });

      it("should accept order_by option", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: "test-project",
          order_by: "released_at",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.order_by).toBe("released_at");
        }
      });

      it("should accept created_at order_by", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: "test-project",
          order_by: "created_at",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.order_by).toBe("created_at");
        }
      });

      it("should accept sort option", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: "test-project",
          sort: "asc",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.sort).toBe("asc");
        }
      });

      it("should accept include_html_description option", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: "test-project",
          include_html_description: true,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "list") {
          expect(result.data.include_html_description).toBe(true);
        }
      });

      it("should accept pagination options", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: "test-project",
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
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: "group/subgroup/project",
          order_by: "created_at",
          sort: "desc",
          include_html_description: true,
          per_page: 100,
          page: 1,
        });
        expect(result.success).toBe(true);
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing action", () => {
        const result = BrowseReleasesSchema.safeParse({
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing project_id", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid order_by value", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: "test-project",
          order_by: "invalid",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid sort value", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: "test-project",
          sort: "invalid",
        });
        expect(result.success).toBe(false);
      });

      it("should reject per_page over 100", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: "test-project",
          per_page: 101,
        });
        expect(result.success).toBe(false);
      });

      it("should reject per_page under 1", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: "test-project",
          per_page: 0,
        });
        expect(result.success).toBe(false);
      });

      it("should reject page under 1", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "list",
          project_id: "test-project",
          page: 0,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("get action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "get",
          project_id: "my-group/my-project",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get") {
          expect(result.data.project_id).toBe("my-group/my-project");
          expect(result.data.tag_name).toBe("v1.0.0");
        }
      });

      it("should accept include_html_description option", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "get",
          project_id: "test-project",
          tag_name: "v2.0.0",
          include_html_description: true,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get") {
          expect(result.data.include_html_description).toBe(true);
        }
      });

      it("should accept tag_name with special characters", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "get",
          project_id: "test-project",
          tag_name: "release/1.0.0-beta.1",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "get") {
          expect(result.data.tag_name).toBe("release/1.0.0-beta.1");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing project_id", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "get",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing tag_name", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "get",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid action", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "invalid",
          project_id: "test-project",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("assets action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "assets",
          project_id: "my-group/my-project",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "assets") {
          expect(result.data.project_id).toBe("my-group/my-project");
          expect(result.data.tag_name).toBe("v1.0.0");
        }
      });

      it("should accept pagination options", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "assets",
          project_id: "test-project",
          tag_name: "v2.0.0",
          per_page: 25,
          page: 1,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "assets") {
          expect(result.data.per_page).toBe(25);
          expect(result.data.page).toBe(1);
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing project_id", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "assets",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing tag_name", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "assets",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });

      it("should reject per_page over 100", () => {
        const result = BrowseReleasesSchema.safeParse({
          action: "assets",
          project_id: "test-project",
          tag_name: "v1.0.0",
          per_page: 101,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Discriminated Union behavior", () => {
    it("should correctly narrow types based on action", () => {
      const listResult = BrowseReleasesSchema.safeParse({
        action: "list",
        project_id: "test",
      });
      const getResult = BrowseReleasesSchema.safeParse({
        action: "get",
        project_id: "test",
        tag_name: "v1.0.0",
      });
      const assetsResult = BrowseReleasesSchema.safeParse({
        action: "assets",
        project_id: "test",
        tag_name: "v1.0.0",
      });

      expect(listResult.success).toBe(true);
      expect(getResult.success).toBe(true);
      expect(assetsResult.success).toBe(true);

      if (listResult.success) {
        expect(listResult.data.action).toBe("list");
      }
      if (getResult.success) {
        expect(getResult.data.action).toBe("get");
      }
      if (assetsResult.success) {
        expect(assetsResult.data.action).toBe("assets");
      }
    });

    it("should reject unknown action values", () => {
      const result = BrowseReleasesSchema.safeParse({
        action: "unknown",
        project_id: "test",
      });
      expect(result.success).toBe(false);
    });
  });
});
