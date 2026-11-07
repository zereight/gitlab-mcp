/**
 * Labels toolset: the project label tool handlers and the GitLab API helpers
 * only they call.
 *
 * index.ts owns the request plumbing these handlers use (the auth-retry fetch,
 * GitLab error handling, and the project allowlist check) and hands it over once
 * with configureLabelTools(). The fetch is read at call time, since index.ts
 * replaces it when the cookie jar reloads.
 */
import type { Response as UndiciResponse } from "undici";
import { z } from "zod";
import type { FetchFn } from "../auth-retry.js";
import {
  CreateLabelSchema,
  DeleteLabelSchema,
  GetLabelSchema,
  type GitLabLabel,
  ListLabelsSchema,
  UpdateLabelSchema,
} from "../schemas.js";
import { getEffectiveApiUrl, getFetchConfig } from "../server/gitlab-request-context.js";
import { appendFilterParams } from "../utils/tool-args.js";
import { encodeGitLabPathSegment } from "../utils/url.js";

export interface LabelToolDeps {
  /** The auth-retry fetch from index.ts, re-read on every call because it is reassigned. */
  getFetch: () => FetchFn;
  handleGitLabError: (response: UndiciResponse) => Promise<void>;
  getEffectiveProjectId: (projectId: string) => string;
}

let deps: LabelToolDeps | undefined;

export function configureLabelTools(next: LabelToolDeps): void {
  deps = next;
}

function requireDeps(): LabelToolDeps {
  if (!deps) {
    throw new Error("Label tools used before configureLabelTools()");
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

export interface LabelToolCallParams {
  name: string;
  arguments: unknown;
}

export interface LabelToolResult {
  content: Array<{ type: "text"; text: string }>;
}

/**
 * List labels for a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param options Optional parameters for listing labels
 * @returns Array of GitLab labels
 */
async function listLabels(
  projectId: string,
  options: Omit<z.infer<typeof ListLabelsSchema>, "project_id"> = {}
): Promise<GitLabLabel[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Construct the URL with project path
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/labels`
  );

  // Add query parameters
  appendFilterParams(url.searchParams, options);

  // Make the API request
  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return data as GitLabLabel[];
}

/**
 * Get a single label from a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param labelId The ID or name of the label
 * @param includeAncestorGroups Whether to include ancestor groups
 * @returns GitLab label
 */
async function getLabel(
  projectId: string,
  labelId: number | string,
  includeAncestorGroups?: boolean
): Promise<GitLabLabel> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(
      getEffectiveProjectId(projectId)
    )}/labels/${encodeGitLabPathSegment(String(labelId))}`
  );

  // Add query parameters
  if (includeAncestorGroups !== undefined) {
    url.searchParams.append("include_ancestor_groups", includeAncestorGroups ? "true" : "false");
  }

  // Make the API request
  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return data as GitLabLabel;
}

/**
 * Create a new label in a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param options Options for creating the label
 * @returns Created GitLab label
 */
async function createLabel(
  projectId: string,
  options: Omit<z.infer<typeof CreateLabelSchema>, "project_id">
): Promise<GitLabLabel> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Make the API request
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/labels`,
    {
      ...getFetchConfig(),
      method: "POST",
      body: JSON.stringify(options),
    }
  );

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return data as GitLabLabel;
}

/**
 * Update an existing label in a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param labelId The ID or name of the label to update
 * @param options Options for updating the label
 * @returns Updated GitLab label
 */
async function updateLabel(
  projectId: string,
  labelId: number | string,
  options: Omit<z.infer<typeof UpdateLabelSchema>, "project_id" | "label_id">
): Promise<GitLabLabel> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Make the API request
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(
      getEffectiveProjectId(projectId)
    )}/labels/${encodeGitLabPathSegment(String(labelId))}`,
    {
      ...getFetchConfig(),
      method: "PUT",
      body: JSON.stringify(options),
    }
  );

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return data as GitLabLabel;
}

/**
 * Delete a label from a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param labelId The ID or name of the label to delete
 */
async function deleteLabel(projectId: string, labelId: number | string): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Make the API request
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(
      getEffectiveProjectId(projectId)
    )}/labels/${encodeGitLabPathSegment(String(labelId))}`,
    {
      ...getFetchConfig(),
      method: "DELETE",
    }
  );

  // Handle errors
  await handleGitLabError(response);
}

export async function handleLabelToolCall(params: LabelToolCallParams): Promise<LabelToolResult> {
  switch (params.name) {
    case "list_labels": {
      const { project_id, ...options } = ListLabelsSchema.parse(params.arguments);
      const labels = await listLabels(project_id, options);
      return {
        content: [{ type: "text", text: JSON.stringify(labels) }],
      };
    }

    case "get_label": {
      const args = GetLabelSchema.parse(params.arguments);
      const label = await getLabel(args.project_id, args.label_id, args.include_ancestor_groups);
      return {
        content: [{ type: "text", text: JSON.stringify(label) }],
      };
    }

    case "create_label": {
      const args = CreateLabelSchema.parse(params.arguments);
      const label = await createLabel(args.project_id, args);
      return {
        content: [{ type: "text", text: JSON.stringify(label) }],
      };
    }

    case "update_label": {
      const args = UpdateLabelSchema.parse(params.arguments);
      const { project_id, label_id, ...options } = args;
      const label = await updateLabel(project_id, label_id, options);
      return {
        content: [{ type: "text", text: JSON.stringify(label) }],
      };
    }

    case "delete_label": {
      const args = DeleteLabelSchema.parse(params.arguments);
      await deleteLabel(args.project_id, args.label_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "success", message: "Label deleted successfully" }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
