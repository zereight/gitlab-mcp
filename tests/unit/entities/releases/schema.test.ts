import { ManageReleaseSchema } from "../../../../src/entities/releases/schema";

describe("ManageReleaseSchema - Discriminated Union", () => {
  describe("create action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "my-group/my-project",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create") {
          expect(result.data.project_id).toBe("my-group/my-project");
          expect(result.data.tag_name).toBe("v1.0.0");
        }
      });

      it("should accept name and description", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
          tag_name: "v1.0.0",
          name: "Release 1.0.0",
          description: "First stable release with **markdown** support",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create") {
          expect(result.data.name).toBe("Release 1.0.0");
          expect(result.data.description).toBe("First stable release with **markdown** support");
        }
      });

      it("should accept ref for new tag creation", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
          tag_name: "v1.0.0",
          ref: "main",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create") {
          expect(result.data.ref).toBe("main");
        }
      });

      it("should accept ref as commit SHA", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
          tag_name: "v1.0.0",
          ref: "abc123def456",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create") {
          expect(result.data.ref).toBe("abc123def456");
        }
      });

      it("should accept tag_message for annotated tags", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
          tag_name: "v1.0.0",
          ref: "main",
          tag_message: "Release version 1.0.0",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create") {
          expect(result.data.tag_message).toBe("Release version 1.0.0");
        }
      });

      it("should accept milestones array", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
          tag_name: "v1.0.0",
          milestones: ["Sprint 1", "Sprint 2"],
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create") {
          expect(result.data.milestones).toEqual(["Sprint 1", "Sprint 2"]);
        }
      });

      it("should accept released_at date", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
          tag_name: "v1.0.0",
          released_at: "2024-01-15T12:00:00Z",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create") {
          expect(result.data.released_at).toBe("2024-01-15T12:00:00Z");
        }
      });

      it("should accept assets with links", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
          tag_name: "v1.0.0",
          assets: {
            links: [
              {
                name: "Linux Binary",
                url: "https://example.com/binaries/linux-amd64",
                direct_asset_path: "/binaries/linux-amd64",
                link_type: "package",
              },
            ],
          },
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create") {
          expect(result.data.assets?.links).toHaveLength(1);
          expect(result.data.assets?.links?.[0].name).toBe("Linux Binary");
        }
      });

      it("should accept multiple asset links", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
          tag_name: "v1.0.0",
          assets: {
            links: [
              { name: "Linux x64", url: "https://example.com/linux-x64" },
              { name: "Windows x64", url: "https://example.com/windows-x64" },
              { name: "macOS x64", url: "https://example.com/macos-x64" },
            ],
          },
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create") {
          expect(result.data.assets?.links).toHaveLength(3);
        }
      });

      it("should accept all link_type values", () => {
        for (const linkType of ["other", "runbook", "image", "package"]) {
          const result = ManageReleaseSchema.safeParse({
            action: "create",
            project_id: "test-project",
            tag_name: "v1.0.0",
            assets: {
              links: [
                {
                  name: "Test",
                  url: "https://example.com/test",
                  link_type: linkType,
                },
              ],
            },
          });
          expect(result.success).toBe(true);
        }
      });

      it("should accept all options combined", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "group/project",
          tag_name: "v2.0.0",
          name: "Version 2.0.0",
          description: "Major release",
          ref: "main",
          tag_message: "Annotated tag for v2.0.0",
          milestones: ["Q1 2024"],
          released_at: "2024-03-01T00:00:00Z",
          assets: {
            links: [{ name: "Binary", url: "https://example.com/binary" }],
          },
        });
        expect(result.success).toBe(true);
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing project_id", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing tag_name", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid asset link url", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
          tag_name: "v1.0.0",
          assets: {
            links: [
              {
                name: "Invalid",
                url: "not-a-url",
              },
            ],
          },
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid link_type", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
          tag_name: "v1.0.0",
          assets: {
            links: [
              {
                name: "Test",
                url: "https://example.com/test",
                link_type: "invalid",
              },
            ],
          },
        });
        expect(result.success).toBe(false);
      });

      it("should reject asset link without name", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
          tag_name: "v1.0.0",
          assets: {
            links: [
              {
                url: "https://example.com/test",
              },
            ],
          },
        });
        expect(result.success).toBe(false);
      });

      it("should reject asset link without url", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create",
          project_id: "test-project",
          tag_name: "v1.0.0",
          assets: {
            links: [
              {
                name: "Test",
              },
            ],
          },
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("update action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "update",
          project_id: "test-project",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "update") {
          expect(result.data.project_id).toBe("test-project");
          expect(result.data.tag_name).toBe("v1.0.0");
        }
      });

      it("should accept name update", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "update",
          project_id: "test-project",
          tag_name: "v1.0.0",
          name: "Updated Release Name",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "update") {
          expect(result.data.name).toBe("Updated Release Name");
        }
      });

      it("should accept description update", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "update",
          project_id: "test-project",
          tag_name: "v1.0.0",
          description: "Updated description with **markdown**",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "update") {
          expect(result.data.description).toBe("Updated description with **markdown**");
        }
      });

      it("should accept milestones update", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "update",
          project_id: "test-project",
          tag_name: "v1.0.0",
          milestones: ["Updated Milestone"],
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "update") {
          expect(result.data.milestones).toEqual(["Updated Milestone"]);
        }
      });

      it("should accept released_at update", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "update",
          project_id: "test-project",
          tag_name: "v1.0.0",
          released_at: "2024-06-01T00:00:00Z",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "update") {
          expect(result.data.released_at).toBe("2024-06-01T00:00:00Z");
        }
      });

      it("should accept all update options combined", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "update",
          project_id: "test-project",
          tag_name: "v1.0.0",
          name: "New Name",
          description: "New Description",
          milestones: ["New Milestone"],
          released_at: "2024-12-01T00:00:00Z",
        });
        expect(result.success).toBe(true);
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing project_id", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "update",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing tag_name", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "update",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("delete action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "delete",
          project_id: "test-project",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "delete") {
          expect(result.data.project_id).toBe("test-project");
          expect(result.data.tag_name).toBe("v1.0.0");
        }
      });

      it("should accept URL-encoded project path", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "delete",
          project_id: "group/subgroup/project",
          tag_name: "v2.0.0",
        });
        expect(result.success).toBe(true);
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing project_id", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "delete",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing tag_name", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "delete",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("create_link action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create_link",
          project_id: "test-project",
          tag_name: "v1.0.0",
          name: "Binary Download",
          url: "https://example.com/download/binary",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create_link") {
          expect(result.data.name).toBe("Binary Download");
          expect(result.data.url).toBe("https://example.com/download/binary");
        }
      });

      it("should accept direct_asset_path", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create_link",
          project_id: "test-project",
          tag_name: "v1.0.0",
          name: "Linux Binary",
          url: "https://example.com/linux-amd64",
          direct_asset_path: "/binaries/linux-amd64",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create_link") {
          expect(result.data.direct_asset_path).toBe("/binaries/linux-amd64");
        }
      });

      it("should accept link_type", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create_link",
          project_id: "test-project",
          tag_name: "v1.0.0",
          name: "Docker Image",
          url: "https://registry.example.com/app:v1.0.0",
          link_type: "image",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create_link") {
          expect(result.data.link_type).toBe("image");
        }
      });

      it("should accept all link_type values", () => {
        for (const linkType of ["other", "runbook", "image", "package"]) {
          const result = ManageReleaseSchema.safeParse({
            action: "create_link",
            project_id: "test-project",
            tag_name: "v1.0.0",
            name: "Test Link",
            url: "https://example.com/test",
            link_type: linkType,
          });
          expect(result.success).toBe(true);
        }
      });

      it("should accept all options combined", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create_link",
          project_id: "group/project",
          tag_name: "v1.0.0",
          name: "Windows Installer",
          url: "https://example.com/installer.exe",
          direct_asset_path: "/installers/windows-x64.exe",
          link_type: "package",
        });
        expect(result.success).toBe(true);
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing name", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create_link",
          project_id: "test-project",
          tag_name: "v1.0.0",
          url: "https://example.com/download",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing url", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create_link",
          project_id: "test-project",
          tag_name: "v1.0.0",
          name: "Test Link",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid url", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create_link",
          project_id: "test-project",
          tag_name: "v1.0.0",
          name: "Test Link",
          url: "not-a-valid-url",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid link_type", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "create_link",
          project_id: "test-project",
          tag_name: "v1.0.0",
          name: "Test Link",
          url: "https://example.com/test",
          link_type: "invalid",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("delete_link action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "delete_link",
          project_id: "test-project",
          tag_name: "v1.0.0",
          link_id: "123",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "delete_link") {
          expect(result.data.link_id).toBe("123");
        }
      });

      it("should accept numeric link_id (coerced to string)", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "delete_link",
          project_id: "test-project",
          tag_name: "v1.0.0",
          link_id: 456,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "delete_link") {
          expect(result.data.link_id).toBe("456");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing link_id", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "delete_link",
          project_id: "test-project",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing project_id", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "delete_link",
          tag_name: "v1.0.0",
          link_id: "123",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing tag_name", () => {
        const result = ManageReleaseSchema.safeParse({
          action: "delete_link",
          project_id: "test-project",
          link_id: "123",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Discriminated Union behavior", () => {
    it("should correctly narrow types based on action", () => {
      const createResult = ManageReleaseSchema.safeParse({
        action: "create",
        project_id: "test",
        tag_name: "v1.0.0",
      });
      const updateResult = ManageReleaseSchema.safeParse({
        action: "update",
        project_id: "test",
        tag_name: "v1.0.0",
      });
      const deleteResult = ManageReleaseSchema.safeParse({
        action: "delete",
        project_id: "test",
        tag_name: "v1.0.0",
      });
      const createLinkResult = ManageReleaseSchema.safeParse({
        action: "create_link",
        project_id: "test",
        tag_name: "v1.0.0",
        name: "Link",
        url: "https://example.com",
      });
      const deleteLinkResult = ManageReleaseSchema.safeParse({
        action: "delete_link",
        project_id: "test",
        tag_name: "v1.0.0",
        link_id: "123",
      });

      expect(createResult.success).toBe(true);
      expect(updateResult.success).toBe(true);
      expect(deleteResult.success).toBe(true);
      expect(createLinkResult.success).toBe(true);
      expect(deleteLinkResult.success).toBe(true);

      if (createResult.success) expect(createResult.data.action).toBe("create");
      if (updateResult.success) expect(updateResult.data.action).toBe("update");
      if (deleteResult.success) expect(deleteResult.data.action).toBe("delete");
      if (createLinkResult.success) expect(createLinkResult.data.action).toBe("create_link");
      if (deleteLinkResult.success) expect(deleteLinkResult.data.action).toBe("delete_link");
    });

    it("should reject unknown action values", () => {
      const result = ManageReleaseSchema.safeParse({
        action: "unknown",
        project_id: "test",
        tag_name: "v1.0.0",
      });
      expect(result.success).toBe(false);
    });
  });
});
