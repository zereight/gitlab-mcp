import * as z from "zod";
import { ListIntegrationsSchema } from "./schema-readonly";
import { ManageIntegrationSchema } from "./schema";
import { gitlab, toQuery } from "../../utils/gitlab-api";
import { getEffectiveProjectId } from "../../config";
import { ToolRegistry, EnhancedToolDefinition } from "../../types";

/**
 * Integrations tools registry - 2 CQRS tools for managing GitLab project integrations
 *
 * list_integrations (Query): list all active integrations
 * manage_integration (Command): get, update, disable
 */
export const integrationsToolRegistry: ToolRegistry = new Map<string, EnhancedToolDefinition>([
  // ============================================================================
  // list_integrations - CQRS Query Tool
  // ============================================================================
  [
    "list_integrations",
    {
      name: "list_integrations",
      description:
        "LIST all active integrations for a project. Returns integrations like Slack, Jira, Discord, Microsoft Teams, Jenkins, etc. Only shows enabled/configured integrations.",
      inputSchema: z.toJSONSchema(ListIntegrationsSchema, {}),
      handler: async (args: unknown) => {
        const input = ListIntegrationsSchema.parse(args);
        const projectId = getEffectiveProjectId(input.project_id);

        const query = toQuery(
          {
            per_page: input.per_page,
            page: input.page,
          },
          []
        );

        return gitlab.get(`projects/${encodeURIComponent(projectId)}/integrations`, { query });
      },
    },
  ],

  // ============================================================================
  // manage_integration - CQRS Command Tool
  // ============================================================================
  [
    "manage_integration",
    {
      name: "manage_integration",
      description:
        'MANAGE project integrations. Actions: "get" retrieves integration settings (read-only), "update" modifies or enables integration with specific config, "disable" removes integration. Supports 50+ integrations: Slack, Jira, Discord, Teams, Jenkins, etc. Note: gitlab-slack-application cannot be created via API - requires OAuth install from UI.',
      inputSchema: z.toJSONSchema(ManageIntegrationSchema, {}),
      handler: async (args: unknown) => {
        const input = ManageIntegrationSchema.parse(args);
        const projectId = getEffectiveProjectId(input.project_id);
        const integrationSlug = input.integration;

        // Enforce read-only mode for write actions (check dynamically for testability)
        const isReadOnly = process.env.GITLAB_READ_ONLY_MODE === "true";
        if (isReadOnly && (input.action === "update" || input.action === "disable")) {
          throw new Error(
            `Action '${input.action}' is not allowed in read-only mode. Only 'get' action is permitted.`
          );
        }

        switch (input.action) {
          case "get": {
            return gitlab.get(
              `projects/${encodeURIComponent(projectId)}/integrations/${integrationSlug}`
            );
          }

          case "update": {
            // Extract fields that shouldn't be sent in the body
            const {
              action: _action,
              project_id: _project_id,
              integration: _integration,
              ...body
            } = input;

            // Flatten config object if provided
            let finalBody = { ...body };
            if (body.config) {
              const { config, ...rest } = body;
              finalBody = { ...rest, ...config };
            }

            return gitlab.put(
              `projects/${encodeURIComponent(projectId)}/integrations/${integrationSlug}`,
              {
                body: finalBody,
                contentType: "json",
              }
            );
          }

          case "disable": {
            await gitlab.delete(
              `projects/${encodeURIComponent(projectId)}/integrations/${integrationSlug}`
            );
            return { deleted: true };
          }

          /* istanbul ignore next -- unreachable with Zod validation */
          default:
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
        }
      },
    },
  ],
]);

/**
 * Get read-only tool names from the registry
 * Note: manage_integration is included because it supports a read-only action ('get').
 * Write actions ('update', 'disable') are blocked at the handler level when GITLAB_READ_ONLY_MODE is enabled.
 */
export function getIntegrationsReadOnlyToolNames(): string[] {
  return ["list_integrations", "manage_integration"];
}

/**
 * Get all tool definitions from the registry
 */
export function getIntegrationsToolDefinitions(): EnhancedToolDefinition[] {
  return Array.from(integrationsToolRegistry.values());
}

/**
 * Get filtered tools based on read-only mode
 */
export function getFilteredIntegrationsTools(
  readOnlyMode: boolean = false
): EnhancedToolDefinition[] {
  if (readOnlyMode) {
    const readOnlyNames = getIntegrationsReadOnlyToolNames();
    return Array.from(integrationsToolRegistry.values()).filter(tool =>
      readOnlyNames.includes(tool.name)
    );
  }
  return getIntegrationsToolDefinitions();
}
