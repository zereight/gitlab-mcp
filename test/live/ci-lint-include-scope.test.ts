/**
 * Live E2E for CI lint under a project allowlist. GitLab expands `include:` with the
 * token's permissions, so linting in the test project can pull a file from another
 * project. With the allowlist set to the test project, validate_ci_lint must keep the
 * verdict but drop merged_yaml, includes, and jobs when an include comes from another
 * project, and keep them when every include is the test project's own.
 *
 * The other project defaults to the public components/sast on gitlab.com
 * (E2E_CI_LINT_INCLUDE_PROJECT / E2E_CI_LINT_INCLUDE_FILE / E2E_CI_LINT_INCLUDE_REF
 * override it). The test project needs a .gitlab-ci.yml on its default branch. Lint
 * creates nothing, so there is nothing to clean up. Skips without a token or a project
 * ID. The project comes from TEST_PROJECT_ID, or from GITLAB_PROJECT_ID.
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
const INCLUDE_PROJECT = process.env.E2E_CI_LINT_INCLUDE_PROJECT || "components/sast";
const INCLUDE_FILE = process.env.E2E_CI_LINT_INCLUDE_FILE || "templates/sast.yml";
const INCLUDE_REF = process.env.E2E_CI_LINT_INCLUDE_REF || "main";

const SKIP_REASON = !GITLAB_TOKEN
  ? "no GitLab token; set GITLAB_TOKEN_TEST, GITLAB_TOKEN, or GITLAB_PERSONAL_ACCESS_TOKEN"
  : !TEST_PROJECT_ID
    ? "no test project; set TEST_PROJECT_ID (or GITLAB_PROJECT_ID)"
    : false;

const OWN_INCLUDE = "include:\n  - local: .gitlab-ci.yml\n";
const OTHER_INCLUDE = `${OWN_INCLUDE}  - project: ${INCLUDE_PROJECT}\n    ref: ${INCLUDE_REF}\n    file: ${INCLUDE_FILE}\n`;

describe("live: CI lint includes under a project allowlist", { skip: SKIP_REASON }, () => {
  const clients: StdioTestClient[] = [];

  async function open(allowedProjectIds: string): Promise<StdioTestClient> {
    const client = new StdioTestClient();
    // The runner's own scope variables are inherited, so every scope setting is explicit.
    await client.connect("build/index.js", {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
      GITLAB_API_URL,
      GITLAB_TOOLSETS: "ci",
      GITLAB_PERMISSION_MODE: "readonly",
      GITLAB_PROJECT_ID: "",
      GITLAB_ALLOWED_PROJECT_IDS: allowedProjectIds,
      ENABLE_STRICT_PROJECT_SCOPE: "false",
      GITLAB_DISABLE_VERSION_CHECK: "true",
    });
    clients.push(client);
    return client;
  }

  async function lint(client: StdioTestClient, content: string) {
    const result = await client.callTool("validate_ci_lint", {
      project_id: String(TEST_PROJECT_ID),
      content,
      include_jobs: true,
    });
    const text = (result.content as Array<{ text?: string }>).map(part => part.text ?? "").join("");
    assert.notStrictEqual(result.isError, true, text);
    return JSON.parse(text) as {
      valid: boolean;
      merged_yaml?: string | null;
      includes?: Array<{ type: string; extra?: { project?: string } }> | null;
      jobs?: unknown[];
      scope_note?: string;
    };
  }

  let unscopedIncludesOther = false;

  before(async () => {
    // Control: without an allowlist GitLab expands the other project's file.
    const unscoped = await lint(await open(""), OTHER_INCLUDE);
    assert.strictEqual(unscoped.valid, true, JSON.stringify(unscoped).slice(0, 500));
    assert.ok(unscoped.merged_yaml, "GitLab should return merged_yaml without an allowlist");
    unscopedIncludesOther =
      unscoped.includes?.some(entry => entry.extra?.project === INCLUDE_PROJECT) ?? false;
    assert.ok(unscopedIncludesOther, `the includes should name ${INCLUDE_PROJECT}`);
  });

  after(async () => {
    for (const client of clients) {
      await client.disconnect();
    }
  });

  test("an include from another project drops the expanded configuration", async () => {
    const scoped = await lint(await open(String(TEST_PROJECT_ID)), OTHER_INCLUDE);
    assert.strictEqual(scoped.valid, true);
    assert.strictEqual(scoped.merged_yaml, null);
    assert.strictEqual(scoped.includes, null);
    assert.strictEqual(scoped.jobs, undefined);
    assert.match(scoped.scope_note ?? "", /outside the allowed project list/);
  });

  test("the test project's own includes are kept (numeric allowlist)", async () => {
    const scoped = await lint(await open(String(TEST_PROJECT_ID)), OWN_INCLUDE);
    assert.ok(scoped.merged_yaml, JSON.stringify(scoped).slice(0, 500));
    assert.ok(Array.isArray(scoped.includes) && scoped.includes.length > 0);
    assert.strictEqual(scoped.scope_note, undefined);
  });
});
