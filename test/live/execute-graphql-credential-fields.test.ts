/**
 * Live E2E for execute_graphql and credential fields. It creates one pipeline trigger
 * in the test project through the REST API, then asks the MCP server (readonly mode,
 * execute_graphql enabled) for the project's triggers:
 *
 * - selecting `token`, directly or under an alias, is refused and the token never
 *   appears in the tool output;
 * - a query without `token` still works and does not carry the token.
 *
 * The trigger is always deleted afterwards. The token value is never printed. Skips
 * without a token or a project ID. The project comes from TEST_PROJECT_ID, or from
 * GITLAB_PROJECT_ID.
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import dotenv from "dotenv";
import { StdioTestClient } from "../clients/stdio-client.js";
import { normalizeGitLabApiUrl } from "../../utils/url.js";
import { callToolWithBackoff, fetchWithBackoff } from "./rate-limit.js";

dotenv.config();

const GITLAB_TOKEN =
  process.env.GITLAB_TOKEN_TEST ||
  process.env.GITLAB_TOKEN ||
  process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID || process.env.GITLAB_PROJECT_ID;
const GITLAB_API_URL = normalizeGitLabApiUrl(process.env.GITLAB_API_URL || "https://gitlab.com");

const SKIP_REASON = !GITLAB_TOKEN
  ? "no GitLab token; set GITLAB_TOKEN_TEST, GITLAB_TOKEN, or GITLAB_PERSONAL_ACCESS_TOKEN"
  : !TEST_PROJECT_ID
    ? "no test project; set TEST_PROJECT_ID (or GITLAB_PROJECT_ID)"
    : false;

const projectUrl = () =>
  `${GITLAB_API_URL}/projects/${encodeURIComponent(String(TEST_PROJECT_ID))}`;
const headers = () => ({ "PRIVATE-TOKEN": GITLAB_TOKEN ?? "", "Content-Type": "application/json" });

describe("live: execute_graphql does not return credential fields", { skip: SKIP_REASON }, () => {
  let client: StdioTestClient | undefined;
  let triggerId: number | undefined;
  let triggerToken = "";
  let projectPath = "";

  before(async () => {
    const project = await fetchWithBackoff(() => fetch(projectUrl(), { headers: headers() }));
    assert.strictEqual(project.status, 200, "the test project should be readable");
    projectPath = ((await project.json()) as { path_with_namespace: string }).path_with_namespace;

    const description = `gitlab-mcp-e2e-graphql-${Date.now()}`;
    const created = await fetchWithBackoff(() =>
      fetch(`${projectUrl()}/triggers`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ description }),
      })
    );
    assert.strictEqual(created.status, 201, "creating a pipeline trigger should succeed");
    const trigger = (await created.json()) as { id: number; token: string };
    triggerId = trigger.id;
    triggerToken = trigger.token;
    assert.ok(triggerToken.length > 0, "the new trigger should have a token");

    client = new StdioTestClient();
    await client.connect("build/index.js", {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
      GITLAB_API_URL,
      GITLAB_TOOLS: "execute_graphql",
      GITLAB_PERMISSION_MODE: "readonly",
      GITLAB_PROJECT_ID: "",
      GITLAB_ALLOWED_PROJECT_IDS: "",
      ENABLE_STRICT_PROJECT_SCOPE: "false",
      GITLAB_DISABLE_VERSION_CHECK: "true",
    });
  });

  after(async () => {
    try {
      await client?.disconnect();
    } finally {
      if (triggerId !== undefined) {
        const deleted = await fetchWithBackoff(() =>
          fetch(`${projectUrl()}/triggers/${triggerId}`, {
            method: "DELETE",
            headers: headers(),
          })
        );
        assert.strictEqual(deleted.status, 204, "deleting the pipeline trigger should succeed");
      }
    }
  });

  async function run(query: string): Promise<{ isError: boolean; text: string }> {
    assert.ok(client, "MCP client should be connected");
    try {
      const result = await callToolWithBackoff(client, "execute_graphql", { query });
      const text = (result.content as Array<{ text?: string }>)
        .map(part => part.text ?? "")
        .join("");
      return { isError: result.isError === true, text };
    } catch (error) {
      return { isError: true, text: error instanceof Error ? error.message : String(error) };
    }
  }

  test("selecting token, directly or under an alias, is refused", async () => {
    for (const selection of ["id token", "id t: token"]) {
      const outcome = await run(
        `{ project(fullPath: ${JSON.stringify(projectPath)}) { pipelineTriggers { nodes { ${selection} } } } }`
      );
      // Report only whether the token is present, never its value.
      assert.ok(!outcome.text.includes(triggerToken), `the token leaked for "${selection}"`);
      assert.strictEqual(outcome.isError, true, "the query should be refused");
      assert.match(outcome.text, /does not return credential fields/);
    }
  });

  test("a query without token still lists the trigger", async () => {
    const outcome = await run(
      `{ project(fullPath: ${JSON.stringify(projectPath)}) { pipelineTriggers { nodes { id description } } } }`
    );
    assert.ok(!outcome.text.includes(triggerToken), "the token leaked");
    assert.strictEqual(outcome.isError, false, "the query should succeed");
    const nodes = JSON.parse(outcome.text).data.project.pipelineTriggers.nodes as Array<{
      id: string;
    }>;
    assert.ok(
      nodes.some(node => node.id.endsWith(`/${triggerId}`)),
      "the trigger should be listed"
    );
  });
});
