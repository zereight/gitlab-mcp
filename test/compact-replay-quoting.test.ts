import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { StdioTestClient } from "./clients/stdio-client.js";
import { runInEveryShell, withStubWorkspace } from "./cli/shell-replay-harness.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

// End to end through the MCP server: with compaction on, a compacted reply carries
// either a `cli` line that sh, cmd.exe and PowerShell all read as the same literal
// arguments, or, when no such line exists, the argv as `cli_argv`.

const MOCK_TOKEN = "glpat-mock-token-12345";
const SERVER_PATH = "build/index.js";
const MARKER = "PWNED";
const BINARY = "zereight-mcp-gitlab";

interface CompactedPayload {
  readonly compact: true;
  readonly cli?: string;
  readonly cli_argv?: readonly string[];
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
      GITLAB_PERMISSION_MODE: "readonly",
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

  test("attaches a double-quoted cli line for a value with a space that every shell reads as one argument", async () => {
    const payload = await callCompacted({ project_id: "123", search: "foo bar" });
    assert.notEqual(payload.preview, undefined);
    assert.equal(payload.cli_argv, undefined);
    assert.equal(
      payload.cli,
      `${BINARY} tool list_merge_requests --project-id 123 --search "foo bar"`
    );

    withStubWorkspace(workspace => {
      assert.deepEqual(runInEveryShell(payload.cli as string, workspace), [
        "tool",
        "list_merge_requests",
        "--project-id",
        "123",
        "--search",
        "foo bar",
      ]);
    });
  });

  const ARGV_ONLY_SEARCHES = [
    ["POSIX command substitution", `x$(touch ${MARKER}) \`touch ${MARKER}\` $HOME; echo hi`],
    ["cmd.exe operators", "x & echo INJECTED > marker & rem "],
    ["a PowerShell single quote", `x' ; New-Item ${MARKER}2 ; '`],
  ] as const;

  for (const [label, search] of ARGV_ONLY_SEARCHES) {
    test(`attaches cli_argv, and no cli line, for a search value with ${label}`, async () => {
      const payload = await callCompacted({ project_id: "123", search });
      assert.notEqual(payload.preview, undefined);
      assert.equal(Object.prototype.hasOwnProperty.call(payload, "cli"), false);
      assert.deepEqual(payload.cli_argv, [
        BINARY,
        "tool",
        "list_merge_requests",
        "--project-id",
        "123",
        "--search",
        search,
      ]);
    });
  }

  test("drops both cli and cli_argv, but keeps the preview, for an argument name with command substitution", async () => {
    const payload = await callCompacted({ project_id: "123", [`$(touch ${MARKER}KEY)`]: "1" });
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "cli"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "cli_argv"), false);
    assert.notEqual(payload.preview, undefined);
  });
});
