/**
 * Live E2E for the project hint (project-not-found-hint). A project tool such as
 * get_project takes project_id. When the project is missing, GitLab answers with a body
 * that names the project ({"message":"404 Project Not Found"}). The error should point the
 * caller at project_id and the token's read access. The generic 404 hint asks for "the
 * resource iid", which does not apply to a project that does not exist. The test asks the
 * MCP server over stdio, in readonly mode, for a numeric project ID that cannot exist and
 * checks the Next: line. It creates nothing, so there is nothing to clean up.
 *
 * Skips without a token. The project ID is not needed: the lookup is for a missing project.
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
const GITLAB_API_URL = normalizeGitLabApiUrl(process.env.GITLAB_API_URL || "https://gitlab.com");

const SKIP_REASON = !GITLAB_TOKEN
  ? "no GitLab token; set GITLAB_TOKEN_TEST, GITLAB_TOKEN, or GITLAB_PERSONAL_ACCESS_TOKEN"
  : false;

describe("live: project hint (project-not-found-hint)", { skip: SKIP_REASON }, () => {
  let client: StdioTestClient | undefined;

  before(async () => {
    client = new StdioTestClient();
    // connect() inherits process.env, so pin the project-scope settings here. An inherited
    // allowlist would reject project_id 999999999999 before the request reaches GitLab, and
    // the hint assertions would then test the wrong error path.
    await client.connect("build/index.js", {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
      GITLAB_API_URL,
      GITLAB_TOOLSETS: "projects",
      GITLAB_PERMISSION_MODE: "readonly",
      GITLAB_PROJECT_ID: "",
      GITLAB_ALLOWED_PROJECT_IDS: "",
      ENABLE_STRICT_PROJECT_SCOPE: "false",
    });
  });

  after(async () => {
    await client?.disconnect();
  });

  test("get_project on a missing project names project_id and read access, not the iid", async () => {
    assert.ok(client, "MCP client should be connected");
    // A numeric ID far above any real GitLab project keeps the lookup from matching one.
    const missingProjectId = "999999999999";

    // A GitLab error can come back as an isError result or as a thrown call error.
    // Either way the message carries the GitLab body and the recovery hint.
    let text: string;
    try {
      const result = await client.callTool("get_project", {
        project_id: missingProjectId,
      });
      assert.strictEqual(result.isError, true, "a missing project should be an error");
      text = (result.content as Array<{ text?: string }>)[0]?.text ?? "";
    } catch (error) {
      text = error instanceof Error ? error.message : String(error);
    }

    assert.match(text, /404/, text);
    assert.match(text, /Project Not Found/, text);
    assert.match(
      text,
      /Next: check project_id \(numeric ID or group%2Fproject\) and that the token can read the project\./,
      text
    );
    assert.doesNotMatch(text, /resource iid/, text);
  });
});
