/**
 * ManageIntegrationSchema Unit Tests
 * Tests schema validation for manage_integration CQRS Command tool
 */

import {
  ManageIntegrationSchema,
  IntegrationTypeSchema,
} from "../../../../src/entities/integrations/schema";

describe("IntegrationTypeSchema", () => {
  describe("Valid integration types", () => {
    const validTypes = [
      // Communication
      "slack",
      "gitlab-slack-application",
      "slack-slash-commands",
      "discord",
      "microsoft-teams",
      "mattermost",
      "telegram",
      "matrix",
      // Issue Trackers
      "jira",
      "jira-cloud-app",
      "bugzilla",
      "redmine",
      "youtrack",
      "clickup",
      "linear",
      // CI/CD
      "jenkins",
      "teamcity",
      "bamboo",
      "buildkite",
      "drone-ci",
      "datadog",
      // Documentation
      "confluence",
      "external-wiki",
      // Mobile/Publishing
      "apple-app-store",
      "google-play",
      "packagist",
      // Cloud
      "google-cloud-platform-artifact-registry",
      "harbor",
      // Security
      "git-guardian",
      // Other
      "github",
      "emails-on-push",
      "pipelines-email",
    ];

    it.each(validTypes)("should accept '%s' integration type", type => {
      const result = IntegrationTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    });
  });

  describe("Invalid integration types", () => {
    it("should reject unknown integration type", () => {
      const result = IntegrationTypeSchema.safeParse("unknown-integration");
      expect(result.success).toBe(false);
    });

    it("should reject empty string", () => {
      const result = IntegrationTypeSchema.safeParse("");
      expect(result.success).toBe(false);
    });

    it("should reject non-string values", () => {
      const result = IntegrationTypeSchema.safeParse(123);
      expect(result.success).toBe(false);
    });
  });
});

describe("ManageIntegrationSchema", () => {
  describe("action field validation", () => {
    it("should accept 'get' action", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "get",
        project_id: "test/project",
        integration: "slack",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("get");
      }
    });

    it("should accept 'update' action", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        active: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("update");
      }
    });

    it("should accept 'disable' action", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "disable",
        project_id: "test/project",
        integration: "slack",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("disable");
      }
    });

    it("should reject invalid action", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "create",
        project_id: "test/project",
        integration: "slack",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing action", () => {
      const result = ManageIntegrationSchema.safeParse({
        project_id: "test/project",
        integration: "slack",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("get action validation", () => {
    it("should accept minimal get request", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "get",
        project_id: "my-group/my-project",
        integration: "jira",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("get");
        expect(result.data.project_id).toBe("my-group/my-project");
        expect(result.data.integration).toBe("jira");
      }
    });

    it("should accept get with numeric project_id", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "get",
        project_id: "12345",
        integration: "discord",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("update action validation", () => {
    it("should accept update with active flag", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        active: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.active).toBe(true);
      }
    });

    it("should accept update with event triggers", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "discord",
        push_events: true,
        issues_events: true,
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
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.push_events).toBe(true);
        expect(result.data.issues_events).toBe(true);
        expect(result.data.merge_requests_events).toBe(true);
        expect(result.data.tag_push_events).toBe(false);
        expect(result.data.note_events).toBe(true);
        expect(result.data.confidential_issues_events).toBe(false);
        expect(result.data.pipeline_events).toBe(true);
        expect(result.data.wiki_page_events).toBe(false);
        expect(result.data.job_events).toBe(true);
        expect(result.data.deployment_events).toBe(false);
        expect(result.data.releases_events).toBe(true);
        expect(result.data.vulnerability_events).toBe(false);
      }
    });

    it("should accept update with config object", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        config: {
          webhook: "https://hooks.slack.com/services/xxx/yyy/zzz",
          username: "GitLab Bot",
          channel: "#gitlab-notifications",
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config).toBeDefined();
        expect(result.data.config?.webhook).toBe("https://hooks.slack.com/services/xxx/yyy/zzz");
        expect(result.data.config?.username).toBe("GitLab Bot");
        expect(result.data.config?.channel).toBe("#gitlab-notifications");
      }
    });

    it("should accept update with passthrough fields (integration-specific)", () => {
      // Schema uses .passthrough() to allow integration-specific fields
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "jira",
        url: "https://jira.example.com",
        username: "jira-user",
        password: "secret",
        jira_issue_transition_id: "5",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // Passthrough fields should be preserved
        expect((result.data as Record<string, unknown>).url).toBe("https://jira.example.com");
        expect((result.data as Record<string, unknown>).username).toBe("jira-user");
      }
    });
  });

  describe("disable action validation", () => {
    it("should accept minimal disable request", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "disable",
        project_id: "test/project",
        integration: "jenkins",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("disable");
        expect(result.data.integration).toBe("jenkins");
      }
    });
  });

  describe("boolean field coercion (flexibleBoolean)", () => {
    it("should accept boolean true for active", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        active: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.active).toBe(true);
      }
    });

    it("should accept boolean false for push_events", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        push_events: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.push_events).toBe(false);
      }
    });

    it("should coerce string 'true' to boolean true", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        active: "true",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.active).toBe(true);
      }
    });

    it("should coerce string 'false' to boolean false", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        active: "false",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.active).toBe(false);
      }
    });

    it("should coerce string 't' to boolean true", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        push_events: "t",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.push_events).toBe(true);
      }
    });

    it("should coerce string '1' to boolean true", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        issues_events: "1",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issues_events).toBe(true);
      }
    });

    it("should coerce number 1 to boolean true", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        merge_requests_events: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.merge_requests_events).toBe(true);
      }
    });

    it("should coerce number 0 to boolean false", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        pipeline_events: 0,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pipeline_events).toBe(false);
      }
    });
  });

  describe("required fields validation", () => {
    it("should reject missing project_id", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "get",
        integration: "slack",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing integration", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "get",
        project_id: "test/project",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid integration type", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "get",
        project_id: "test/project",
        integration: "invalid-integration-type",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle all communication integrations", () => {
      const communicationIntegrations = [
        "slack",
        "gitlab-slack-application",
        "discord",
        "microsoft-teams",
        "mattermost",
        "telegram",
        "matrix",
      ];

      for (const integration of communicationIntegrations) {
        const result = ManageIntegrationSchema.safeParse({
          action: "get",
          project_id: "test/project",
          integration,
        });
        expect(result.success).toBe(true);
      }
    });

    it("should handle all CI/CD integrations", () => {
      const cicdIntegrations = [
        "jenkins",
        "teamcity",
        "bamboo",
        "buildkite",
        "drone-ci",
        "datadog",
      ];

      for (const integration of cicdIntegrations) {
        const result = ManageIntegrationSchema.safeParse({
          action: "get",
          project_id: "test/project",
          integration,
        });
        expect(result.success).toBe(true);
      }
    });

    it("should handle all issue tracker integrations", () => {
      const issueTrackerIntegrations = [
        "jira",
        "jira-cloud-app",
        "bugzilla",
        "redmine",
        "youtrack",
        "clickup",
        "linear",
      ];

      for (const integration of issueTrackerIntegrations) {
        const result = ManageIntegrationSchema.safeParse({
          action: "get",
          project_id: "test/project",
          integration,
        });
        expect(result.success).toBe(true);
      }
    });

    it("should handle config with various value types", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        config: {
          string_value: "text",
          number_value: 123,
          boolean_value: true,
          array_value: ["a", "b"],
          nested_object: { key: "value" },
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config).toBeDefined();
      }
    });

    it("should handle empty config object", () => {
      const result = ManageIntegrationSchema.safeParse({
        action: "update",
        project_id: "test/project",
        integration: "slack",
        config: {},
      });
      expect(result.success).toBe(true);
    });
  });
});
