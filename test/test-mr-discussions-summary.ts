import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { StdioTestClient } from "./clients/stdio-client.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-12345";
const TEST_PROJECT_ID = "123";
const TEST_MR_IID = "1";

interface DiscussionNote {
  readonly id?: unknown;
  readonly author?: unknown;
  readonly body?: unknown;
  readonly created_at?: unknown;
  readonly resolved?: unknown;
  readonly [key: string]: unknown;
}

interface Discussion {
  readonly id?: unknown;
  readonly notes?: DiscussionNote[];
  readonly [key: string]: unknown;
}

const DISCUSSIONS_FIXTURE = [
  {
    id: "10d5abc",
    individual_note: false,
    notes: [
      {
        id: 501,
        type: "DiffNote",
        body: "Please rename this.",
        attachment: null,
        author: {
          id: 7,
          username: "alice",
          name: "Alice",
          state: "active",
          avatar_url: null,
          web_url: "https://gitlab.mock/alice",
        },
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        system: false,
        noteable_id: 1,
        noteable_type: "MergeRequest",
        noteable_iid: 1,
        resolvable: true,
        resolved: false,
        resolved_by: null,
        resolved_at: null,
      },
    ],
  },
];

function callMrDiscussions(args: Record<string, unknown>, env: NodeJS.ProcessEnv) {
  return new Promise<{ items: Discussion[] }>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env, GITLAB_READ_ONLY_MODE: "true" },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", d => (output += d));
    proc.stderr?.on("data", d => (errorOutput += d));

    proc.on("close", code => {
      if (code !== 0) {
        return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      }
      const line = output.split("\n").find(l => l.startsWith("{"));
      if (!line) {
        return reject(new Error("No JSON output found"));
      }
      try {
        const response = JSON.parse(line);
        if (response.error) {
          return reject(response.error);
        }
        const content = response.result?.content?.[0]?.text;
        if (typeof content !== "string") {
          return reject(new Error(`Unexpected tool result: ${JSON.stringify(response.result)}`));
        }
        resolve(JSON.parse(content));
      } catch (e) {
        reject(e);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "mr_discussions", arguments: args },
      }) + "\n"
    );
  });
}

describe("mr_discussions summary", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  let baseEnv: NodeJS.ProcessEnv;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/merge_requests/${TEST_MR_IID}/discussions`,
      (_req, res) => {
        res.json(DISCUSSIONS_FIXTURE);
      }
    );
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
    baseEnv = {
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    };
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("keeps the full discussions when GITLAB_MCP_LIST_SUMMARY_DEFAULT is unset", async () => {
    const { items } = await callMrDiscussions(
      { project_id: TEST_PROJECT_ID, merge_request_iid: TEST_MR_IID },
      { ...baseEnv, GITLAB_MCP_LIST_SUMMARY_DEFAULT: undefined }
    );

    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].individual_note, false);
    const note = items[0].notes?.[0];
    assert.ok(note);
    assert.strictEqual(note.resolvable, true);
    assert.strictEqual(Reflect.get(note.author as object, "name"), "Alice");
  });

  test("summarizes notes when GITLAB_MCP_LIST_SUMMARY_DEFAULT is true and summary is omitted", async () => {
    const { items } = await callMrDiscussions(
      { project_id: TEST_PROJECT_ID, merge_request_iid: TEST_MR_IID },
      { ...baseEnv, GITLAB_MCP_LIST_SUMMARY_DEFAULT: "true" }
    );

    assert.deepStrictEqual(items, [
      {
        id: "10d5abc",
        notes: [
          {
            id: "501",
            author: { username: "alice" },
            body: "Please rename this.",
            created_at: "2024-01-01T00:00:00Z",
            resolved: false,
          },
        ],
      },
    ]);
  });

  test("keeps the full discussions when summary is false and the server default is on", async () => {
    const { items } = await callMrDiscussions(
      { project_id: TEST_PROJECT_ID, merge_request_iid: TEST_MR_IID, summary: false },
      { ...baseEnv, GITLAB_MCP_LIST_SUMMARY_DEFAULT: "true" }
    );

    assert.strictEqual(items.length, 1);
    const note = items[0].notes?.[0];
    assert.ok(note);
    assert.strictEqual(note.resolvable, true);
    assert.strictEqual(Reflect.get(note.author as object, "name"), "Alice");
  });

  test("states the server summary default in the mr_discussions schema", async () => {
    const client = new StdioTestClient();
    await client.connect("build/index.js", { ...baseEnv, GITLAB_MCP_LIST_SUMMARY_DEFAULT: "true" });
    try {
      const { tools } = await client.listTools();
      const tool = tools.find(t => t.name === "mr_discussions");
      const summary = tool?.inputSchema.properties?.summary as { description?: string } | undefined;
      assert.match(summary?.description ?? "", /defaults to true; pass false/);
    } finally {
      await client.disconnect();
    }
  });
});
