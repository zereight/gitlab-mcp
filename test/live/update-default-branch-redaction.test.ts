/**
 * Live E2E for update_default_branch output. GitLab answers PUT /projects/:id with
 * the full project, which for a maintainer includes runners_token and import_url.
 * The tool must change the default branch and return the project without those
 * fields, like get_project and update_project do.
 *
 * The test switches the test project's default branch to E2E_BASE_BRANCH (default
 * "e2e-base") and always switches it back afterwards. It checks the change with a
 * direct API read, and checks that the raw API response does carry the fields, so
 * the redaction assertion is not vacuous. No field value is printed.
 *
 * Skips without a token or a project ID. The project comes from TEST_PROJECT_ID, or
 * from GITLAB_PROJECT_ID when the runner sets only that.
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
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID || process.env.GITLAB_PROJECT_ID;
const GITLAB_API_URL = normalizeGitLabApiUrl(process.env.GITLAB_API_URL || "https://gitlab.com");
const TARGET_BRANCH = process.env.E2E_BASE_BRANCH || "e2e-base";

const SKIP_REASON = !GITLAB_TOKEN
  ? "no GitLab token; set GITLAB_TOKEN_TEST, GITLAB_TOKEN, or GITLAB_PERSONAL_ACCESS_TOKEN"
  : !TEST_PROJECT_ID
    ? "no test project; set TEST_PROJECT_ID (or GITLAB_PROJECT_ID)"
    : false;

const SENSITIVE_FIELDS = ["runners_token", "import_url"];

async function getProject(): Promise<Record<string, unknown>> {
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(String(TEST_PROJECT_ID))}`,
    { headers: { "PRIVATE-TOKEN": GITLAB_TOKEN ?? "" } }
  );
  assert.strictEqual(response.status, 200, "the test project should be readable");
  return (await response.json()) as Record<string, unknown>;
}

describe("live: update_default_branch redacts project fields", { skip: SKIP_REASON }, () => {
  let client: StdioTestClient | undefined;
  let originalBranch = "";

  before(async () => {
    const project = await getProject();
    originalBranch = String(project.default_branch ?? "");
    assert.ok(originalBranch, "the test project should have a default branch");
    assert.notStrictEqual(originalBranch, TARGET_BRANCH, "the target branch is already default");

    client = new StdioTestClient();
    await client.connect("build/index.js", {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
      GITLAB_API_URL,
      GITLAB_TOOLSETS: "all",
      GITLAB_ALLOWED_PROJECT_IDS: String(TEST_PROJECT_ID),
      GITLAB_DISABLE_VERSION_CHECK: "true",
    });
  });

  after(async () => {
    try {
      if (originalBranch && (await getProject()).default_branch !== originalBranch) {
        const response = await fetch(
          `${GITLAB_API_URL}/projects/${encodeURIComponent(String(TEST_PROJECT_ID))}`,
          {
            method: "PUT",
            headers: { "PRIVATE-TOKEN": GITLAB_TOKEN ?? "", "Content-Type": "application/json" },
            body: JSON.stringify({ default_branch: originalBranch }),
          }
        );
        assert.strictEqual(response.status, 200, "restoring the default branch should succeed");
      }
    } finally {
      await client?.disconnect();
    }
  });

  test("the raw project response carries the fields the tool must drop", async () => {
    const project = await getProject();
    for (const field of SENSITIVE_FIELDS) {
      assert.ok(field in project, `GitLab should return ${field} to this token`);
    }
  });

  test("update_default_branch changes the branch and returns no runners_token or import_url", async () => {
    assert.ok(client, "MCP client should be connected");
    const result = await client.callTool("update_default_branch", {
      project_id: String(TEST_PROJECT_ID),
      default_branch: TARGET_BRANCH,
    });
    const text = (result.content as Array<{ text?: string }>).map(part => part.text ?? "").join("");
    assert.notStrictEqual(result.isError, true, "update_default_branch should succeed");

    const parsed = JSON.parse(text) as {
      default_branch?: string;
      project?: Record<string, unknown>;
    };
    assert.strictEqual(parsed.default_branch, TARGET_BRANCH);
    assert.ok(parsed.project, "the tool should return the project");
    assert.strictEqual(parsed.project.default_branch, TARGET_BRANCH);
    for (const field of SENSITIVE_FIELDS) {
      // Report only whether the field is present, never its value.
      assert.ok(!(field in parsed.project), `${field} should not be in the project`);
      assert.ok(!text.includes(`"${field}"`), `${field} should not appear in the tool output`);
    }

    assert.strictEqual((await getProject()).default_branch, TARGET_BRANCH);
  });
});
