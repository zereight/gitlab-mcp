import { z } from "zod";
import { ListWebhooksSchema } from "../../../../src/entities/webhooks/schema-readonly";

describe("ListWebhooksSchema", () => {
  describe("discriminator field", () => {
    it("should use 'action' as discriminator field", () => {
      // Convert to JSON schema and verify action property exists
      const jsonSchema = z.toJSONSchema(ListWebhooksSchema);

      // The discriminated union generates oneOf with action property
      expect(jsonSchema.oneOf).toBeDefined();
      expect(jsonSchema.oneOf!.length).toBe(2);

      // Each branch should have action property with const value
      const actions = jsonSchema.oneOf!.map(
        (branch: any) => branch.properties?.action?.const
      );
      expect(actions).toContain("project");
      expect(actions).toContain("group");
    });

    it("should accept action='project' with projectId", () => {
      const result = ListWebhooksSchema.safeParse({
        action: "project",
        projectId: "test-project",
      });
      expect(result.success).toBe(true);
    });

    it("should accept action='group' with groupId", () => {
      const result = ListWebhooksSchema.safeParse({
        action: "group",
        groupId: "test-group",
      });
      expect(result.success).toBe(true);
    });

    it("should reject old scope field", () => {
      const result = ListWebhooksSchema.safeParse({
        scope: "project",
        projectId: "test-project",
      });
      expect(result.success).toBe(false);
    });
  });
});
