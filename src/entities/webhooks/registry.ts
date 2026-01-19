import * as z from "zod";
import { ListWebhooksSchema } from "./schema-readonly";
import { ManageWebhookSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";
// assertDefined no longer needed - discriminated union provides type safety
import { isActionDenied } from "../../config";

/**
 * Webhooks tools registry - 2 CQRS tools (discriminated union schema)
 *
 * list_webhooks (Query): list project/group webhooks
 * manage_webhook (Command): create, read, update, delete, test
 */
export const webhooksToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // list_webhooks - CQRS Query Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "list_webhooks",
    {
      name: "list_webhooks",
      description:
        "List all webhooks configured for a project or group. Use to discover existing integrations, audit webhook configurations, debug delivery issues, or understand event subscriptions. Shows webhook URLs, enabled event types, SSL settings, and delivery status. Group webhooks (Premium tier) are inherited by all child projects.",
      inputSchema: z.toJSONSchema(ListWebhooksSchema),
      handler: async (args: unknown) => {
        const input = ListWebhooksSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("list_webhooks", input.scope)) {
          throw new Error(`Scope '${input.scope}' is not allowed for list_webhooks tool`);
        }

        switch (input.scope) {
          case "project": {
            // TypeScript knows: input has projectId (required)
            const { scope: _scope, projectId, ...queryParams } = input;
            return gitlab.get(`projects/${encodeURIComponent(projectId)}/hooks`, {
              query: toQuery(queryParams, []),
            });
          }

          case "group": {
            // TypeScript knows: input has groupId (required)
            const { scope: _scope, groupId, ...queryParams } = input;
            return gitlab.get(`groups/${encodeURIComponent(groupId)}/hooks`, {
              query: toQuery(queryParams, []),
            });
          }

          /* istanbul ignore next -- unreachable with Zod discriminatedUnion */
          default:
            throw new Error(`Unknown scope: ${(input as { scope: string }).scope}`);
        }
      },
    },
  ],

  // ============================================================================
  // manage_webhook - CQRS Command Tool (discriminated union schema)
  // TypeScript automatically narrows types in each switch case
  // ============================================================================
  [
    "manage_webhook",
    {
      name: "manage_webhook",
      description:
        "Manage webhooks with full CRUD operations plus testing. Actions: 'create' (add new webhook with URL and event types), 'read' (get webhook details - SAFE FOR READ-ONLY MODE), 'update' (modify URL, events, or settings), 'delete' (remove webhook), 'test' (trigger test delivery for specific event type). Use for setting up CI/CD automation, configuring notifications, integrating external systems, debugging deliveries, or managing event subscriptions. Test action sends actual HTTP request to configured URL. Group webhooks require Premium tier. NOTE: In read-only mode, only 'read' action is allowed; write operations are blocked at handler level.",
      inputSchema: z.toJSONSchema(ManageWebhookSchema),
      handler: async (args: unknown) => {
        const input = ManageWebhookSchema.parse(args);

        // Runtime validation: reject denied actions even if they bypass schema filtering
        if (isActionDenied("manage_webhook", input.action)) {
          throw new Error(`Action '${input.action}' is not allowed for manage_webhook tool`);
        }

        // Check read-only mode for write operations
        const isReadOnly = process.env.GITLAB_READ_ONLY_MODE === "true";
        if (isReadOnly && input.action !== "read") {
          throw new Error(
            `Operation '${input.action}' is not allowed in read-only mode. Only 'read' action is permitted.`
          );
        }

        // Determine base path from scope and IDs
        const getBasePath = (scope: "project" | "group", projectId?: string, groupId?: string) => {
          if (scope === "project" && projectId) {
            return `projects/${encodeURIComponent(projectId)}/hooks`;
          } else if (scope === "group" && groupId) {
            return `groups/${encodeURIComponent(groupId)}/hooks`;
          }
          throw new Error("Invalid scope or missing project/group ID");
        };

        // Helper to filter webhook data for API requests
        const buildRequestBody = (data: Record<string, unknown>): Record<string, unknown> => {
          const body: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(data)) {
            if (
              value !== undefined &&
              !["action", "scope", "projectId", "groupId", "hookId", "trigger"].includes(key)
            ) {
              body[key] = value;
            }
          }
          return body;
        };

        switch (input.action) {
          case "create": {
            // TypeScript knows: input has url (required), scope, projectId/groupId, event fields
            const basePath = getBasePath(input.scope, input.projectId, input.groupId);

            return gitlab.post(basePath, {
              body: buildRequestBody(input),
              contentType: "json",
            });
          }

          case "read": {
            // TypeScript knows: input has hookId (required), scope, projectId/groupId
            const basePath = getBasePath(input.scope, input.projectId, input.groupId);

            return gitlab.get(`${basePath}/${input.hookId}`);
          }

          case "update": {
            // TypeScript knows: input has hookId (required), scope, projectId/groupId, optional fields
            const basePath = getBasePath(input.scope, input.projectId, input.groupId);

            return gitlab.put(`${basePath}/${input.hookId}`, {
              body: buildRequestBody(input),
              contentType: "json",
            });
          }

          case "delete": {
            // TypeScript knows: input has hookId (required), scope, projectId/groupId
            const basePath = getBasePath(input.scope, input.projectId, input.groupId);

            await gitlab.delete(`${basePath}/${input.hookId}`);
            return { success: true, message: "Webhook deleted successfully" };
          }

          case "test": {
            // TypeScript knows: input has hookId (required), trigger (required), scope, projectId/groupId
            const basePath = getBasePath(input.scope, input.projectId, input.groupId);

            return gitlab.post(`${basePath}/${input.hookId}/test/${input.trigger}`, {
              contentType: "json",
            });
          }

          /* istanbul ignore next -- unreachable with Zod discriminatedUnion */
          default:
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
        }
      },
    },
  ],
]);

/**
 * Get read-only tool names from the registry
 */
export function getWebhooksReadOnlyToolNames(): string[] {
  // In read-only mode, both tools are exposed:
  // - list_webhooks: Fully read-only, lists webhooks
  // - manage_webhook: Handler enforces read-only at runtime, only allows action='read'
  // This design allows the tool to be present for webhook inspection while blocking
  // write operations (create/update/delete/test) at the handler level.
  return ["list_webhooks", "manage_webhook"];
}

/**
 * Get all tool definitions from the registry
 */
export function getWebhooksToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(webhooksToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredWebhooksTools(readOnlyMode: boolean = false): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getWebhooksReadOnlyToolNames();
    return Array.from(webhooksToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getWebhooksToolDefinitions();
}
