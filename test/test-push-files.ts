import { describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "mock-token-push-files";
const PROJECT_ID = "42";
const BRANCH = "feature/update";

const MOCK_COMMIT = {
  id: "0123456789abcdef0123456789abcdef01234567",
  short_id: "01234567",
  title: "Update files",
  author_name: "Tester",
  author_email: "tester@example.com",
  authored_date: "2025-01-01T00:00:00.000Z",
  committer_name: "Tester",
  committer_email: "tester@example.com",
  committed_date: "2025-01-01T00:00:00.000Z",
  web_url: "https://gitlab.example.com/group/project/-/commit/01234567",
  parent_ids: [],
};

interface CommitAction {
  action: string;
  file_path: string;
  content: string;
}

async function callPushFiles(
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (d: Buffer) => (output += d));
    proc.stderr?.on("data", (d: Buffer) => (errorOutput += d));

    proc.on("close", code => {
      if (code !== 0) {
        return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      }

      const line = output.split("\n").find(l => l.startsWith("{"));
      if (!line) return reject(new Error("No JSON output found"));

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(new Error(response.error?.message ?? String(response.error)));
        } else {
          const content = response.result?.content?.[0]?.text;
          resolve(content ? JSON.parse(content) : response.result);
        }
      } catch (e) {
        reject(e);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "push_files", arguments: args },
      }) + "\n"
    );
  });
}

/**
 * Starts a mock GitLab where `existingPaths` are already tracked in the branch and
 * everything else 404s, then runs one push_files call and returns the commit actions
 * the server received.
 */
async function actionsForPush(
  existingPaths: string[],
  files: { file_path: string; content: string }[]
): Promise<CommitAction[]> {
  const mockPort = await findMockServerPort();
  const mockServer = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
  let receivedActions: CommitAction[] = [];

  for (const path of existingPaths) {
    mockServer.addMockHandler(
      "head",
      `/projects/${PROJECT_ID}/repository/files/${encodeURIComponent(path)}`,
      (_req, res) => {
        res.status(200).end();
      }
    );
  }

  mockServer.addMockHandler("post", `/projects/${PROJECT_ID}/repository/commits`, (req, res) => {
    receivedActions = (req.body as { actions: CommitAction[] }).actions;
    res.status(201).json(MOCK_COMMIT);
  });

  await mockServer.start();

  try {
    await callPushFiles(
      {
        project_id: PROJECT_ID,
        branch: BRANCH,
        commit_message: "Update files",
        files,
      },
      {
        GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );
  } finally {
    await mockServer.stop();
  }

  return receivedActions;
}

describe("When push_files commits a file that already exists", () => {
  test("should send action 'update' instead of 'create'", async () => {
    // Regression: every action was hardcoded to "create", and GitLab answers
    // `400 A file with this name already exists` for a tracked path — so push_files
    // could only ever add new files.
    const actions = await actionsForPush(
      ["src/index.ts"],
      [{ file_path: "src/index.ts", content: "export const x = 1;\n" }]
    );

    assert.strictEqual(actions.length, 1);
    assert.strictEqual(actions[0].action, "update");
    assert.strictEqual(actions[0].file_path, "src/index.ts");
  });
});

describe("When push_files commits a file that does not exist", () => {
  test("should send action 'create'", async () => {
    const actions = await actionsForPush(
      [],
      [{ file_path: "docs/new-page.md", content: "# New\n" }]
    );

    assert.strictEqual(actions.length, 1);
    assert.strictEqual(actions[0].action, "create");
  });
});

describe("When push_files commits a mix of new and existing files", () => {
  test("should resolve the action per file", async () => {
    const actions = await actionsForPush(
      ["src/index.ts"],
      [
        { file_path: "src/index.ts", content: "export const x = 2;\n" },
        { file_path: "src/new-module.ts", content: "export const y = 3;\n" },
      ]
    );

    const byPath = Object.fromEntries(actions.map(a => [a.file_path, a.action]));
    assert.deepStrictEqual(byPath, {
      "src/index.ts": "update",
      "src/new-module.ts": "create",
    });
  });
});
