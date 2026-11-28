/**
 * Live E2E for snippet tools called without project_id under managed masking.
 * Creates a private project snippet in TEST_PROJECT_ID over REST, with a unique
 * keyword in its title and content. Starts the server over stdio with
 * GITLAB_PROJECT_ID set to that project and a managed masking policy that binds the
 * project to a group masking the keyword, with unboundProjectBehavior "builtin".
 * get_snippet and list_snippets without project_id must return the masked text.
 * A direct REST read shows the keyword, so the check is not vacuous. Deletes the
 * snippet afterwards.
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

const REPLACEMENT = "[masked]";

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

describe(
  "live: snippet tools use the default project for managed masking",
  { skip: SKIP_REASON },
  () => {
    const projectId = TEST_PROJECT_ID ?? "";
    const projectPath = `/projects/${encodeURIComponent(projectId)}`;
    // Unique per run, so the policy keyword only matches this run's snippet.
    const stamp = `${Date.now()}-${process.pid}`;
    const SECRET = `gitlab-mcp-e2e-snippet-default-project-${stamp}`;
    const title = `snippet ${SECRET}`;
    const content = `token: ${SECRET}\n`;
    let workspace: string | undefined;
    let snippetId: number | undefined;
    let client: StdioTestClient | undefined;

    before(async () => {
      assert.match(projectId, /^\d+$/, "TEST_PROJECT_ID must be numeric to bind a managed policy");

      const snippet = await gitlabJson("POST", `${projectPath}/snippets`, {
        title,
        file_name: "e2e.txt",
        content,
        visibility: "private",
      });
      snippetId = Number(snippet.id);

      workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mcp-e2e-snippet-masking-"));
      const policyPath = path.join(workspace, "policies.json");
      fs.writeFileSync(
        policyPath,
        JSON.stringify({
          version: 1,
          policyGroups: {
            e2e: {
              rules: [
                { id: "e2e-secret", type: "keyword", match: SECRET, replacement: REPLACEMENT },
              ],
            },
          },
          bindings: [
            { gitlabInstance: GITLAB_API_URL, projectIds: [Number(projectId)], policyGroup: "e2e" },
          ],
          unboundProjectBehavior: "builtin",
        })
      );

      // connect() inherits process.env, so pin the scope and masking settings.
      client = new StdioTestClient();
      await client.connect("build/index.js", {
        GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
        GITLAB_API_URL,
        GITLAB_PROJECT_ID: projectId,
        GITLAB_ALLOWED_PROJECT_IDS: "",
        GITLAB_TOOLSETS: "snippets",
        GITLAB_PERMISSION_MODE: "readonly",
        GITLAB_MASKING_ENABLED: "true",
        GITLAB_MASKING_POLICY_FILE: policyPath,
        GITLAB_MASKING_CONFIG: "",
        GITLAB_MASKING_WORKSPACE_DIR: workspace,
      });
    });

    after(async () => {
      try {
        await client?.disconnect();
        if (workspace) fs.rmSync(workspace, { recursive: true, force: true });
      } finally {
        if (snippetId !== undefined) {
          await deleteScratch(
            () => gitlab("DELETE", `${projectPath}/snippets/${snippetId}`),
            `snippet ${snippetId}`,
            "delete it by hand from the test project's snippets"
          );
        }
      }
    });

    test("the snippet really holds the keyword", async () => {
      assert.ok(snippetId !== undefined, "the snippet should exist");
      const metadata = await gitlabJson("GET", `${projectPath}/snippets/${snippetId}`);
      assert.ok(String(metadata.title).includes(SECRET), "the REST title should hold the keyword");
      const raw = await gitlab("GET", `${projectPath}/snippets/${snippetId}/raw`);
      assert.ok(raw.ok, `raw read failed: ${raw.status}`);
      assert.ok(
        (await raw.text()).includes(SECRET),
        "the REST raw content should hold the keyword"
      );
    });

    test("get_snippet without project_id returns masked title and content", async () => {
      assert.ok(client, "MCP client should be connected");
      const result = await client.callTool("get_snippet", {
        snippet_id: snippetId,
        include_content: true,
      });
      assert.notStrictEqual(result.isError, true, resultText(result));
      const text = resultText(result);
      assert.ok(!text.includes(SECRET), "the keyword must be masked");
      assert.ok(text.includes(REPLACEMENT), "the masked replacement should appear");
    });

    test("list_snippets without project_id returns the masked title", async () => {
      assert.ok(client, "MCP client should be connected");
      const result = await client.callTool("list_snippets", { per_page: 100 });
      assert.notStrictEqual(result.isError, true, resultText(result));
      const text = resultText(result);
      assert.ok(!text.includes(SECRET), "the keyword must be masked");
      const listed = JSON.parse(text) as Array<{ id: number; title: string }>;
      const entry = listed.find(snippet => snippet.id === snippetId);
      assert.ok(entry, `snippet ${snippetId} should be listed`);
      assert.ok(entry.title.includes(REPLACEMENT), entry.title);
    });
  }
);
