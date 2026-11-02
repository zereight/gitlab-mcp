/**
 * Wiki toolset: the project and group wiki tool handlers and the GitLab API
 * helpers only they call.
 *
 * index.ts owns the request plumbing these handlers use (the auth-retry fetch,
 * GitLab error handling, the project allowlist check, and the strict project
 * scope guard) and hands it over once with configureWikiTools(). The fetch is
 * read at call time, since index.ts replaces it when the cookie jar reloads.
 */
import type { Response as UndiciResponse } from "undici";
import type { FetchFn } from "../auth-retry.js";
import {
  CreateGroupWikiPageSchema,
  CreateWikiPageSchema,
  DeleteGroupWikiPageSchema,
  DeleteWikiPageSchema,
  GetGroupWikiPageSchema,
  GetWikiPageSchema,
  type GitLabWikiPage,
  GitLabWikiPageSchema,
  ListGroupWikiPagesSchema,
  type ListGroupWikiPagesOptions,
  ListWikiPagesOptions,
  ListWikiPagesSchema,
  UpdateGroupWikiPageSchema,
  UpdateWikiPageSchema,
} from "../schemas.js";
import { getEffectiveApiUrl, getFetchConfig } from "../server/gitlab-request-context.js";
import { encodeGitLabPathSegment } from "../utils/url.js";
import { resolveNestedWikiUpdateTitle } from "../utils/wiki-title.js";

export interface WikiToolDeps {
  /** The auth-retry fetch from index.ts, re-read on every call because it is reassigned. */
  getFetch: () => FetchFn;
  handleGitLabError: (response: UndiciResponse) => Promise<void>;
  getEffectiveProjectId: (projectId: string) => string;
  rejectIfStrictProjectScope: (toolName: string) => void;
}

let deps: WikiToolDeps | undefined;

export function configureWikiTools(next: WikiToolDeps): void {
  deps = next;
}

function requireDeps(): WikiToolDeps {
  if (!deps) {
    throw new Error("Wiki tools used before configureWikiTools()");
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

export interface WikiToolCallParams {
  name: string;
  arguments: unknown;
}

export interface WikiToolResult {
  content: Array<{ type: "text"; text: string }>;
}

// Wiki API helper functions
/**
 * List wiki pages in a project
 */
async function listWikiPages(
  projectId: string,
  options: Omit<ListWikiPagesOptions, "project_id"> = {}
): Promise<GitLabWikiPage[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/wikis`
  );
  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());
  if (options.with_content)
    url.searchParams.append("with_content", options.with_content.toString());
  if (options.render_html) url.searchParams.append("render_html", options.render_html.toString());
  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.array().parse(data);
}

/**
 * Get a specific wiki page
 */
async function getWikiPage(
  projectId: string,
  slug: string,
  renderHtml?: boolean
): Promise<GitLabWikiPage> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/wikis/${encodeGitLabPathSegment(slug)}`
  );
  if (renderHtml) url.searchParams.append("render_html", renderHtml.toString());
  const response = await fetch(url.toString(), { ...getFetchConfig() });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.parse(data);
}

/**
 * Create a new wiki page
 */
async function createWikiPage(
  projectId: string,
  title: string,
  content: string,
  format?: string
): Promise<GitLabWikiPage> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const body: Record<string, any> = { title, content };
  if (format) body.format = format;
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/wikis`,
    {
      ...getFetchConfig(),
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.parse(data);
}

/**
 * Update an existing wiki page
 */
async function updateWikiPage(
  projectId: string,
  slug: string,
  title?: string,
  content?: string,
  format?: string
): Promise<GitLabWikiPage> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const body: Record<string, any> = {};
  if (title) {
    if (slug.includes("/") && !title.includes("/")) {
      const existing = await getWikiPage(projectId, slug);
      body.title = resolveNestedWikiUpdateTitle(slug, title, existing.title);
    } else {
      body.title = title;
    }
  }
  if (content) body.content = content;
  if (format) body.format = format;
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/wikis/${encodeGitLabPathSegment(slug)}`,
    {
      ...getFetchConfig(),
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.parse(data);
}

/**
 * Delete a wiki page
 */
async function deleteWikiPage(projectId: string, slug: string): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeGitLabPathSegment(getEffectiveProjectId(projectId))}/wikis/${encodeGitLabPathSegment(slug)}`,
    {
      ...getFetchConfig(),
      method: "DELETE",
    }
  );
  await handleGitLabError(response);
}

/**
 * List wiki pages in a GitLab group
 */
async function listGroupWikiPages(
  groupId: string,
  options: Omit<ListGroupWikiPagesOptions, "group_id"> = {}
): Promise<GitLabWikiPage[]> {
  groupId = decodeURIComponent(groupId); // Decode group ID
  const url = new URL(`${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/wikis`);
  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());
  if (options.with_content)
    url.searchParams.append("with_content", options.with_content.toString());
  if (options.render_html) url.searchParams.append("render_html", options.render_html.toString());
  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.array().parse(data);
}

/**
 * Get a specific group wiki page
 */
async function getGroupWikiPage(
  groupId: string,
  slug: string,
  renderHtml?: boolean
): Promise<GitLabWikiPage> {
  groupId = decodeURIComponent(groupId); // Decode group ID
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/wikis/${encodeGitLabPathSegment(slug)}`
  );
  if (renderHtml) url.searchParams.append("render_html", renderHtml.toString());
  const response = await fetch(url.toString(), { ...getFetchConfig() });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.parse(data);
}

/**
 * Create a new group wiki page
 */
async function createGroupWikiPage(
  groupId: string,
  title: string,
  content: string,
  format?: string
): Promise<GitLabWikiPage> {
  groupId = decodeURIComponent(groupId); // Decode group ID
  const body: Record<string, any> = { title, content };
  if (format) body.format = format;
  const response = await fetch(
    `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/wikis`,
    {
      ...getFetchConfig(),
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.parse(data);
}

/**
 * Update an existing group wiki page
 */
async function updateGroupWikiPage(
  groupId: string,
  slug: string,
  title?: string,
  content?: string,
  format?: string
): Promise<GitLabWikiPage> {
  groupId = decodeURIComponent(groupId); // Decode group ID
  const body: Record<string, any> = {};
  if (title) {
    if (slug.includes("/") && !title.includes("/")) {
      const existing = await getGroupWikiPage(groupId, slug);
      body.title = resolveNestedWikiUpdateTitle(slug, title, existing.title);
    } else {
      body.title = title;
    }
  }
  if (content) body.content = content;
  if (format) body.format = format;
  const response = await fetch(
    `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/wikis/${encodeGitLabPathSegment(slug)}`,
    {
      ...getFetchConfig(),
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.parse(data);
}

/**
 * Delete a group wiki page
 */
async function deleteGroupWikiPage(groupId: string, slug: string): Promise<void> {
  groupId = decodeURIComponent(groupId); // Decode group ID
  const response = await fetch(
    `${getEffectiveApiUrl()}/groups/${encodeGitLabPathSegment(groupId)}/wikis/${encodeGitLabPathSegment(slug)}`,
    {
      ...getFetchConfig(),
      method: "DELETE",
    }
  );
  await handleGitLabError(response);
}

export async function handleWikiToolCall(params: WikiToolCallParams): Promise<WikiToolResult> {
  switch (params.name) {
    case "list_wiki_pages": {
      const { project_id, page, per_page, with_content, render_html } = ListWikiPagesSchema.parse(
        params.arguments
      );
      const wikiPages = await listWikiPages(project_id, {
        page,
        per_page,
        with_content,
        render_html,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(wikiPages) }],
      };
    }

    case "get_wiki_page": {
      const { project_id, slug, render_html } = GetWikiPageSchema.parse(params.arguments);
      const wikiPage = await getWikiPage(project_id, slug, render_html);
      return {
        content: [{ type: "text", text: JSON.stringify(wikiPage) }],
      };
    }

    case "create_wiki_page": {
      const { project_id, title, content, format } = CreateWikiPageSchema.parse(params.arguments);
      const wikiPage = await createWikiPage(project_id, title, content, format);
      return {
        content: [{ type: "text", text: JSON.stringify(wikiPage) }],
      };
    }

    case "update_wiki_page": {
      const { project_id, slug, title, content, format } = UpdateWikiPageSchema.parse(
        params.arguments
      );
      const wikiPage = await updateWikiPage(project_id, slug, title, content, format);
      return {
        content: [{ type: "text", text: JSON.stringify(wikiPage) }],
      };
    }

    case "delete_wiki_page": {
      const { project_id, slug } = DeleteWikiPageSchema.parse(params.arguments);
      await deleteWikiPage(project_id, slug);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: "Wiki page deleted successfully",
            }),
          },
        ],
      };
    }

    case "list_group_wiki_pages": {
      rejectIfStrictProjectScope("list_group_wiki_pages");
      const { group_id, page, per_page, with_content, render_html } =
        ListGroupWikiPagesSchema.parse(params.arguments);
      const wikiPages = await listGroupWikiPages(group_id, {
        page,
        per_page,
        with_content,
        render_html,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(wikiPages) }],
      };
    }

    case "get_group_wiki_page": {
      rejectIfStrictProjectScope("get_group_wiki_page");
      const { group_id, slug, render_html } = GetGroupWikiPageSchema.parse(params.arguments);
      const wikiPage = await getGroupWikiPage(group_id, slug, render_html);
      return {
        content: [{ type: "text", text: JSON.stringify(wikiPage) }],
      };
    }

    case "create_group_wiki_page": {
      rejectIfStrictProjectScope("create_group_wiki_page");
      const { group_id, title, content, format } = CreateGroupWikiPageSchema.parse(
        params.arguments
      );
      const wikiPage = await createGroupWikiPage(group_id, title, content, format);
      return {
        content: [{ type: "text", text: JSON.stringify(wikiPage) }],
      };
    }

    case "update_group_wiki_page": {
      rejectIfStrictProjectScope("update_group_wiki_page");
      const { group_id, slug, title, content, format } = UpdateGroupWikiPageSchema.parse(
        params.arguments
      );
      const wikiPage = await updateGroupWikiPage(group_id, slug, title, content, format);
      return {
        content: [{ type: "text", text: JSON.stringify(wikiPage) }],
      };
    }

    case "delete_group_wiki_page": {
      rejectIfStrictProjectScope("delete_group_wiki_page");
      const { group_id, slug } = DeleteGroupWikiPageSchema.parse(params.arguments);
      await deleteGroupWikiPage(group_id, slug);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: "Group wiki page deleted successfully",
            }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
