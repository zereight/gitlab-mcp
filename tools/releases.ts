/**
 * Releases toolset: the release list, get, create, update and delete tools, the release
 * evidence endpoint, the release asset download, and the helpers only they call.
 *
 * index.ts owns the request plumbing these handlers use (the auth-retry fetch, GitLab
 * error handling, project id resolution, the download URL builder and redirect options) and
 * hands it over once with configureReleaseTools(). The fetch is read at call time, since
 * index.ts replaces it when the cookie jar reloads.
 */
import type { Response as UndiciResponse } from "undici";
import { z } from "zod";
import type { FetchFn } from "../auth-retry.js";
import {
  CreateReleaseEvidenceSchema,
  CreateReleaseSchema,
  DeleteReleaseSchema,
  DownloadReleaseAssetSchema,
  GetReleaseSchema,
  GitLabReleaseSchema,
  ListReleasesSchema,
  UpdateReleaseSchema,
  type GitLabRelease,
} from "../schemas.js";
import { getEffectiveApiUrl, getFetchConfig } from "../server/gitlab-request-context.js";
import {
  fetchWithValidatedRedirects,
  type FetchWithValidatedRedirectsOptions,
} from "../utils/safe-redirect-fetch.js";
import { appendFilterParams } from "../utils/tool-args.js";
import { encodeGitLabPath, encodeGitLabPathSegment } from "../utils/url.js";

export interface ReleaseToolDeps {
  /** The auth-retry fetch from index.ts, re-read on every call because it is reassigned. */
  getFetch: () => FetchFn;
  handleGitLabError: (response: UndiciResponse) => Promise<void>;
  /** index.ts's handleGitLabError with a 404 hint of the caller's choosing. */
  handleGitLabErrorWithNotFoundHint: (response: UndiciResponse, hint: string) => Promise<void>;
  getEffectiveProjectId: (projectId: string) => string;
  /** index.ts's download proxy URL builder, used in remote mode instead of downloading. */
  buildDownloadUrl: (type: string, projectId: string, params: Record<string, string>) => string;
  /** Redirect-validated download options from index.ts: the auth-retry fetch and trusted hosts. */
  downloadRedirectOptions: () => FetchWithValidatedRedirectsOptions;
  /** True when index.ts runs over SSE or StreamableHTTP, where a download returns a URL instead. */
  isRemote: boolean;
}

let deps: ReleaseToolDeps | undefined;

export function configureReleaseTools(next: ReleaseToolDeps): void {
  deps = next;
}

function requireDeps(): ReleaseToolDeps {
  if (!deps) {
    throw new Error("Release tools used before configureReleaseTools()");
  }
  return deps;
}

const fetch: FetchFn = (input, init) => requireDeps().getFetch()(input, init);

function handleGitLabError(response: UndiciResponse): Promise<void> {
  return requireDeps().handleGitLabError(response);
}

function handleGitLabErrorWithNotFoundHint(response: UndiciResponse, hint: string): Promise<void> {
  return requireDeps().handleGitLabErrorWithNotFoundHint(response, hint);
}

function getEffectiveProjectId(projectId: string): string {
  return requireDeps().getEffectiveProjectId(projectId);
}

function buildDownloadUrl(type: string, projectId: string, params: Record<string, string>): string {
  return requireDeps().buildDownloadUrl(type, projectId, params);
}

function downloadRedirectOptions(): FetchWithValidatedRedirectsOptions {
  return requireDeps().downloadRedirectOptions();
}

function isRemote(): boolean {
  return requireDeps().isRemote;
}

// Release tools take a tag_name: a 404 means the project is missing or no release has that tag.
// Used by handleReleaseTagError() in place of the generic iid hint.
const RELEASE_TAG_NOT_FOUND_HINT =
  "check project_id and that tag_name is the Git tag of an existing release; list_releases lists them.";

/**
 * Like handleGitLabError, but a 404 from a tag-addressed release endpoint gets the release hint.
 * Release tools take a tag_name, so the generic hint about the iid would name the wrong argument.
 */
async function handleReleaseTagError(response: UndiciResponse): Promise<void> {
  await handleGitLabErrorWithNotFoundHint(response, RELEASE_TAG_NOT_FOUND_HINT);
}

/**
 * List all releases for a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param options Optional parameters for listing releases
 * @returns Array of GitLab releases
 */
async function listReleases(
  projectId: string,
  options: Omit<z.infer<typeof ListReleasesSchema>, "project_id"> = {}
): Promise<GitLabRelease[]> {
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/releases`
  );

  // Add query parameters
  appendFilterParams(url.searchParams, options);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabReleaseSchema.array().parse(data);
}

/**
 * Get a release by tag name
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The Git tag the release is associated with
 * @param includeHtmlDescription If true, includes HTML rendered Markdown
 * @returns GitLab release
 */
async function getRelease(
  projectId: string,
  tagName: string,
  includeHtmlDescription?: boolean
): Promise<GitLabRelease> {
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/releases/${encodeGitLabPathSegment(tagName)}`
  );

  if (includeHtmlDescription !== undefined) {
    url.searchParams.append("include_html_description", includeHtmlDescription.toString());
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleReleaseTagError(response);

  const data = await response.json();
  return GitLabReleaseSchema.parse(data);
}

/**
 * Create a new release
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param options Options for creating the release
 * @returns Created GitLab release
 */
async function createRelease(
  projectId: string,
  options: Omit<z.infer<typeof CreateReleaseSchema>, "project_id">
): Promise<GitLabRelease> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/releases`,
    {
      ...getFetchConfig(),
      method: "POST",
      body: JSON.stringify(options),
    }
  );

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabReleaseSchema.parse(data);
}

/**
 * Update an existing release
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The Git tag the release is associated with
 * @param options Options for updating the release
 * @returns Updated GitLab release
 */
async function updateRelease(
  projectId: string,
  tagName: string,
  options: Omit<z.infer<typeof UpdateReleaseSchema>, "project_id" | "tag_name">
): Promise<GitLabRelease> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/releases/${encodeGitLabPathSegment(tagName)}`,
    {
      ...getFetchConfig(),
      method: "PUT",
      body: JSON.stringify(options),
    }
  );

  await handleReleaseTagError(response);

  const data = await response.json();
  return GitLabReleaseSchema.parse(data);
}

/**
 * Delete a release
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The Git tag the release is associated with
 * @returns Deleted GitLab release
 */
async function deleteRelease(projectId: string, tagName: string): Promise<GitLabRelease> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/releases/${encodeGitLabPathSegment(tagName)}`,
    {
      ...getFetchConfig(),
      method: "DELETE",
    }
  );

  await handleReleaseTagError(response);

  const data = await response.json();
  return GitLabReleaseSchema.parse(data);
}

/**
 * Create release evidence (GitLab Premium/Ultimate only)
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The Git tag the release is associated with
 */
async function createReleaseEvidence(projectId: string, tagName: string): Promise<void> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/releases/${encodeGitLabPathSegment(tagName)}/evidence`,
    {
      ...getFetchConfig(),
      method: "POST",
    }
  );

  await handleReleaseTagError(response);
}

/**
 * Download a release asset
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The Git tag the release is associated with
 * @param directAssetPath Path to the release asset file
 * @returns The asset file content
 */
async function downloadReleaseAsset(
  projectId: string,
  tagName: string,
  directAssetPath: string
): Promise<string> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetchWithValidatedRedirects(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/releases/${encodeGitLabPathSegment(tagName)}/downloads/${encodeGitLabPath(directAssetPath)}`,
    downloadRedirectOptions()
  );

  await handleGitLabError(response);

  return await response.text();
}

export interface ReleaseToolCallParams {
  name: string;
  arguments: unknown;
}

export interface ReleaseToolResult {
  content: Array<{ type: "text"; text: string }>;
}

export async function handleReleaseToolCall(
  params: ReleaseToolCallParams
): Promise<ReleaseToolResult> {
  switch (params.name) {
    case "list_releases": {
      const args = ListReleasesSchema.parse(params.arguments);
      const { project_id, ...options } = args;
      const releases = await listReleases(project_id, options);
      return {
        content: [{ type: "text", text: JSON.stringify(releases) }],
      };
    }

    case "get_release": {
      const args = GetReleaseSchema.parse(params.arguments);
      const release = await getRelease(
        args.project_id,
        args.tag_name,
        args.include_html_description
      );
      return {
        content: [{ type: "text", text: JSON.stringify(release) }],
      };
    }

    case "create_release": {
      const args = CreateReleaseSchema.parse(params.arguments);
      const { project_id, ...options } = args;
      const release = await createRelease(project_id, options);
      return {
        content: [{ type: "text", text: JSON.stringify(release) }],
      };
    }

    case "update_release": {
      const args = UpdateReleaseSchema.parse(params.arguments);
      const { project_id, tag_name, ...options } = args;
      const release = await updateRelease(project_id, tag_name, options);
      return {
        content: [{ type: "text", text: JSON.stringify(release) }],
      };
    }

    case "delete_release": {
      const args = DeleteReleaseSchema.parse(params.arguments);
      const release = await deleteRelease(args.project_id, args.tag_name);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: "Release deleted successfully",
              release,
            }),
          },
        ],
      };
    }

    case "create_release_evidence": {
      const args = CreateReleaseEvidenceSchema.parse(params.arguments);
      await createReleaseEvidence(args.project_id, args.tag_name);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: "Release evidence created successfully",
            }),
          },
        ],
      };
    }

    case "download_release_asset": {
      const args = DownloadReleaseAssetSchema.parse(params.arguments);
      if (isRemote()) {
        const downloadUrl = buildDownloadUrl("release-asset", args.project_id, {
          tag_name: args.tag_name,
          direct_asset_path: args.direct_asset_path,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                download_url: downloadUrl,
                filename: args.direct_asset_path.split("/").pop() || args.direct_asset_path,
              }),
            },
          ],
        };
      }
      const assetContent = await downloadReleaseAsset(
        args.project_id,
        args.tag_name,
        args.direct_asset_path
      );
      return {
        content: [{ type: "text", text: assetContent }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
