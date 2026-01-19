/**
 * ListIntegrationsSchema Unit Tests
 * Tests schema validation for list_integrations CQRS Query tool
 */

import { ListIntegrationsSchema } from "../../../../src/entities/integrations/schema-readonly";

describe("ListIntegrationsSchema", () => {
  describe("Valid inputs", () => {
    it("should accept minimal valid input (project_id only)", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "my-group/my-project",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.project_id).toBe("my-group/my-project");
      }
    });

    it("should accept numeric project_id", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "12345",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.project_id).toBe("12345");
      }
    });

    it("should accept pagination parameters", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "test/project",
        per_page: 50,
        page: 2,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(50);
        expect(result.data.page).toBe(2);
      }
    });

    it("should accept per_page at minimum value (1)", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "test/project",
        per_page: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(1);
      }
    });

    it("should accept per_page at maximum value (100)", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "test/project",
        per_page: 100,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(100);
      }
    });

    it("should accept URL-encoded project path", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "my-group%2Fmy-project",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("Invalid inputs", () => {
    it("should reject missing project_id", () => {
      const result = ListIntegrationsSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const projectIdError = result.error.issues.find(i => i.path.includes("project_id"));
        expect(projectIdError).toBeDefined();
      }
    });

    it("should reject per_page exceeding 100", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "test/project",
        per_page: 150,
      });
      expect(result.success).toBe(false);
    });

    it("should reject per_page less than 1", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "test/project",
        per_page: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject negative per_page", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "test/project",
        per_page: -10,
      });
      expect(result.success).toBe(false);
    });

    it("should reject page less than 1", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "test/project",
        page: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer per_page", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "test/project",
        per_page: 10.5,
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer page", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "test/project",
        page: 1.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle project path with special characters", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "my-group/my-project_v2.0",
      });
      expect(result.success).toBe(true);
    });

    it("should handle deeply nested project path", () => {
      const result = ListIntegrationsSchema.safeParse({
        project_id: "org/team/subteam/project",
      });
      expect(result.success).toBe(true);
    });
  });
});
