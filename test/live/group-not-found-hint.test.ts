/**
 * Live E2E for the group hint (group-not-found-hint). A group tool such as
 * list_group_iterations takes group_id. When the group is missing, GitLab answers
 * with a body that names the group ({"message":"404 Group Not Found"}). The error
 * should then point the caller at group_id, not at project_id, which the tool does
 * not take. A namespace tool (get_work_item with project_id "group:<path>") gets the
 * project_id hint for the same missing group. The test asks the MCP server over stdio,
 * in readonly mode, for group paths that cannot exist and checks the Next: line. It
 * creates nothing, so there is nothing to clean up.
 *
 * Skips without a token. The project ID is not needed: the lookup is for a group.
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

describe("live: group hint (group-not-found-hint)", { skip: SKIP_REASON }, () => {
  let client: StdioTestClient | undefined;

  before(async () => {
    client = new StdioTestClient();
    // connect() inherits process.env, so pin the project-scope settings here. An
    // inherited allowlist could stop the missing-group request before it reaches GitLab,
    // and the hint assertions would then test the wrong error path.
    await client.connect("build/index.js", {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
      GITLAB_API_URL,
      GITLAB_TOOLSETS: "projects,workitems",
      GITLAB_PERMISSION_MODE: "readonly",
      GITLAB_PROJECT_ID: "",
      GITLAB_ALLOWED_PROJECT_IDS: "",
      ENABLE_STRICT_PROJECT_SCOPE: "false",
    });
  });

  after(async () => {
    await client?.disconnect();
  });

  test("list_group_iterations on a missing group names group_id, not project_id", async () => {
    assert.ok(client, "MCP client should be connected");
    // A timestamped path keeps the lookup from ever matching a real group.
    const missingGroup = `gitlab-mcp-e2e-missing-group-${Date.now()}`;

    // A GitLab error can come back as an isError result or as a thrown call error.
    // Either way the message carries the GitLab body and the recovery hint.
    let text: string;
    try {
      const result = await client.callTool("list_group_iterations", {
        group_id: missingGroup,
      });
      assert.strictEqual(result.isError, true, "a missing group should be an error");
      text = (result.content as Array<{ text?: string }>)[0]?.text ?? "";
    } catch (error) {
      text = error instanceof Error ? error.message : String(error);
    }

    assert.match(text, /404/, text);
    assert.match(text, /Group Not Found/, text);
    assert.match(
      text,
      /Next: check group_id \(numeric ID or URL-encoded path such as parent%2Fchild\)/,
      text
    );
    assert.doesNotMatch(text, /project_id/, text);
  });

  test("get_work_item with project_id group:<missing> names project_id, not group_id", async () => {
    assert.ok(client, "MCP client should be connected");
    const missingGroup = `gitlab-mcp-e2e-missing-group-${Date.now()}`;

    let text: string;
    try {
      const result = await client.callTool("get_work_item", {
        project_id: `group:${missingGroup}`,
        iid: 1,
      });
      assert.strictEqual(result.isError, true, "a missing group should be an error");
      text = (result.content as Array<{ text?: string }>)[0]?.text ?? "";
    } catch (error) {
      text = error instanceof Error ? error.message : String(error);
    }

    assert.match(text, /404/, text);
    assert.match(text, /Group Not Found/, text);
    assert.match(text, /Next: check project_id/, text);
    assert.doesNotMatch(text, /group_id/, text);
  });
});
