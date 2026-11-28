/**
 * Live E2E for the upload_markdown path hints. upload_markdown resolves file_path
 * against the MCP server's working directory and rejects absolute paths and "..".
 * Each rejection should come back as an isError tool result that names the rule and
 * ends with a "Next:" hint, not as a JSON-RPC error. The test asks the MCP server over
 * stdio to upload an absolute path, a ".." path, and a relative file that does not
 * exist. All three fail before any request to GitLab, so nothing is uploaded and
 * there is nothing to clean up.
 *
 * Skips without a token or a project ID. The project comes from TEST_PROJECT_ID, or
 * from GITLAB_PROJECT_ID when the runner sets only that.
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import path from "node:path";
import dotenv from "dotenv";
import { StdioTestClient } from "../clients/stdio-client.js";
import { normalizeGitLabApiUrl } from "../../utils/url.js";

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

const NEXT_HINT =
  /\nNext: pass a path relative to the MCP server's working directory \(absolute paths and '\.\.' are rejected\); copy the file there first if it is elsewhere\./;

// A timestamp keeps the relative names from ever matching a real file.
const stamp = Date.now();
const CASES: Array<{ label: string; filePath: string; firstLine: RegExp }> = [
  {
    // An existing file: an absolute path is refused even when the file is there.
    label: "an absolute path",
    filePath: path.resolve("package.json"),
    firstLine: /^Invalid file_path: absolute paths are not allowed\./,
  },
  {
    label: "a '..' path",
    filePath: `../gitlab-mcp-e2e-outside-${stamp}.md`,
    firstLine: /^Invalid file_path: directory traversal is not allowed\./,
  },
  {
    label: "a relative file that does not exist",
    filePath: `gitlab-mcp-e2e-missing-${stamp}.md`,
    firstLine: /^File not found: /,
  },
];

describe(
  "live: upload_markdown path hints (upload-markdown-path-hints)",
  { skip: SKIP_REASON },
  () => {
    let client: StdioTestClient | undefined;

    before(async () => {
      client = new StdioTestClient();
      await client.connect("build/index.js", {
        GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
        GITLAB_API_URL,
        GITLAB_TOOLSETS: "users",
      });
    });

    after(async () => {
      await client?.disconnect();
    });

    for (const { label, filePath, firstLine } of CASES) {
      test(`upload_markdown with ${label} is an isError result with the Next: hint`, async () => {
        assert.ok(client, "MCP client should be connected");
        // A JSON-RPC error would make callTool throw; these must be tool results.
        const result = await client.callTool("upload_markdown", {
          project_id: TEST_PROJECT_ID,
          file_path: filePath,
        });
        assert.strictEqual(result.isError, true, `${filePath} should be an isError result`);
        const text = (result.content as Array<{ text?: string }>)[0]?.text ?? "";
        assert.match(text, firstLine, text);
        assert.match(text, NEXT_HINT, text);
      });
    }
  }
);
