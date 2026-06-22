import { after, before, describe, test } from "node:test";
import assert from "node:assert";
import { Buffer } from "node:buffer";
import {
  cleanupServers,
  findAvailablePort,
  HOST,
  launchServer,
  ServerInstance,
  TransportMode,
} from "./utils/server-launcher.js";
import { findMockServerPort, MockGitLabServer } from "./utils/mock-gitlab-server.js";
import { CustomHeaderClient } from "./clients/custom-header-client.js";

const MOCK_TOKEN = "mock-concurrent-token-12345";
const TEST_PROJECT_ID = "123";

function fileResponse(filePath: string, content: string) {
  return {
    file_name: filePath.split("/").at(-1),
    file_path: filePath,
    encoding: "base64",
    content: Buffer.from(content, "utf8").toString("base64"),
  };
}

describe("Streamable HTTP concurrent session requests", { timeout: 20_000 }, () => {
  let mockGitLab: MockGitLabServer;
  let server: ServerInstance;
  let mcpUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(9360);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
      responseDelay: 100,
    });

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/repository/files/package.json`,
      (_req, res) => {
        res.json(fileResponse("package.json", "package file"));
      }
    );
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/repository/files/README.md`,
      (_req, res) => {
        res.json(fileResponse("README.md", "readme file"));
      }
    );

    await mockGitLab.start();

    const port = await findAvailablePort(3460);
    server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port,
      timeout: 10_000,
      env: {
        STREAMABLE_HTTP: "true",
        REMOTE_AUTHORIZATION: "true",
        GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      },
    });
    mcpUrl = `http://${HOST}:${port}/mcp`;
  });

  after(async () => {
    cleanupServers([server]);
    if (mockGitLab) await mockGitLab.stop();
  });

  test("handles concurrent SDK tool calls with the same Mcp-Session-Id", async () => {
    const client = new CustomHeaderClient({ Authorization: `Bearer ${MOCK_TOKEN}` });
    await client.connect(mcpUrl);

    try {
      const initialSessionId = client.getSessionId();
      assert.ok(initialSessionId, "initialize should return Mcp-Session-Id");

      let timeoutHandle: NodeJS.Timeout;
      try {
        const [packageResult, readmeResult] = await Promise.race([
          Promise.all([
            client.callTool("get_file_contents", {
              project_id: TEST_PROJECT_ID,
              file_path: "package.json",
              ref: "main",
            }),
            client.callTool("get_file_contents", {
              project_id: TEST_PROJECT_ID,
              file_path: "README.md",
              ref: "main",
            }),
          ]),
          new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
              () => reject(new Error("concurrent tool calls timed out")),
              5_000
            );
          }),
        ]);

        const packageText =
          packageResult.content?.[0]?.type === "text" ? packageResult.content[0].text : "";
        const readmeText =
          readmeResult.content?.[0]?.type === "text" ? readmeResult.content[0].text : "";
        assert.strictEqual(
          client.getSessionId(),
          initialSessionId,
          "concurrent calls should reuse the same Mcp-Session-Id"
        );
        assert.ok(packageText.includes("package file"), packageText);
        assert.ok(readmeText.includes("readme file"), readmeText);
      } finally {
        clearTimeout(timeoutHandle!);
      }
    } finally {
      await client.disconnect();
    }
  });
});

describe("Streamable HTTP health check capacity logging", { timeout: 20_000 }, () => {
  let mockGitLab: MockGitLabServer;
  let server: ServerInstance;
  let mcpUrl: string;
  let baseUrl: string;
  let output = "";

  before(async () => {
    const mockPort = await findMockServerPort(9370);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();

    const port = await findAvailablePort(3470);
    server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port,
      timeout: 10_000,
      env: {
        STREAMABLE_HTTP: "true",
        REMOTE_AUTHORIZATION: "true",
        GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        MAX_SESSIONS: "1",
      },
    });

    server.process.stdout?.on("data", data => {
      output += data.toString();
    });
    server.process.stderr?.on("data", data => {
      output += data.toString();
    });

    baseUrl = `http://${HOST}:${port}`;
    mcpUrl = `${baseUrl}/mcp`;
  });

  after(async () => {
    cleanupServers([server]);
    if (mockGitLab) await mockGitLab.stop();
  });

  test("logs active session capacity when health check is degraded", async () => {
    const client = new CustomHeaderClient({ Authorization: `Bearer ${MOCK_TOKEN}` });
    await client.connect(mcpUrl);

    try {
      const response = await fetch(`${baseUrl}/health`);
      const body = (await response.json()) as {
        status: string;
        activeSessions: number;
        maxSessions: number;
      };

      assert.strictEqual(response.status, 503);
      assert.strictEqual(body.status, "degraded");
      assert.strictEqual(body.activeSessions, 1);
      assert.strictEqual(body.maxSessions, 1);

      await new Promise(resolve => setTimeout(resolve, 100));

      assert.match(output, /Health check degraded/);
      assert.match(output, /activeSessions.*1/);
      assert.match(output, /maxSessions.*1/);
    } finally {
      await client.disconnect();
    }
  });
});
