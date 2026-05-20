import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-12345";
const TEST_PROJECT_ID = "123";

const MOCK_BLAME = [
  {
    lines: ["line one", ""],
    commit: {
      id: "1111111111111111111111111111111111111111",
      message: "feat: initial commit",
      authored_date: "2024-01-01T00:00:00.000Z",
      author_name: "Alice",
      author_email: "alice@example.com",
    },
  },
  {
    lines: ["line three"],
    commit: {
      id: "2222222222222222222222222222222222222222",
      message: "feat: add second change",
      authored_date: "2024-02-02T00:00:00.000Z",
      author_name: "Bob",
      author_email: "bob@example.com",
    },
  },
];

async function callGetFileBlame(
  args: Record<string, any>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
        GITLAB_READ_ONLY_MODE: "true",
      },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (d) => (output += d));
    proc.stderr?.on("data", (d) => (errorOutput += d));

    proc.on("close", (code) => {
      if (code !== 0)
        return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      const line = output.split("\n").find((l) => l.startsWith("{"));
      if (!line) return reject(new Error("No JSON output found"));
      try {
        const response = JSON.parse(line);
        if (response.error) return reject(response.error);
        const content = response.result?.content?.[0]?.text;
        if (content) return resolve(JSON.parse(content));
        resolve(response.result);
      } catch (e) {
        reject(e);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get_file_blame", arguments: args },
      }) + "\n"
    );
  });
}

describe("get_file_blame", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  let lastQuery: Record<string, any> = {};

  before(async () => {
    const mockPort = await findMockServerPort(9000);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/repository/files/src%2Fexample.txt/blame`,
      (req, res) => {
        lastQuery = req.query;
        res.json(MOCK_BLAME);
      }
    );
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("returns blame entries for a file at ref", async () => {
    const blame = await callGetFileBlame(
      {
        project_id: TEST_PROJECT_ID,
        file_path: "src/example.txt",
        ref: "main",
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(Array.isArray(blame), "Response should be an array");
    assert.strictEqual(blame.length, 2, "Two blame entries expected");
    assert.strictEqual(
      blame[1].commit.id,
      "2222222222222222222222222222222222222222",
      "second entry commit id matches"
    );
    assert.deepStrictEqual(blame[1].lines, ["line three"]);
    assert.strictEqual(lastQuery.ref, "main", "ref propagated to GitLab API");
    assert.ok(
      !("range[start]" in lastQuery) && !("range[end]" in lastQuery),
      "no range params when omitted"
    );
  });

  test("passes range[start]/range[end] when both set", async () => {
    await callGetFileBlame(
      {
        project_id: TEST_PROJECT_ID,
        file_path: "src/example.txt",
        ref: "main",
        range_start: 10,
        range_end: 20,
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.strictEqual(lastQuery["range[start]"], "10");
    assert.strictEqual(lastQuery["range[end]"], "20");
  });

  test("rejects partial range (range_start only) at schema layer", async () => {
    await assert.rejects(
      () =>
        callGetFileBlame(
          {
            project_id: TEST_PROJECT_ID,
            file_path: "src/example.txt",
            ref: "main",
            range_start: 10,
          },
          {
            GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
            GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
          }
        ),
      (e: any) =>
        typeof e?.message === "string" &&
        e.message.includes("range_start and range_end must be provided together")
    );
  });

  test("rejects inverted range (start > end) at schema layer", async () => {
    await assert.rejects(
      () =>
        callGetFileBlame(
          {
            project_id: TEST_PROJECT_ID,
            file_path: "src/example.txt",
            ref: "main",
            range_start: 20,
            range_end: 10,
          },
          {
            GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
            GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
          }
        ),
      (e: any) =>
        typeof e?.message === "string" &&
        e.message.includes("range_start must be less than or equal to range_end")
    );
  });
});
