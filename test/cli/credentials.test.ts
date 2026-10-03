import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import * as url from "node:url";
import { describe, it } from "node:test";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CLI_ENTRY = path.resolve(__dirname, "../../build/index.js");
const CLI_TIMEOUT_MS = 30_000;
const MR_FIXTURE = {
  id: 1,
  iid: 1,
  project_id: 7,
  title: "Hello MR",
  description: "d",
  state: "opened",
  web_url: "http://example.test/mr/1",
  source_branch: "feature",
  target_branch: "main",
  author: { id: 1, username: "u", name: "U", state: "active", avatar_url: null, web_url: "http://example.test/u" },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  merged_at: null,
  closed_at: null,
  merge_commit_sha: null,
};

interface CliRun {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly authorization: string | undefined;
}

function buildCleanEnv(extra: Readonly<Record<string, string>>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !key.startsWith("GITLAB_")) {
      env[key] = value;
    }
  }
  return { ...env, ...extra };
}

function startFakeGitLabAsync(onRequest: (authorization: string | undefined) => void): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    onRequest(req.headers.authorization);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(MR_FIXTURE));
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function getPort(server: http.Server): number {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("fake GitLab server is not listening on a TCP port");
  }
  return address.port;
}

function runCliAsync(env: Record<string, string>): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, "mr", "view", "--project-id", "g/p", "--mr-iid", "1"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: CLI_TIMEOUT_MS,
      killSignal: "SIGKILL",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => {
      stdout += String(chunk);
    });
    child.stderr.on("data", chunk => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", exitCode => resolve({ exitCode, stdout, stderr }));
  });
}

function buildOAuthEnv(apiUrl: string, tmpDir: string): Record<string, string> {
  const tokenPath = path.join(tmpDir, "token.json");
  fs.writeFileSync(
    tokenPath,
    JSON.stringify({
      access_token: "oauth-cli-test",
      refresh_token: "refresh",
      expires_in: 7200,
      created_at: Date.now(),
      token_type: "Bearer",
    })
  );
  return {
    GITLAB_API_URL: apiUrl,
    GITLAB_USE_OAUTH: "true",
    GITLAB_OAUTH_CLIENT_ID: "client-id",
    GITLAB_OAUTH_TOKEN_PATH: tokenPath,
  };
}

async function runMrViewAgainstFakeGitLabAsync(
  buildEnv: (apiUrl: string, tmpDir: string) => Record<string, string>
): Promise<CliRun> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-cli-credentials-"));
  let authorization: string | undefined;
  const server = await startFakeGitLabAsync(value => {
    authorization = value;
  });
  try {
    const apiUrl = `http://127.0.0.1:${getPort(server)}/api/v4`;
    const result = await runCliAsync(buildCleanEnv(buildEnv(apiUrl, tmpDir)));
    return { ...result, authorization };
  } finally {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe("When the human CLI runs without an MCP client", () => {
  describe("with a personal access token in the environment", () => {
    it("should send the token as a bearer credential", async () => {
      const run = await runMrViewAgainstFakeGitLabAsync(apiUrl => ({
        GITLAB_API_URL: apiUrl,
        GITLAB_PERSONAL_ACCESS_TOKEN: "glpat-cli-test",
      }));

      assert.equal(run.exitCode, 0);
      assert.equal(run.authorization, "Bearer glpat-cli-test");
    });
  });

  describe("with an OAuth token stored by the auth command", () => {
    it("should send the stored token as a bearer credential", async () => {
      const run = await runMrViewAgainstFakeGitLabAsync(buildOAuthEnv);

      assert.equal(run.exitCode, 0);
      assert.equal(run.authorization, "Bearer oauth-cli-test");
    });
  });

  describe("with an OAuth token and GITLAB_IS_OLD enabled", () => {
    it("should still send the token as a bearer credential", async () => {
      const run = await runMrViewAgainstFakeGitLabAsync((apiUrl, tmpDir) => ({
        ...buildOAuthEnv(apiUrl, tmpDir),
        GITLAB_IS_OLD: "true",
      }));

      assert.equal(run.exitCode, 0);
      assert.equal(run.authorization, "Bearer oauth-cli-test");
    });
  });

  describe("with OAuth enabled against a cleartext remote URL", () => {
    it("should refuse to run before any network call", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-cli-credentials-"));
      try {
        const result = await runCliAsync(
          buildCleanEnv(buildOAuthEnv("http://gitlab.example.invalid/api/v4", tmpDir))
        );

        assert.equal(result.exitCode, 1);
        assert.match(result.stderr, /cleartext HTTP/);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("with no credentials at all", () => {
    it("should exit with a usage error before any network call", async () => {
      const run = await runMrViewAgainstFakeGitLabAsync(apiUrl => ({ GITLAB_API_URL: apiUrl }));

      assert.equal(run.exitCode, 2);
      assert.equal(run.authorization, undefined);
    });
  });
});
