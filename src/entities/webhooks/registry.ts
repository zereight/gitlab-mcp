import * as z from "zod";
import { ListWebhooksSchema } from "./schema-readonly";
import { ManageWebhookSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Webhooks tools registry - unified registry containing all webhook operation tools with their handlers
 */
export const webhooksToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  [
    "list_webhooks",
    {
      name: "list_webhooks",
      description:
        "List all webhooks configured for a project or group. Use to discover existing integrations, audit webhook configurations, debug delivery issues, or understand event subscriptions. Shows webhook URLs, enabled event types, SSL settings, and delivery status. Group webhooks (Premium tier) are inherited by all child projects.",
      inputSchema: z.toJSONSchema(ListWebhooksSchema),
      handler: async (args: unknown) => {
        const options = ListWebhooksSchema.parse(args);
        const { scope, projectId, groupId, ...queryParams } = options;

        if (scope === "project" && projectId) {
          return gitlab.get(`projects/${encodeURIComponent(projectId)}/hooks`, {
            query: toQuery(queryParams, []),
          });
        } else if (scope === "group" && groupId) {
          return gitlab.get(`groups/${encodeURIComponent(groupId)}/hooks`, {
            query: toQuery(queryParams, []),
          });
        }

        throw new Error("Invalid scope or missing project/group ID");
      },
    },
  ],
  [
    "manage_webhook",
    {
      name: "manage_webhook",
      description:
        "Manage webhooks with full CRUD operations plus testing. Actions: 'create' (add new webhook with URL and event types), 'read' (get webhook details - SAFE FOR READ-ONLY MODE), 'update' (modify URL, events, or settings), 'delete' (remove webhook), 'test' (trigger test delivery for specific event type). Use for setting up CI/CD automation, configuring notifications, integrating external systems, debugging deliveries, or managing event subscriptions. Test action sends actual HTTP request to configured URL. Group webhooks require Premium tier. NOTE: In read-only mode, only 'read' action is allowed; write operations are blocked at handler level.",
      inputSchema: z.toJSONSchema(ManageWebhookSchema),
      handler: async (args: unknown) => {
        const options = ManageWebhookSchema.parse(args);
        const { action, scope, projectId, groupId, hookId, trigger, ...webhookData } = options;

        // Check read-only mode for write operations
        const isReadOnly = process.env.GITLAB_READ_ONLY_MODE === "true";
        if (isReadOnly && action !== "read") {
          throw new Error(
            `Operation '${action}' is not allowed in read-only mode. Only 'read' action is permitted.`
          );
        }

        // Determine base path
        const basePath =
          scope === "project" && projectId
            ? `projects/${encodeURIComponent(projectId)}/hooks`
            : scope === "group" && groupId
              ? `groups/${encodeURIComponent(groupId)}/hooks`
              : null;

        if (!basePath) {
          throw new Error("Invalid scope or missing project/group ID");
        }

        // Helper to filter webhook data for API requests
        const buildRequestBody = (data: Record<string, unknown>): Record<string, unknown> => {
          const body: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && !["scope", "projectId", "groupId"].includes(key)) {
              body[key] = value;
            }
          }
          return body;
        };

        // Handle different actions
        switch (action) {
          case "create": {
            return gitlab.post(basePath, {
              body: buildRequestBody(webhookData),
              contentType: "json",
            });
          }

          case "read": {
            if (!hookId) {
              throw new Error("hookId is required for read action");
            }
            return gitlab.get(`${basePath}/${hookId}`);
          }

          case "update": {
            if (!hookId) {
              throw new Error("hookId is required for update action");
            }

            return gitlab.put(`${basePath}/${hookId}`, {
              body: buildRequestBody(webhookData),
              contentType: "json",
            });
          }

          case "delete": {
            if (!hookId) {
              throw new Error("hookId is required for delete action");
            }
            await gitlab.delete(`${basePath}/${hookId}`);
            return { success: true, message: "Webhook deleted successfully" };
          }

          case "test": {
            if (!hookId) {
              throw new Error("hookId is required for test action");
            }
            if (!trigger) {
              throw new Error("trigger is required for test action");
            }

            return gitlab.post(`${basePath}/${hookId}/test/${trigger}`, {
              contentType: "json",
            });
          }

          default:
            throw new Error(`Unknown action: ${action as string}`);
        }
      },
    },
  ],
]);

export function getWebhooksReadOnlyToolNames(): string[] {
  // In read-only mode, both tools are exposed:
  // - list_webhooks: Fully read-only, lists webhooks
  // - manage_webhook: Handler enforces read-only at runtime, only allows action='read'
  // This design allows the tool to be present for webhook inspection while blocking
  // write operations (create/update/delete/test) at the handler level.
  return ["list_webhooks", "manage_webhook"];
}

export function getWebhooksToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(webhooksToolRegistry.values());
}

export function getFilteredWebhooksTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getWebhooksReadOnlyToolNames();
    return Array.from(webhooksToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getWebhooksToolDefinitions();
}
