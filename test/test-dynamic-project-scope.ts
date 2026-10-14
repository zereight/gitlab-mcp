import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { randomBytes } from "node:crypto";
import {
  cleanupServers,
  findAvailablePort,
  HOST,
  launchServer,
  ServerInstance,
  TransportMode,
} from "./utils/server-launcher.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CustomHeaderClient } from "./clients/custom-header-client.js";

const MOCK_TOKEN = "glpat-dynamic-scope-token";
const SCOPE_HEADER = "x-gitlab-allowed-project-ids";

function assertProjectAllowlistDenial(result: CallToolResult): void {
  assert.strictEqual(result.isError, true);
  const first = result.content[0];
  assert.ok(first !== undefined && first.type === "text");
  assert.match(first.text, /Access denied/);
  assert.match(first.text, /allowed project list/);
}

function parseToolJson(result: CallToolResult): unknown {
  assert.ok(result.isError !== true, "tool should succeed");
  const first = result.content[0];
  assert.ok(first !== undefined && first.type === "text");
  return JSON.parse(first.text);
}

function snippetTitleFrom(value: unknown): string {
  if (value === null || typeof value !== "object" || !("title" in value)) {
    assert.fail("expected a snippet object with title");
  }
  const title = value.title;
  if (typeof title !== "string") {
    assert.fail("expected snippet title to be a string");
  }
  return title;
}

async function connectClient(mcpUrl: string, scope?: string): Promise<CustomHeaderClient> {
  const headers: Record<string, string> = { authorization: `Bearer ${MOCK_TOKEN}` };
  if (scope !== undefined) {
    headers[SCOPE_HEADER] = scope;
  }
  const client = new CustomHeaderClient(headers);
  await client.connect(mcpUrl);
  return client;
}

async function getProjectId(client: CustomHeaderClient, projectId: string): Promise<string> {
  const result = await client.callTool("get_project", { project_id: projectId });
  assert.ok(result.content, "Should have content");
  const content = result.content[0];
  assert.ok("text" in content, "Content should have text");
  const project = JSON.parse(content.text as string);
  return project.id.toString();
}

describe("Dynamic project scope", { concurrency: 1 }, () => {
  describe("with GITLAB_ALLOWED_PROJECT_IDS set", () => {
    let mockGitLab: MockGitLabServer;
    const servers: ServerInstance[] = [];
    let mcpUrl: string;

    before(async () => {
      const mockPort = await findMockServerPort();
      mockGitLab = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
      mockGitLab.addMockHandler("get", "/projects", (req, res) => {
        if (req.query.search === "no-totals") {
          const requestedPage = Number(req.query.page ?? "1");
          if (requestedPage < 3) {
            res.set("x-next-page", String(requestedPage + 1));
          }
        } else {
          res.set("x-total", "3");
          res.set("x-total-pages", "2");
        }
        res.json(
          ["1", "2", "3"].map(id => ({
            id: Number(id),
            name: `Project ${id}`,
            path: `project-${id}`,
            path_with_namespace: `group/project-${id}`,
            description: null,
            visibility: "private",
            namespace: { id: 1, name: "Group", path: "group", kind: "group", full_path: "group" },
          }))
        );
      });
      await mockGitLab.start();

      const mcpPort = await findAvailablePort(3200);
      const server = await launchServer({
        mode: TransportMode.STREAMABLE_HTTP,
        port: mcpPort,
        timeout: 5000,
        env: {
          STREAMABLE_HTTP: "true",
          REMOTE_AUTHORIZATION: "true",
          ENABLE_DYNAMIC_PROJECT_SCOPE: "true",
          ENABLE_STRICT_PROJECT_SCOPE: "true",
          GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
          GITLAB_TOOLS: "execute_graphql,list_todos",
          GITLAB_ALLOWED_PROJECT_IDS: "1,2",
        },
      });
      servers.push(server);
      mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    });

    after(async () => {
      cleanupServers(servers);
      await mockGitLab?.stop();
    });

    test("header narrows the allowlist to the requested projects", async () => {
      const client = await connectClient(mcpUrl, "1");
      try {
        assert.strictEqual(await getProjectId(client, ""), "1");
        const denied = await client.callTool("get_project", { project_id: "2" });
        assertProjectAllowlistDenial(denied);
      } finally {
        await client.disconnect();
      }
    });

    test("project outside GITLAB_ALLOWED_PROJECT_IDS rejects the session", async () => {
      const client = new CustomHeaderClient({
        authorization: `Bearer ${MOCK_TOKEN}`,
        [SCOPE_HEADER]: "1,3",
      });

      let connected = false;
      try {
        await client.connect(mcpUrl);
        connected = true;
        await client.callTool("get_project", { project_id: "1" });
      } catch {
        // Expected: the session is rejected before any tool call is possible.
      } finally {
        await client.disconnect();
      }

      assert.strictEqual(connected, false, "out-of-scope header must not initialize a session");
    });

    test("empty header rejects the session", async () => {
      const client = new CustomHeaderClient({
        authorization: `Bearer ${MOCK_TOKEN}`,
        [SCOPE_HEADER]: "  ",
      });

      let connected = false;
      try {
        await client.connect(mcpUrl);
        connected = true;
        await client.callTool("get_project", { project_id: "1" });
      } catch {
        // Expected: the session is rejected before any tool call is possible.
      } finally {
        await client.disconnect();
      }

      assert.strictEqual(connected, false, "an empty header must not initialize a session");
    });

    test("scoped session refuses non-scopable tools", async () => {
      const client = await connectClient(mcpUrl, "1");
      try {
        await assert.rejects(
          () => client.callTool("execute_graphql", { query: "query { currentUser { id } }" }),
          /not allowed while a project allowlist is in effect/
        );
      } finally {
        await client.disconnect();
      }
    });

    test("session without the header keeps the full env allowlist", async () => {
      const client = await connectClient(mcpUrl);
      try {
        assert.strictEqual(await getProjectId(client, "2"), "2");
      } finally {
        await client.disconnect();
      }
    });

    test("list_issues without project_id stays within the session scope", async () => {
      const client = await connectClient(mcpUrl, "1");
      try {
        const result = await client.callTool("list_issues", {});
        assert.ok(result.content, "Should have content");
        const content = result.content[0];
        assert.ok("text" in content, "Content should have text");
        const issues = JSON.parse(content.text as string) as { web_url: string }[];
        assert.ok(
          issues.every(issue => issue.web_url.includes("/project/1/")),
          "Should only return issues of the scoped project"
        );
      } finally {
        await client.disconnect();
      }
    });

    test("list_todos is refused under strict scope", async () => {
      const client = await connectClient(mcpUrl, "1");
      try {
        await assert.rejects(
          () => client.callTool("list_todos", {}),
          /not allowed while a project allowlist is in effect/
        );
      } finally {
        await client.disconnect();
      }
    });

    test("search_repositories keeps the unfiltered pagination totals", async () => {
      const client = await connectClient(mcpUrl, "1");
      try {
        const result = await client.callTool("search_repositories", { search: "project" });
        assert.ok(result.content, "Should have content");
        const content = result.content[0];
        assert.ok("text" in content, "Content should have text");
        const search = JSON.parse(content.text as string) as {
          count: number;
          total_pages: number;
          items: { id: string }[];
        };
        assert.deepStrictEqual(
          search.items.map(item => item.id),
          ["1"]
        );
        assert.strictEqual(search.count, 3, "count must reflect the unfiltered GitLab total");
        assert.strictEqual(search.total_pages, 2, "total_pages must cover the unfiltered pages");
      } finally {
        await client.disconnect();
      }
    });

    test("search_repositories follows next_page across all pages when totals are missing", async () => {
      const client = await connectClient(mcpUrl, "1");
      try {
        let page: number | undefined = 1;
        const visited: number[] = [];
        while (page !== undefined) {
          const result = await client.callTool("search_repositories", {
            search: "no-totals",
            page,
          });
          assert.ok(result.content, "Should have content");
          const content = result.content[0];
          assert.ok("text" in content, "Content should have text");
          const search = JSON.parse(content.text as string) as {
            total_pages?: number;
            next_page?: number;
            current_page: number;
            items: { id: string }[];
          };
          assert.strictEqual(search.total_pages, undefined, "total_pages must stay unset");
          assert.deepStrictEqual(
            search.items.map(item => item.id),
            ["1"]
          );
          visited.push(search.current_page);
          page = search.next_page;
        }
        assert.deepStrictEqual(visited, [1, 2, 3], "next_page must make every page reachable");
      } finally {
        await client.disconnect();
      }
    });

    test("list_projects is filtered to the session scope", async () => {
      const client = await connectClient(mcpUrl, "1");
      try {
        const result = await client.callTool("list_projects", {});
        assert.ok(result.content, "Should have content");
        const content = result.content[0];
        assert.ok("text" in content, "Content should have text");
        const projects = JSON.parse(content.text as string) as { id: string }[];
        assert.deepStrictEqual(
          projects.map(project => project.id),
          ["1"]
        );
      } finally {
        await client.disconnect();
      }
    });

    test("list_projects is filtered to the env allowlist without the header", async () => {
      const client = await connectClient(mcpUrl);
      try {
        const result = await client.callTool("list_projects", {});
        assert.ok(result.content, "Should have content");
        const content = result.content[0];
        assert.ok("text" in content, "Content should have text");
        const projects = JSON.parse(content.text as string) as { id: string }[];
        assert.deepStrictEqual(
          projects.map(project => project.id),
          ["1", "2"]
        );
      } finally {
        await client.disconnect();
      }
    });
  });

  describe("without GITLAB_ALLOWED_PROJECT_IDS", () => {
    let mockGitLab: MockGitLabServer;
    const servers: ServerInstance[] = [];
    let mcpUrl: string;

    before(async () => {
      const mockPort = await findMockServerPort();
      mockGitLab = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
      mockGitLab.addRootHandler("post", "/api/graphql", (req, res) => {
        const { query } = req.body as { query: string };
        if (query.includes("vulnerability(")) {
          res.json({
            data: {
              vulnerability: {
                id: "gid://gitlab/Vulnerability/42",
                title: "Mock vulnerability",
                project: {
                  id: "gid://gitlab/Project/8",
                  name: "Other project",
                  fullPath: "other/project",
                },
              },
            },
          });
          return;
        }
        res.status(500).json({ message: `Unexpected GraphQL query: ${query}` });
      });
      await mockGitLab.start();

      const mcpPort = await findAvailablePort(3200);
      const server = await launchServer({
        mode: TransportMode.STREAMABLE_HTTP,
        port: mcpPort,
        timeout: 5000,
        env: {
          STREAMABLE_HTTP: "true",
          REMOTE_AUTHORIZATION: "true",
          ENABLE_DYNAMIC_PROJECT_SCOPE: "true",
          GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
          GITLAB_TOOLS: "execute_graphql,get_vulnerability",
        },
      });
      servers.push(server);
      mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    });

    after(async () => {
      cleanupServers(servers);
      await mockGitLab?.stop();
    });

    test("header bounds an otherwise unrestricted server", async () => {
      const client = await connectClient(mcpUrl, "7");
      try {
        assert.strictEqual(await getProjectId(client, ""), "7");
        const denied = await client.callTool("get_project", { project_id: "8" });
        assertProjectAllowlistDenial(denied);
        await assert.rejects(
          () => client.callTool("execute_graphql", { query: "query { currentUser { id } }" }),
          /not allowed while a project allowlist is in effect/
        );
      } finally {
        await client.disconnect();
      }
    });

    test("session without the header stays unrestricted", async () => {
      const client = await connectClient(mcpUrl);
      try {
        assert.strictEqual(await getProjectId(client, "8"), "8");
      } finally {
        await client.disconnect();
      }
    });

    test("scoped session cannot reach vulnerabilities of other projects", async () => {
      const client = await connectClient(mcpUrl, "7");
      try {
        const denied = await client.callTool("get_vulnerability", { vulnerability_id: "42" });
        assertProjectAllowlistDenial(denied);
      } finally {
        await client.disconnect();
      }
    });

    test("unscoped session can reach vulnerabilities", async () => {
      const client = await connectClient(mcpUrl);
      try {
        const result = await client.callTool("get_vulnerability", { vulnerability_id: "42" });
        assert.ok(result.content, "Should have content");
        const content = result.content[0];
        assert.ok("text" in content, "Content should have text");
        const vulnerability = JSON.parse(content.text as string);
        assert.strictEqual(vulnerability.project.fullPath, "other/project");
      } finally {
        await client.disconnect();
      }
    });
  });

  describe("with session-scoped snippet tools", () => {
    let mockGitLab: MockGitLabServer;
    const servers: ServerInstance[] = [];
    let mcpUrl: string;
    const snippetHits: string[] = [];

    before(async () => {
      const mockPort = await findMockServerPort();
      mockGitLab = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
      mockGitLab.addMockHandler("get", "/snippets", (_req, res) => {
        snippetHits.push("personal:list");
        res.json([{ id: 99, title: "personal snippet of the token owner" }]);
      });
      mockGitLab.addMockHandler("get", "/projects/5/snippets", (_req, res) => {
        snippetHits.push("project:list");
        res.json([{ id: 42, title: "project snippet" }]);
      });
      mockGitLab.addMockHandler("get", "/projects/5/snippets/42", (_req, res) => {
        snippetHits.push("project:get");
        res.json({ id: 42, title: "project snippet" });
      });
      mockGitLab.addMockHandler("get", "/snippets/42", (_req, res) => {
        snippetHits.push("personal:get");
        res.json({ id: 42, title: "personal snippet of the token owner" });
      });
      mockGitLab.addMockHandler("delete", "/snippets/99", (_req, res) => {
        snippetHits.push("personal:delete");
        res.status(204).end();
      });
      mockGitLab.addMockHandler("delete", "/projects/5/snippets/42", (_req, res) => {
        snippetHits.push("project:delete");
        res.status(204).end();
      });
      mockGitLab.addMockHandler("post", "/snippets", (_req, res) => {
        snippetHits.push("personal:create");
        res.json({ id: 99, title: "personal snippet of the token owner" });
      });
      mockGitLab.addMockHandler("post", "/projects/5/snippets", (_req, res) => {
        snippetHits.push("project:create");
        res.json({ id: 42, title: "project snippet" });
      });
      mockGitLab.addMockHandler("put", "/snippets/42", (_req, res) => {
        snippetHits.push("personal:update");
        res.json({ id: 42, title: "updated personal snippet" });
      });
      mockGitLab.addMockHandler("put", "/projects/5/snippets/42", (_req, res) => {
        snippetHits.push("project:update");
        res.json({ id: 42, title: "updated project snippet" });
      });
      await mockGitLab.start();

      const mcpPort = await findAvailablePort(3200);
      const server = await launchServer({
        mode: TransportMode.STREAMABLE_HTTP,
        port: mcpPort,
        timeout: 5000,
        env: {
          STREAMABLE_HTTP: "true",
          REMOTE_AUTHORIZATION: "true",
          ENABLE_DYNAMIC_PROJECT_SCOPE: "true",
          GITLAB_TOOLSETS: "snippets",
          GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        },
      });
      servers.push(server);
      mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    });

    after(async () => {
      cleanupServers(servers);
      await mockGitLab?.stop();
    });

    test("list_snippets without project_id stays within the session scope", async () => {
      snippetHits.length = 0;
      const client = await connectClient(mcpUrl, "5");
      try {
        const result = await client.callTool("list_snippets", {});
        assert.ok(result.content, "Should have content");
        const content = result.content[0];
        assert.ok("text" in content, "Content should have text");
        const snippets = JSON.parse(content.text as string) as { title: string }[];
        assert.strictEqual(snippets[0].title, "project snippet");
      } finally {
        await client.disconnect();
      }
      assert.deepStrictEqual(
        snippetHits,
        ["project:list"],
        "must route to the scoped project, not the personal /snippets endpoint"
      );
    });

    test("delete_snippet without project_id stays within the session scope", async () => {
      snippetHits.length = 0;
      const client = await connectClient(mcpUrl, "5");
      try {
        await client.callTool("delete_snippet", { snippet_id: 42 });
      } finally {
        await client.disconnect();
      }
      assert.deepStrictEqual(
        snippetHits,
        ["project:delete"],
        "must route to the scoped project, not the personal /snippets endpoint"
      );
    });

    test("get_snippet without project_id stays within the session scope", async () => {
      snippetHits.length = 0;
      const client = await connectClient(mcpUrl, "5");
      try {
        const result = await client.callTool("get_snippet", { snippet_id: 42 });
        assert.ok(result.content, "Should have content");
        const content = result.content[0];
        assert.ok("text" in content, "Content should have text");
        const snippet = JSON.parse(content.text as string) as { title: string };
        assert.strictEqual(snippet.title, "project snippet");
      } finally {
        await client.disconnect();
      }
      assert.deepStrictEqual(
        snippetHits,
        ["project:get"],
        "must route to the scoped project, not the personal /snippets endpoint"
      );
    });

    test("create_snippet without project_id stays within the session scope", async () => {
      snippetHits.length = 0;
      const client = await connectClient(mcpUrl, "5");
      try {
        const result = await client.callTool("create_snippet", {
          title: "scoped create",
          file_name: "note.md",
          content: "hi",
        });
        assert.strictEqual(snippetTitleFrom(parseToolJson(result)), "project snippet");
      } finally {
        await client.disconnect();
      }
      assert.deepStrictEqual(
        snippetHits,
        ["project:create"],
        "must route to the scoped project, not the personal /snippets endpoint"
      );
    });

    test("update_snippet without project_id stays within the session scope", async () => {
      snippetHits.length = 0;
      const client = await connectClient(mcpUrl, "5");
      try {
        const result = await client.callTool("update_snippet", {
          snippet_id: 42,
          title: "scoped update",
        });
        assert.strictEqual(snippetTitleFrom(parseToolJson(result)), "updated project snippet");
      } finally {
        await client.disconnect();
      }
      assert.deepStrictEqual(
        snippetHits,
        ["project:update"],
        "must route to the scoped project, not the personal /snippets endpoint"
      );
    });
  });

  describe("scope stays bound to the session", () => {
    const ROTATED_TOKEN = "glpat-dynamic-scope-token-rotated";
    let mockGitLab: MockGitLabServer;
    const servers: ServerInstance[] = [];
    let statelessUrl: string;
    let statefulUrl: string;

    interface PostResult {
      status: number;
      sid: string | null;
      json: { result?: CallToolResult } | undefined;
    }

    async function post(
      url: string,
      body: Record<string, unknown>,
      headers: Record<string, string>
    ): Promise<PostResult> {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...headers,
        },
        body: JSON.stringify({ jsonrpc: "2.0", ...body }),
      });
      const text = await res.text();
      const data = text.split("\n").find(line => line.startsWith("data:"));
      const payload = data ? data.slice("data:".length) : text;
      return {
        status: res.status,
        sid: res.headers.get("mcp-session-id"),
        json: payload ? JSON.parse(payload) : undefined,
      };
    }

    function auth(token = MOCK_TOKEN, scope?: string): Record<string, string> {
      const headers: Record<string, string> = { authorization: `Bearer ${token}` };
      if (scope !== undefined) {
        headers[SCOPE_HEADER] = scope;
      }
      return headers;
    }

    async function initSession(url: string, headers: Record<string, string>): Promise<string> {
      const res = await post(
        url,
        {
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "scope-binding-test", version: "1.0.0" },
          },
        },
        headers
      );
      assert.strictEqual(res.status, 200);
      assert.ok(res.sid, "initialize must return an Mcp-Session-Id");
      await post(
        url,
        { method: "notifications/initialized" },
        { ...headers, "mcp-session-id": res.sid }
      );
      return res.sid;
    }

    function getProject(
      url: string,
      projectId: string,
      headers: Record<string, string>
    ): Promise<PostResult> {
      return post(
        url,
        {
          id: 2,
          method: "tools/call",
          params: { name: "get_project", arguments: { project_id: projectId } },
        },
        headers
      );
    }

    function assertDenied(res: PostResult): void {
      assert.strictEqual(res.status, 200);
      assert.ok(res.json?.result, "expected a tool result");
      assertProjectAllowlistDenial(res.json.result);
    }

    before(async () => {
      const mockPort = await findMockServerPort();
      mockGitLab = new MockGitLabServer({
        port: mockPort,
        validTokens: [MOCK_TOKEN, ROTATED_TOKEN],
      });
      await mockGitLab.start();

      const env = {
        STREAMABLE_HTTP: "true",
        REMOTE_AUTHORIZATION: "true",
        ENABLE_DYNAMIC_PROJECT_SCOPE: "true",
        GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        GITLAB_ALLOWED_PROJECT_IDS: "1,2",
      };

      const statelessPort = await findAvailablePort(3200);
      servers.push(
        await launchServer({
          mode: TransportMode.STREAMABLE_HTTP,
          port: statelessPort,
          timeout: 5000,
          env: {
            ...env,
            OAUTH_STATELESS_MODE: "true",
            OAUTH_STATELESS_SECRET: randomBytes(32).toString("base64url"),
          },
        })
      );
      statelessUrl = `http://${HOST}:${statelessPort}/mcp`;

      const statefulPort = await findAvailablePort(3200);
      servers.push(
        await launchServer({
          mode: TransportMode.STREAMABLE_HTTP,
          port: statefulPort,
          timeout: 5000,
          env,
        })
      );
      statefulUrl = `http://${HOST}:${statefulPort}/mcp`;
    });

    after(async () => {
      cleanupServers(servers);
      await mockGitLab?.stop();
    });

    test("stateless: omitting the header keeps the sealed scope", async () => {
      const sid = await initSession(statelessUrl, auth(MOCK_TOKEN, "1"));
      const res = await getProject(statelessUrl, "2", { ...auth(), "mcp-session-id": sid });
      assertDenied(res);

      assert.ok(res.sid, "response must carry a rotated sid");
      assertDenied(await getProject(statelessUrl, "2", { "mcp-session-id": res.sid }));
    });

    test("stateless: a different header is rejected", async () => {
      const sid = await initSession(statelessUrl, auth(MOCK_TOKEN, "1"));
      const res = await getProject(statelessUrl, "2", {
        ...auth(MOCK_TOKEN, "2"),
        "mcp-session-id": sid,
      });
      assert.strictEqual(res.status, 401);
    });

    test("stateless: the same header keeps working", async () => {
      const sid = await initSession(statelessUrl, auth(MOCK_TOKEN, "1"));
      const res = await getProject(statelessUrl, "1", {
        ...auth(MOCK_TOKEN, "1"),
        "mcp-session-id": sid,
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.json?.result);
      const project = parseToolJson(res.json.result) as { id: number };
      assert.strictEqual(project.id, 1);
    });

    test("stateless: a refreshed token keeps the sealed scope", async () => {
      const sid = await initSession(statelessUrl, auth(MOCK_TOKEN, "1"));
      assertDenied(
        await getProject(statelessUrl, "2", { ...auth(ROTATED_TOKEN), "mcp-session-id": sid })
      );
    });

    test("stateless: an unscoped session can be narrowed, and stays narrowed", async () => {
      const sid = await initSession(statelessUrl, auth());
      const res = await getProject(statelessUrl, "2", {
        ...auth(MOCK_TOKEN, "1"),
        "mcp-session-id": sid,
      });
      assertDenied(res);

      assert.ok(res.sid, "response must carry a rotated sid");
      assertDenied(await getProject(statelessUrl, "2", { ...auth(), "mcp-session-id": res.sid }));
    });

    test("stateful: an unscoped session can be narrowed, and stays narrowed", async () => {
      const sid = await initSession(statefulUrl, auth());
      assertDenied(
        await getProject(statefulUrl, "2", { ...auth(MOCK_TOKEN, "1"), "mcp-session-id": sid })
      );
      assertDenied(await getProject(statefulUrl, "2", { ...auth(), "mcp-session-id": sid }));
    });

    test("stateful: a refreshed token keeps the session scope", async () => {
      const sid = await initSession(statefulUrl, auth(MOCK_TOKEN, "1"));
      assertDenied(
        await getProject(statefulUrl, "2", { ...auth(ROTATED_TOKEN), "mcp-session-id": sid })
      );
    });

    test("stateful: a different header is rejected", async () => {
      const sid = await initSession(statefulUrl, auth(MOCK_TOKEN, "1"));
      const res = await getProject(statefulUrl, "2", {
        ...auth(ROTATED_TOKEN, "2"),
        "mcp-session-id": sid,
      });
      assert.strictEqual(res.status, 401);
    });
  });

  describe("with ENABLE_DYNAMIC_PROJECT_SCOPE disabled", () => {
    let mockGitLab: MockGitLabServer;
    const servers: ServerInstance[] = [];
    let mcpUrl: string;

    before(async () => {
      const mockPort = await findMockServerPort();
      mockGitLab = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
      await mockGitLab.start();

      const mcpPort = await findAvailablePort(3200);
      const server = await launchServer({
        mode: TransportMode.STREAMABLE_HTTP,
        port: mcpPort,
        timeout: 5000,
        env: {
          STREAMABLE_HTTP: "true",
          REMOTE_AUTHORIZATION: "true",
          GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        },
      });
      servers.push(server);
      mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    });

    after(async () => {
      cleanupServers(servers);
      await mockGitLab?.stop();
    });

    test("header is ignored when the feature flag is off", async () => {
      const client = await connectClient(mcpUrl, "1");
      try {
        assert.strictEqual(await getProjectId(client, "2"), "2");
      } finally {
        await client.disconnect();
      }
    });
  });
});
