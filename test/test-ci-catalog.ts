import { after, before, describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "mock-ci-catalog-token";

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
        SSE: "false",
        STREAMABLE_HTTP: "false",
        REMOTE_AUTHORIZATION: "false",
        GITLAB_MCP_OAUTH: "false",
      },
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

      try {
        const line = output.split("\n").find(l => l.startsWith("{"));
        if (!line) {
          reject(new Error("No JSON output found"));
          return;
        }

        const response = JSON.parse(line);
        if (response.error) {
          reject(new Error(response.error.message ?? JSON.stringify(response.error)));
          return;
        }

        const content = response.result?.content?.[0]?.text;
        resolve(content ? JSON.parse(content) : response.result);
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

describe("CI/CD Catalog tools", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  const env = () => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
  });

  before(async () => {
    const port = await findMockServerPort(9000);
    mockGitLab = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
    mockGitLab.addRootHandler("post", "/api/graphql", (req, res) => {
      if (req.body.query.includes("ListCiCatalogResources")) {
        assert.strictEqual(req.body.variables.search, "docker");
        res.json({
          data: {
            ciCatalogResources: {
              nodes: [
                {
                  id: "gid://gitlab/Ci::Catalog::Resource/1",
                  name: "Docker",
                  description: "Build Docker images",
                  fullPath: "components/docker",
                  icon: null,
                  starCount: 3,
                  topics: ["ci"],
                  verificationLevel: "UNVERIFIED",
                  visibilityLevel: "public",
                  webPath: "/components/docker",
                  latestReleasedAt: "2026-01-01T00:00:00Z",
                  last30DayUsageCount: 7,
                },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });
        return;
      }

      res.json({
        data: {
          ciCatalogResource: {
            id: "gid://gitlab/Ci::Catalog::Resource/1",
            name: "Docker",
            description: "Build Docker images",
            fullPath: "components/docker",
            icon: null,
            starCount: 3,
            topics: ["ci"],
            verificationLevel: "UNVERIFIED",
            visibilityLevel: "public",
            webPath: "/components/docker",
            latestReleasedAt: "2026-01-01T00:00:00Z",
            last30DayUsageCount: 7,
            versions: {
              nodes: [
                {
                  id: "gid://gitlab/Ci::Catalog::Resources::Version/1",
                  name: "1.0.0",
                  path: "/components/docker/-/releases/1.0.0",
                  createdAt: "2026-01-01T00:00:00Z",
                  releasedAt: "2026-01-01T00:00:00Z",
                  semver: { major: 1, minor: 0, patch: 0 },
                  components: {
                    nodes: [
                      {
                        id: "gid://gitlab/Ci::Catalog::Resources::Component/1",
                        name: "build",
                        description: "Build an image",
                        includePath: "components/docker/build@1.0.0",
                        last30DayUsageCount: 4,
                        inputs: [
                          {
                            name: "image",
                            description: "Image name",
                            type: "STRING",
                            required: true,
                            default: null,
                            options: null,
                            regex: null,
                          },
                        ],
                      },
                      {
                        id: "gid://gitlab/Ci::Catalog::Resources::Component/2",
                        name: "scan",
                        description: "Scan an image",
                        includePath: "components/docker/scan@1.0.0",
                        last30DayUsageCount: 2,
                        inputs: [],
                      },
                    ],
                    pageInfo: { hasNextPage: false, endCursor: null },
                  },
                },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      });
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("list_ci_catalog_resources calls GitLab GraphQL", async () => {
    const result = await callTool("list_ci_catalog_resources", { search: "docker" }, env());
    const resource = result.data.ciCatalogResources.nodes[0];
    assert.strictEqual(resource.name, "Docker");
    assert.strictEqual(resource.fullPath, "components/docker");
  });

  test("get_ci_catalog_resource can filter returned components by name", async () => {
    const result = await callTool(
      "get_ci_catalog_resource",
      { full_path: "components/docker", component_name: "build" },
      env()
    );
    const components = result.data.ciCatalogResource.versions.nodes[0].components.nodes;
    assert.strictEqual(components.length, 1);
    assert.strictEqual(components[0].name, "build");
    assert.strictEqual(components[0].inputs[0].name, "image");
  });

  test("get_ci_catalog_resource rejects empty identity values", async () => {
    await assert.rejects(
      () => callTool("get_ci_catalog_resource", { full_path: "" }, env()),
      /full_path|Too small|minLength|invalid/i
    );
  });

  test("get_ci_catalog_resource rejects multiple identity values", async () => {
    await assert.rejects(
      () =>
        callTool(
          "get_ci_catalog_resource",
          { id: "gid://gitlab/Ci::Catalog::Resource/1", full_path: "components/docker" },
          env()
        ),
      /exactly one|id|full_path/i
    );
  });
});
