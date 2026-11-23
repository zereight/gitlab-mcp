/**
 * Snippets toolset: the snippet tool handlers and the GitLab API helpers only they call.
 *
 * index.ts owns the request plumbing these handlers use (the auth-retry fetch, GitLab
 * error handling, project scope resolution) and hands it over once with
 * configureSnippetTools(). The fetch is read at call time, since index.ts replaces it
 * when the cookie jar reloads.
 */
import type { Response as UndiciResponse } from "undici";
import { z } from "zod";
import type { FetchFn } from "../auth-retry.js";
import {
  CreateSnippetSchema,
  DeleteSnippetSchema,
  GetSnippetSchema,
  GitLabSnippetSchema,
  ListSnippetsSchema,
  UpdateSnippetSchema,
  type GitLabSnippet,
} from "../schemas.js";
import { getEffectiveApiUrl, getFetchConfig } from "../server/gitlab-request-context.js";
import { withRecoveryHint } from "../utils/error-hints.js";
import { encodeGitLabPathSegment } from "../utils/url.js";
import { ToolInputError } from "../utils/tool-input-error.js";

export interface SnippetToolDeps {
  /** The auth-retry fetch from index.ts, re-read on every call because it is reassigned. */
  getFetch: () => FetchFn;
  handleGitLabError: (response: UndiciResponse) => Promise<void>;
  getEffectiveProjectId: (projectId: string) => string;
  /** True when a project allowlist or GITLAB_PROJECT_ID narrows the server to projects. */
  isProjectScopeActive: () => boolean;
}

let deps: SnippetToolDeps | undefined;

export function configureSnippetTools(next: SnippetToolDeps): void {
  deps = next;
}

function requireDeps(): SnippetToolDeps {
  if (!deps) {
    throw new Error("Snippet tools used before configureSnippetTools()");
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

function isProjectScopeActive(): boolean {
  return requireDeps().isProjectScopeActive();
}

/**
 * Build the snippets endpoint URL.
 *
 * When projectId is provided, or when a project allowlist is in effect (env
 * GITLAB_PROJECT_ID / GITLAB_ALLOWED_PROJECT_IDS or a session scope narrowed via
 * X-GitLab-Allowed-Project-Ids), returns the project snippets endpoint — routing
 * through getEffectiveProjectId so the effective scope is enforced. Only falls
 * back to the personal /snippets endpoint when no scope is active at all.
 */
function getSnippetsEndpoint(projectId?: string): string {
  if (projectId || isProjectScopeActive()) {
    const decoded = projectId ? decodeURIComponent(projectId) : "";
    const effectiveProjectId = getEffectiveProjectId(decoded);
    return `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/snippets`;
  }
  return `${getEffectiveApiUrl()}/snippets`;
}

/**
 * List snippets — project snippets if projectId is given, otherwise personal snippets.
 */
async function listSnippets(
  projectId: string | undefined,
  options: Omit<z.infer<typeof ListSnippetsSchema>, "project_id"> = {}
): Promise<GitLabSnippet[]> {
  const url = new URL(getSnippetsEndpoint(projectId));

  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabSnippetSchema.array().parse(data);
}

/**
 * Get a snippet's metadata. Use getSnippetRawContent to fetch the raw file content.
 */
async function getSnippet(
  projectId: string | undefined,
  snippetId: number
): Promise<GitLabSnippet> {
  const response = await fetch(`${getSnippetsEndpoint(projectId)}/${snippetId}`, {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabSnippetSchema.parse(data);
}

/**
 * Get the raw content of a single-file snippet via the `/raw` endpoint.
 * For multi-file snippets, use getSnippetFileRawContent instead.
 */
async function getSnippetRawContent(
  projectId: string | undefined,
  snippetId: number
): Promise<string> {
  const response = await fetch(`${getSnippetsEndpoint(projectId)}/${snippetId}/raw`, {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);

  return await response.text();
}

/**
 * Extract the ref (branch/tag/commit) from a snippet file's raw_url.
 * Anchors on /snippets/{id}/raw/ so branch names or file paths containing
 * the word "raw" don't produce a false match.
 */
function extractSnippetRef(rawUrl: string, snippetId: number, filePath: string): string {
  const rawMarker = `/snippets/${snippetId}/raw/`;
  const decoded = decodeURIComponent(new URL(rawUrl).pathname);
  const markerIdx = decoded.indexOf(rawMarker);
  if (markerIdx === -1) {
    throw new Error(`Cannot extract ref from snippet file raw_url: ${rawUrl}`);
  }
  const afterRaw = decoded.slice(markerIdx + rawMarker.length); // "{ref}/{filePath}"
  const fileStart = afterRaw.lastIndexOf("/" + filePath);
  if (fileStart === -1) {
    throw new Error(`Cannot locate file path "${filePath}" in snippet file raw_url: ${rawUrl}`);
  }
  return afterRaw.slice(0, fileStart);
}

/**
 * Fetch the raw content of one file inside a multi-file snippet.
 * Accepts an explicit ref (branch/tag/commit) — callers resolve it via
 * extractSnippetRef or a user-supplied parameter before calling this.
 */
async function getSnippetFileRawContent(
  projectId: string | undefined,
  snippetId: number,
  ref: string,
  filePath: string
): Promise<string> {
  const encodedRef = encodeGitLabPathSegment(ref);
  const encodedPath = encodeGitLabPathSegment(filePath);
  const url = `${getSnippetsEndpoint(projectId)}/${snippetId}/files/${encodedRef}/${encodedPath}/raw`;
  const response = await fetch(url, { ...getFetchConfig() });
  await handleGitLabError(response);
  return await response.text();
}

function snippetCreateFilesPayload(
  options: Omit<z.infer<typeof CreateSnippetSchema>, "project_id">
): Array<{ file_path: string; content: string }> {
  if (options.files !== undefined && options.files.length > 0) {
    return options.files;
  }
  if (options.file_name !== undefined && options.content !== undefined) {
    return [{ file_path: options.file_name, content: options.content }];
  }
  throw new ToolInputError(
    withRecoveryHint(
      "Provide either files[] (multi-file) or both file_name and content (single-file)",
      "for one file pass file_name and content; for several pass files: [{ file_path, content }]."
    )
  );
}

/**
 * Create a snippet — project-scoped if projectId is given, otherwise personal.
 */
async function createSnippet(
  projectId: string | undefined,
  options: Omit<z.infer<typeof CreateSnippetSchema>, "project_id">
): Promise<GitLabSnippet> {
  const { title, description, visibility } = options;
  const body: Record<string, unknown> = {
    title,
    visibility: visibility ?? "private",
    files: snippetCreateFilesPayload(options),
  };
  if (description !== undefined) {
    body.description = description;
  }

  const response = await fetch(getSnippetsEndpoint(projectId), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify(body),
  });

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabSnippetSchema.parse(data);
}

/**
 * Update an existing snippet — project-scoped if projectId is given, otherwise personal.
 */
async function updateSnippet(
  projectId: string | undefined,
  options: Omit<z.infer<typeof UpdateSnippetSchema>, "project_id">
): Promise<GitLabSnippet> {
  const { snippet_id, title, file_name, content, files, description, visibility } = options;
  const body: Record<string, unknown> = {};
  if (title !== undefined) body.title = title;
  if (description !== undefined) body.description = description;
  if (visibility !== undefined) body.visibility = visibility;

  if (files !== undefined) {
    body.files = files;
  } else if (file_name !== undefined && content !== undefined) {
    body.files = [{ action: "update", file_path: file_name, content }];
  }

  const response = await fetch(`${getSnippetsEndpoint(projectId)}/${snippet_id}`, {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(body),
  });

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabSnippetSchema.parse(data);
}

/**
 * Delete a snippet — project-scoped if projectId is given, otherwise personal.
 */
async function deleteSnippet(projectId: string | undefined, snippetId: number): Promise<void> {
  const response = await fetch(`${getSnippetsEndpoint(projectId)}/${snippetId}`, {
    ...getFetchConfig(),
    method: "DELETE",
  });

  await handleGitLabError(response);
}

export interface SnippetToolCallParams {
  name: string;
  arguments: unknown;
}

export interface SnippetToolResult {
  content: Array<{ type: "text"; text: string }>;
}

export async function handleSnippetToolCall(
  params: SnippetToolCallParams
): Promise<SnippetToolResult> {
  switch (params.name) {
    case "list_snippets": {
      const args = ListSnippetsSchema.parse(params.arguments);
      const { project_id, ...options } = args;
      const snippets = await listSnippets(project_id, options);
      return {
        content: [{ type: "text", text: JSON.stringify(snippets) }],
      };
    }

    case "get_snippet": {
      const args = GetSnippetSchema.parse(params.arguments);
      const snippet = await getSnippet(args.project_id, args.snippet_id);
      const result: Record<string, unknown> = { ...snippet };
      if (args.include_content) {
        const files = snippet.files ?? [];
        if (files.length > 1) {
          const firstFile = files[0];
          let ref: string;
          if (args.ref !== undefined) {
            ref = args.ref;
          } else {
            if (!firstFile.raw_url)
              throw new Error(`Snippet file "${firstFile.path}" has no raw_url`);
            ref = extractSnippetRef(firstFile.raw_url, args.snippet_id, firstFile.path);
          }
          result.files = await Promise.all(
            files.map(async f => ({
              ...f,
              content: await getSnippetFileRawContent(
                args.project_id,
                args.snippet_id,
                ref,
                f.path
              ),
            }))
          );
        } else {
          const file = files[0];
          const filePath = file?.path ?? snippet.file_name ?? undefined;
          if (args.ref !== undefined && filePath) {
            result.content = await getSnippetFileRawContent(
              args.project_id,
              args.snippet_id,
              args.ref,
              filePath
            );
          } else {
            result.content = await getSnippetRawContent(args.project_id, args.snippet_id);
          }
        }
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }

    case "create_snippet": {
      const args = CreateSnippetSchema.parse(params.arguments);
      const { project_id, ...options } = args;
      const snippet = await createSnippet(project_id, options);
      return {
        content: [{ type: "text", text: JSON.stringify(snippet) }],
      };
    }

    case "update_snippet": {
      const args = UpdateSnippetSchema.parse(params.arguments);
      const { project_id, ...options } = args;
      const snippet = await updateSnippet(project_id, options);
      return {
        content: [{ type: "text", text: JSON.stringify(snippet) }],
      };
    }

    case "delete_snippet": {
      const args = DeleteSnippetSchema.parse(params.arguments);
      await deleteSnippet(args.project_id, args.snippet_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: `Snippet ${args.snippet_id} deleted successfully`,
            }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
