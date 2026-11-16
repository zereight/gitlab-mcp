/**
 * Tags toolset: the repository tag and protected tag tool handlers and the
 * GitLab API helpers only they call.
 *
 * index.ts owns the request plumbing these handlers use (the auth-retry fetch,
 * GitLab error handling, and the project allowlist check) and hands it over once
 * with configureTagTools(). The fetch is read at call time, since index.ts
 * replaces it when the cookie jar reloads.
 */
import type { Response as UndiciResponse } from "undici";
import { z } from "zod";
import type { FetchFn } from "../auth-retry.js";
import {
  CreateTagSchema,
  DeleteTagSchema,
  GetProtectedTagSchema,
  GetTagSchema,
  GetTagSignatureSchema,
  GitLabProtectedTagSchema,
  type GitLabTag,
  GitLabTagSchema,
  type GitLabTagSignature,
  GitLabTagSignatureSchema,
  ListProtectedTagsSchema,
  ListTagsSchema,
  ProtectTagSchema,
  UnprotectTagSchema,
} from "../schemas.js";
import { getEffectiveApiUrl, getFetchConfig } from "../server/gitlab-request-context.js";
import { appendFilterParams } from "../utils/tool-args.js";
import { encodeGitLabPathSegment } from "../utils/url.js";

export interface TagToolDeps {
  /** The auth-retry fetch from index.ts, re-read on every call because it is reassigned. */
  getFetch: () => FetchFn;
  handleGitLabError: (response: UndiciResponse) => Promise<void>;
  getEffectiveProjectId: (projectId: string) => string;
}

let deps: TagToolDeps | undefined;

export function configureTagTools(next: TagToolDeps): void {
  deps = next;
}

function requireDeps(): TagToolDeps {
  if (!deps) {
    throw new Error("Tag tools used before configureTagTools()");
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

export interface TagToolCallParams {
  name: string;
  arguments: unknown;
}

export interface TagToolResult {
  content: Array<{ type: "text"; text: string }>;
}

/**
 * List repository tags
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param options Optional parameters for filtering and pagination
 * @returns Array of GitLab tags
 */
async function listTags(
  projectId: string,
  options: Omit<z.infer<typeof ListTagsSchema>, "project_id"> = {}
): Promise<GitLabTag[]> {
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/repository/tags`
  );

  appendFilterParams(url.searchParams, options);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabTagSchema.array().parse(data);
}

/**
 * Get a repository tag by name
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The name of the tag
 * @returns GitLab tag
 */
async function getTag(projectId: string, tagName: string): Promise<GitLabTag> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/repository/tags/${encodeGitLabPathSegment(tagName)}`,
    {
      ...getFetchConfig(),
    }
  );

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabTagSchema.parse(data);
}

/**
 * Create a new repository tag
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param options Options for creating the tag
 * @returns Created GitLab tag
 */
async function createTag(
  projectId: string,
  options: Omit<z.infer<typeof CreateTagSchema>, "project_id">
): Promise<GitLabTag> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/repository/tags`,
    {
      ...getFetchConfig(),
      method: "POST",
      body: JSON.stringify(options),
    }
  );

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabTagSchema.parse(data);
}

/**
 * Delete a repository tag
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The name of the tag
 */
async function deleteTag(projectId: string, tagName: string): Promise<void> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/repository/tags/${encodeGitLabPathSegment(tagName)}`,
    {
      ...getFetchConfig(),
      method: "DELETE",
    }
  );

  await handleGitLabError(response);
}

/**
 * Get the signature of a repository tag
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The name of the tag
 * @returns Tag signature
 */
async function getTagSignature(projectId: string, tagName: string): Promise<GitLabTagSignature> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/repository/tags/${encodeGitLabPathSegment(tagName)}/signature`,
    {
      ...getFetchConfig(),
    }
  );

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabTagSignatureSchema.parse(data);
}

export async function handleTagToolCall(params: TagToolCallParams): Promise<TagToolResult> {
  switch (params.name) {
    case "list_tags": {
      const args = ListTagsSchema.parse(params.arguments);
      const { project_id, ...options } = args;
      const tags = await listTags(project_id, options);
      return {
        content: [{ type: "text", text: JSON.stringify(tags) }],
      };
    }

    case "get_tag": {
      const args = GetTagSchema.parse(params.arguments);
      const tag = await getTag(args.project_id, args.tag_name);
      return {
        content: [{ type: "text", text: JSON.stringify(tag) }],
      };
    }

    case "create_tag": {
      const args = CreateTagSchema.parse(params.arguments);
      const { project_id, ...options } = args;
      const tag = await createTag(project_id, options);
      return {
        content: [{ type: "text", text: JSON.stringify(tag) }],
      };
    }

    case "delete_tag": {
      const args = DeleteTagSchema.parse(params.arguments);
      await deleteTag(args.project_id, args.tag_name);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: `Tag '${args.tag_name}' deleted successfully`,
            }),
          },
        ],
      };
    }

    case "get_tag_signature": {
      const args = GetTagSignatureSchema.parse(params.arguments);
      const signature = await getTagSignature(args.project_id, args.tag_name);
      return {
        content: [{ type: "text", text: JSON.stringify(signature) }],
      };
    }

    case "list_protected_tags": {
      const args = ListProtectedTagsSchema.parse(params.arguments);
      const projectId = decodeURIComponent(args.project_id);
      const effectiveProjectId = getEffectiveProjectId(projectId);
      const url = new URL(
        `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/protected_tags`
      );
      if (args.page) url.searchParams.append("page", String(args.page));
      if (args.per_page) url.searchParams.append("per_page", String(args.per_page));

      const response = await fetch(url.toString(), {
        ...getFetchConfig(),
      });

      await handleGitLabError(response);
      const data = z.array(GitLabProtectedTagSchema).parse(await response.json());
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }

    case "get_protected_tag": {
      const args = GetProtectedTagSchema.parse(params.arguments);
      const projectId = decodeURIComponent(args.project_id);
      const effectiveProjectId = getEffectiveProjectId(projectId);
      const url = new URL(
        `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/protected_tags/${encodeGitLabPathSegment(args.tag_name)}`
      );

      const response = await fetch(url.toString(), {
        ...getFetchConfig(),
      });

      await handleGitLabError(response);
      const data = GitLabProtectedTagSchema.parse(await response.json());
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }

    case "protect_tag": {
      const args = ProtectTagSchema.parse(params.arguments);
      const projectId = decodeURIComponent(args.project_id);
      const effectiveProjectId = getEffectiveProjectId(projectId);
      const url = new URL(
        `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/protected_tags`
      );

      const body: Record<string, unknown> = { name: args.tag_name };
      if (args.create_access_level !== undefined) {
        body.create_access_level = args.create_access_level;
      }

      const response = await fetch(url.toString(), {
        ...getFetchConfig(),
        method: "POST",
        body: JSON.stringify(body),
      });

      await handleGitLabError(response);
      const data = GitLabProtectedTagSchema.parse(await response.json());
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }

    case "unprotect_tag": {
      const args = UnprotectTagSchema.parse(params.arguments);
      const projectId = decodeURIComponent(args.project_id);
      const effectiveProjectId = getEffectiveProjectId(projectId);
      const url = new URL(
        `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(effectiveProjectId)}/protected_tags/${encodeGitLabPathSegment(args.tag_name)}`
      );

      const response = await fetch(url.toString(), {
        ...getFetchConfig(),
        method: "DELETE",
      });

      await handleGitLabError(response);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "unprotected", tag: args.tag_name }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
