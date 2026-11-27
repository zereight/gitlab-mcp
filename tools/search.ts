/**
 * Code search toolset: search_code, search_project_code and search_group_code, through
 * GitLab's blob search API.
 *
 * index.ts owns the auth-retry fetch, GitLab error handling, project ID resolution and the
 * strict project scope guard, and hands them over once with configureSearchTools(). The fetch
 * is read at call time, since index.ts replaces it when the cookie jar reloads.
 * search_repositories stays in index.ts with its project search helper.
 */
import type { Response as UndiciResponse } from "undici";
import { z } from "zod";
import type { FetchFn } from "../auth-retry.js";
import {
  GitLabSearchBlobResultSchema,
  type GitLabSearchBlobResult,
  SearchCodeSchema,
  SearchGroupCodeSchema,
  SearchProjectCodeSchema,
} from "../schemas.js";
import { getEffectiveApiUrl, getFetchConfig } from "../server/gitlab-request-context.js";
import { encodeGitLabPathSegment } from "../utils/url.js";

export interface SearchToolDeps {
  /** The auth-retry fetch from index.ts, re-read on every call because it is reassigned. */
  getFetch: () => FetchFn;
  handleGitLabError: (response: UndiciResponse) => Promise<void>;
  getEffectiveProjectId: (projectId: string) => string;
  /** index.ts's strict project scope guard. */
  rejectIfStrictProjectScope: (toolName: string) => void;
}

let deps: SearchToolDeps | undefined;

export function configureSearchTools(next: SearchToolDeps): void {
  deps = next;
}

function requireDeps(): SearchToolDeps {
  if (!deps) {
    throw new Error("Search tools used before configureSearchTools()");
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

/**
 * Search for code blobs using GitLab Search API
 * Supports global, project-level, and group-level search
 */
async function searchBlobs(params: {
  search: string;
  project_id?: string;
  group_id?: string;
  ref?: string;
  filename?: string;
  path?: string;
  extension?: string;
  page?: number;
  per_page?: number;
}): Promise<GitLabSearchBlobResult[]> {
  let basePath: string;
  if (params.project_id) {
    const decodedProjectId = decodeURIComponent(params.project_id);
    const projectId = encodeGitLabPathSegment(getEffectiveProjectId(decodedProjectId));
    basePath = `${getEffectiveApiUrl()}/projects/${projectId}/search`;
  } else if (params.group_id) {
    basePath = `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(params.group_id)}/search`;
  } else {
    basePath = `${getEffectiveApiUrl()}/search`;
  }

  const url = new URL(basePath);
  url.searchParams.append("scope", "blobs");
  url.searchParams.append("search", params.search);

  if (params.ref) {
    url.searchParams.append("ref", params.ref);
  }
  if (params.page) {
    url.searchParams.append("page", params.page.toString());
  }
  if (params.per_page) {
    url.searchParams.append("per_page", params.per_page.toString());
  }

  if (params.filename) {
    url.searchParams.append("filename", params.filename);
  }
  if (params.path) {
    url.searchParams.append("path", params.path);
  }
  if (params.extension) {
    url.searchParams.append("extension", params.extension);
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);

  const data = await response.json();
  return z.array(GitLabSearchBlobResultSchema).parse(data);
}

export interface SearchToolCallParams {
  name: string;
  arguments: unknown;
}

export interface SearchToolResult {
  content: Array<{ type: "text"; text: string }>;
}

export async function handleSearchToolCall(
  params: SearchToolCallParams
): Promise<SearchToolResult> {
  switch (params.name) {
    case "search_code": {
      rejectIfStrictProjectScope("search_code");
      const args = SearchCodeSchema.parse(params.arguments);
      const results = await searchBlobs({
        search: args.search,
        filename: args.filename,
        path: args.path,
        extension: args.extension,
        page: args.page,
        per_page: args.per_page,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(results) }],
      };
    }

    case "search_project_code": {
      const args = SearchProjectCodeSchema.parse(params.arguments);
      const results = await searchBlobs({
        search: args.search,
        // searchBlobs treats an empty project_id as an instance-wide search; resolve it
        // like other project tools instead (default project, or an input error).
        project_id: args.project_id || getEffectiveProjectId(args.project_id),
        ref: args.ref,
        filename: args.filename,
        path: args.path,
        extension: args.extension,
        page: args.page,
        per_page: args.per_page,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(results) }],
      };
    }

    case "search_group_code": {
      rejectIfStrictProjectScope("search_group_code");
      const args = SearchGroupCodeSchema.parse(params.arguments);
      const results = await searchBlobs({
        search: args.search,
        group_id: args.group_id,
        filename: args.filename,
        path: args.path,
        extension: args.extension,
        page: args.page,
        per_page: args.per_page,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(results) }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
