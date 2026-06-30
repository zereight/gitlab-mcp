import { describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "mock-update-project-token";
const TEST_PROJECT_ID = "123";

async function callUpdateProject(
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
        SSE: "false",
        STREAMABLE_HTTP: "false",
        REMOTE_AUTHORIZATION: "false",
        GITLAB_MCP_OAUTH: "false",
      },
    });

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
          reject(new Error(response.error?.message ?? String(response.error)));
          return;
        }

        const content = response.result?.content?.[0]?.text;
        resolve(content ? JSON.parse(content) : response.result);
      } catch (error) {
        reject(error);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "update_project", arguments: args },
      }) + "\n"
    );
  });
}

describe("update_project", () => {
  test("sends project settings to PUT /projects/:id", async () => {
    const mockPort = await findMockServerPort();
    const mockServer = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
    let receivedBody: Record<string, unknown> | undefined;

    mockServer.addMockHandler("put", `/projects/${TEST_PROJECT_ID}`, (req, res) => {
      receivedBody = req.body as Record<string, unknown>;
      res.json({ id: Number(TEST_PROJECT_ID), ...receivedBody });
    });

    await mockServer.start();

    try {
      const result = await callUpdateProject(
        {
          project_id: TEST_PROJECT_ID,
          description: "Managed by MCP",
          visibility: "private",
          topics: ["ai", "mcp"],
          issues_access_level: "enabled",
          wiki_access_level: "disabled",
          remove_source_branch_after_merge: "true",
        },
        {
          GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
          GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        }
      );

      assert.deepStrictEqual(receivedBody, {
        description: "Managed by MCP",
        visibility: "private",
        topics: ["ai", "mcp"],
        issues_access_level: "enabled",
        wiki_access_level: "disabled",
        remove_source_branch_after_merge: true,
      });
      assert.strictEqual(result.description, "Managed by MCP");
    } finally {
      await mockServer.stop();
    }
  });

  test("keeps string false as boolean false", async () => {
    const mockPort = await findMockServerPort();
    const mockServer = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
    let receivedBody: Record<string, unknown> | undefined;

    mockServer.addMockHandler("put", `/projects/${TEST_PROJECT_ID}`, (req, res) => {
      receivedBody = req.body as Record<string, unknown>;
      res.json({ id: Number(TEST_PROJECT_ID), ...receivedBody });
    });

    await mockServer.start();

    try {
      await callUpdateProject(
        { project_id: TEST_PROJECT_ID, remove_source_branch_after_merge: "false" },
        {
          GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
          GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        }
      );

      assert.strictEqual(receivedBody?.remove_source_branch_after_merge, false);
    } finally {
      await mockServer.stop();
    }
  });

  test("rejects public access level for non-pages features", async () => {
    await assert.rejects(
      () =>
        callUpdateProject(
          { project_id: TEST_PROJECT_ID, issues_access_level: "public" },
          {
            GITLAB_API_URL: "https://gitlab.example.com/api/v4",
            GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
          }
        ),
      /Invalid enum value/
    );
  });

  test("rejects empty updates before calling GitLab", async () => {
    await assert.rejects(
      () =>
        callUpdateProject(
          { project_id: TEST_PROJECT_ID },
          {
            GITLAB_API_URL: "https://gitlab.example.com/api/v4",
            GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
          }
        ),
      /Provide at least one project setting/
    );
  });
});
