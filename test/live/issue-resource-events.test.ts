/**
 * Live E2E for list_issue_label_events and list_issue_state_events (#1003).
 * Creates one issue in TEST_PROJECT_ID over REST, adds and removes the label
 * `gitlab-mcp-e2e` and closes the issue, then reads the events through the MCP
 * server over stdio in readonly mode and checks the lean event shape. Deletes
 * the issue afterwards; a token that may not delete issues leaves it closed.
 *
 * Skips without a token or TEST_PROJECT_ID, like test/validate-api.js. With
 * both set, a fixture failure (e.g. a token without `api` scope) fails the run.
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import dotenv from "dotenv";
import { StdioTestClient } from "../clients/stdio-client.js";
import { normalizeGitLabApiUrl } from "../../utils/url.js";

dotenv.config();

const GITLAB_TOKEN =
  process.env.GITLAB_TOKEN_TEST ||
  process.env.GITLAB_TOKEN ||
  process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID;
const GITLAB_API_URL = normalizeGitLabApiUrl(process.env.GITLAB_API_URL || "https://gitlab.com");
const LABEL_NAME = "gitlab-mcp-e2e";

const SKIP_REASON = !GITLAB_TOKEN
  ? "no GitLab token; set GITLAB_TOKEN_TEST, GITLAB_TOKEN, or GITLAB_PERSONAL_ACCESS_TOKEN"
  : !TEST_PROJECT_ID
    ? "no test project; set TEST_PROJECT_ID"
    : false;

async function gitlab(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Response> {
  return fetch(`${GITLAB_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITLAB_TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function gitlabJson(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await gitlab(method, path, body);
  if (!response.ok) {
    assert.fail(`${method} ${path} failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

function resultText(result: { content: unknown }): string {
  return (result.content as Array<{ text?: string }>)[0]?.text ?? "";
}

function assertCreatedAt(event: Record<string, unknown>): void {
  assert.strictEqual(typeof event.created_at, "string");
  assert.ok(
    !Number.isNaN(Date.parse(event.created_at as string)),
    `created_at should be a date: ${event.created_at}`
  );
}

describe("live: issue label and state events (#1003)", { skip: SKIP_REASON }, () => {
  const projectPath = `/projects/${encodeURIComponent(TEST_PROJECT_ID ?? "")}`;
  let username: string;
  let issuePath: string | undefined;
  let issueIid: string;
  let client: StdioTestClient | undefined;

  async function callEvents(
    tool: string,
    extraArgs: Record<string, unknown> = {}
  ): Promise<Array<Record<string, unknown>>> {
    assert.ok(client, "MCP client should be connected");
    const result = await client.callTool(tool, {
      project_id: TEST_PROJECT_ID,
      issue_iid: issueIid,
      ...extraArgs,
    });
    assert.notStrictEqual(result.isError, true, resultText(result));
    const events: unknown = JSON.parse(resultText(result));
    assert.ok(Array.isArray(events), `${tool} should reply with an array`);
    return events as Array<Record<string, unknown>>;
  }

  before(async () => {
    const user = await gitlabJson("GET", "/user");
    username = String(user.username);

    const labelResponse = await gitlab("POST", `${projectPath}/labels`, {
      name: LABEL_NAME,
      color: "#6699cc",
    });
    // 409: the label exists from an earlier run.
    if (!labelResponse.ok && labelResponse.status !== 409) {
      assert.fail(
        `creating label ${LABEL_NAME} failed: ${labelResponse.status} ${await labelResponse.text()}`
      );
    }

    const issue = await gitlabJson("POST", `${projectPath}/issues`, {
      title: `gitlab-mcp e2e: resource events ${new Date().toISOString()}`,
    });
    issueIid = String(issue.iid);
    issuePath = `${projectPath}/issues/${issueIid}`;

    await gitlabJson("PUT", issuePath, { add_labels: LABEL_NAME });
    await gitlabJson("PUT", issuePath, { remove_labels: LABEL_NAME });
    await gitlabJson("PUT", issuePath, { state_event: "close" });

    client = new StdioTestClient();
    await client.connect("build/index.js", {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
      GITLAB_API_URL,
      GITLAB_TOOLSETS: "issues",
      GITLAB_PERMISSION_MODE: "readonly",
    });
  });

  after(async () => {
    await client?.disconnect();
    if (!issuePath) return;
    // Deleting an issue needs the Owner role; a Maintainer token leaves it closed.
    const response = await gitlab("DELETE", issuePath);
    if (!response.ok) {
      process.stderr.write(
        `could not delete ${issuePath} (${response.status}); it stays closed in the test project\n`
      );
    }
  });

  test("list_issue_label_events returns the add and remove events, lean", async () => {
    const events = await callEvents("list_issue_label_events");
    assert.deepStrictEqual(
      events.map(event => event.action),
      ["add", "remove"]
    );
    for (const event of events) {
      assert.deepStrictEqual(Object.keys(event).sort(), ["action", "created_at", "label", "user"]);
      assert.deepStrictEqual(event.label, { name: LABEL_NAME });
      assert.deepStrictEqual(event.user, { username });
      assertCreatedAt(event);
    }
  });

  test("list_issue_label_events pages with per_page and page", async () => {
    const events = await callEvents("list_issue_label_events", { per_page: 1, page: 2 });
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].action, "remove");
  });

  test("list_issue_state_events returns the close event, lean", async () => {
    const events = await callEvents("list_issue_state_events");
    assert.strictEqual(events.length, 1);
    assert.deepStrictEqual(Object.keys(events[0]).sort(), ["created_at", "state", "user"]);
    assert.strictEqual(events[0].state, "closed");
    assert.deepStrictEqual(events[0].user, { username });
    assertCreatedAt(events[0]);
  });
});
