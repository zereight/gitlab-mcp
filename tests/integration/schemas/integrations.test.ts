/**
 * Integrations Schema Integration Tests
 * Tests schemas using handler functions with real GitLab API
 */

import { ListIntegrationsSchema } from "../../../src/entities/integrations/schema-readonly";
import { ManageIntegrationSchema } from "../../../src/entities/integrations/schema";
import { IntegrationTestHelper } from "../helpers/registry-helper";

describe("Integrations Schema - GitLab Integration", () => {
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (!GITLAB_TOKEN) {
      throw new Error("GITLAB_TOKEN environment variable is required");
    }

    helper = new IntegrationTestHelper();
    await helper.initialize();
    console.log("Integration test helper initialized for integrations testing");
  });

  describe("ListIntegrationsSchema", () => {
    it("should validate and list integrations with real project data", async () => {
      console.log("Getting real project for integrations testing");

      // Get actual project from data lifecycle
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        path_with_namespace: string;
        name: string;
        id: number;
      }[];
      if (projects.length === 0) {
        console.log("No projects available for testing");
        return;
      }

      const testProject = projects[0];
      console.log(`Using project: ${testProject.name} (ID: ${testProject.id})`);

      const validParams = {
        project_id: testProject.id.toString(),
        per_page: 20,
      };

      // Validate schema
      const result = ListIntegrationsSchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        // Test actual handler function
        const integrations = (await helper.executeTool("list_integrations", result.data)) as {
          slug: string;
          title: string;
          active: boolean;
        }[];
        expect(Array.isArray(integrations)).toBe(true);
        console.log(`Retrieved ${integrations.length} active integrations via handler`);

        // Validate structure if we have integrations
        if (integrations.length > 0) {
          const integration = integrations[0];
          expect(integration).toHaveProperty("slug");
          expect(integration).toHaveProperty("title");
          expect(integration).toHaveProperty("active");
          console.log(
            `Validated integration structure: ${integration.title} (${integration.slug})`
          );
        }
      }

      console.log("ListIntegrationsSchema test completed with real data");
    });

    it("should validate pagination parameters", async () => {
      // Get actual project for validation
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        id: number;
      }[];
      if (projects.length === 0) {
        console.log("No projects available for pagination testing");
        return;
      }

      const testProject = projects[0];
      const paginationParams = {
        project_id: testProject.id.toString(),
        per_page: 10,
        page: 1,
      };

      const result = ListIntegrationsSchema.safeParse(paginationParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.per_page).toBe(10);
        expect(result.data.page).toBe(1);
      }

      console.log("ListIntegrationsSchema validates pagination parameters");
    });

    it("should reject invalid parameters", async () => {
      const invalidParams = {
        project_id: "123",
        per_page: 150, // Exceeds max of 100
      };

      const result = ListIntegrationsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }

      console.log("ListIntegrationsSchema correctly rejects invalid parameters");
    });
  });

  describe("ManageIntegrationSchema - get action", () => {
    it("should validate get integration parameters", async () => {
      const params = {
        action: "get" as const,
        project_id: "123",
        integration: "slack" as const,
      };

      const result = ManageIntegrationSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.action).toBe("get");
        expect(result.data.integration).toBe("slack");
      }

      console.log("ManageIntegrationSchema get action validates correctly");
    });

    it("should support all integration types", async () => {
      const integrationTypes = [
        "slack",
        "jira",
        "discord",
        "microsoft-teams",
        "jenkins",
        "emails-on-push",
      ];

      for (const integrationType of integrationTypes) {
        const params = {
          action: "get" as const,
          project_id: "123",
          integration: integrationType,
        };

        const result = ManageIntegrationSchema.safeParse(params);
        expect(result.success).toBe(true);
      }

      console.log("ManageIntegrationSchema supports multiple integration types");
    });
  });

  describe("ManageIntegrationSchema - update action", () => {
    it("should validate update integration parameters with event triggers", async () => {
      const params = {
        action: "update" as const,
        project_id: "123",
        integration: "slack" as const,
        active: true,
        push_events: true,
        issues_events: true,
        merge_requests_events: true,
        pipeline_events: false,
      };

      const result = ManageIntegrationSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "update") {
        expect(result.data.action).toBe("update");
        expect(result.data.active).toBe(true);
        expect(result.data.push_events).toBe(true);
        expect(result.data.issues_events).toBe(true);
        expect(result.data.merge_requests_events).toBe(true);
        expect(result.data.pipeline_events).toBe(false);
      }

      console.log("ManageIntegrationSchema update action validates event triggers");
    });

    it("should validate update with config object", async () => {
      const params = {
        action: "update" as const,
        project_id: "123",
        integration: "slack" as const,
        config: {
          webhook_url: "https://hooks.slack.com/services/xxx/yyy/zzz",
          username: "GitLab Bot",
          channel: "#general",
        },
      };

      const result = ManageIntegrationSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "update") {
        expect(result.data.config).toBeDefined();
        expect(result.data.config?.webhook_url).toBe(
          "https://hooks.slack.com/services/xxx/yyy/zzz"
        );
      }

      console.log("ManageIntegrationSchema update action validates config object");
    });

    it("should accept integration-specific fields via passthrough", async () => {
      const params = {
        action: "update" as const,
        project_id: "123",
        integration: "jira" as const,
        url: "https://jira.example.com",
        username: "jira-user",
        password: "secret",
        jira_issue_transition_id: "5",
      };

      const result = ManageIntegrationSchema.safeParse(params);
      expect(result.success).toBe(true);

      console.log("ManageIntegrationSchema accepts passthrough fields");
    });
  });

  describe("ManageIntegrationSchema - disable action", () => {
    it("should validate disable integration parameters", async () => {
      const params = {
        action: "disable" as const,
        project_id: "123",
        integration: "slack" as const,
      };

      const result = ManageIntegrationSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.action).toBe("disable");
        expect(result.data.integration).toBe("slack");
      }

      console.log("ManageIntegrationSchema disable action validates correctly");
    });
  });

  describe("ManageIntegrationSchema - event triggers", () => {
    it("should accept all common event trigger types", async () => {
      const params = {
        action: "update" as const,
        project_id: "123",
        integration: "discord" as const,
        push_events: true,
        issues_events: false,
        merge_requests_events: true,
        tag_push_events: false,
        note_events: true,
        confidential_issues_events: false,
        pipeline_events: true,
        wiki_page_events: false,
        job_events: true,
        deployment_events: false,
        releases_events: true,
        vulnerability_events: false,
      };

      const result = ManageIntegrationSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success && result.data.action === "update") {
        expect(result.data.push_events).toBe(true);
        expect(result.data.issues_events).toBe(false);
        expect(result.data.merge_requests_events).toBe(true);
        expect(result.data.pipeline_events).toBe(true);
        expect(result.data.wiki_page_events).toBe(false);
        expect(result.data.releases_events).toBe(true);
      }

      console.log("ManageIntegrationSchema accepts all event trigger types");
    });
  });

  describe("ManageIntegrationSchema - integration type validation", () => {
    it("should reject invalid integration type", async () => {
      const params = {
        action: "get" as const,
        project_id: "123",
        integration: "invalid-integration" as const,
      };

      const result = ManageIntegrationSchema.safeParse(params);
      expect(result.success).toBe(false);

      console.log("ManageIntegrationSchema rejects invalid integration type");
    });
  });

  /**
   * Integration Lifecycle Tests
   * Tests actual enable/update/disable operations against real GitLab instance
   * Using emails-on-push integration as recommended in issue #7
   */
  describe("Integration Lifecycle - emails-on-push", () => {
    let testProjectId: string;

    beforeAll(async () => {
      // Get a test project for lifecycle testing
      const projects = (await helper.listProjects({ per_page: 1 })) as {
        id: number;
        path_with_namespace: string;
      }[];

      if (projects.length === 0) {
        console.log("No projects available for lifecycle testing");
        return;
      }

      testProjectId = projects[0].id.toString();
      console.log(
        `Lifecycle test using project: ${projects[0].path_with_namespace} (ID: ${testProjectId})`
      );
    });

    it("should get integration settings (even when disabled)", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      try {
        // Get current state of emails-on-push integration
        const result = (await helper.executeTool("manage_integration", {
          action: "get",
          project_id: testProjectId,
          integration: "emails-on-push",
        })) as {
          id: number;
          slug: string;
          title: string;
          active: boolean;
        };

        expect(result).toBeDefined();
        expect(result.slug).toBe("emails-on-push");
        expect(result).toHaveProperty("title");
        expect(typeof result.active).toBe("boolean");

        console.log(`emails-on-push integration status: ${result.active ? "active" : "inactive"}`);
      } catch (error) {
        // Some GitLab instances may not have this integration available
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("404") || errorMsg.includes("Not Found")) {
          console.log("emails-on-push integration not available on this GitLab instance");
          return;
        }
        throw error;
      }
    });

    it("should enable/update emails-on-push integration", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      try {
        // Enable emails-on-push with test configuration
        const updateResult = (await helper.executeTool("manage_integration", {
          action: "update",
          project_id: testProjectId,
          integration: "emails-on-push",
          push_events: true,
          tag_push_events: false,
          // emails-on-push requires 'recipients' field
          recipients: "test@example.com",
        })) as {
          id: number;
          slug: string;
          active: boolean;
          push_events: boolean;
          tag_push_events: boolean;
        };

        expect(updateResult).toBeDefined();
        expect(updateResult.slug).toBe("emails-on-push");
        expect(updateResult.active).toBe(true);
        expect(updateResult.push_events).toBe(true);
        expect(updateResult.tag_push_events).toBe(false);

        console.log("emails-on-push integration enabled successfully");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("404") || errorMsg.includes("Not Found")) {
          console.log("emails-on-push integration not available on this GitLab instance");
          return;
        }
        throw error;
      }
    });

    it("should update integration settings", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      try {
        // Update with modified settings
        const updateResult = (await helper.executeTool("manage_integration", {
          action: "update",
          project_id: testProjectId,
          integration: "emails-on-push",
          push_events: true,
          tag_push_events: true, // Changed from false
          branches_to_be_notified: "all",
          recipients: "test@example.com, updated@example.com",
        })) as {
          id: number;
          slug: string;
          active: boolean;
          tag_push_events: boolean;
        };

        expect(updateResult).toBeDefined();
        expect(updateResult.active).toBe(true);
        expect(updateResult.tag_push_events).toBe(true);

        console.log("emails-on-push integration settings updated successfully");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("404") || errorMsg.includes("Not Found")) {
          console.log("emails-on-push integration not available on this GitLab instance");
          return;
        }
        throw error;
      }
    });

    it("should disable emails-on-push integration", async () => {
      if (!testProjectId) {
        console.log("Skipping: no test project available");
        return;
      }

      try {
        // Disable the integration
        const disableResult = (await helper.executeTool("manage_integration", {
          action: "disable",
          project_id: testProjectId,
          integration: "emails-on-push",
        })) as {
          deleted: boolean;
        };

        expect(disableResult).toBeDefined();
        expect(disableResult.deleted).toBe(true);

        console.log("emails-on-push integration disabled successfully");

        // Verify it's disabled
        const verifyResult = (await helper.executeTool("manage_integration", {
          action: "get",
          project_id: testProjectId,
          integration: "emails-on-push",
        })) as {
          active: boolean;
        };

        expect(verifyResult.active).toBe(false);
        console.log("Verified: emails-on-push integration is now inactive");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("404") || errorMsg.includes("Not Found")) {
          console.log("emails-on-push integration not available on this GitLab instance");
          return;
        }
        throw error;
      }
    });
  });
});
