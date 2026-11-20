/**
 * Tests for the update_file_patch tool: the file is read from the branch, patched on
 * the server, and committed with the file's last_commit_id; lines outside the patch
 * are never resent by the caller.
 */

import assert from "node:assert";
import { after, before, beforeEach, describe, test } from "node:test";
import { Buffer } from "node:buffer";
import { CustomHeaderClient } from "./clients/custom-header-client.js";
import {
  cleanupServers,
  findAvailablePort,
  HOST,
  launchServer,
  type ServerInstance,
  TransportMode,
} from "./utils/server-launcher.js";
import { findMockServerPort, MockGitLabServer } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-update-file-patch-test-token";
const PROJECT_ID = "123";
const FILE_PATH = "apps/demo/values.yaml";
const ENCODED_PATH = encodeURIComponent(FILE_PATH);
const BRANCH = "feature/raise-cpu";

const ORIGINAL = [
  "app:",
  "  psql:",
  "    resources:",
  "      requests:",
  "        cpu: 50m",
  "        memory: 600Mi",
  "  cronJobs:",
  "    - name: compact",
  "      suspend: false",
  "      requests:",
  "        cpu: 50m",
  "",
].join("\n");

describe("update_file_patch", { timeout: 30_000 }, () => {
  let mockGitLab: MockGitLabServer;
  let server: ServerInstance;
  let client: CustomHeaderClient;

  // In-memory file the mock GitLab serves and updates
  let content = ORIGINAL;
  let lastCommitId = "commit-1";
  let commitCount = 0;
  let lastPut: Record<string, any> | undefined;
  const readRefs: string[] = [];

  function resetFile() {
    content = ORIGINAL;
    lastCommitId = "commit-1";
    commitCount = 0;
    lastPut = undefined;
    readRefs.length = 0;
  }

  async function call(args: Record<string, unknown>) {
    const result = await client.callTool("update_file_patch", {
      project_id: PROJECT_ID,
      file_path: FILE_PATH,
      branch: BRANCH,
      commit_message: "raise cpu",
      patch_type: "search_replace",
      ...args,
    });
    return JSON.parse((result.content as any)[0]?.text || "{}");
  }

  async function callExpectingError(args: Record<string, unknown>): Promise<string> {
    try {
      const result = await client.callTool("update_file_patch", {
        project_id: PROJECT_ID,
        file_path: FILE_PATH,
        branch: BRANCH,
        commit_message: "raise cpu",
        patch_type: "search_replace",
        ...args,
      });
      if ((result as any).isError) {
        return (result.content as any)[0]?.text ?? "";
      }
    } catch (err: any) {
      return err.message ?? String(err);
    }
    assert.fail("update_file_patch should have failed");
  }

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });

    for (const path of [ENCODED_PATH, FILE_PATH]) {
      mockGitLab.addMockHandler(
        "get",
        `/projects/${PROJECT_ID}/repository/files/${path}`,
        (req, res) => {
          readRefs.push(String(req.query.ref ?? ""));
          res.json({
            file_name: "values.yaml",
            file_path: FILE_PATH,
            encoding: "base64",
            content: Buffer.from(content, "utf8").toString("base64"),
            ref: String(req.query.ref ?? ""),
            commit_id: lastCommitId,
            last_commit_id: lastCommitId,
          });
        }
      );
      mockGitLab.addMockHandler(
        "put",
        `/projects/${PROJECT_ID}/repository/files/${path}`,
        (req, res) => {
          lastPut = req.body;
          if (req.body.last_commit_id && req.body.last_commit_id !== lastCommitId) {
            res.status(400).json({
              message:
                "You are attempting to update a file that has changed since you started editing it.",
            });
            return;
          }
          content =
            req.body.encoding === "base64"
              ? Buffer.from(req.body.content, "base64").toString("utf8")
              : req.body.content;
          commitCount += 1;
          lastCommitId = `commit-${commitCount + 1}`;
          res.json({ file_path: FILE_PATH, branch: req.body.branch });
        }
      );
    }
    mockGitLab.addMockHandler(
      "get",
      `/projects/${PROJECT_ID}/repository/files/logo.png`,
      (_req, res) => {
        res.json({
          file_name: "logo.png",
          file_path: "logo.png",
          encoding: "base64",
          content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0xd8]).toString("base64"),
          last_commit_id: "commit-1",
        });
      }
    );
    await mockGitLab.start();

    const port = await findAvailablePort(3720);
    server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port,
      timeout: 10_000,
      env: {
        STREAMABLE_HTTP: "true",
        REMOTE_AUTHORIZATION: "true",
        GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        GITLAB_TOOLSETS: "repositories",
      },
    });
    client = new CustomHeaderClient({ headers: { authorization: `Bearer ${MOCK_TOKEN}` } });
    await client.connect(`http://${HOST}:${port}/mcp`);
  });

  after(async () => {
    await client?.disconnect();
    cleanupServers([server]);
    if (mockGitLab) await mockGitLab.stop();
  });

  beforeEach(() => resetFile());

  test("tool appears in the repositories toolset", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t: any) => t.name);
    assert.ok(names.includes("update_file_patch"), "update_file_patch should be listed");
  });

  test("search_replace commits only the changed line and keeps every other line", async () => {
    const data = await call({
      patch:
        "<<<<<<< SEARCH\n      requests:\n        cpu: 50m\n        memory: 600Mi\n=======\n      requests:\n        cpu: 500m\n        memory: 600Mi\n>>>>>>> REPLACE",
    });
    assert.strictEqual(data.status, "success");
    assert.strictEqual(data.changes, 1);
    assert.strictEqual(data.branch, BRANCH);
    assert.ok(data.preview.includes("+        cpu: 500m"), "preview should show the new line");
    assert.strictEqual(
      content,
      ORIGINAL.replace("        cpu: 50m\n        memory", "        cpu: 500m\n        memory")
    );
    assert.ok(content.includes("      suspend: false"), "untouched lines must stay");
    assert.ok(readRefs.includes(BRANCH), "file should be read from the target branch");
    assert.strictEqual(
      lastPut?.last_commit_id,
      "commit-1",
      "commit should carry the commit id read with the file"
    );
    assert.strictEqual(lastPut?.branch, BRANCH);
  });

  test("dry_run returns the diff without committing", async () => {
    const data = await call({
      patch: "<<<<<<< SEARCH\n      suspend: false\n=======\n      suspend: true\n>>>>>>> REPLACE",
      dry_run: true,
    });
    assert.strictEqual(data.status, "preview");
    assert.strictEqual(data.dry_run, true);
    assert.ok(data.preview.includes("+      suspend: true"));
    assert.strictEqual(commitCount, 0);
    assert.strictEqual(content, ORIGINAL);
  });

  test("a SEARCH text that matches twice is refused without committing", async () => {
    const msg = await callExpectingError({
      patch: "<<<<<<< SEARCH\n        cpu: 50m\n=======\n        cpu: 500m\n>>>>>>> REPLACE",
    });
    assert.match(msg, /matches 2 times/);
    assert.strictEqual(commitCount, 0);
  });

  test("a SEARCH text that is not in the file is refused without committing", async () => {
    const msg = await callExpectingError({
      patch: "<<<<<<< SEARCH\n        cpu: 75m\n=======\n        cpu: 500m\n>>>>>>> REPLACE",
    });
    assert.match(msg, /not found in file/);
    assert.strictEqual(commitCount, 0);
  });

  test("unified_diff patches the file", async () => {
    const data = await call({
      patch_type: "unified_diff",
      patch:
        "--- a/values.yaml\n+++ b/values.yaml\n@@ -7,4 +7,4 @@\n   cronJobs:\n     - name: compact\n-      suspend: false\n+      suspend: true\n       requests:\n",
    });
    assert.strictEqual(data.status, "success");
    assert.ok(content.includes("      suspend: true"));
    assert.ok(
      content.includes("        cpu: 50m\n        memory: 600Mi"),
      "untouched lines must stay"
    );
  });

  test("an explicit last_commit_id that is stale makes GitLab reject the commit", async () => {
    const msg = await callExpectingError({
      patch: "<<<<<<< SEARCH\n      suspend: false\n=======\n      suspend: true\n>>>>>>> REPLACE",
      last_commit_id: "commit-0",
    });
    assert.match(msg, /changed since/);
    assert.strictEqual(content, ORIGINAL);
  });

  test("a binary file is refused", async () => {
    const msg = await callExpectingError({
      file_path: "logo.png",
      patch: "<<<<<<< SEARCH\nPNG\n=======\nJPG\n>>>>>>> REPLACE",
    });
    assert.match(msg, /not a UTF-8 text file/);
  });
});
