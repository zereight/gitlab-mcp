/**
 * Live E2E for get_file_contents with offset and limit.
 * Creates a scratch branch from the default branch of TEST_PROJECT_ID and a file on
 * it over REST, then reads the file through the MCP server over stdio in readonly
 * mode. Checks that consecutive ranges join back into the file with matching paging
 * metadata, that an offset past the end returns no lines, and that with masking
 * enabled the line numbers count lines of the masked text. Deletes the scratch
 * branch afterwards; the file only ever exists on that branch.
 *
 * Skips without a token or TEST_PROJECT_ID, like test/validate-api.js. With both set,
 * a fixture failure (e.g. a token without `api` scope) fails the run.
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

const SKIP_REASON = !GITLAB_TOKEN
  ? "no GitLab token; set GITLAB_TOKEN_TEST, GITLAB_TOKEN, or GITLAB_PERSONAL_ACCESS_TOKEN"
  : !TEST_PROJECT_ID
    ? "no test project; set TEST_PROJECT_ID"
    : false;

// A keyword the masking client replaces with two lines.
const SECRET = "gitlab-mcp-e2e-line-range-secret";
const SECRET_REPLACEMENT = "[masked]\n[masked]";

// Six lines: non-ASCII text, a tab, a blank line, and a last line without a newline.
const ORIGINAL = [
  "first",
  `token: ${SECRET}`,
  "café ✓",
  "\tfourth",
  "",
  "last line without newline",
].join("\n");

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

// A line is its text plus its "\n"; a last line without one still counts.
function lineCount(text: string): number {
  return text.split("\n").length - (text === "" || text.endsWith("\n") ? 1 : 0);
}

interface FileRead {
  content: string;
  offset?: number;
  returned_lines?: number;
  total_lines?: number;
}

describe("live: get_file_contents line range", { skip: SKIP_REASON }, () => {
  const projectPath = `/projects/${encodeURIComponent(TEST_PROJECT_ID ?? "")}`;
  const stamp = `${Date.now()}-${process.pid}`;
  const branch = `gitlab-mcp-e2e/get-file-contents-line-range-${stamp}`;
  const filePath = `gitlab-mcp-e2e/get-file-contents-line-range-${stamp}.txt`;
  const fileApiPath = `${projectPath}/repository/files/${encodeURIComponent(filePath)}`;
  let workspace: string | undefined;
  let branchCreated = false;
  let client: StdioTestClient | undefined;
  let maskingClient: StdioTestClient | undefined;

  async function read(
    reader: StdioTestClient | undefined,
    range: { offset?: number; limit?: number }
  ): Promise<FileRead> {
    assert.ok(reader, "MCP client should be connected");
    const result = await callToolWithBackoff(reader, "get_file_contents", {
      project_id: TEST_PROJECT_ID,
      file_path: filePath,
      ref: branch,
      ...range,
    });
    assert.notStrictEqual(result.isError, true, resultText(result));
    return JSON.parse(resultText(result)) as FileRead;
  }

  // Reads the whole file in pages of `limit` lines and checks each page's metadata.
  async function readPages(reader: StdioTestClient | undefined, limit: number) {
    const pages: string[] = [];
    let totalLines = 0;
    for (let offset = 0; offset === 0 || offset < totalLines; offset += limit) {
      const page = await read(reader, { offset, limit });
      totalLines = page.total_lines ?? 0;
      assert.strictEqual(page.offset, offset);
      assert.strictEqual(page.returned_lines, Math.min(limit, totalLines - offset));
      assert.strictEqual(lineCount(page.content), page.returned_lines, page.content);
      pages.push(page.content);
    }
    return { content: pages.join(""), totalLines };
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
      commit_message: "gitlab-mcp e2e: add get_file_contents line range fixture",
    });

    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mcp-e2e-line-range-"));
    const maskingConfig = path.join(workspace, "mask.json");
    fs.writeFileSync(
      maskingConfig,
      JSON.stringify({
        version: 1,
        rules: [{ id: "e2e", type: "keyword", match: SECRET, replacement: SECRET_REPLACEMENT }],
      })
    );

    // connect() inherits process.env, so pin the masking settings for each client.
    const env = {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
      GITLAB_API_URL,
      GITLAB_TOOLSETS: "repositories",
      GITLAB_PERMISSION_MODE: "readonly",
      GITLAB_MASKING_POLICY_FILE: "",
    };
    client = new StdioTestClient();
    await client.connect("build/index.js", { ...env, GITLAB_MASKING_ENABLED: "false" });
    maskingClient = new StdioTestClient();
    await maskingClient.connect("build/index.js", {
      ...env,
      GITLAB_MASKING_ENABLED: "true",
      GITLAB_MASKING_CONFIG: maskingConfig,
      GITLAB_MASKING_WORKSPACE_DIR: workspace,
    });
  });

  after(async () => {
    try {
      await client?.disconnect();
      await maskingClient?.disconnect();
      if (workspace) fs.rmSync(workspace, { recursive: true, force: true });
    } finally {
      if (branchCreated) {
        await deleteScratch(
          () =>
            gitlab("DELETE", `${projectPath}/repository/branches/${encodeURIComponent(branch)}`),
          `branch ${branch}`,
          "delete it by hand"
        );
      }
    }
  });

  test("consecutive ranges join back into the file", async () => {
    const whole = await read(client, {});
    assert.strictEqual(whole.content, ORIGINAL);
    assert.strictEqual(whole.total_lines, undefined, "a read without a range has no paging");

    const pages = await readPages(client, 4);
    assert.strictEqual(pages.totalLines, 6);
    assert.strictEqual(pages.content, ORIGINAL);
  });

  test("an offset past the end returns no lines", async () => {
    const page = await read(client, { offset: 10, limit: 2 });
    assert.deepStrictEqual(
      {
        content: page.content,
        offset: page.offset,
        returned_lines: page.returned_lines,
        total_lines: page.total_lines,
      },
      { content: "", offset: 10, returned_lines: 0, total_lines: 6 }
    );
  });

  test("with masking, line numbers count lines of the masked text", async () => {
    const whole = await read(maskingClient, {});
    assert.strictEqual(whole.content, ORIGINAL.replace(SECRET, SECRET_REPLACEMENT));

    const pages = await readPages(maskingClient, 1);
    assert.strictEqual(pages.totalLines, 7, "the replacement adds a line");
    assert.strictEqual(pages.content, whole.content);
    assert.ok(!pages.content.includes(SECRET), "the secret must be masked");
  });
});
