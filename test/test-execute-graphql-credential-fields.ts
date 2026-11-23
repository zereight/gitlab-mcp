/**
 * execute_graphql must not return credential fields. A pipeline trigger's `token` (and a
 * new runner's `ephemeralAuthenticationToken`) is dropped by the REST tools; a query that
 * selects one, under any alias or inside a fragment, is refused before it is sent. An
 * alias named `token` on a safe field is not a credential and keeps its value.
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import { StdioTestClient } from "./clients/stdio-client.js";

const MOCK_TOKEN = "glpat-graphql-credential-test-token";
const TRIGGER_TOKEN = "glptt-TRIGGER-SECRET-4410";

describe("execute_graphql credential fields", () => {
  let mockGitLab: MockGitLabServer;
  let client: StdioTestClient;
  let graphqlRequests = 0;

  before(async () => {
    mockGitLab = new MockGitLabServer({
      port: await findMockServerPort(),
      validTokens: [MOCK_TOKEN],
    });
    // Answers like GitLab: only the selected fields, under the caller's aliases.
    mockGitLab.addRootHandler("post", "/api/graphql", (req, res) => {
      graphqlRequests++;
      const query = String(req.body?.query ?? "");
      if (query.includes("token: currentUser")) {
        res.json({ data: { token: { username: "safe-user" } } });
        return;
      }
      if (query.includes("token: id")) {
        res.json({
          data: {
            project: { pipelineTriggers: { nodes: [{ token: "gid://gitlab/Ci::Trigger/1" }] } },
          },
        });
        return;
      }
      res.json({
        data: {
          project: {
            pipelineTriggers: { nodes: [{ id: "gid://gitlab/Ci::Trigger/1", description: "d" }] },
          },
        },
      });
    });
    await mockGitLab.start();

    client = new StdioTestClient();
    await client.connect("build/index.js", {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_TOOLS: "execute_graphql",
      GITLAB_PROJECT_ID: "",
      GITLAB_ALLOWED_PROJECT_IDS: "",
      GITLAB_PERMISSION_MODE: "readonly",
      GITLAB_DISABLE_VERSION_CHECK: "true",
    });
  });

  after(async () => {
    await client?.disconnect();
    await mockGitLab.stop();
  });

  async function run(query: string): Promise<{ isError: boolean; text: string }> {
    try {
      const result = await client.callTool("execute_graphql", { query });
      const text = (result.content as Array<{ text?: string }>)
        .map(part => part.text ?? "")
        .join("");
      return { isError: result.isError === true, text };
    } catch (error) {
      return { isError: true, text: error instanceof Error ? error.message : String(error) };
    }
  }

  for (const [label, query] of [
    ["a token field", '{ project(fullPath: "g/p") { pipelineTriggers { nodes { id token } } } }'],
    [
      "an aliased token field",
      '{ project(fullPath: "g/p") { pipelineTriggers { nodes { t: token } } } }',
    ],
    [
      "a token field in a fragment",
      'query { project(fullPath: "g/p") { pipelineTriggers { nodes { ...T } } } } fragment T on PipelineTrigger { token }',
    ],
    [
      "a runner authentication token",
      '{ project(fullPath: "g/p") { runners { nodes { ephemeralAuthenticationToken } } } }',
    ],
  ] as const) {
    test(`refuses ${label} before sending the query`, async () => {
      const before = graphqlRequests;
      const outcome = await run(query);
      assert.strictEqual(outcome.isError, true, outcome.text);
      assert.match(outcome.text, /does not return credential fields/, outcome.text);
      assert.ok(!outcome.text.includes(TRIGGER_TOKEN), outcome.text);
      assert.strictEqual(graphqlRequests, before, "no GraphQL request should be sent");
    });
  }

  test("a query without credential fields is sent", async () => {
    const before = graphqlRequests;
    const outcome = await run(
      '{ project(fullPath: "g/p") { pipelineTriggers { nodes { id description } } } }'
    );
    assert.strictEqual(outcome.isError, false, outcome.text);
    assert.strictEqual(graphqlRequests, before + 1);
    assert.ok(!outcome.text.includes(TRIGGER_TOKEN), outcome.text);
    const parsed = JSON.parse(outcome.text);
    assert.strictEqual(parsed.data.project.pipelineTriggers.nodes[0].description, "d");
  });

  test("an alias named token on a safe field keeps its value", async () => {
    const onField = await run(
      '{ project(fullPath: "g/p") { pipelineTriggers { nodes { token: id } } } }'
    );
    assert.strictEqual(onField.isError, false, onField.text);
    assert.strictEqual(
      JSON.parse(onField.text).data.project.pipelineTriggers.nodes[0].token,
      "gid://gitlab/Ci::Trigger/1"
    );

    const onObject = await run("{ token: currentUser { username } }");
    assert.strictEqual(onObject.isError, false, onObject.text);
    assert.deepStrictEqual(JSON.parse(onObject.text).data, { token: { username: "safe-user" } });
  });
});
