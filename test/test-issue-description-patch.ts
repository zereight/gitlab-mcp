/**
 * Tests for the update_issue_description_patch tool.
 * Tests search_replace, unified_diff, dry_run, create_note, and edge cases.
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import {
  launchServer,
  findAvailablePort,
  cleanupServers,
  ServerInstance,
  TransportMode,
  HOST,
} from "./utils/server-launcher.js";
import {
  MockGitLabServer,
  findMockServerPort,
} from "./utils/mock-gitlab-server.js";
import { CustomHeaderClient } from "./clients/custom-header-client.js";
import {
  parseSearchReplaceBlocks,
  applySearchReplace,
  applyUnifiedDiff,
} from "../utils/patch-helper.js";

const MOCK_TOKEN = "glpat-patch-test-token-12345";

// ---- Unit tests for patch helper ----

describe("parseSearchReplaceBlocks", () => {
  test("parses a single block", () => {
    const blocks = parseSearchReplaceBlocks(
      "<<<<<<< SEARCH\nold text\n=======\nnew text\n>>>>>>> REPLACE"
    );
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].search, "old text");
    assert.strictEqual(blocks[0].replace, "new text");
  });

  test("parses multiple blocks", () => {
    const blocks = parseSearchReplaceBlocks(
      "<<<<<<< SEARCH\nfirst\n=======\nfirst new\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nsecond\n=======\nsecond new\n>>>>>>> REPLACE"
    );
    assert.strictEqual(blocks.length, 2);
  });

  test("handles empty content", () => {
    const blocks = parseSearchReplaceBlocks("");
    assert.strictEqual(blocks.length, 0);
  });

  test("ignores text outside blocks", () => {
    const blocks = parseSearchReplaceBlocks(
      "prefix\n<<<<<<< SEARCH\nx\n=======\ny\n>>>>>>> REPLACE\nsuffix"
    );
    assert.strictEqual(blocks.length, 1);
  });

  test("rejects malformed block with missing REPLACE marker", () => {
    assert.throws(
      () => parseSearchReplaceBlocks(
        "<<<<<<< SEARCH\nfirst\n=======\nfirst new\n>>>>>>> REPLACE\n" +
        "<<<<<<< SEARCH\nsecond\n=======\nsecond new\n>>>>>>> TYPO"
      ),
      /malformed|Marker|marker/
    );
  });

  test("rejects block with missing ======= marker", () => {
    assert.throws(
      () => parseSearchReplaceBlocks(
        "<<<<<<< SEARCH\nfoo\n\nbar\n>>>>>>> REPLACE"
      ),
      /malformed|Marker|marker/
    );
  });

  test("allows prose around valid blocks", () => {
    const blocks = parseSearchReplaceBlocks(
      "# Some notes\n\n<<<<<<< SEARCH\nfoo\n=======\nbar\n>>>>>>> REPLACE\n\nMore context"
    );
    assert.strictEqual(blocks.length, 1);
  });
});

describe("applySearchReplace", () => {
  test("replaces single occurrence", () => {
    const result = applySearchReplace("Status: In progress\nDone.", [
      { search: "Status: In progress", replace: "Status: Done" },
    ]);
    assert.strictEqual(result.description, "Status: Done\nDone.");
    assert.strictEqual(result.changes, 1);
    assert.ok(result.summary.includes("Status: In progress"));
    assert.ok(result.preview.includes("-Status: In progress"));
  });

  test("fails on no match", () => {
    assert.throws(
      () => applySearchReplace("Some text.", [{ search: "Nonexistent", replace: "x" }]),
      /Search text not found/
    );
  });

  test("rejects empty SEARCH body", () => {
    assert.throws(
      () => applySearchReplace("Some text.", [{ search: "", replace: "x" }], true),
      /Empty SEARCH/
    );
  });

  test("fails on duplicate without allowMultiple", () => {
    assert.throws(
      () => applySearchReplace("x\ny\nx\n", [{ search: "x", replace: "z" }]),
      /matches 2 times/
    );
  });

  test("replaces all with allowMultiple", () => {
    const result = applySearchReplace("x\ny\nx\n", [{ search: "x", replace: "z" }], true);
    assert.strictEqual(result.changes, 2);
    assert.strictEqual(result.description, "z\ny\nz\n");
  });

  test("fails on identical replacement", () => {
    assert.throws(
      () => applySearchReplace("Keep this.", [{ search: "Keep this.", replace: "Keep this." }]),
      /did not change/
    );
  });

  test("preserves leading blank line in SEARCH block", () => {
    const source = "\n\nStatus: In progress\n";
    const result = applySearchReplace(source, [
      { search: "\n\nStatus: In progress", replace: "\n\nStatus: Done" },
    ]);
    assert.strictEqual(result.description, "\n\nStatus: Done\n");
  });

  test("preserves leading blank line when patch starts with blank line", () => {
    const blocks = parseSearchReplaceBlocks(
      "<<<<<<< SEARCH\n\nfoo\n=======\n\nbar\n>>>>>>> REPLACE"
    );
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].search, "\nfoo");
    assert.strictEqual(blocks[0].replace, "\nbar");
  });

  test("replacement with leading blank line works", () => {
    const result = applySearchReplace("Header\n\nContent\n", [
      { search: "Content", replace: "\nNewContent" },
    ]);
    assert.strictEqual(result.description, "Header\n\n\nNewContent\n");
  });
});

describe("applyUnifiedDiff", () => {
  test("applies simple diff", () => {
    const source = "Line 1\nLine 2\nLine 3\n";
    const patch = "--- old\n+++ new\n@@ -1,3 +1,3 @@\n Line 1\n-Line 2\n+Line 2 modified\n Line 3\n";
    const result = applyUnifiedDiff(source, patch);
    assert.ok(result.description.includes("Line 2 modified"));
  });

  test("fails on non-matching diff", () => {
    const source = "AAA\nBBB\n";
    const patch = "--- old\n+++ new\n@@ -1,2 +1,2 @@\n-XXX\n+YYY\n BBB\n";
    assert.throws(() => applyUnifiedDiff(source, patch), /could not be applied/);
  });

test("fails on malformed patch", () => {
    assert.throws(() => applyUnifiedDiff("text", "not a patch"), /no valid hunks/i);
  });
});

// ---- Integration tests via MCP client ----

describe("update_issue_description_patch MCP tool", () => {
  let mockGitLab: MockGitLabServer;
  let server: ServerInstance;
  let client: CustomHeaderClient;

  const MOCK_PORT_BASE = 9600;
  const MCP_PORT_BASE = 3600;
  let portCounter = 0;

  async function launchMcp(
    mockGitLabUrl: string,
    extraEnv: Record<string, string> = {}
  ): Promise<ServerInstance> {
    const port = MCP_PORT_BASE + portCounter++ * 10;
    return launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port,
      timeout: 10000,
      env: {
        STREAMABLE_HTTP: "true",
        REMOTE_AUTHORIZATION: "true",
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_ACCESS_TOKEN: MOCK_TOKEN,
        ...extraEnv,
      },
    });
  }

async function getClient(port: number): Promise<CustomHeaderClient> {
    const client = new CustomHeaderClient({
      headers: {
        authorization: `Bearer ${MOCK_TOKEN}`,
      },
    });
    await client.connect(`http://${HOST}:${port}/mcp`);
    return client;
  }

  before(async () => {
    const mockPort = await findMockServerPort(MOCK_PORT_BASE);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();

    const mockGitLabUrl = mockGitLab.getUrl();
    server = await launchMcp(mockGitLabUrl, { GITLAB_TOOLSETS: "issues" });
    client = await getClient(server.port ?? 0);
  });

  after(async () => {
    await client?.disconnect();
    cleanupServers([server]);
    await mockGitLab?.stop();
  });

  test("tool appears in tool list", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t: any) => t.name);
    assert.ok(names.includes("update_issue_description_patch"), "tool should be in list");
  });

  test("dry_run: search_replace returns preview without modifying", async () => {
    // Get current description
    const getResult = await client.callTool("get_issue", {
      project_id: "test/project",
      issue_iid: "1",
    });
    const issue = JSON.parse((getResult.content as any)[0]?.text || "{}");
    const originalDesc = issue.description;

    // Dry-run
    const result = await client.callTool("update_issue_description_patch", {
      project_id: "test/project",
      issue_iid: "1",
      patch_type: "search_replace",
      patch: `<<<<<<< SEARCH\n${originalDesc}\n=======\nShould NOT persist\n>>>>>>> REPLACE`,
      dry_run: true,
    });
    const data = JSON.parse((result.content as any)[0]?.text || "{}");
    assert.strictEqual(data.status, "preview");
    assert.strictEqual(data.dry_run, true);
    assert.strictEqual(data.changes, 1);

    // Verify NOT updated
    const getAgain = await client.callTool("get_issue", {
      project_id: "test/project",
      issue_iid: "1",
    });
    const issueAgain = JSON.parse((getAgain.content as any)[0]?.text || "{}");
    assert.strictEqual(issueAgain.description, originalDesc, "should be unchanged after dry_run");
  });

  test("search_replace: applies the patch", async () => {
    const result = await client.callTool("update_issue_description_patch", {
      project_id: "test/project",
      issue_iid: "1",
      patch_type: "search_replace",
      patch: `<<<<<<< SEARCH\nDescription for issue 1\n=======\nPatched description\n>>>>>>> REPLACE`,
    });
    const data = JSON.parse((result.content as any)[0]?.text || "{}");
    assert.strictEqual(data.status, "success");
    assert.strictEqual(data.changes, 1);

    // Verify persisted
    const getResult = await client.callTool("get_issue", {
      project_id: "test/project",
      issue_iid: "1",
    });
    const issue = JSON.parse((getResult.content as any)[0]?.text || "{}");
    assert.strictEqual(issue.description, "Patched description");
  });

  test("create_note: note is attempted after update", async () => {
    const result = await client.callTool("update_issue_description_patch", {
      project_id: "test/project",
      issue_iid: "1",
      patch_type: "search_replace",
      patch: `<<<<<<< SEARCH\nPatched description\n=======\nDescription with note\n>>>>>>> REPLACE`,
      create_note: true,
    });
    const data = JSON.parse((result.content as any)[0]?.text || "{}");
    assert.strictEqual(data.status, "success");
    assert.ok(data.note !== undefined, "note result should be present");
  });

  test("search_replace: fails on no match", async () => {
    try {
      await client.callTool("update_issue_description_patch", {
        project_id: "test/project",
        issue_iid: "1",
        patch_type: "search_replace",
        patch: `<<<<<<< SEARCH\nNonExistentText_{UNIQUE}_\n=======\nShould fail\n>>>>>>> REPLACE`,
      });
      assert.fail("Should have thrown");
    } catch (err: any) {
      const msg = err.message ?? String(err);
      assert.ok(msg.includes("not found"), `Error should mention 'not found': ${msg}`);
    }
  });

  test("unified_diff: applies the patch", async () => {
    // Set known state
    await client.callTool("update_issue_description_patch", {
      project_id: "test/project",
      issue_iid: "1",
      patch_type: "search_replace",
      patch: `<<<<<<< SEARCH\nDescription with note\n=======\nLine 1\nLine 2\nLine 3\n>>>>>>> REPLACE`,
    });

    const result = await client.callTool("update_issue_description_patch", {
      project_id: "test/project",
      issue_iid: "1",
      patch_type: "unified_diff",
      patch: "--- old\n+++ new\n@@ -1,3 +1,3 @@\n Line 1\n-Line 2\n+Line 2 changed\n Line 3\n",
    });
    const data = JSON.parse((result.content as any)[0]?.text || "{}");
    assert.strictEqual(data.status, "success");

    const getResult = await client.callTool("get_issue", {
      project_id: "test/project",
      issue_iid: "1",
    });
    const issue = JSON.parse((getResult.content as any)[0]?.text || "{}");
    assert.ok(issue.description.includes("Line 2 changed"));
  });
});
