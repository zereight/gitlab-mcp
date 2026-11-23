import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-namespace-scope-token";

const mockNamespace = {
  id: 7,
  name: "Team",
  path: "team",
  kind: "group",
  full_path: "team",
  parent_id: null,
  avatar_url: null,
  web_url: "https://gitlab.mock/groups/team",
};

interface NamespaceCall {
  tool: string;
  args: Record<string, unknown>;
}

const NAMESPACE_CALLS: NamespaceCall[] = [
  { tool: "list_namespaces", args: {} },
  { tool: "get_namespace", args: { namespace_id: "team" } },
  { tool: "verify_namespace", args: { path: "team" } },
];

const namespaceHits: string[] = [];

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

/** One stdio tools/call; resolves with the parsed tool text and rejects on a JSON-RPC error. */
async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<unknown> {
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
        if (response.result?.isError === true) {
          reject(new Error(typeof text === "string" ? text : "tool returned isError"));
          return;
        }
        resolve(typeof text === "string" ? JSON.parse(text) : response.result);
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

describe("Namespace tools and strict project scope", { concurrency: 1 }, () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  const env = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLS: NAMESPACE_CALLS.map(call => call.tool).join(","),
    GITLAB_DISABLE_VERSION_CHECK: "true",
    ...extra,
  });

  before(async () => {
    const port = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
    mockGitLab.addMockHandler("get", "/namespaces", (req, res) => {
      namespaceHits.push(req.path);
      res.json([mockNamespace]);
    });
    mockGitLab.addMockHandler("get", "/namespaces/team", (req, res) => {
      namespaceHits.push(req.path);
      res.json(mockNamespace);
    });
    mockGitLab.addMockHandler("get", "/namespaces/team/exists", (req, res) => {
      namespaceHits.push(req.path);
      res.json({ exists: true });
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  beforeEach(() => {
    namespaceHits.length = 0;
  });

  for (const { tool, args } of NAMESPACE_CALLS) {
    test(`${tool} is refused under strict scope with an allowlist`, async () => {
      await assert.rejects(
        callTool(
          tool,
          args,
          env({ GITLAB_ALLOWED_PROJECT_IDS: "1", ENABLE_STRICT_PROJECT_SCOPE: "true" })
        ),
        new RegExp(`${tool} is not allowed while a project allowlist is in effect`)
      );
      assert.deepEqual(namespaceHits, [], "no namespace request may reach GitLab");
    });

    test(`${tool} is refused under strict scope with GITLAB_PROJECT_ID`, async () => {
      await assert.rejects(
        callTool(tool, args, env({ GITLAB_PROJECT_ID: "1", ENABLE_STRICT_PROJECT_SCOPE: "true" })),
        new RegExp(`${tool} is not allowed when GITLAB_PROJECT_ID is set`)
      );
      assert.deepEqual(namespaceHits, [], "no namespace request may reach GitLab");
    });

    test(`${tool} still works with an allowlist but without strict scope`, async () => {
      await callTool(tool, args, env({ GITLAB_ALLOWED_PROJECT_IDS: "1" }));
      assert.equal(namespaceHits.length, 1);
    });

    test(`${tool} still works under strict scope without an allowlist`, async () => {
      await callTool(tool, args, env({ ENABLE_STRICT_PROJECT_SCOPE: "true" }));
      assert.equal(namespaceHits.length, 1);
    });
  }
});
