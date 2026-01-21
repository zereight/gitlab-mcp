import { ManageRefSchema } from "../../../../src/entities/refs/schema";

describe("ManageRefSchema - Discriminated Union", () => {
  describe("create_branch action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageRefSchema.safeParse({
          action: "create_branch",
          project_id: "my-group/my-project",
          branch: "feature/new-feature",
          ref: "main",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create_branch") {
          expect(result.data.branch).toBe("feature/new-feature");
          expect(result.data.ref).toBe("main");
        }
      });

      it("should accept commit SHA as ref", () => {
        const result = ManageRefSchema.safeParse({
          action: "create_branch",
          project_id: "123",
          branch: "hotfix/bug-123",
          ref: "abc123def456",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create_branch") {
          expect(result.data.ref).toBe("abc123def456");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing branch", () => {
        const result = ManageRefSchema.safeParse({
          action: "create_branch",
          project_id: "test-project",
          ref: "main",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing ref", () => {
        const result = ManageRefSchema.safeParse({
          action: "create_branch",
          project_id: "test-project",
          branch: "feature/test",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("delete_branch action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageRefSchema.safeParse({
          action: "delete_branch",
          project_id: "my-group/my-project",
          branch: "feature/old-feature",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "delete_branch") {
          expect(result.data.branch).toBe("feature/old-feature");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing branch", () => {
        const result = ManageRefSchema.safeParse({
          action: "delete_branch",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("protect_branch action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageRefSchema.safeParse({
          action: "protect_branch",
          project_id: "my-group/my-project",
          name: "main",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "protect_branch") {
          expect(result.data.name).toBe("main");
        }
      });

      it("should accept access level options", () => {
        const result = ManageRefSchema.safeParse({
          action: "protect_branch",
          project_id: "test-project",
          name: "release-*",
          push_access_level: 40,
          merge_access_level: 30,
          unprotect_access_level: 40,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "protect_branch") {
          expect(result.data.push_access_level).toBe(40);
          expect(result.data.merge_access_level).toBe(30);
          expect(result.data.unprotect_access_level).toBe(40);
        }
      });

      it("should accept allow_force_push option", () => {
        const result = ManageRefSchema.safeParse({
          action: "protect_branch",
          project_id: "test-project",
          name: "main",
          allow_force_push: false,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "protect_branch") {
          expect(result.data.allow_force_push).toBe(false);
        }
      });

      it("should accept granular access (Premium feature)", () => {
        const result = ManageRefSchema.safeParse({
          action: "protect_branch",
          project_id: "test-project",
          name: "main",
          allowed_to_push: [{ user_id: 1 }, { group_id: 2 }, { access_level: 40 }],
          allowed_to_merge: [{ access_level: 30 }],
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "protect_branch") {
          expect(result.data.allowed_to_push).toHaveLength(3);
          expect(result.data.allowed_to_merge).toHaveLength(1);
        }
      });

      it("should accept code_owner_approval_required option", () => {
        const result = ManageRefSchema.safeParse({
          action: "protect_branch",
          project_id: "test-project",
          name: "main",
          code_owner_approval_required: true,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "protect_branch") {
          expect(result.data.code_owner_approval_required).toBe(true);
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing name", () => {
        const result = ManageRefSchema.safeParse({
          action: "protect_branch",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("unprotect_branch action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageRefSchema.safeParse({
          action: "unprotect_branch",
          project_id: "my-group/my-project",
          name: "old-protected",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "unprotect_branch") {
          expect(result.data.name).toBe("old-protected");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing name", () => {
        const result = ManageRefSchema.safeParse({
          action: "unprotect_branch",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("update_branch_protection action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageRefSchema.safeParse({
          action: "update_branch_protection",
          project_id: "my-group/my-project",
          name: "main",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "update_branch_protection") {
          expect(result.data.name).toBe("main");
        }
      });

      it("should accept allow_force_push update", () => {
        const result = ManageRefSchema.safeParse({
          action: "update_branch_protection",
          project_id: "test-project",
          name: "main",
          allow_force_push: true,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "update_branch_protection") {
          expect(result.data.allow_force_push).toBe(true);
        }
      });

      it("should accept granular access updates", () => {
        const result = ManageRefSchema.safeParse({
          action: "update_branch_protection",
          project_id: "test-project",
          name: "main",
          allowed_to_push: [{ access_level: 40 }],
          allowed_to_merge: [{ user_id: 1 }],
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "update_branch_protection") {
          expect(result.data.allowed_to_push).toHaveLength(1);
          expect(result.data.allowed_to_merge).toHaveLength(1);
        }
      });
    });
  });

  describe("create_tag action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageRefSchema.safeParse({
          action: "create_tag",
          project_id: "my-group/my-project",
          tag_name: "v1.0.0",
          ref: "main",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create_tag") {
          expect(result.data.tag_name).toBe("v1.0.0");
          expect(result.data.ref).toBe("main");
        }
      });

      it("should accept message for annotated tag", () => {
        const result = ManageRefSchema.safeParse({
          action: "create_tag",
          project_id: "test-project",
          tag_name: "v2.0.0",
          ref: "release-2.0",
          message: "Release version 2.0.0",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create_tag") {
          expect(result.data.message).toBe("Release version 2.0.0");
        }
      });

      it("should accept commit SHA as ref", () => {
        const result = ManageRefSchema.safeParse({
          action: "create_tag",
          project_id: "test-project",
          tag_name: "v1.0.1",
          ref: "abc123def456",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "create_tag") {
          expect(result.data.ref).toBe("abc123def456");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing tag_name", () => {
        const result = ManageRefSchema.safeParse({
          action: "create_tag",
          project_id: "test-project",
          ref: "main",
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing ref", () => {
        const result = ManageRefSchema.safeParse({
          action: "create_tag",
          project_id: "test-project",
          tag_name: "v1.0.0",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("delete_tag action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageRefSchema.safeParse({
          action: "delete_tag",
          project_id: "my-group/my-project",
          tag_name: "v0.9.0",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "delete_tag") {
          expect(result.data.tag_name).toBe("v0.9.0");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing tag_name", () => {
        const result = ManageRefSchema.safeParse({
          action: "delete_tag",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("protect_tag action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageRefSchema.safeParse({
          action: "protect_tag",
          project_id: "my-group/my-project",
          name: "v*",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "protect_tag") {
          expect(result.data.name).toBe("v*");
        }
      });

      it("should accept create_access_level", () => {
        const result = ManageRefSchema.safeParse({
          action: "protect_tag",
          project_id: "test-project",
          name: "release-*",
          create_access_level: 40,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "protect_tag") {
          expect(result.data.create_access_level).toBe(40);
        }
      });

      it("should accept allowed_to_create (Premium)", () => {
        const result = ManageRefSchema.safeParse({
          action: "protect_tag",
          project_id: "test-project",
          name: "v*",
          allowed_to_create: [{ user_id: 1 }, { group_id: 2 }],
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "protect_tag") {
          expect(result.data.allowed_to_create).toHaveLength(2);
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing name", () => {
        const result = ManageRefSchema.safeParse({
          action: "protect_tag",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("unprotect_tag action", () => {
    describe("Valid inputs", () => {
      it("should accept minimal valid input", () => {
        const result = ManageRefSchema.safeParse({
          action: "unprotect_tag",
          project_id: "my-group/my-project",
          name: "old-*",
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.action === "unprotect_tag") {
          expect(result.data.name).toBe("old-*");
        }
      });
    });

    describe("Invalid inputs", () => {
      it("should reject missing name", () => {
        const result = ManageRefSchema.safeParse({
          action: "unprotect_tag",
          project_id: "test-project",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Discriminated Union behavior", () => {
    it("should correctly narrow types based on action", () => {
      const createBranchResult = ManageRefSchema.safeParse({
        action: "create_branch",
        project_id: "test",
        branch: "feature/test",
        ref: "main",
      });
      const deleteBranchResult = ManageRefSchema.safeParse({
        action: "delete_branch",
        project_id: "test",
        branch: "feature/old",
      });
      const createTagResult = ManageRefSchema.safeParse({
        action: "create_tag",
        project_id: "test",
        tag_name: "v1.0.0",
        ref: "main",
      });
      const deleteTagResult = ManageRefSchema.safeParse({
        action: "delete_tag",
        project_id: "test",
        tag_name: "v0.9.0",
      });

      expect(createBranchResult.success).toBe(true);
      expect(deleteBranchResult.success).toBe(true);
      expect(createTagResult.success).toBe(true);
      expect(deleteTagResult.success).toBe(true);

      if (createBranchResult.success) {
        expect(createBranchResult.data.action).toBe("create_branch");
      }
      if (deleteBranchResult.success) {
        expect(deleteBranchResult.data.action).toBe("delete_branch");
      }
      if (createTagResult.success) {
        expect(createTagResult.data.action).toBe("create_tag");
      }
      if (deleteTagResult.success) {
        expect(deleteTagResult.data.action).toBe("delete_tag");
      }
    });

    it("should reject unknown action values", () => {
      const result = ManageRefSchema.safeParse({
        action: "unknown",
        project_id: "test",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing action", () => {
      const result = ManageRefSchema.safeParse({
        project_id: "test",
        branch: "main",
      });
      expect(result.success).toBe(false);
    });
  });
});
