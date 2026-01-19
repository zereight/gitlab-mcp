import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

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
// manage_integration - CQRS Command Tool (discriminated union schema)
// Actions: get, update, disable
// Uses z.discriminatedUnion() for type-safe action handling.
// ============================================================================

// --- Shared fields ---
const projectIdField = requiredId.describe("Project ID or URL-encoded path");
const integrationField = IntegrationTypeSchema.describe(
  "Integration type slug (e.g., slack, jira, discord). Note: gitlab-slack-application cannot be created via API - it requires OAuth installation from GitLab UI."
);

// Common event trigger fields (used by update action)
const eventFields = {
  active: flexibleBoolean
    .optional()
    .describe("Enable or disable the integration without full configuration"),
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
  wiki_page_events: flexibleBoolean.optional().describe("Trigger integration on wiki page events"),
  job_events: flexibleBoolean.optional().describe("Trigger integration on job events"),
  deployment_events: flexibleBoolean
    .optional()
    .describe("Trigger integration on deployment events"),
  releases_events: flexibleBoolean.optional().describe("Trigger integration on release events"),
  vulnerability_events: flexibleBoolean
    .optional()
    .describe("Trigger integration on vulnerability events"),
  config: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Integration-specific configuration parameters. Pass as key-value pairs. Examples: webhook_url, token, channel, etc. See GitLab API documentation for integration-specific fields."
    ),
};

// --- Action: get ---
const GetIntegrationSchema = z.object({
  action: z.literal("get").describe("Get integration settings (read-only)"),
  project_id: projectIdField,
  integration: integrationField,
});

// --- Action: update ---
const UpdateIntegrationSchema = z
  .object({
    action: z.literal("update").describe("Update or enable integration with specific config"),
    project_id: projectIdField,
    integration: integrationField,
    ...eventFields,
  })
  .passthrough(); // Allow additional integration-specific fields at root level

// --- Action: disable ---
const DisableIntegrationSchema = z.object({
  action: z.literal("disable").describe("Disable and remove integration"),
  project_id: projectIdField,
  integration: integrationField,
});

// --- Discriminated union combining all actions ---
export const ManageIntegrationSchema = z.discriminatedUnion("action", [
  GetIntegrationSchema,
  UpdateIntegrationSchema,
  DisableIntegrationSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ManageIntegrationInput = z.infer<typeof ManageIntegrationSchema>;
export type IntegrationType = z.infer<typeof IntegrationTypeSchema>;
