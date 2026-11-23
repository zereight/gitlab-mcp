import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-search-project-scope-token";

const blob = (projectId: number) => ({
  basename: "README",
  data: `project ${projectId} match`,
  path: "README.md",
  filename: "README.md",
  id: null,
  ref: "main",
  startline: 1,
  project_id: projectId,
});

/** Paths the mock received, relative to /api/v4 (e.g. "/search" or "/projects/11/search"). */
const searchHits: string[] = [];

function inheritedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of [
    "GITLAB_ALLOWED_PROJECT_IDS",
    "GITLAB_PROJECT_ID",
    "ENABLE_STRICT_PROJECT_SCOPE",
    "GITLAB_TOOLS",
    "GITLAB_TOOLSETS",
  ]) {
    delete env[key];
  }
  return env;
}

interface ToolResult {
  isError: boolean;
  text: string;
}

/** One stdio tools/call; resolves with the tool result and rejects on a JSON-RPC error. */
async function callTool(
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<ToolResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...inheritedEnv(), ...env },
    });

    proc.on("error", reject);

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (d: Buffer) => (output += d));
    proc.stderr?.on("data", (d: Buffer) => (errorOutput += d));

    proc.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        return;
      }
      const line = output.split("\n").find(l => l.startsWith("{"));
      if (!line) {
        reject(new Error("No JSON output found"));
        return;
      }
      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(new Error(response.error.message ?? JSON.stringify(response.error)));
          return;
        }
        const text = response.result?.content?.[0]?.text;
        resolve({
          isError: response.result?.isError === true,
          text: typeof text === "string" ? text : JSON.stringify(response.result),
        });
      } catch (error) {
        reject(error);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "search_project_code", arguments: args },
      }) + "\n"
    );
  });
}

describe("search_project_code stays inside one project", { concurrency: 1 }, () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  const env = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLS: "search_project_code",
    GITLAB_DISABLE_VERSION_CHECK: "true",
    ...extra,
  });

  before(async () => {
    const port = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
    mockGitLab.addMockHandler("get", "/search", (req, res) => {
      searchHits.push(req.path);
      res.json([blob(22)]);
    });
    for (const id of [11, 22]) {
      mockGitLab.addMockHandler("get", `/projects/${id}/search`, (req, res) => {
        searchHits.push(req.path);
        res.json([blob(id)]);
      });
    }
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  beforeEach(() => {
    searchHits.length = 0;
  });

  test("an empty project_id uses the single allowed project under strict scope", async () => {
    const result = await callTool(
      { project_id: "", search: "match" },
      env({ GITLAB_ALLOWED_PROJECT_IDS: "11", ENABLE_STRICT_PROJECT_SCOPE: "true" })
    );
    assert.equal(result.isError, false, result.text);
    assert.deepEqual(searchHits, ["/projects/11/search"]);
    assert.ok(!result.text.includes("project 22"), result.text);
  });

  test("an empty project_id with several allowed projects asks for one", async () => {
    const result = await callTool(
      { project_id: "", search: "match" },
      env({ GITLAB_ALLOWED_PROJECT_IDS: "11,33", ENABLE_STRICT_PROJECT_SCOPE: "true" })
    );
    assert.equal(result.isError, true, result.text);
    assert.match(result.text, /Multiple projects allowed/);
    assert.deepEqual(searchHits, [], "no search request may reach GitLab");
  });

  test("an empty project_id uses GITLAB_PROJECT_ID", async () => {
    const result = await callTool(
      { project_id: "", search: "match" },
      env({ GITLAB_PROJECT_ID: "11", ENABLE_STRICT_PROJECT_SCOPE: "true" })
    );
    assert.equal(result.isError, false, result.text);
    assert.deepEqual(searchHits, ["/projects/11/search"]);
  });

  test("an empty project_id without a default project is an input error", async () => {
    const result = await callTool({ project_id: "", search: "match" }, env());
    assert.equal(result.isError, true, result.text);
    assert.match(result.text, /No project ID provided/);
    assert.deepEqual(searchHits, [], "no instance-wide search may be sent");
  });

  test("an allowed project_id is searched", async () => {
    const result = await callTool(
      { project_id: "11", search: "match" },
      env({ GITLAB_ALLOWED_PROJECT_IDS: "11", ENABLE_STRICT_PROJECT_SCOPE: "true" })
    );
    assert.equal(result.isError, false, result.text);
    assert.deepEqual(searchHits, ["/projects/11/search"]);
  });

  test("a project_id outside the allowlist is refused", async () => {
    const result = await callTool(
      { project_id: "22", search: "match" },
      env({ GITLAB_ALLOWED_PROJECT_IDS: "11" })
    );
    assert.equal(result.isError, true, result.text);
    assert.match(result.text, /Access denied/);
    assert.deepEqual(searchHits, []);
  });

  test("any project_id is searched without an allowlist", async () => {
    const result = await callTool({ project_id: "22", search: "match" }, env());
    assert.equal(result.isError, false, result.text);
    assert.deepEqual(searchHits, ["/projects/22/search"]);
  });
});
