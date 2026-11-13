import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { StdioTestClient } from "./clients/stdio-client.js";
import { hasMarker, runInShell, withStubWorkspace } from "./cli/shell-replay-harness.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

// End to end through the MCP server: with compaction on, the replay line attached
// to a compacted reply must run as literal arguments when a shell executes it.

const MOCK_TOKEN = "glpat-mock-token-12345";
const SERVER_PATH = "build/index.js";
const MARKER = "PWNED";

interface CompactedPayload {
  readonly compact: true;
  readonly cli?: string;
  readonly preview: unknown;
}

describe("GITLAB_MCP_COMPACT_RESULTS replay line", () => {
  let mockGitLab: MockGitLabServer;
  let baseEnv: Record<string, string>;

  before(async () => {
    const port = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
    await mockGitLab.start();
    baseEnv = {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_READ_ONLY_MODE: "true",
      GITLAB_MCP_COMPACT_RESULTS: "true",
      GITLAB_MCP_COMPACT_RESULT_CHARS: "10",
    };
  });

  after(async () => {
    await mockGitLab.stop();
  });

  async function callCompacted(args: Record<string, unknown>): Promise<CompactedPayload> {
    const client = new StdioTestClient();
    await client.connect(SERVER_PATH, baseEnv);
    try {
      const result = (await client.callTool("list_merge_requests", args)) as {
        isError?: boolean;
        content: { type: string; text: string }[];
      };
      assert.notEqual(result.isError, true, "the call must succeed so the reply is compacted");
      const payload = JSON.parse(result.content[0].text) as CompactedPayload;
      assert.equal(payload.compact, true);
      return payload;
    } finally {
      await client.disconnect();
    }
  }

  test("runs a search value containing command substitution as one literal argument", async () => {
    const search = `x$(touch ${MARKER}) \`touch ${MARKER}\` $HOME; echo hi`;
    const payload = await callCompacted({ project_id: "123", search });
    assert.equal(typeof payload.cli, "string");

    withStubWorkspace(workspace => {
      const argv = runInShell(payload.cli as string, workspace);
      assert.ok(argv !== undefined, "the replay must invoke the binary");
      assert.equal(hasMarker(workspace, MARKER), false, "the shell executed injected code");
      assert.deepEqual(argv, [
        "tool",
        "list_merge_requests",
        "--project-id",
        "123",
        "--search",
        search,
      ]);
    });
  });

  test("drops the replay line, but keeps the preview, for an argument name with command substitution", async () => {
    const payload = await callCompacted({ project_id: "123", [`$(touch ${MARKER}KEY)`]: "1" });
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "cli"), false);
    assert.notEqual(payload.preview, undefined);
    withStubWorkspace(workspace => {
      assert.equal(hasMarker(workspace, `${MARKER}KEY`), false);
    });
  });
});
