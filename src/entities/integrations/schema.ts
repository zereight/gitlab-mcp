import { z } from "zod";
import { flexibleBoolean } from "../utils";

// ============================================================================
// Integration Types (50+ supported integrations in GitLab 18.8)
// ============================================================================

export const IntegrationTypeSchema = z.enum([
  // Communication
  "slack",
  "gitlab-slack-application",
  "slack-slash-commands",
  "discord",
  "microsoft-teams",
  "mattermost",
  "mattermost-slash-commands",
  "telegram",
  "matrix",
  "pumble",
  "hangouts-chat",
  "webex-teams",
  "unify-circuit",
  "campfire",
  "irker",
  // Issue Trackers
  "jira",
  "jira-cloud-app",
  "bugzilla",
  "redmine",
  "youtrack",
  "clickup",
  "linear",
  "phorge",
  "pivotaltracker",
  "asana",
  "custom-issue-tracker",
  "ewm",
  // CI/CD
  "jenkins",
  "teamcity",
  "bamboo",
  "buildkite",
  "drone-ci",
  "datadog",
  "mock-ci",
  "diffblue-cover",
  // Documentation
  "confluence",
  "external-wiki",
  // Mobile/Publishing
  "apple-app-store",
  "google-play",
  "packagist",
  // Cloud
  "google-cloud-platform-artifact-registry",
  "google-cloud-platform-workload-identity-federation",
  "harbor",
  // Security
  "git-guardian",
  // Other
  "github",
  "assembla",
  "emails-on-push",
  "pipelines-email",
  "pushover",
  "squash-tm",
]);

// ============================================================================
// manage_integration - CQRS Command Tool with generic config support
// Actions: get, update, disable
// ============================================================================

export const ManageIntegrationSchema = z
  .object({
    action: z.enum(["get", "update", "disable"]).describe("Action to perform"),
    project_id: z.string().describe("Project ID or URL-encoded path"),
    integration: IntegrationTypeSchema.describe(
      "Integration type slug (e.g., slack, jira, discord). Note: gitlab-slack-application cannot be created via API - it requires OAuth installation from GitLab UI."
    ),

    // Common integration activation control
    active: flexibleBoolean
      .optional()
      .describe("For 'update': Enable or disable the integration without full configuration"),

    // Common event trigger parameters (optional for update action)
    push_events: flexibleBoolean.optional().describe("Trigger integration on push events"),
    issues_events: flexibleBoolean.optional().describe("Trigger integration on issue events"),
    merge_requests_events: flexibleBoolean
      .optional()
      .describe("Trigger integration on merge request events"),
    tag_push_events: flexibleBoolean.optional().describe("Trigger integration on tag push events"),
    note_events: flexibleBoolean.optional().describe("Trigger integration on note events"),
    confidential_issues_events: flexibleBoolean
      .optional()
      .describe("Trigger integration on confidential issue events"),
    pipeline_events: flexibleBoolean.optional().describe("Trigger integration on pipeline events"),
    wiki_page_events: flexibleBoolean
      .optional()
      .describe("Trigger integration on wiki page events"),
    job_events: flexibleBoolean.optional().describe("Trigger integration on job events"),
    deployment_events: flexibleBoolean
      .optional()
      .describe("Trigger integration on deployment events"),
    releases_events: flexibleBoolean.optional().describe("Trigger integration on release events"),
    vulnerability_events: flexibleBoolean
      .optional()
      .describe("Trigger integration on vulnerability events"),

    // Generic config for integration-specific parameters
    // Each integration has unique config options (webhook URLs, tokens, channels, etc.)
    config: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Integration-specific configuration parameters. Pass as key-value pairs. Examples: webhook_url, token, channel, etc. See GitLab API documentation for integration-specific fields."
      ),
  })
  .passthrough(); // Allow additional integration-specific fields at root level

// ============================================================================
// Type exports
// ============================================================================

export type ManageIntegrationInput = z.infer<typeof ManageIntegrationSchema>;
export type IntegrationType = z.infer<typeof IntegrationTypeSchema>;
