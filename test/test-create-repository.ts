import { describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "mock-token-create-repository";
const TEST_NAMESPACE_ID = 6;

const MOCK_CREATED_PROJECT = {
  id: "99",
  name: "my-docs",
  path_with_namespace: "my-group/my-docs",
  description: null,
  visibility: "private",
};

async function callCreateRepository(
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
        GITLAB_TEST_MODE: "true",
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
        params: { name: "create_repository", arguments: args },
      }) + "\n"
    );
  });
}

describe("When create_repository is called", () => {
  describe("with namespace_id", () => {
    test("should forward namespace_id in POST /projects body", async () => {
      const mockPort = await findMockServerPort();
      const mockServer = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
      let receivedBody: Record<string, unknown> | undefined;

      mockServer.addMockHandler("post", "/projects", (req, res) => {
        receivedBody = req.body as Record<string, unknown>;
        res.status(201).json(MOCK_CREATED_PROJECT);
      });

      await mockServer.start();

      try {
        const result = await callCreateRepository(
          { name: "my-docs", namespace_id: TEST_NAMESPACE_ID },
          {
            GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
            GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
          }
        );

        assert.deepStrictEqual(receivedBody?.namespace_id, TEST_NAMESPACE_ID);
        assert.strictEqual((result as { name: string }).name, "my-docs");
      } finally {
        await mockServer.stop();
      }
    });

    test("should accept string namespace_id from list_namespaces", async () => {
      const mockPort = await findMockServerPort();
      const mockServer = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
      let receivedBody: Record<string, unknown> | undefined;

      mockServer.addMockHandler("post", "/projects", (req, res) => {
        receivedBody = req.body as Record<string, unknown>;
        res.status(201).json(MOCK_CREATED_PROJECT);
      });

      await mockServer.start();

      try {
        await callCreateRepository(
          { name: "my-docs", namespace_id: String(TEST_NAMESPACE_ID) },
          {
            GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
            GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
          }
        );

        assert.deepStrictEqual(receivedBody?.namespace_id, TEST_NAMESPACE_ID);
      } finally {
        await mockServer.stop();
      }
    });
  });

  describe("without namespace_id", () => {
    test("should omit namespace_id from POST /projects body", async () => {
      const mockPort = await findMockServerPort();
      const mockServer = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
      let receivedBody: Record<string, unknown> | undefined;

      mockServer.addMockHandler("post", "/projects", (req, res) => {
        receivedBody = req.body as Record<string, unknown>;
        res.status(201).json(MOCK_CREATED_PROJECT);
      });

      await mockServer.start();

      try {
        await callCreateRepository(
          { name: "my-docs" },
          {
            GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
            GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
          }
        );

        assert.ok(receivedBody);
        assert.ok(!Object.hasOwn(receivedBody, "namespace_id"));
      } finally {
        await mockServer.stop();
      }
    });
  });
});
