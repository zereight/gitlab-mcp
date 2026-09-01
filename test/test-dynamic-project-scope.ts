import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import {
  cleanupServers,
  findAvailablePort,
  HOST,
  launchServer,
  ServerInstance,
  TransportMode,
} from "./utils/server-launcher.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import { CustomHeaderClient } from "./clients/custom-header-client.js";

const MOCK_TOKEN = "glpat-dynamic-scope-token";
const SCOPE_HEADER = "x-gitlab-allowed-project-ids";

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
        await assert.rejects(
          () => client.callTool("get_project", { project_id: "2" }),
          /Access denied/
        );
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
        await assert.rejects(
          () => client.callTool("get_project", { project_id: "8" }),
          /Access denied/
        );
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
        await assert.rejects(
          () => client.callTool("get_vulnerability", { vulnerability_id: "42" }),
          /Access denied/
        );
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
