import { z } from "zod";
import { flexibleBoolean, requiredId } from "../utils";

// ============================================================================
// manage_webhook - CQRS Command Tool (discriminated union schema)
// Actions: create, read, update, delete, test
//
// Uses z.discriminatedUnion() to define action-specific parameters.
// Benefits:
// - Each action has ONLY its relevant parameters (token savings)
// - TypeScript type narrowing in handlers
// - Filtering denied actions removes their exclusive parameters from schema
// - JSON Schema outputs oneOf which is flattened for AI clients at runtime
// ============================================================================

// --- Shared webhook event fields used by create/update actions ---
const WebhookEventFields = {
  push_events: flexibleBoolean.optional().describe("Enable push events"),
  push_events_branch_filter: z
    .string()
    .optional()
    .describe("Branch filter for push events (wildcard supported)"),
  tag_push_events: flexibleBoolean.optional().describe("Enable tag push events"),
  merge_requests_events: flexibleBoolean.optional().describe("Enable merge request events"),
  issues_events: flexibleBoolean.optional().describe("Enable issue events"),
  confidential_issues_events: flexibleBoolean
    .optional()
    .describe("Enable confidential issue events"),
  note_events: flexibleBoolean.optional().describe("Enable note/comment events"),
  confidential_note_events: flexibleBoolean.optional().describe("Enable confidential note events"),
  job_events: flexibleBoolean.optional().describe("Enable job/build events"),
  pipeline_events: flexibleBoolean.optional().describe("Enable pipeline events"),
  wiki_page_events: flexibleBoolean.optional().describe("Enable wiki page events"),
  deployment_events: flexibleBoolean.optional().describe("Enable deployment events"),
  feature_flag_events: flexibleBoolean.optional().describe("Enable feature flag events"),
  releases_events: flexibleBoolean.optional().describe("Enable release events"),
  emoji_events: flexibleBoolean.optional().describe("Enable emoji events"),
  resource_access_token_events: flexibleBoolean
    .optional()
    .describe("Enable resource access token events"),
  member_events: flexibleBoolean.optional().describe("Enable member events"),
  subgroup_events: flexibleBoolean
    .optional()
    .describe("Enable subgroup events (group webhooks only)"),
  project_events: flexibleBoolean
    .optional()
    .describe("Enable project events (group webhooks only)"),
  enable_ssl_verification: flexibleBoolean
    .optional()
    .describe("Enable SSL certificate verification"),
};

// --- Trigger events enum for test action ---
const TriggerEventSchema = z.enum([
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
]);

// --- Scope field with project/group discrimination ---
const scopeField = z.enum(["project", "group"]).describe("Scope of webhook (project or group)");

// --- Create action: creates a new webhook ---
const CreateWebhookSchema = z.object({
  action: z.literal("create"),
  scope: scopeField,
  projectId: z.string().optional().describe("Project ID or path (required if scope=project)"),
  groupId: z.string().optional().describe("Group ID or path (required if scope=group)"),
  url: z.string().describe("Webhook URL (required)"),
  name: z.string().optional().describe("Human-readable webhook name (GitLab 16.11+)"),
  description: z.string().optional().describe("Webhook description (GitLab 16.11+)"),
  token: z.string().optional().describe("Secret token for webhook validation"),
  ...WebhookEventFields,
});

// --- Read action: retrieves webhook details ---
const ReadWebhookSchema = z.object({
  action: z.literal("read"),
  scope: scopeField,
  projectId: z.string().optional().describe("Project ID or path (required if scope=project)"),
  groupId: z.string().optional().describe("Group ID or path (required if scope=group)"),
  hookId: requiredId.describe("Webhook ID (required)"),
});

// --- Update action: modifies an existing webhook ---
const UpdateWebhookSchema = z.object({
  action: z.literal("update"),
  scope: scopeField,
  projectId: z.string().optional().describe("Project ID or path (required if scope=project)"),
  groupId: z.string().optional().describe("Group ID or path (required if scope=group)"),
  hookId: requiredId.describe("Webhook ID (required)"),
  url: z.string().optional().describe("Webhook URL"),
  name: z.string().optional().describe("Human-readable webhook name (GitLab 16.11+)"),
  description: z.string().optional().describe("Webhook description (GitLab 16.11+)"),
  token: z.string().optional().describe("Secret token for webhook validation"),
  ...WebhookEventFields,
});

// --- Delete action: removes a webhook ---
const DeleteWebhookSchema = z.object({
  action: z.literal("delete"),
  scope: scopeField,
  projectId: z.string().optional().describe("Project ID or path (required if scope=project)"),
  groupId: z.string().optional().describe("Group ID or path (required if scope=group)"),
  hookId: requiredId.describe("Webhook ID (required)"),
});

// --- Test action: triggers a test delivery ---
const TestWebhookSchema = z.object({
  action: z.literal("test"),
  scope: scopeField,
  projectId: z.string().optional().describe("Project ID or path (required if scope=project)"),
  groupId: z.string().optional().describe("Group ID or path (required if scope=group)"),
  hookId: requiredId.describe("Webhook ID (required)"),
  trigger: TriggerEventSchema.describe("Event type to test (required)"),
});

// --- Discriminated union combining all actions ---
export const ManageWebhookSchema = z.discriminatedUnion("action", [
  CreateWebhookSchema,
  ReadWebhookSchema,
  UpdateWebhookSchema,
  DeleteWebhookSchema,
  TestWebhookSchema,
]);

// ============================================================================
// Type exports
// ============================================================================

export type ManageWebhookOptions = z.infer<typeof ManageWebhookSchema>;
