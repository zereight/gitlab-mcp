/**
 * Live E2E for the release tag hint. get_release takes a tag_name, not an iid, so a
 * 404 for a tag that has no release should point the caller at tag_name and
 * list_releases instead of the generic "project_id and iid" hint. GitLab answers
 * such a lookup with a generic body, {"message":"404 Not Found"}, so the hint comes
 * from the release tool path and not from the body. The test asks the MCP server
 * over stdio, in readonly mode, for a tag that cannot exist and checks the error.
 * It creates nothing, so there is nothing to clean up.
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

const SKIP_REASON = !GITLAB_TOKEN
  ? "no GitLab token; set GITLAB_TOKEN_TEST, GITLAB_TOKEN, or GITLAB_PERSONAL_ACCESS_TOKEN"
  : !TEST_PROJECT_ID
    ? "no test project; set TEST_PROJECT_ID (or GITLAB_PROJECT_ID)"
    : false;

describe("live: release tag hint (release-not-found-hint)", { skip: SKIP_REASON }, () => {
  let client: StdioTestClient | undefined;

  before(async () => {
    client = new StdioTestClient();
    await client.connect("build/index.js", {
      GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
      GITLAB_API_URL,
      GITLAB_TOOLSETS: "releases",
      GITLAB_PERMISSION_MODE: "readonly",
    });
  });

  after(async () => {
    await client?.disconnect();
  });

  test("get_release on a missing tag names tag_name and list_releases, not the iid", async () => {
    assert.ok(client, "MCP client should be connected");
    // A timestamped tag keeps the lookup from ever matching a real release.
    const missingTag = `gitlab-mcp-e2e-missing-${Date.now()}`;

    // A GitLab error can come back as an isError result or as a thrown call error.
    // Either way the message carries the GitLab body and the recovery hint.
    let text: string;
    try {
      const result = await client.callTool("get_release", {
        project_id: TEST_PROJECT_ID,
        tag_name: missingTag,
      });
      assert.strictEqual(result.isError, true, "a missing release should be an error");
      text = (result.content as Array<{ text?: string }>)[0]?.text ?? "";
    } catch (error) {
      text = error instanceof Error ? error.message : String(error);
    }

    assert.match(text, /404/, text);
    assert.match(
      text,
      /Next: check project_id and that tag_name is the Git tag of an existing release; list_releases lists them\./,
      text
    );
    assert.doesNotMatch(text, /resource iid/, text);
  });
});
