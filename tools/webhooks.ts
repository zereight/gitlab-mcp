/**
 * Webhooks toolset: the project and group webhook tool handlers, webhook event
 * listing, and the GitLab API helpers only they call.
 *
 * index.ts owns the request plumbing these handlers use (the auth-retry fetch, GitLab
 * error handling, the project scope helpers) and hands it over once with
 * configureWebhookTools(). The fetch is read at call time, since index.ts replaces it
 * when the cookie jar reloads.
 */
import type { Response as UndiciResponse } from "undici";
import { z } from "zod";
import type { FetchFn } from "../auth-retry.js";
import {
  CreateWebhookSchema,
  DeleteWebhookSchema,
  GetWebhookEventSchema,
  ListWebhookEventsSchema,
  ListWebhooksSchema,
  UpdateWebhookSchema,
} from "../schemas.js";
import { getEffectiveApiUrl, getFetchConfig } from "../server/gitlab-request-context.js";
import { encodeGitLabPathSegment } from "../utils/url.js";
import { summarizeWebhookEvents } from "../utils/helpers.js";

export interface WebhookToolDeps {
  /** The auth-retry fetch from index.ts, re-read on every call because it is reassigned. */
  getFetch: () => FetchFn;
  handleGitLabError: (response: UndiciResponse) => Promise<void>;
  getEffectiveProjectId: (projectId: string) => string;
  rejectIfStrictProjectScope: (toolName: string) => void;
}

let deps: WebhookToolDeps | undefined;

export function configureWebhookTools(next: WebhookToolDeps): void {
  deps = next;
}

function requireDeps(): WebhookToolDeps {
  if (!deps) {
    throw new Error("Webhook tools used before configureWebhookTools()");
  }
  return deps;
}

const fetch: FetchFn = (input, init) => requireDeps().getFetch()(input, init);

function handleGitLabError(response: UndiciResponse): Promise<void> {
  return requireDeps().handleGitLabError(response);
}

function getEffectiveProjectId(projectId: string): string {
  return requireDeps().getEffectiveProjectId(projectId);
}

function rejectIfStrictProjectScope(toolName: string): void {
  requireDeps().rejectIfStrictProjectScope(toolName);
}

export interface WebhookToolCallParams {
  name: string;
  arguments: unknown;
}

export interface WebhookToolResult {
  content: Array<{ type: "text"; text: string }>;
}

// Webhook API helper functions

/**
 * Build the base URL for webhooks (project or group)
 */
function buildWebhookBaseUrl(projectId?: string, groupId?: string): string {
  if (projectId) {
    projectId = decodeURIComponent(projectId);
    return `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/hooks`;
  }
  rejectIfStrictProjectScope("group webhooks");
  const decodedGroupId = decodeURIComponent(groupId!);
  return `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(decodedGroupId)}/hooks`;
}

/**
 * List webhooks for a project or group
 */
async function listWebhooks(options: z.infer<typeof ListWebhooksSchema>): Promise<unknown[]> {
  const url = new URL(buildWebhookBaseUrl(options.project_id, options.group_id));

  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());

  const response = await fetch(url.toString(), { ...getFetchConfig() });
  await handleGitLabError(response);
  return (await response.json()) as unknown[];
}

function buildWebhookMutationBody(
  options: z.infer<typeof CreateWebhookSchema> | z.infer<typeof UpdateWebhookSchema>
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (key === "project_id" || key === "group_id" || key === "hook_id") continue;
    if (value !== undefined) body[key] = value;
  }
  return body;
}

/**
 * Create a webhook on a project or group
 */
async function createWebhook(options: z.infer<typeof CreateWebhookSchema>): Promise<unknown> {
  const url = buildWebhookBaseUrl(options.project_id, options.group_id);
  const response = await fetch(url, {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify(buildWebhookMutationBody(options)),
  });
  await handleGitLabError(response);
  return await response.json();
}

/**
 * Update a webhook on a project or group
 */
async function updateWebhook(options: z.infer<typeof UpdateWebhookSchema>): Promise<unknown> {
  const url = `${buildWebhookBaseUrl(options.project_id, options.group_id)}/${options.hook_id}`;
  const response = await fetch(url, {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(buildWebhookMutationBody(options)),
  });
  await handleGitLabError(response);
  return await response.json();
}

/**
 * Delete a webhook from a project or group
 */
async function deleteWebhook(
  options: z.infer<typeof DeleteWebhookSchema>
): Promise<{ status: string; hook_id: number }> {
  const url = `${buildWebhookBaseUrl(options.project_id, options.group_id)}/${options.hook_id}`;
  const response = await fetch(url, {
    ...getFetchConfig(),
    method: "DELETE",
  });
  await handleGitLabError(response);
  return { status: "deleted", hook_id: options.hook_id };
}

/**
 * Fetch a single page of webhook events
 */
async function fetchWebhookEventsPage(
  baseUrl: string,
  page: number,
  perPage: number,
  status?: string | number
): Promise<Record<string, unknown>[]> {
  const url = new URL(baseUrl);
  url.searchParams.set("page", page.toString());
  url.searchParams.set("per_page", perPage.toString());
  if (status !== undefined) url.searchParams.append("status", String(status));

  const response = await fetch(url.toString(), { ...getFetchConfig() });
  await handleGitLabError(response);
  return (await response.json()) as Record<string, unknown>[];
}

/**
 * List webhook events for a project or group webhook
 */
async function listWebhookEvents(
  options: z.infer<typeof ListWebhookEventsSchema>
): Promise<unknown[]> {
  const eventsUrl = `${buildWebhookBaseUrl(options.project_id, options.group_id)}/${options.hook_id}/events`;

  const events = await fetchWebhookEventsPage(
    eventsUrl,
    options.page ?? 1,
    options.per_page ?? 20,
    options.status
  );
  return options.summary ? summarizeWebhookEvents(events) : events;
}

/**
 * Get a specific webhook event by ID (searches up to 500 recent events)
 */
async function getWebhookEvent(
  options: z.infer<typeof GetWebhookEventSchema>
): Promise<Record<string, unknown> | null> {
  const eventsUrl = `${buildWebhookBaseUrl(options.project_id, options.group_id)}/${options.hook_id}/events`;
  // GitLab enforces max per_page=20 for webhook events
  const perPage = 20;

  if (options.page) {
    // Direct page lookup — single API call
    const events = await fetchWebhookEventsPage(eventsUrl, options.page, perPage);
    const match = events.find(e => e.id === options.event_id);
    return match ?? null;
  }

  // Auto-paginate up to 500 events
  const maxPages = 25;
  for (let page = 1; page <= maxPages; page++) {
    const events = await fetchWebhookEventsPage(eventsUrl, page, perPage);
    const match = events.find(e => e.id === options.event_id);
    if (match) return match;
    if (events.length < perPage) break;
  }
  return null;
}

export async function handleWebhookToolCall(
  params: WebhookToolCallParams
): Promise<WebhookToolResult> {
  switch (params.name) {
    case "list_webhooks": {
      const args = ListWebhooksSchema.parse(params.arguments);
      const webhooks = await listWebhooks(args);
      return {
        content: [{ type: "text", text: JSON.stringify(webhooks) }],
      };
    }

    case "create_webhook": {
      const args = CreateWebhookSchema.parse(params.arguments);
      const webhook = await createWebhook(args);
      return {
        content: [{ type: "text", text: JSON.stringify(webhook) }],
      };
    }

    case "update_webhook": {
      const args = UpdateWebhookSchema.parse(params.arguments);
      const webhook = await updateWebhook(args);
      return {
        content: [{ type: "text", text: JSON.stringify(webhook) }],
      };
    }

    case "delete_webhook": {
      const args = DeleteWebhookSchema.parse(params.arguments);
      const result = await deleteWebhook(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }

    case "list_webhook_events": {
      const args = ListWebhookEventsSchema.parse(params.arguments);
      const events = await listWebhookEvents(args);
      return {
        content: [{ type: "text", text: JSON.stringify(events) }],
      };
    }

    case "get_webhook_event": {
      const args = GetWebhookEventSchema.parse(params.arguments);
      const event = await getWebhookEvent(args);
      if (!event) {
        const searchScope = args.page ? `on page ${args.page}` : "in the 500 most recent events";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Webhook event ${args.event_id} not found ${searchScope}`,
              }),
            },
          ],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(event) }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
