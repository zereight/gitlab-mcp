import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Logger } from "pino";
import { Response as UndiciResponse, type Dispatcher } from "undici";

// config.js reads the environment once at import, so pin standard PAT mode first.
for (const key of [
  "REMOTE_AUTHORIZATION",
  "GITLAB_MCP_OAUTH",
  "ENABLE_DYNAMIC_API_URL",
  "ENABLE_DYNAMIC_PROJECT_SCOPE",
  "GITLAB_JOB_TOKEN",
  "GITLAB_IS_OLD",
  "GITLAB_PERSONAL_ACCESS_TOKEN_FILE",
  "GITLAB_PERMISSION_MODE",
]) {
  delete process.env[key];
}
process.env.GITLAB_PERSONAL_ACCESS_TOKEN = "test-token-wiki-tools-0000";

const context = await import("../../server/gitlab-request-context.js");
const wiki = await import("../../tools/wiki.js");

const API_URL = "https://gitlab.example.com/api/v4";

interface RecordedRequest {
  url: string;
  method: string;
  body: string | undefined;
  authorization: string | undefined;
}

const requests: RecordedRequest[] = [];
let responses: Array<{ status: number; body: unknown }> = [];
let rejectedTools: string[] = [];
let projectIdLookups: string[] = [];

function jsonResponse(status: number, body: unknown): UndiciResponse {
  return new UndiciResponse(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function recordingFetch(tag: string) {
  const fetchImpl: typeof import("undici").fetch = async (input, init) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    requests.push({
      url: `${tag}:${String(input)}`,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
      authorization: headers.Authorization,
    });
    const next = responses.shift();
    if (!next) {
      throw new Error("no fake response queued");
    }
    return jsonResponse(next.status, next.body);
  };
  return fetchImpl;
}

let currentFetch = recordingFetch("a");

function configure(): void {
  context.configureGitLabRequestContext({
    logger: { debug() {}, warn() {} } as unknown as Logger,
    getDefaultApiUrl: () => API_URL,
    getDefaultAllowedProjectIds: () => [],
    getDispatcherForUrl: () => ({}) as Dispatcher,
    getOAuthAccessToken: () => null,
  });
  wiki.configureWikiTools({
    getFetch: () => currentFetch,
    handleGitLabError: async response => {
      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status}`);
      }
    },
    getEffectiveProjectId: projectId => {
      projectIdLookups.push(projectId);
      return projectId;
    },
    rejectIfStrictProjectScope: toolName => {
      rejectedTools.push(toolName);
      throw new Error(`${toolName} is not available in a project-scoped deployment`);
    },
  });
}

function reset(): void {
  requests.length = 0;
  responses = [];
  rejectedTools = [];
  projectIdLookups = [];
  currentFetch = recordingFetch("a");
}

const page = { title: "Home", slug: "home", format: "markdown", content: "hello" };

describe("When the wiki tools are used before they are configured", () => {
  it("should throw instead of falling back to a global fetch", async () => {
    // Only the request context is configured here; the wiki deps are not.
    context.configureGitLabRequestContext({
      logger: { debug() {}, warn() {} } as unknown as Logger,
      getDefaultApiUrl: () => API_URL,
      getDefaultAllowedProjectIds: () => [],
      getDispatcherForUrl: () => ({}) as Dispatcher,
      getOAuthAccessToken: () => null,
    });
    await assert.rejects(
      wiki.handleWikiToolCall({ name: "get_wiki_page", arguments: { project_id: "1", slug: "x" } }),
      /before configureWikiTools/
    );
  });
});

describe("When the project wiki tools are called", () => {
  it("should list pages with the pagination and content flags as query parameters", async () => {
    configure();
    reset();
    responses.push({ status: 200, body: [page] });

    const result = await wiki.handleWikiToolCall({
      name: "list_wiki_pages",
      arguments: { project_id: "group/project", page: 2, per_page: 5, with_content: true },
    });

    assert.equal(requests.length, 1);
    assert.equal(
      requests[0].url,
      `a:${API_URL}/projects/group%2Fproject/wikis?page=2&per_page=5&with_content=true`
    );
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[0].authorization, "Bearer test-token-wiki-tools-0000");
    assert.deepEqual(projectIdLookups, ["group/project"]);
    assert.deepEqual(result, { content: [{ type: "text", text: JSON.stringify([page]) }] });
  });

  it("should encode the slug in the page URL", async () => {
    configure();
    reset();
    responses.push({ status: 200, body: page });

    await wiki.handleWikiToolCall({
      name: "get_wiki_page",
      arguments: { project_id: "1", slug: "docs/getting started", render_html: true },
    });

    assert.equal(
      requests[0].url,
      `a:${API_URL}/projects/1/wikis/docs%2Fgetting%20started?render_html=true`
    );
  });

  it("should post the title, content, and format when creating a page", async () => {
    configure();
    reset();
    responses.push({ status: 201, body: page });

    await wiki.handleWikiToolCall({
      name: "create_wiki_page",
      arguments: { project_id: "1", title: "Home", content: "hello", format: "markdown" },
    });

    assert.equal(requests[0].method, "POST");
    assert.equal(requests[0].url, `a:${API_URL}/projects/1/wikis`);
    assert.deepEqual(JSON.parse(requests[0].body ?? ""), {
      title: "Home",
      content: "hello",
      format: "markdown",
    });
  });

  it("should read the existing page before renaming a nested page with a leaf title", async () => {
    configure();
    reset();
    responses.push({
      status: 200,
      body: { ...page, title: "00-map/infra servers", slug: "00-map/infra-servers" },
    });
    responses.push({ status: 200, body: page });

    await wiki.handleWikiToolCall({
      name: "update_wiki_page",
      arguments: { project_id: "1", slug: "00-map/infra-servers", title: "infra servers v2" },
    });

    assert.equal(requests.length, 2);
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[1].method, "PUT");
    assert.equal(requests[1].url, `a:${API_URL}/projects/1/wikis/00-map%2Finfra-servers`);
    assert.deepEqual(JSON.parse(requests[1].body ?? ""), { title: "00-map/infra servers v2" });
  });

  it("should return the success message after deleting a page", async () => {
    configure();
    reset();
    responses.push({ status: 204, body: null });

    const result = await wiki.handleWikiToolCall({
      name: "delete_wiki_page",
      arguments: { project_id: "1", slug: "home" },
    });

    assert.equal(requests[0].method, "DELETE");
    assert.deepEqual(result, {
      content: [
        {
          type: "text",
          text: JSON.stringify({ status: "success", message: "Wiki page deleted successfully" }),
        },
      ],
    });
  });

  it("should surface GitLab errors through the injected error handler", async () => {
    configure();
    reset();
    responses.push({ status: 404, body: { message: "404 Not Found" } });

    await assert.rejects(
      wiki.handleWikiToolCall({ name: "get_wiki_page", arguments: { project_id: "1", slug: "x" } }),
      /GitLab API error: 404/
    );
  });

  it("should use the fetch that is current at call time", async () => {
    configure();
    reset();
    responses.push({ status: 200, body: [page] }, { status: 200, body: [page] });

    await wiki.handleWikiToolCall({ name: "list_wiki_pages", arguments: { project_id: "1" } });
    currentFetch = recordingFetch("b");
    await wiki.handleWikiToolCall({ name: "list_wiki_pages", arguments: { project_id: "1" } });

    assert.deepEqual(
      requests.map(request => request.url.split(":")[0]),
      ["a", "b"]
    );
  });
});

describe("When the group wiki tools are called", () => {
  it("should apply the strict project scope guard before parsing the arguments", async () => {
    configure();
    reset();

    await assert.rejects(
      wiki.handleWikiToolCall({ name: "list_group_wiki_pages", arguments: {} }),
      /list_group_wiki_pages is not available/
    );

    assert.deepEqual(rejectedTools, ["list_group_wiki_pages"]);
    assert.equal(requests.length, 0);
  });

  it("should address the group wikis endpoint without the project allowlist", async () => {
    configure();
    reset();
    wiki.configureWikiTools({
      getFetch: () => currentFetch,
      handleGitLabError: async () => {},
      getEffectiveProjectId: projectId => {
        projectIdLookups.push(projectId);
        return projectId;
      },
      rejectIfStrictProjectScope: toolName => {
        rejectedTools.push(toolName);
      },
    });
    responses.push({ status: 204, body: null });

    const result = await wiki.handleWikiToolCall({
      name: "delete_group_wiki_page",
      arguments: { group_id: "my-group", slug: "home" },
    });

    assert.deepEqual(rejectedTools, ["delete_group_wiki_page"]);
    assert.deepEqual(projectIdLookups, []);
    assert.equal(requests[0].method, "DELETE");
    assert.equal(requests[0].url, `a:${API_URL}/groups/my-group/wikis/home`);
    assert.deepEqual(result, {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "success",
            message: "Group wiki page deleted successfully",
          }),
        },
      ],
    });
  });
});

describe("When a tool outside the wiki toolset is passed in", () => {
  it("should throw the unknown tool error", async () => {
    configure();
    await assert.rejects(
      wiki.handleWikiToolCall({ name: "list_labels", arguments: {} }),
      /Unknown tool: list_labels/
    );
  });
});
