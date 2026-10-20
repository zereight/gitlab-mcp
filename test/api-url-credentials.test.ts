import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOCK_TOKEN = "glpat-mock-token-userinfo";
const PROJECT_ID = "123";
const JOB_ID = "456";
const REDIRECT_JOB_ID = "790";
const URL_PASSWORD = "p%2Cw0rd-e2e-4b1d";
const USERINFO_WARNING = "GITLAB_API_URL contains a username or password before the host";

interface ToolCallOutcome {
  readonly response: Record<string, unknown>;
  readonly stderr: string;
}

function serverEnv(apiUrl: string, logFormat: string | undefined): Record<string, string> {
  const env: Record<string, string> = {
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_API_URL: apiUrl,
    GITLAB_DISABLE_VERSION_CHECK: "true",
    USE_PIPELINE: "true",
    LOG_LEVEL: "info",
  };
  if (logFormat !== undefined) {
    env.LOG_FORMAT = logFormat;
  }
  if (process.env.PATH !== undefined) {
    env.PATH = process.env.PATH;
  }
  if (process.env.HOME !== undefined) {
    env.HOME = process.env.HOME;
  }
  return env;
}

async function callToolAsync(
  toolName: string,
  args: Record<string, unknown>,
  apiUrl: string,
  logFormat?: string
): Promise<ToolCallOutcome> {
  const child = spawn(process.execPath, [path.join(REPO_ROOT, "build/index.js")], {
    cwd: REPO_ROOT,
    env: serverEnv(apiUrl, logFormat),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout?.on("data", chunk => {
    stdoutChunks.push(Buffer.from(chunk));
  });
  child.stderr?.on("data", chunk => {
    stderrChunks.push(Buffer.from(chunk));
  });
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
  }, 20000);
  child.stdin?.end(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    })}\n`
  );
  await once(child, "close");
  clearTimeout(timer);

  const stdout = Buffer.concat(stdoutChunks).toString("utf8");
  const stderr = Buffer.concat(stderrChunks).toString("utf8");
  const line = stdout.split("\n").find(item => item.startsWith("{"));
  if (line === undefined) {
    throw new Error(`no JSON-RPC response on stdout\n${stderr}`);
  }
  return { response: JSON.parse(line) as Record<string, unknown>, stderr };
}

function credentialedUrl(baseUrl: string, pathname: string): string {
  const url = new URL(pathname, baseUrl);
  return `${url.protocol}//alice:${URL_PASSWORD}@${url.host}${url.pathname}`;
}

describe("When GITLAB_API_URL has userinfo", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    mockGitLab = new MockGitLabServer({
      port: await findMockServerPort(),
      validTokens: [MOCK_TOKEN],
    });
    mockGitLab.addMockHandler(
      "get",
      `/projects/${PROJECT_ID}/jobs/${JOB_ID}/artifacts/tree`,
      (_req, res) => {
        res.json([
          { name: "report.xml", path: "report.xml", type: "file", size: 1, mode: "100644" },
        ]);
      }
    );
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  describe("with a tool call", () => {
    it("should send the request to the URL without userinfo", async () => {
      const outcome = await callToolAsync(
        "list_job_artifacts",
        { project_id: PROJECT_ID, job_id: JOB_ID },
        credentialedUrl(mockGitLabUrl, "/api/v4")
      );
      const result = outcome.response.result as { isError?: boolean; content: { text: string }[] };

      assert.equal(result.isError, undefined);
      assert.equal(JSON.parse(result.content[0].text)[0].name, "report.xml");
    });

    it("should warn once that the userinfo is ignored", async () => {
      const outcome = await callToolAsync(
        "list_job_artifacts",
        { project_id: PROJECT_ID, job_id: JOB_ID },
        credentialedUrl(mockGitLabUrl, "/api/v4")
      );

      assert.equal(outcome.stderr.split(USERINFO_WARNING).length - 1, 1);
    });

    it("should omit the password from stderr", async () => {
      const outcome = await callToolAsync(
        "list_job_artifacts",
        { project_id: PROJECT_ID, job_id: JOB_ID },
        credentialedUrl(mockGitLabUrl, "/api/v4")
      );

      assert.equal(outcome.stderr.includes(URL_PASSWORD), false);
    });
  });

  describe("in a comma-separated list", () => {
    it("should send the request to the URL without userinfo", async () => {
      const outcome = await callToolAsync(
        "list_job_artifacts",
        { project_id: PROJECT_ID, job_id: JOB_ID },
        `${credentialedUrl(mockGitLabUrl, "/api/v4")},https://other.example/api/v4`
      );
      const result = outcome.response.result as { isError?: boolean; content: { text: string }[] };

      assert.equal(result.isError, undefined);
      assert.equal(outcome.stderr.includes(URL_PASSWORD), false);
    });
  });
});

describe("When fetch rejects a credentialed URL during a tool call", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    mockGitLab = new MockGitLabServer({
      port: await findMockServerPort(),
      validTokens: [MOCK_TOKEN],
    });
    // A same-origin redirect is followed with fetch(), which throws
    // "Request cannot be constructed from a URL that includes credentials: <url>".
    mockGitLab.addMockHandler(
      "get",
      `/projects/${PROJECT_ID}/jobs/${REDIRECT_JOB_ID}/artifacts/report.xml`,
      (_req, res) => {
        res.redirect(
          credentialedUrl(
            mockGitLabUrl,
            `/api/v4/projects/${PROJECT_ID}/jobs/${REDIRECT_JOB_ID}/artifacts/moved.xml`
          )
        );
      }
    );
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  for (const logFormat of ["json", undefined]) {
    describe(`with LOG_FORMAT=${logFormat ?? "unset"}`, () => {
      it("should return the error with the userinfo redacted", async () => {
        const outcome = await callToolAsync(
          "get_job_artifact_file",
          { project_id: PROJECT_ID, job_id: REDIRECT_JOB_ID, artifact_path: "report.xml" },
          `${mockGitLabUrl}/api/v4`,
          logFormat
        );
        const error = outcome.response.error as { message: string };

        assert.match(error.message, /includes credentials: http:\/\/\[REDACTED\]@127\.0\.0\.1:/);
        assert.equal(JSON.stringify(outcome.response).includes(URL_PASSWORD), false);
      });

      it("should log the error without the password", async () => {
        const outcome = await callToolAsync(
          "get_job_artifact_file",
          { project_id: PROJECT_ID, job_id: REDIRECT_JOB_ID, artifact_path: "report.xml" },
          `${mockGitLabUrl}/api/v4`,
          logFormat
        );

        assert.equal(outcome.stderr.includes("tool_call_error"), true);
        assert.equal(outcome.stderr.includes(URL_PASSWORD), false);
      });
    });
  }
});
