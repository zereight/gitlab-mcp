import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import { Buffer } from "node:buffer";
import { CustomHeaderClient } from "./clients/custom-header-client.js";
import {
  cleanupServers,
  findAvailablePort,
  HOST,
  launchServer,
  type ServerInstance,
  TransportMode,
} from "./utils/server-launcher.js";
import { findMockServerPort, MockGitLabServer } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-get-file-contents-test-token";
const TEST_PROJECT_ID = "123";

describe("get_file_contents", { timeout: 20_000 }, () => {
  let mockGitLab: MockGitLabServer;
  let server: ServerInstance;
  let mcpUrl: string;

  before(async () => {
    const binaryContent = Buffer.from([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0xc7, 0xff, 0xd8, 0x00,
    ]).toString("base64");
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/repository/files/sample.pdf`,
      (_req, res) => {
        res.json({
          file_name: "sample.pdf",
          file_path: "sample.pdf",
          encoding: "base64",
          content: binaryContent,
        });
      }
    );
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/repository/files/README.md`,
      (_req, res) => {
        res.json({
          file_name: "README.md",
          file_path: "README.md",
          encoding: "base64",
          content: Buffer.from("Hello, 世界\n", "utf8").toString("base64"),
        });
      }
    );
    await mockGitLab.start();

    const port = await findAvailablePort(3480);
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

  test("preserves non-UTF-8 file content as base64", async () => {
    const expectedContent = Buffer.from([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0xc7, 0xff, 0xd8, 0x00,
    ]).toString("base64");
    const client = new CustomHeaderClient({ Authorization: `Bearer ${MOCK_TOKEN}` });
    await client.connect(mcpUrl);

    try {
      const result = await Promise.race([
        client.callTool("get_file_contents", {
          project_id: TEST_PROJECT_ID,
          file_path: "sample.pdf",
          ref: "main",
        }),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error("get_file_contents timed out")), 5_000);
          timer.unref();
        }),
      ]);
      const responseText = result.content?.[0]?.type === "text" ? result.content[0].text : "";
      const file = JSON.parse(responseText) as { content: string; encoding: string };

      assert.strictEqual(file.content, expectedContent);
      assert.strictEqual(file.encoding, "base64");
    } finally {
      await client.disconnect();
    }
  });

  test("decodes valid UTF-8 file content", async () => {
    const client = new CustomHeaderClient({ Authorization: `Bearer ${MOCK_TOKEN}` });
    await client.connect(mcpUrl);

    try {
      const result = await client.callTool("get_file_contents", {
        project_id: TEST_PROJECT_ID,
        file_path: "README.md",
        ref: "main",
      });
      const responseText = result.content?.[0]?.type === "text" ? result.content[0].text : "";
      const file = JSON.parse(responseText) as { content: string; encoding: string };

      assert.strictEqual(file.content, "Hello, 世界\n");
      assert.strictEqual(file.encoding, "utf8");
    } finally {
      await client.disconnect();
    }
  });
});
