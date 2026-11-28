/**
 * Live E2E for list_issue_links with GITLAB_MCP_LIST_SUMMARY_DEFAULT.
 * Creates two issues in TEST_PROJECT_ID over REST, links them, then reads the
 * links through the MCP server over stdio. An omitted summary keeps
 * issue_link_id and link_type and drops description; summary: false returns
 * the full GitLab JSON. The issue_link_id from the summary is enough for
 * get_issue_link. Deletes both issues afterwards; a token that may not delete
 * issues leaves them open.
 *
 * Skips without a token or TEST_PROJECT_ID, like test/validate-api.js. With
 * both set, a fixture failure (e.g. a token without `api` scope) fails the run.
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import dotenv from "dotenv";
import { StdioTestClient } from "../clients/stdio-client.js";
import { normalizeGitLabApiUrl } from "../../utils/url.js";
import { deleteScratch } from "./cleanup.js";
import { callToolWithBackoff, fetchWithBackoff } from "./rate-limit.js";

dotenv.config();

const GITLAB_TOKEN =
  process.env.GITLAB_TOKEN_TEST ||
  process.env.GITLAB_TOKEN ||
  process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID;
const GITLAB_API_URL = normalizeGitLabApiUrl(process.env.GITLAB_API_URL || "https://gitlab.com");
const TARGET_TITLE = "gitlab-mcp e2e: linked target";
const TARGET_DESCRIPTION = "Long description that the list summary should drop";

const SKIP_REASON = !GITLAB_TOKEN
  ? "no GitLab token; set GITLAB_TOKEN_TEST, GITLAB_TOKEN, or GITLAB_PERSONAL_ACCESS_TOKEN"
  : !TEST_PROJECT_ID
    ? "no test project; set TEST_PROJECT_ID"
    : false;

// Callers retry a 429: gitlabJson through fetchWithBackoff, the
// cleanup DELETE through deleteScratch.
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
  const response = await fetchWithBackoff(() => gitlab(method, path, body));
  if (!response.ok) {
    assert.fail(`${method} ${path} failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

function resultText(result: { content: unknown }): string {
  return (result.content as Array<{ text?: string }>)[0]?.text ?? "";
}

describe("live: list_issue_links follows the list summary default", { skip: SKIP_REASON }, () => {
  const projectPath = `/projects/${encodeURIComponent(TEST_PROJECT_ID ?? "")}`;
  const issuePaths: string[] = [];
  let sourceIid: string;
  let targetIid: string;
  let client: StdioTestClient | undefined;

  async function callLinks(
    extraArgs: Record<string, unknown> = {}
  ): Promise<Array<Record<string, unknown>>> {
    assert.ok(client, "MCP client should be connected");
    const result = await callToolWithBackoff(client, "list_issue_links", {
      project_id: TEST_PROJECT_ID,
      issue_iid: sourceIid,
      ...extraArgs,
    });
    assert.notStrictEqual(result.isError, true, resultText(result));
    const links: unknown = JSON.parse(resultText(result));
    assert.ok(Array.isArray(links), "list_issue_links should reply with an array");
    return links as Array<Record<string, unknown>>;
  }

  before(async () => {
    const source = await gitlabJson("POST", `${projectPath}/issues`, {
      title: `gitlab-mcp e2e: link source ${new Date().toISOString()}`,
    });
    sourceIid = String(source.iid);
    issuePaths.push(`${projectPath}/issues/${sourceIid}`);

    const target = await gitlabJson("POST", `${projectPath}/issues`, {
      title: TARGET_TITLE,
      description: TARGET_DESCRIPTION,
    });
    targetIid = String(target.iid);
    issuePaths.push(`${projectPath}/issues/${targetIid}`);

    await gitlabJson("POST", `${projectPath}/issues/${sourceIid}/links`, {
      target_project_id: TEST_PROJECT_ID,
      target_issue_iid: targetIid,
      link_type: "relates_to",
    });

    client = new StdioTestClient();
    await client.connect("build/index.js", {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
      GITLAB_API_URL,
      GITLAB_TOOLSETS: "issues",
      GITLAB_PERMISSION_MODE: "readonly",
      GITLAB_MCP_LIST_SUMMARY_DEFAULT: "true",
    });
  });

  after(async () => {
    try {
      await client?.disconnect();
    } finally {
      // Deleting an issue needs the Owner role; a Maintainer token leaves it open.
      for (const target of [...issuePaths].reverse()) {
        await deleteScratch(
          () => gitlab("DELETE", target),
          target,
          "it stays open in the test project"
        );
      }
    }
  });

  test("omitted summary keeps issue_link_id and link_type and drops description", async () => {
    const links = await callLinks();
    assert.strictEqual(links.length, 1);
    const link = links[0];
    assert.strictEqual(String(link.iid), targetIid);
    assert.strictEqual(link.title, TARGET_TITLE);
    assert.strictEqual(link.state, "opened");
    assert.strictEqual(link.link_type, "relates_to");
    assert.ok(
      link.issue_link_id !== undefined && String(link.issue_link_id).length > 0,
      "summarized reply should keep issue_link_id"
    );
    assert.strictEqual("description" in link, false);
    assert.strictEqual("link_created_at" in link, false);
  });

  test("summary: false returns the full GitLab JSON, including description", async () => {
    const links = await callLinks({ summary: false });
    assert.strictEqual(links.length, 1);
    const link = links[0];
    assert.strictEqual(String(link.iid), targetIid);
    assert.strictEqual(link.title, TARGET_TITLE);
    assert.strictEqual(link.link_type, "relates_to");
    assert.ok(
      link.issue_link_id !== undefined && String(link.issue_link_id).length > 0,
      "full reply should keep issue_link_id"
    );
    assert.strictEqual(link.description, TARGET_DESCRIPTION);
    assert.strictEqual(typeof link.link_created_at, "string");
  });

  test("issue_link_id from the summary is enough for get_issue_link", async () => {
    assert.ok(client, "MCP client should be connected");
    const [link] = await callLinks();
    const result = await callToolWithBackoff(client, "get_issue_link", {
      project_id: TEST_PROJECT_ID,
      issue_iid: sourceIid,
      issue_link_id: link.issue_link_id,
    });
    assert.notStrictEqual(result.isError, true, resultText(result));
    const body = JSON.parse(resultText(result)) as Record<string, unknown>;
    assert.strictEqual(body.link_type, "relates_to");
    const target = body.target_issue as Record<string, unknown> | undefined;
    assert.ok(target, "get_issue_link should include target_issue");
    assert.strictEqual(String(target.iid), targetIid);
    assert.strictEqual(target.title, TARGET_TITLE);
  });
});
