/**
 * Live E2E for update_file_patch.
 * Creates a scratch branch from the default branch of TEST_PROJECT_ID and a file on
 * it over REST, then patches the file through the MCP server over stdio in modify
 * mode. Checks that dry_run does not commit, that a search_replace commit keeps every
 * untouched byte, and that a stale last_commit_id is rejected. Deletes the scratch
 * branch afterwards; the file only ever exists on that branch.
 *
 * Skips without a token or TEST_PROJECT_ID, like test/validate-api.js. With both set,
 * a fixture failure (e.g. a token without `api` scope) fails the run.
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

const SKIP_REASON = !GITLAB_TOKEN
  ? "no GitLab token; set GITLAB_TOKEN_TEST, GITLAB_TOKEN, or GITLAB_PERSONAL_ACCESS_TOKEN"
  : !TEST_PROJECT_ID
    ? "no test project; set TEST_PROJECT_ID"
    : false;

// Lines a sloppy rewrite tends to change: a setext heading, a comment banner, trailing
// spaces, a tab, non-ASCII text, a blank line, and the final newline.
const ORIGINAL = [
  "Demo values",
  "===========",
  "",
  "# ==========",
  "# resources",
  "# ==========",
  "resources:",
  "  requests:",
  "    cpu: 50m   ",
  "    memory: 600Mi",
  "\tnote: café ✓",
  "suspend: false",
  "",
].join("\n");

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

describe("live: update_file_patch", { skip: SKIP_REASON }, () => {
  const projectPath = `/projects/${encodeURIComponent(TEST_PROJECT_ID ?? "")}`;
  const stamp = `${Date.now()}-${process.pid}`;
  const branch = `gitlab-mcp-e2e/update-file-patch-${stamp}`;
  const filePath = `gitlab-mcp-e2e/update-file-patch-${stamp}.md`;
  const fileApiPath = `${projectPath}/repository/files/${encodeURIComponent(filePath)}`;
  let branchCreated = false;
  let initialLastCommitId: string;
  let client: StdioTestClient | undefined;

  async function rawBytes(): Promise<Buffer> {
    const response = await gitlab("GET", `${fileApiPath}/raw?ref=${encodeURIComponent(branch)}`);
    if (!response.ok) {
      assert.fail(`reading ${filePath} failed: ${response.status} ${await response.text()}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async function branchHead(): Promise<string> {
    const info = await gitlabJson(
      "GET",
      `${projectPath}/repository/branches/${encodeURIComponent(branch)}`
    );
    return String((info.commit as Record<string, unknown>).id);
  }

  async function callPatch(args: Record<string, unknown>) {
    assert.ok(client, "MCP client should be connected");
    return client.callTool("update_file_patch", {
      project_id: TEST_PROJECT_ID,
      file_path: filePath,
      branch,
      commit_message: "gitlab-mcp e2e: update_file_patch",
      patch_type: "search_replace",
      ...args,
    });
  }

  before(async () => {
    const project = await gitlabJson("GET", projectPath);
    await gitlabJson("POST", `${projectPath}/repository/branches`, {
      branch,
      ref: String(project.default_branch),
    });
    branchCreated = true;

    await gitlabJson("POST", fileApiPath, {
      branch,
      content: ORIGINAL,
      commit_message: "gitlab-mcp e2e: add update_file_patch fixture",
    });
    const file = await gitlabJson("GET", `${fileApiPath}?ref=${encodeURIComponent(branch)}`);
    initialLastCommitId = String(file.last_commit_id);

    client = new StdioTestClient();
    await client.connect("build/index.js", {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
      GITLAB_API_URL,
      GITLAB_TOOLSETS: "repositories",
      GITLAB_PERMISSION_MODE: "modify",
    });
  });

  after(async () => {
    await client?.disconnect();
    if (!branchCreated) return;
    const response = await gitlab(
      "DELETE",
      `${projectPath}/repository/branches/${encodeURIComponent(branch)}`
    );
    if (!response.ok) {
      process.stderr.write(
        `could not delete branch ${branch} (${response.status}); delete it by hand\n`
      );
    }
  });

  test("dry_run returns the diff and does not commit", async () => {
    const headBefore = await branchHead();
    const result = await callPatch({
      patch: "<<<<<<< SEARCH\nsuspend: false\n=======\nsuspend: true\n>>>>>>> REPLACE",
      dry_run: true,
    });
    assert.notStrictEqual(result.isError, true, resultText(result));
    const data = JSON.parse(resultText(result));
    assert.strictEqual(data.status, "preview");
    assert.ok(String(data.preview).includes("+suspend: true"), data.preview);
    assert.strictEqual(await branchHead(), headBefore, "dry_run must not add a commit");
    assert.ok((await rawBytes()).equals(Buffer.from(ORIGINAL, "utf8")));
  });

  test("search_replace commits the change and keeps every other byte", async () => {
    const headBefore = await branchHead();
    const result = await callPatch({
      patch:
        "<<<<<<< SEARCH\n# ==========\n# resources\n# ==========\nresources:\n  requests:\n    cpu: 50m   \n" +
        "=======\n# ==========\n# resources\n# ==========\nresources:\n  requests:\n    cpu: 500m   \n" +
        ">>>>>>> REPLACE",
    });
    assert.notStrictEqual(result.isError, true, resultText(result));
    const data = JSON.parse(resultText(result));
    assert.strictEqual(data.status, "success");
    assert.strictEqual(data.changes, 1);
    assert.notStrictEqual(await branchHead(), headBefore, "a commit should be added");

    const expected = Buffer.from(ORIGINAL.replace("cpu: 50m   ", "cpu: 500m   "), "utf8");
    assert.ok(
      (await rawBytes()).equals(expected),
      "the file must differ from the original only in the patched line"
    );
  });

  test("a stale last_commit_id is rejected and nothing is committed", async () => {
    const headBefore = await branchHead();
    const contentBefore = await rawBytes();
    let rejected = false;
    try {
      const result = await callPatch({
        patch: "<<<<<<< SEARCH\nsuspend: false\n=======\nsuspend: true\n>>>>>>> REPLACE",
        last_commit_id: initialLastCommitId,
      });
      rejected = result.isError === true;
    } catch {
      rejected = true;
    }
    assert.ok(rejected, "the stale commit id should be rejected");
    assert.strictEqual(await branchHead(), headBefore);
    assert.ok((await rawBytes()).equals(contentBefore));
  });
});
