import { z } from "zod";
import { flexibleBoolean, validateScopeId } from "../utils";

// WRITE WEBHOOK OPERATION SCHEMAS

/**
 * Schema for managing webhooks with full CRUD + testing capabilities.
 *
 * @remarks
 * This schema supports five actions:
 * - `create`: Add a new webhook (requires `url`)
 * - `read`: Retrieve webhook details (requires `hookId`)
 * - `update`: Modify webhook configuration (requires `hookId`)
 * - `delete`: Remove webhook permanently (requires `hookId`)
 * - `test`: Trigger test delivery for an event type (requires `hookId` and `trigger`)
 *
 * @example Create a webhook
 * ```typescript
 * {
 *   action: "create",
 *   scope: "project",
 *   projectId: "my-project",
 *   url: "https://example.com/webhook",
 *   push_events: true
 * }
 * ```
 *
 * @example Test a webhook
 * ```typescript
 * {
 *   action: "test",
 *   scope: "project",
 *   projectId: "my-project",
 *   hookId: 123,
 *   trigger: "push_events"
 * }
 * ```
 */
export const ManageWebhookSchema = z
  .object({
    action: z
      .enum(["create", "read", "update", "delete", "test"])
      .describe("Action to perform on webhook"),

    scope: z.enum(["project", "group"]).describe("Scope of webhook (project or group)"),
    projectId: z.string().optional().describe("Project ID or path (required if scope=project)"),
    groupId: z.string().optional().describe("Group ID or path (required if scope=group)"),

    // For read/update/delete/test actions
    hookId: z.number().optional().describe("Webhook ID (required for read/update/delete/test)"),

    // For test action
    trigger: z
      .enum([
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
      ])
      .optional()
      .describe("Event type to test (required for test action)"),

    // For create/update actions
    url: z.string().optional().describe("Webhook URL (required for create)"),
    name: z.string().optional().describe("Human-readable webhook name (GitLab 16.11+)"),
    description: z.string().optional().describe("Webhook description (GitLab 16.11+)"),
    token: z.string().optional().describe("Secret token for webhook validation"),

    // Event triggers
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
    confidential_note_events: flexibleBoolean
      .optional()
      .describe("Enable confidential note events"),
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

    // SSL verification
    enable_ssl_verification: flexibleBoolean
      .optional()
      .describe("Enable SSL certificate verification"),
  })
  .refine(validateScopeId, {
    message: "projectId is required when scope=project, groupId is required when scope=group",
  })
  .refine(
    data => {
      if (["read", "update", "delete", "test"].includes(data.action)) {
        return data.hookId !== undefined;
      }
      return true;
    },
    {
      message: "hookId is required for read, update, delete, and test actions",
    }
  )
  .refine(
    data => {
      if (data.action === "create") {
        return !!data.url;
      }
      return true;
    },
    {
      message: "url is required for create action",
    }
  )
  .refine(
    data => {
      if (data.action === "test") {
        return !!data.trigger;
      }
      return true;
    },
    {
      message: "trigger is required for test action",
    }
  );

// Export type definitions
export type ManageWebhookOptions = z.infer<typeof ManageWebhookSchema>;
