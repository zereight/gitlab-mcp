import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import fs from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-12345";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = path.resolve(__dirname, "../package.json");
const PACKAGE_VERSION = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version;

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

interface ToolCallResult {
  isError: boolean;
  text: string;
}

function callToolAsync(
  env: NodeJS.ProcessEnv,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<ToolCallResult> {
  return new Promise<ToolCallResult>((resolve, reject) => {
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
        if (typeof content !== "string") {
          reject(new Error("No tool result content"));
          return;
        }

        resolve({
          isError: response.result?.isError === true,
          text: content,
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
        params: { name: toolName, arguments: args },
      }) + "\n"
    );
  });
}

async function callHealthCheckAsync(env: NodeJS.ProcessEnv): Promise<Record<string, unknown>> {
  const result = await callToolAsync(env, "health_check");
  if (result.isError) {
    throw new Error(result.text);
  }
  return JSON.parse(result.text);
}

function forbidCurrentUser(mockGitLab: MockGitLabServer): void {
  mockGitLab.addMockHandler("get", "/user", (_req, res) => {
    res.status(403).json({ error: "insufficient_scope", scope: "user" });
  });
}

function rateLimitCurrentUser(mockGitLab: MockGitLabServer): void {
  mockGitLab.addMockHandler("get", "/user", (_req, res) => {
    res.status(403).json({ message: "User API Key Rate limit exceeded" });
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
        assert.equal(result.mcp_server_version, PACKAGE_VERSION);
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
        assert.equal(result.mcp_server_version, PACKAGE_VERSION);
        assert.equal("version" in result, false);
        assert.equal("revision" in result, false);
        assert.equal("enterprise" in result, false);
      } finally {
        await mockGitLab.stop();
      }
    });
  });

  describe("when GitLab GET /user returns 401", () => {
    test("should stay unauthenticated without a job token", async () => {
      const mockPort = await findMockServerPort();
      const mockGitLab = createMockGitLabServer(mockPort);
      mockGitLab.addMockHandler("get", "/user", (_req, res) => {
        res.status(401).json({ message: "401 Unauthorized" });
      });
      await mockGitLab.start();

      try {
        const result = await callHealthCheckAsync(baseEnv(mockGitLab.getUrl()));

        assert.equal(result.status, "error");
        assert.equal(result.authenticated, false);
        assert.equal(result.mcp_server_version, PACKAGE_VERSION);
        assert.equal("user_api_warning" in result, false);
        assert.equal("version" in result, false);
      } finally {
        await mockGitLab.stop();
      }
    });

    test("should authenticate through GET /job when a job token is configured", async () => {
      const mockPort = await findMockServerPort();
      const mockGitLab = createMockGitLabServer(mockPort);
      mockGitLab.addMockHandler("get", "/user", (_req, res) => {
        res.status(401).json({ message: "401 Unauthorized" });
      });
      mockGitLab.addMockHandler("get", "/job", (_req, res) => {
        res.status(200).json({ id: 9 });
      });
      await mockGitLab.start();

      try {
        const result = await callHealthCheckAsync({
          ...baseEnv(mockGitLab.getUrl()),
          GITLAB_JOB_TOKEN: MOCK_TOKEN,
        });

        assert.equal(result.status, "ok");
        assert.equal(result.authenticated, true);
        assert.equal(result.version, "18.3.1-ee");
        assert.equal("user_api_warning" in result, false);
      } finally {
        await mockGitLab.stop();
      }
    });
  });

  describe("when GitLab GET /user returns 403", () => {
    test("should report authenticated with a user API warning and omit version fields", async () => {
      const mockPort = await findMockServerPort();
      const mockGitLab = createMockGitLabServer(mockPort);
      forbidCurrentUser(mockGitLab);
      await mockGitLab.start();

      try {
        const result = await callHealthCheckAsync(baseEnv(mockGitLab.getUrl()));

        assert.equal(result.status, "ok");
        assert.equal(result.authenticated, true);
        assert.equal(result.mcp_server_version, PACKAGE_VERSION);
        assert.equal(typeof result.user_api_warning, "string");
        assert.match(String(result.user_api_warning), /403/);
        assert.match(String(result.user_api_warning), /insufficient scope/);
        assert.match(String(result.user_api_warning), /read_user/);
        assert.equal("version" in result, false);
        assert.equal("revision" in result, false);
        assert.equal("enterprise" in result, false);
      } finally {
        await mockGitLab.stop();
      }
    });

    test("should keep version metadata when the job-token fallback succeeds", async () => {
      const mockPort = await findMockServerPort();
      const mockGitLab = createMockGitLabServer(mockPort);
      forbidCurrentUser(mockGitLab);
      mockGitLab.addMockHandler("get", "/job", (_req, res) => {
        res.status(200).json({ id: 9 });
      });
      await mockGitLab.start();

      try {
        const result = await callHealthCheckAsync({
          ...baseEnv(mockGitLab.getUrl()),
          GITLAB_JOB_TOKEN: MOCK_TOKEN,
        });

        assert.equal(result.status, "ok");
        assert.equal(result.authenticated, true);
        assert.equal(result.version, "18.3.1-ee");
        assert.equal(result.revision, "abc1234");
        assert.equal(result.enterprise, true);
        assert.equal("user_api_warning" in result, false);
      } finally {
        await mockGitLab.stop();
      }
    });

    test("should stay authenticated without a scope warning when /user is rate limited", async () => {
      const mockPort = await findMockServerPort();
      const mockGitLab = createMockGitLabServer(mockPort);
      rateLimitCurrentUser(mockGitLab);
      await mockGitLab.start();

      try {
        const result = await callHealthCheckAsync(baseEnv(mockGitLab.getUrl()));

        assert.equal(result.status, "ok");
        assert.equal(result.authenticated, true);
        assert.equal("user_api_warning" in result, false);
        assert.equal("version" in result, false);
      } finally {
        await mockGitLab.stop();
      }
    });
  });
});

describe("When current-user tools call GET /user", () => {
  describe("with a 403 insufficient-scope response", () => {
    test("should tell whoami that read_user or User API read is required", async () => {
      const mockPort = await findMockServerPort();
      const mockGitLab = createMockGitLabServer(mockPort);
      forbidCurrentUser(mockGitLab);
      await mockGitLab.start();

      try {
        const result = await callToolAsync(
          {
            ...baseEnv(mockGitLab.getUrl()),
            GITLAB_TOOLSETS: "users",
          },
          "whoami"
        );

        assert.equal(result.isError, true);
        assert.match(result.text, /GET \/api\/v4\/user/);
        assert.match(result.text, /insufficient scope/);
        assert.match(result.text, /read_user/);
        assert.match(result.text, /User:Read/);
      } finally {
        await mockGitLab.stop();
      }
    });

    test("should tell my_issues that read_user or User API read is required", async () => {
      const mockPort = await findMockServerPort();
      const mockGitLab = createMockGitLabServer(mockPort);
      forbidCurrentUser(mockGitLab);
      await mockGitLab.start();

      try {
        const result = await callToolAsync(
          {
            ...baseEnv(mockGitLab.getUrl()),
            GITLAB_TOOLSETS: "issues",
          },
          "my_issues"
        );

        assert.equal(result.isError, true);
        assert.match(result.text, /GET \/api\/v4\/user/);
        assert.match(result.text, /insufficient scope/);
        assert.match(result.text, /read_user/);
        assert.match(result.text, /my_issues/);
      } finally {
        await mockGitLab.stop();
      }
    });

    test("should keep the rate-limit error for whoami", async () => {
      const mockPort = await findMockServerPort();
      const mockGitLab = createMockGitLabServer(mockPort);
      rateLimitCurrentUser(mockGitLab);
      await mockGitLab.start();

      try {
        const result = await callToolAsync(
          {
            ...baseEnv(mockGitLab.getUrl()),
            GITLAB_TOOLSETS: "users",
          },
          "whoami"
        );

        assert.equal(result.isError, true);
        assert.match(result.text, /Rate Limit Exceeded/);
        assert.doesNotMatch(result.text, /insufficient scope/);
      } finally {
        await mockGitLab.stop();
      }
    });
  });
});
