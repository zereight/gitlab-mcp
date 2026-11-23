import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import {
  cleanupServers,
  findAvailablePort,
  HOST,
  launchServer,
  ServerInstance,
  TransportMode,
} from "./utils/server-launcher.js";
import { CustomHeaderClient } from "./clients/custom-header-client.js";

const MOCK_TOKEN = "glpat-ci-catalog-scope-token";
const SCOPE_HEADER = "x-gitlab-allowed-project-ids";

interface CatalogProject {
  projectId: number;
  fullPath: string;
  resourceGid: string;
  marker: string;
}

const ALLOWED: CatalogProject = {
  projectId: 11,
  fullPath: "allowed-group/components",
  resourceGid: "gid://gitlab/Ci::Catalog::Resource/1",
  marker: "ALLOWED",
};

const OTHER: CatalogProject = {
  projectId: 22,
  fullPath: "other-group/internal-components",
  resourceGid: "gid://gitlab/Ci::Catalog::Resource/2",
  marker: "OUT-OF-SCOPE",
};

// An allowlisted path that GitLab resolves to OTHER's catalog resource, as it can
// after a project is moved and the old path still redirects.
const MOVED_PATH = "allowed-group/moved-components";

const OUT_OF_SCOPE_DATA = /OUT-OF-SCOPE/;

interface GraphQLRequest {
  query: string;
  variables: Record<string, unknown>;
}

const graphqlRequests: GraphQLRequest[] = [];
const projectLookups: string[] = [];

function resetRequests(): void {
  graphqlRequests.length = 0;
  projectLookups.length = 0;
}

/** Queries that select version, README, and component data. */
function detailQueries(): GraphQLRequest[] {
  return graphqlRequests.filter(request => request.query.includes("versions("));
}

function catalogSummary(project: CatalogProject) {
  return {
    id: project.resourceGid,
    name: `${project.marker} components`,
    description: `${project.marker}-DESCRIPTION`,
    fullPath: project.fullPath,
    icon: null,
    starCount: 1,
    topics: [],
    verificationLevel: "UNVERIFIED",
    visibilityLevel: "private",
    webPath: `/${project.fullPath}`,
    latestReleasedAt: "2026-01-01T00:00:00Z",
    last30DayUsageCount: 1,
  };
}

function catalogResource(project: CatalogProject) {
  return {
    ...catalogSummary(project),
    versions: {
      nodes: [
        {
          id: `gid://gitlab/Ci::Catalog::Resources::Version/${project.projectId}`,
          name: "1.0.0",
          path: `/${project.fullPath}/-/releases/1.0.0`,
          createdAt: "2026-01-01T00:00:00Z",
          releasedAt: "2026-01-01T00:00:00Z",
          readme: `${project.marker}-README`,
          semver: { major: 1, minor: 0, patch: 0 },
          components: {
            nodes: [
              {
                id: `gid://gitlab/Ci::Catalog::Resources::Component/${project.projectId}`,
                name: "deploy",
                description: "Deploy",
                includePath: `$CI_SERVER_FQDN/${project.fullPath}/deploy@1.0.0`,
                last30DayUsageCount: 1,
                inputs: [
                  {
                    name: "host",
                    description: "Target host",
                    type: "STRING",
                    required: false,
                    default: `${project.marker}-INPUT-DEFAULT`,
                    options: null,
                    regex: null,
                  },
                ],
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  };
}

function findCatalogProject(variables: Record<string, unknown>): CatalogProject | undefined {
  if (typeof variables.id === "string") {
    return [ALLOWED, OTHER].find(project => project.resourceGid === variables.id);
  }
  if (variables.fullPath === MOVED_PATH) {
    return OTHER;
  }
  return [ALLOWED, OTHER].find(project => project.fullPath === variables.fullPath);
}

function addCatalogHandlers(gitlab: MockGitLabServer): void {
  gitlab.addRootHandler("post", "/api/graphql", (req, res) => {
    const body = req.body as { query?: unknown; variables?: Record<string, unknown> | null };
    const query = typeof body.query === "string" ? body.query : "";
    const variables = body.variables ?? {};
    graphqlRequests.push({ query, variables });

    if (query.includes("ciCatalogResources(")) {
      res.json({
        data: {
          ciCatalogResources: {
            nodes: [catalogSummary(ALLOWED), catalogSummary(OTHER)],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });
      return;
    }

    if (query.includes("ciCatalogResource(")) {
      const project = findCatalogProject(variables);
      res.json({ data: { ciCatalogResource: project ? catalogResource(project) : null } });
      return;
    }

    res.status(500).json({ message: "unexpected GraphQL query" });
  });

  const lookups: [string, CatalogProject][] = [
    [ALLOWED.fullPath, ALLOWED],
    [OTHER.fullPath, OTHER],
    [MOVED_PATH, OTHER],
  ];
  for (const [path, project] of lookups) {
    gitlab.addMockHandler("get", `/projects/${encodeURIComponent(path)}`, (_req, res) => {
      projectLookups.push(path);
      res.json({
        id: project.projectId,
        path_with_namespace: project.fullPath,
        name: `${project.marker} components`,
      });
    });
  }
}

interface ToolOutcome {
  isError: boolean;
  text: string;
}

function inheritedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of [
    "GITLAB_ALLOWED_PROJECT_IDS",
    "GITLAB_PROJECT_ID",
    "ENABLE_STRICT_PROJECT_SCOPE",
    "GITLAB_TOOLS",
    "GITLAB_TOOLSETS",
  ]) {
    delete env[key];
  }
  return env;
}

/** One stdio tools/call; resolves with the tool result and rejects on a JSON-RPC error. */
async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<ToolOutcome> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...inheritedEnv(), ...env },
    });

    proc.on("error", reject);

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (d: Buffer) => (output += d));
    proc.stderr?.on("data", (d: Buffer) => (errorOutput += d));

    proc.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        return;
      }
      const line = output.split("\n").find(l => l.startsWith("{"));
      if (!line) {
        reject(new Error("No JSON output found"));
        return;
      }
      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(new Error(response.error.message ?? JSON.stringify(response.error)));
          return;
        }
        const text = response.result?.content?.[0]?.text;
        resolve({
          isError: response.result?.isError === true,
          text: typeof text === "string" ? text : "",
        });
      } catch (error) {
        reject(error);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }) + "\n"
    );
  });
}

function assertAccessDenied(outcome: ToolOutcome): void {
  assert.equal(outcome.isError, true, `expected an isError result, got: ${outcome.text}`);
  assert.match(outcome.text, /Access denied/);
  assert.match(outcome.text, /allowed project list/);
  assert.doesNotMatch(outcome.text, OUT_OF_SCOPE_DATA);
}

function resourceFrom(text: string): { fullPath: string } {
  const parsed = JSON.parse(text) as { data?: { ciCatalogResource?: { fullPath: string } } };
  const resource = parsed.data?.ciCatalogResource;
  assert.ok(resource, "expected data.ciCatalogResource");
  return resource;
}

describe("CI/CD catalog tools and the project allowlist", { concurrency: 1 }, () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  const env = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "ci",
    GITLAB_DISABLE_VERSION_CHECK: "true",
    ...extra,
  });

  before(async () => {
    const port = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
    addCatalogHandlers(mockGitLab);
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  beforeEach(() => {
    resetRequests();
  });

  describe("get_ci_catalog_resource with GITLAB_ALLOWED_PROJECT_IDS", () => {
    test("refuses a full_path outside a path allowlist before any request", async () => {
      const outcome = await callTool(
        "get_ci_catalog_resource",
        { full_path: OTHER.fullPath, include_readme: true },
        env({ GITLAB_ALLOWED_PROJECT_IDS: ALLOWED.fullPath })
      );

      assertAccessDenied(outcome);
      assert.match(outcome.text, new RegExp(OTHER.fullPath));
      assert.equal(graphqlRequests.length, 0, "no GraphQL request may be sent");
      assert.deepEqual(projectLookups, []);
    });

    test("refuses a full_path whose project is outside a numeric allowlist", async () => {
      const outcome = await callTool(
        "get_ci_catalog_resource",
        { full_path: OTHER.fullPath, include_readme: true },
        env({ GITLAB_ALLOWED_PROJECT_IDS: String(ALLOWED.projectId) })
      );

      assertAccessDenied(outcome);
      assert.deepEqual(detailQueries(), [], "catalog details must not be requested");
    });

    test("refuses an id whose resource belongs to a project outside a path allowlist", async () => {
      const outcome = await callTool(
        "get_ci_catalog_resource",
        { id: OTHER.resourceGid, include_readme: true },
        env({ GITLAB_ALLOWED_PROJECT_IDS: ALLOWED.fullPath })
      );

      assertAccessDenied(outcome);
      assert.match(outcome.text, new RegExp(OTHER.fullPath));
      assert.deepEqual(detailQueries(), [], "catalog details must not be requested");
    });

    test("refuses an id whose resource belongs to a project outside a numeric allowlist", async () => {
      const outcome = await callTool(
        "get_ci_catalog_resource",
        { id: OTHER.resourceGid, include_readme: true },
        env({ GITLAB_ALLOWED_PROJECT_IDS: String(ALLOWED.projectId) })
      );

      assertAccessDenied(outcome);
      assert.deepEqual(detailQueries(), [], "catalog details must not be requested");
    });

    test("refuses an allowlisted path that resolves to another project", async () => {
      const outcome = await callTool(
        "get_ci_catalog_resource",
        { full_path: MOVED_PATH, include_readme: true },
        env({ GITLAB_ALLOWED_PROJECT_IDS: MOVED_PATH })
      );

      assertAccessDenied(outcome);
    });

    test("returns a resource allowed by full path", async () => {
      const outcome = await callTool(
        "get_ci_catalog_resource",
        { full_path: ALLOWED.fullPath, include_readme: true },
        env({ GITLAB_ALLOWED_PROJECT_IDS: `999,${ALLOWED.fullPath}` })
      );

      assert.equal(outcome.isError, false, outcome.text);
      assert.equal(resourceFrom(outcome.text).fullPath, ALLOWED.fullPath);
      assert.match(outcome.text, /ALLOWED-README/);
    });

    test("returns a resource allowed by numeric project id", async () => {
      const outcome = await callTool(
        "get_ci_catalog_resource",
        { full_path: ALLOWED.fullPath, include_readme: true },
        env({ GITLAB_ALLOWED_PROJECT_IDS: String(ALLOWED.projectId) })
      );

      assert.equal(outcome.isError, false, outcome.text);
      assert.equal(resourceFrom(outcome.text).fullPath, ALLOWED.fullPath);
    });

    test("returns a resource looked up by id when its project is allowed", async () => {
      const outcome = await callTool(
        "get_ci_catalog_resource",
        { id: ALLOWED.resourceGid },
        env({ GITLAB_ALLOWED_PROJECT_IDS: String(ALLOWED.projectId) })
      );

      assert.equal(outcome.isError, false, outcome.text);
      assert.equal(resourceFrom(outcome.text).fullPath, ALLOWED.fullPath);
    });

    test("strict scope does not refuse a resource of an allowed project", async () => {
      const outcome = await callTool(
        "get_ci_catalog_resource",
        { full_path: ALLOWED.fullPath },
        env({ GITLAB_ALLOWED_PROJECT_IDS: ALLOWED.fullPath, ENABLE_STRICT_PROJECT_SCOPE: "true" })
      );

      assert.equal(outcome.isError, false, outcome.text);
      assert.equal(resourceFrom(outcome.text).fullPath, ALLOWED.fullPath);
    });
  });

  describe("get_ci_catalog_resource without an allowlist", () => {
    test("reads any resource with a single request", async () => {
      const outcome = await callTool("get_ci_catalog_resource", { id: OTHER.resourceGid }, env());

      assert.equal(outcome.isError, false, outcome.text);
      assert.equal(resourceFrom(outcome.text).fullPath, OTHER.fullPath);
      assert.equal(graphqlRequests.length, 1);
      assert.deepEqual(projectLookups, []);
    });

    test("GITLAB_PROJECT_ID stays a default, not a lock", async () => {
      const outcome = await callTool(
        "get_ci_catalog_resource",
        { full_path: OTHER.fullPath },
        env({ GITLAB_PROJECT_ID: String(ALLOWED.projectId) })
      );

      assert.equal(outcome.isError, false, outcome.text);
      assert.equal(resourceFrom(outcome.text).fullPath, OTHER.fullPath);
    });
  });

  describe("list_ci_catalog_resources", () => {
    test("is refused under strict scope with an allowlist", async () => {
      await assert.rejects(
        callTool(
          "list_ci_catalog_resources",
          {},
          env({ GITLAB_ALLOWED_PROJECT_IDS: ALLOWED.fullPath, ENABLE_STRICT_PROJECT_SCOPE: "true" })
        ),
        /list_ci_catalog_resources is not allowed while a project allowlist is in effect/
      );
      assert.equal(graphqlRequests.length, 0);
    });

    test("is refused under strict scope with GITLAB_PROJECT_ID", async () => {
      await assert.rejects(
        callTool(
          "list_ci_catalog_resources",
          {},
          env({ GITLAB_PROJECT_ID: String(ALLOWED.projectId), ENABLE_STRICT_PROJECT_SCOPE: "true" })
        ),
        /list_ci_catalog_resources is not allowed when GITLAB_PROJECT_ID is set/
      );
      assert.equal(graphqlRequests.length, 0);
    });

    test("still lists without strict scope", async () => {
      const outcome = await callTool(
        "list_ci_catalog_resources",
        {},
        env({ GITLAB_ALLOWED_PROJECT_IDS: ALLOWED.fullPath })
      );

      assert.equal(outcome.isError, false, outcome.text);
      const parsed = JSON.parse(outcome.text) as {
        data: { ciCatalogResources: { nodes: { fullPath: string }[] } };
      };
      assert.deepEqual(
        parsed.data.ciCatalogResources.nodes.map(node => node.fullPath),
        [ALLOWED.fullPath, OTHER.fullPath]
      );
    });

    test("still lists under strict scope without an allowlist", async () => {
      const outcome = await callTool(
        "list_ci_catalog_resources",
        {},
        env({ ENABLE_STRICT_PROJECT_SCOPE: "true" })
      );

      assert.equal(outcome.isError, false, outcome.text);
    });
  });

  describe("get_ci_catalog_resource with a session project scope", () => {
    const servers: ServerInstance[] = [];
    let mcpUrl: string;

    before(async () => {
      const mcpPort = await findAvailablePort(3260);
      servers.push(
        await launchServer({
          mode: TransportMode.STREAMABLE_HTTP,
          port: mcpPort,
          timeout: 5000,
          env: {
            STREAMABLE_HTTP: "true",
            REMOTE_AUTHORIZATION: "true",
            ENABLE_DYNAMIC_PROJECT_SCOPE: "true",
            GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
            GITLAB_TOOLSETS: "ci",
            GITLAB_ALLOWED_PROJECT_IDS: "",
            GITLAB_PROJECT_ID: "",
            ENABLE_STRICT_PROJECT_SCOPE: "",
            GITLAB_DISABLE_VERSION_CHECK: "true",
          },
        })
      );
      mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    });

    after(() => {
      cleanupServers(servers);
    });

    async function withSession(
      scope: string | undefined,
      run: (client: CustomHeaderClient) => Promise<void>
    ): Promise<void> {
      const headers: Record<string, string> = { authorization: `Bearer ${MOCK_TOKEN}` };
      if (scope !== undefined) {
        headers[SCOPE_HEADER] = scope;
      }
      const client = new CustomHeaderClient(headers);
      await client.connect(mcpUrl);
      try {
        await run(client);
      } finally {
        await client.disconnect();
      }
    }

    function outcomeOf(result: CallToolResult): ToolOutcome {
      const first = result.content[0];
      return {
        isError: result.isError === true,
        text: first !== undefined && first.type === "text" ? first.text : "",
      };
    }

    test("a path scope refuses a full_path outside it and allows its own project", async () => {
      await withSession(ALLOWED.fullPath, async client => {
        const denied = await client.callTool("get_ci_catalog_resource", {
          full_path: OTHER.fullPath,
          include_readme: true,
        });
        assertAccessDenied(outcomeOf(denied));
        assert.deepEqual(detailQueries(), [], "catalog details must not be requested");

        const allowed = await client.callTool("get_ci_catalog_resource", {
          full_path: ALLOWED.fullPath,
        });
        const outcome = outcomeOf(allowed);
        assert.equal(outcome.isError, false, outcome.text);
        assert.equal(resourceFrom(outcome.text).fullPath, ALLOWED.fullPath);
      });
    });

    test("a numeric scope refuses an id lookup of another project", async () => {
      await withSession(String(ALLOWED.projectId), async client => {
        const denied = await client.callTool("get_ci_catalog_resource", {
          id: OTHER.resourceGid,
          include_readme: true,
        });
        assertAccessDenied(outcomeOf(denied));
        assert.deepEqual(detailQueries(), [], "catalog details must not be requested");
      });
    });

    test("an unscoped session stays unrestricted", async () => {
      await withSession(undefined, async client => {
        const result = await client.callTool("get_ci_catalog_resource", {
          full_path: OTHER.fullPath,
        });
        const outcome = outcomeOf(result);
        assert.equal(outcome.isError, false, outcome.text);
        assert.equal(resourceFrom(outcome.text).fullPath, OTHER.fullPath);
      });
    });
  });
});
