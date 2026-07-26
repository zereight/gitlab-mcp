import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-12345";

function createMockGitLabServer(port: number): MockGitLabServer {
  return new MockGitLabServer({
    port,
    validTokens: [MOCK_TOKEN],
  });
}

function baseEnv(mockGitLabUrl: string): NodeJS.ProcessEnv {
  return {
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "projects",
  };
}

async function callHealthCheckAsync(env: NodeJS.ProcessEnv): Promise<Record<string, unknown>> {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
        USE_PIPELINE: "true",
      },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (chunk: Buffer) => (output += chunk));
    proc.stderr?.on("data", (chunk: Buffer) => (errorOutput += chunk));

    proc.on("close", code => {
      if (code !== 0) {
        return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      }

      const line = output.split("\n").find(entry => entry.startsWith("{"));
      if (!line) {
        return reject(new Error("No JSON output found"));
      }

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
          return;
        }

        const content = response.result?.content?.[0]?.text;
        if (!content) {
          reject(new Error("No tool result content"));
          return;
        }

        resolve(JSON.parse(content));
      } catch (error) {
        reject(error);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "health_check", arguments: {} },
      }) + "\n"
    );
  });
}

describe("When health_check runs", () => {
  describe("with authenticated mock GitLab", () => {
    test("should include GitLab instance version metadata", async () => {
      const mockPort = await findMockServerPort();
      const mockGitLab = createMockGitLabServer(mockPort);
      await mockGitLab.start();

      try {
        const result = await callHealthCheckAsync(baseEnv(mockGitLab.getUrl()));

        assert.equal(result.status, "ok");
        assert.equal(result.authenticated, true);
        assert.equal(result.version, "18.3.1-ee");
        assert.equal(result.revision, "abc1234");
        assert.equal(result.enterprise, true);
      } finally {
        await mockGitLab.stop();
      }
    });
  });

  describe("when GitLab /version lookup fails", () => {
    test("should keep health check ok without version fields", async () => {
      const mockPort = await findMockServerPort();
      const mockGitLab = createMockGitLabServer(mockPort);
      mockGitLab.addMockHandler("get", "/version", (_req, res) => {
        res.status(500).json({ message: "version unavailable" });
      });
      await mockGitLab.start();

      try {
        const result = await callHealthCheckAsync(baseEnv(mockGitLab.getUrl()));

        assert.equal(result.status, "ok");
        assert.equal(result.authenticated, true);
        assert.equal("version" in result, false);
        assert.equal("revision" in result, false);
        assert.equal("enterprise" in result, false);
      } finally {
        await mockGitLab.stop();
      }
    });
  });
});
