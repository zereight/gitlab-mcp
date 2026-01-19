/**
 * Webhooks Schema Integration Tests
 * Tests schemas using handler functions with real GitLab API
 */

import { ListWebhooksSchema } from "../../../src/entities/webhooks/schema-readonly";
import { ManageWebhookSchema } from "../../../src/entities/webhooks/schema";
import { IntegrationTestHelper } from "../helpers/registry-helper";

describe("Webhooks Schema - GitLab Integration", () => {
  let helper: IntegrationTestHelper;
  let testProjectId: string;
  let createdWebhookId: number | null = null;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error("GITLAB_TOKEN environment variable is required");
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("Integration test helper initialized for webhooks testing");

    // Get a test project from the "test" group for webhook operations
    const projects = (await helper.listProjects({ per_page: 5 })) as {
      path_with_namespace: string;
      name: string;
      id: number;
    }[];

    // Find a project in the "test" group (required by testing restrictions)
    const testProject = projects.find(p => p.path_with_namespace.startsWith("test/"));
    if (!testProject) {
      console.log("No projects in 'test' group available for webhooks testing");
      return;
    }

    testProjectId = testProject.path_with_namespace;
    console.log(`Using test project: ${testProject.name} (${testProjectId})`);
  });

  afterAll(async () => {
    // Cleanup: delete any webhook created during tests
    if (createdWebhookId && testProjectId) {
      try {
        await helper.executeTool("manage_webhook", {
          action: "delete",
          scope: "project",
          projectId: testProjectId,
          hookId: createdWebhookId,
        });
        console.log(`Cleaned up test webhook ${createdWebhookId}`);
      } catch (error) {
        console.log(`Failed to cleanup webhook: ${error}`);
      }
    }
  });

  describe("ListWebhooksSchema - project scope", () => {
    it("should validate list webhooks parameters", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      const validParams = {
        scope: "project" as const,
        projectId: testProjectId,
        per_page: 10,
      };

      // Validate schema
      const result = ListWebhooksSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const webhooks = (await helper.executeTool("list_webhooks", result.data)) as {
          id: number;
          url: string;
        }[];
        expect(Array.isArray(webhooks)).toBe(true);
        console.log(`Retrieved ${webhooks.length} webhooks via handler`);

        // Validate structure if we have webhooks
        if (webhooks.length > 0) {
          const webhook = webhooks[0];
          expect(webhook).toHaveProperty("id");
          expect(webhook).toHaveProperty("url");
          console.log(`Validated webhook structure: ID ${webhook.id}`);
        }
      }

      console.log("ListWebhooksSchema project scope test completed");
    });

    it("should reject missing projectId for project scope", () => {
      const invalidParams = {
        scope: "project" as const,
        // Missing projectId
      };

      const result = ListWebhooksSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ListWebhooksSchema correctly rejects missing projectId");
    });
  });

  describe("ManageWebhookSchema - create action", () => {
    it("should validate create webhook parameters", () => {
      const params = {
        action: "create" as const,
        scope: "project" as const,
        projectId: "test/project",
        url: "https://example.com/webhook",
        push_events: true,
        merge_requests_events: true,
        enable_ssl_verification: true,
      };

      const result = ManageWebhookSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "create") {
        expect(result.data.action).toBe("create");
        expect(result.data.url).toBe("https://example.com/webhook");
        expect(result.data.push_events).toBe(true);
      }

      console.log("ManageWebhookSchema create action validates correctly");
    });

    it("should require url for create action", () => {
      const invalidParams = {
        action: "create" as const,
        scope: "project" as const,
        projectId: "test/project",
        // Missing url
        push_events: true,
      };

      const result = ManageWebhookSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageWebhookSchema correctly requires url for create action");
    });

    it("should create and read a webhook via handler", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      // Create a webhook
      const createParams = {
        action: "create" as const,
        scope: "project" as const,
        projectId: testProjectId,
        url: "https://example.com/test-webhook-integration",
        push_events: true,
        enable_ssl_verification: false, // Disable for test URL
      };

      const createResult = ManageWebhookSchema.safeParse(createParams);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const webhook = (await helper.executeTool("manage_webhook", createResult.data)) as {
          id: number;
          url: string;
          push_events: boolean;
        };

        expect(webhook).toHaveProperty("id");
        expect(webhook.url).toBe("https://example.com/test-webhook-integration");
        expect(webhook.push_events).toBe(true);

        createdWebhookId = webhook.id;
        console.log(`Created test webhook with ID: ${webhook.id}`);

        // Read the webhook back
        const readParams = {
          action: "read" as const,
          scope: "project" as const,
          projectId: testProjectId,
          hookId: webhook.id,
        };

        const readResult = ManageWebhookSchema.safeParse(readParams);
        expect(readResult.success).toBe(true);

        if (readResult.success) {
          const readWebhook = (await helper.executeTool("manage_webhook", readResult.data)) as {
            id: number;
            url: string;
          };
          expect(readWebhook.id).toBe(webhook.id);
          expect(readWebhook.url).toBe(webhook.url);
          console.log(`Read webhook ${readWebhook.id} successfully`);
        }
      }
    });
  });

  describe("ManageWebhookSchema - update action", () => {
    it("should validate update webhook parameters", () => {
      const params = {
        action: "update" as const,
        scope: "project" as const,
        projectId: "test/project",
        hookId: 123,
        url: "https://example.com/updated-webhook",
        push_events: false,
        merge_requests_events: true,
      };

      const result = ManageWebhookSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "update") {
        expect(result.data.action).toBe("update");
        // hookId is coerced to string by requiredId
        expect(result.data.hookId).toBe("123");
      }

      console.log("ManageWebhookSchema update action validates correctly");
    });

    it("should require hookId for update action", () => {
      const invalidParams = {
        action: "update" as const,
        scope: "project" as const,
        projectId: "test/project",
        // Missing hookId
        url: "https://example.com/webhook",
      };

      const result = ManageWebhookSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageWebhookSchema correctly requires hookId for update action");
    });

    it("should update a webhook via handler", async () => {
      if (!testProjectId || !createdWebhookId) {
        console.log("Skipping: no test webhook available");
        return;
      }

      const updateParams = {
        action: "update" as const,
        scope: "project" as const,
        projectId: testProjectId,
        hookId: createdWebhookId,
        merge_requests_events: true,
        issues_events: true,
      };

      const updateResult = ManageWebhookSchema.safeParse(updateParams);
      expect(updateResult.success).toBe(true);

      if (updateResult.success) {
        const webhook = (await helper.executeTool("manage_webhook", updateResult.data)) as {
          id: number;
          merge_requests_events: boolean;
          issues_events: boolean;
        };

        expect(webhook.id).toBe(createdWebhookId);
        expect(webhook.merge_requests_events).toBe(true);
        expect(webhook.issues_events).toBe(true);
        console.log(`Updated webhook ${webhook.id} successfully`);
      }
    });
  });

  describe("ManageWebhookSchema - test action", () => {
    it("should validate test webhook parameters", () => {
      const params = {
        action: "test" as const,
        scope: "project" as const,
        projectId: "test/project",
        hookId: 123,
        trigger: "push_events" as const,
      };

      const result = ManageWebhookSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "test") {
        expect(result.data.action).toBe("test");
        expect(result.data.trigger).toBe("push_events");
      }

      console.log("ManageWebhookSchema test action validates correctly");
    });

    it("should require trigger for test action", () => {
      const invalidParams = {
        action: "test" as const,
        scope: "project" as const,
        projectId: "test/project",
        hookId: 123,
        // Missing trigger
      };

      const result = ManageWebhookSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageWebhookSchema correctly requires trigger for test action");
    });

    it("should validate all trigger types", () => {
      const triggers = [
        "push_events",
        "tag_push_events",
        "merge_requests_events",
        "issues_events",
        "confidential_issues_events",
        "note_events",
        "job_events",
        "pipeline_events",
        "wiki_page_events",
        "releases_events",
        "milestone_events",
        "emoji_events",
        "resource_access_token_events",
      ] as const;

      for (const trigger of triggers) {
        const params = {
          action: "test" as const,
          scope: "project" as const,
          projectId: "test/project",
          hookId: 123,
          trigger,
        };

        const result = ManageWebhookSchema.safeParse(params);
        expect(result.success).toBe(true);
      }

      console.log(`Validated all ${triggers.length} trigger types`);
    });
  });

  describe("ManageWebhookSchema - delete action", () => {
    it("should validate delete webhook parameters", () => {
      const params = {
        action: "delete" as const,
        scope: "project" as const,
        projectId: "test/project",
        hookId: 123,
      };

      const result = ManageWebhookSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "delete") {
        expect(result.data.action).toBe("delete");
        // hookId is coerced to string by requiredId
        expect(result.data.hookId).toBe("123");
      }

      console.log("ManageWebhookSchema delete action validates correctly");
    });

    it("should require hookId for delete action", () => {
      const invalidParams = {
        action: "delete" as const,
        scope: "project" as const,
        projectId: "test/project",
        // Missing hookId
      };

      const result = ManageWebhookSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      console.log("ManageWebhookSchema correctly requires hookId for delete action");
    });

    it("should delete a webhook via handler", async () => {
      if (!testProjectId || !createdWebhookId) {
        console.log("Skipping: no test webhook available");
        return;
      }

      const deleteParams = {
        action: "delete" as const,
        scope: "project" as const,
        projectId: testProjectId,
        hookId: createdWebhookId,
      };

      const deleteResult = ManageWebhookSchema.safeParse(deleteParams);
      expect(deleteResult.success).toBe(true);

      if (deleteResult.success) {
        const result = (await helper.executeTool("manage_webhook", deleteResult.data)) as {
          success: boolean;
        };

        expect(result.success).toBe(true);
        console.log(`Deleted webhook ${createdWebhookId} successfully`);

        // Mark as deleted so afterAll doesn't try to delete again
        createdWebhookId = null;
      }
    });
  });

  describe("ManageWebhookSchema - group webhook parameters", () => {
    it("should validate group-specific parameters", () => {
      const params = {
        action: "create" as const,
        scope: "group" as const,
        groupId: "test-group",
        url: "https://example.com/group-webhook",
        push_events: true,
        subgroup_events: true, // Group-only parameter
        project_events: true, // Group-only parameter
      };

      const result = ManageWebhookSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "create") {
        expect(result.data.subgroup_events).toBe(true);
        expect(result.data.project_events).toBe(true);
      }

      console.log("ManageWebhookSchema validates group-specific parameters");
    });
  });

  describe("ManageWebhookSchema - all event types", () => {
    it("should validate all event type parameters", () => {
      const params = {
        action: "create" as const,
        scope: "project" as const,
        projectId: "test/project",
        url: "https://example.com/all-events-webhook",
        push_events: true,
        push_events_branch_filter: "main",
        tag_push_events: true,
        merge_requests_events: true,
        issues_events: true,
        confidential_issues_events: true,
        note_events: true,
        confidential_note_events: true,
        job_events: true,
        pipeline_events: true,
        wiki_page_events: true,
        deployment_events: true,
        feature_flag_events: true,
        releases_events: true,
        emoji_events: true,
        resource_access_token_events: true,
        member_events: true,
        enable_ssl_verification: true,
      };

      const result = ManageWebhookSchema.safeParse(params);
      expect(result.success).toBe(true);

      console.log("ManageWebhookSchema validates all event type parameters");
    });
  });
});
