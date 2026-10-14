import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it, before, after } from "node:test";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-job-output";
const TEST_PROJECT_ID = "123";
const TEST_JOB_ID = "456";
const ESC = String.fromCharCode(0x1b);
const TRACE = [`${ESC}[32mUNIQUE_HEAD${ESC}[0m token`, "middle", "tail only"].join("\n");

interface ToolCallResult {
  readonly isError?: boolean;
  readonly content?: readonly { readonly type?: string; readonly text?: string }[];
}

function readToolText(result: ToolCallResult): string {
  const text = result.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("tool result missing text");
  }
  return text;
}

function readToolCallResult(value: Record<string, unknown>): ToolCallResult {
  const content = Array.isArray(value.content)
    ? value.content.flatMap(item => {
        if (!isRecord(item) || typeof item.text !== "string") {
          return [];
        }
        const type = typeof item.type === "string" ? item.type : undefined;
        return [{ type, text: item.text }];
      })
    : undefined;
  return {
    isError: typeof value.isError === "boolean" ? value.isError : undefined,
    content,
  };
}

function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<ToolCallResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
        GITLAB_READ_ONLY_MODE: "true",
        USE_PIPELINE: "true",
        GITLAB_DISABLE_VERSION_CHECK: "true",
      },
    });
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`timed out calling ${toolName}`));
    }, 20000);
    let output = "";
    let errorOutput = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString();
    });
    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        return;
      }
      const line = output.split("\n").find(entry => entry.startsWith("{"));
      if (line === undefined) {
        reject(new Error(`No JSON output found: ${errorOutput}`));
        return;
      }
      const response: unknown = JSON.parse(line);
      if (!isRecord(response)) {
        reject(new Error("JSON-RPC response was not an object"));
        return;
      }
      if (response.error !== undefined) {
        reject(new Error(JSON.stringify(response.error)));
        return;
      }
      if (!isRecord(response.result)) {
        reject(new Error("JSON-RPC result was not an object"));
        return;
      }
      resolve(readToolCallResult(response.result));
    });
    proc.stdin.end(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: toolName, arguments: args },
      })}\n`
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

describe("When get_pipeline_job_output reads a job trace", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/jobs/${TEST_JOB_ID}/trace`,
      (_req, res) => {
        res.type("text/plain").send(TRACE);
      }
    );
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  function toolEnv(): NodeJS.ProcessEnv {
    return {
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    };
  }

  describe("with limit and no pattern", () => {
    it("should keep end-based pagination and the raw ANSI text", async () => {
      const result = await callTool(
        "get_pipeline_job_output",
        { project_id: TEST_PROJECT_ID, job_id: TEST_JOB_ID, limit: 1 },
        toolEnv()
      );
      const text = readToolText(result);

      assert.notEqual(result.isError, true);
      assert.match(text, /tail only/);
      assert.doesNotMatch(text, /UNIQUE_HEAD/);
    });
  });

  describe("with no pattern and no limit", () => {
    it("should return the raw log including ANSI codes", async () => {
      const result = await callTool(
        "get_pipeline_job_output",
        { project_id: TEST_PROJECT_ID, job_id: TEST_JOB_ID },
        toolEnv()
      );

      assert.equal(readToolText(result).includes(`${ESC}[32mUNIQUE_HEAD`), true);
    });
  });

  describe("with a substring pattern and a tail limit", () => {
    it("should search the full log and return the cleaned match line", async () => {
      const result = await callTool(
        "get_pipeline_job_output",
        { project_id: TEST_PROJECT_ID, job_id: TEST_JOB_ID, pattern: "unique_head", limit: 1 },
        toolEnv()
      );
      const text = readToolText(result);

      assert.match(text, /1\|UNIQUE_HEAD token/);
      assert.match(text, /total_matches=1/);
      assert.equal(text.includes(ESC), false);
    });
  });

  describe("with an invalid regular expression", () => {
    it("should return a tool error", async () => {
      const result = await callTool(
        "get_pipeline_job_output",
        { project_id: TEST_PROJECT_ID, job_id: TEST_JOB_ID, pattern: "(", regex: true },
        toolEnv()
      );

      assert.equal(result.isError, true);
      assert.match(readToolText(result), /Invalid regular expression/);
    });
  });
});
