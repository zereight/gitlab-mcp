import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import {
  TOOLSET_DEFINITIONS,
  destructiveTools,
  pipelineToolNames,
  readOnlyTools,
} from "../tools/registry.js";

const MOCK_TOKEN = "glpat-runner-test-token";
const TEST_PROJECT_ID = "123";
const TEST_RUNNER_ID = "8";
const REGISTRATION_TOKEN = "GR1348941secret";
const RUNNER_AUTH_TOKEN = "glrt-secret";
const NESTED_REGISTRATION_TOKEN = "nested-reg";
const NESTED_AUTH_TOKEN = "nested-auth";

interface ToolCallResult {
  isError: boolean;
  payload: unknown;
}

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected a JSON object");
  }

  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    record[key] = entry;
  }
  return record;
}

function runnerEnv(apiUrl: string, allowedProjectIds = ""): NodeJS.ProcessEnv {
  return {
    GITLAB_API_URL: `${apiUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "pipelines",
    GITLAB_PROJECT_ID: "",
    GITLAB_ALLOWED_PROJECT_IDS: allowedProjectIds,
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
      env: { ...process.env, ...env },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        return;
      }

      const line = output.split("\n").find(entry => entry.startsWith("{"));
      if (!line) {
        reject(new Error(`No JSON output found: ${errorOutput}`));
        return;
      }

      const response = readRecord(JSON.parse(line));
      if (response.error !== undefined) {
        resolve({ isError: true, payload: response.error });
        return;
      }

      const result = readRecord(response.result);
      const content = Array.isArray(result.content) ? result.content : [];
      const first = content[0];
      const text =
        typeof first === "object" &&
        first !== null &&
        "text" in first &&
        typeof first.text === "string"
          ? first.text
          : "";
      const isError = result.isError === true;

      if (isError) {
        resolve({ isError: true, payload: text });
        return;
      }

      resolve({ isError: false, payload: text === "" ? result : JSON.parse(text) });
    });

    proc.stdin?.end(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: toolName, arguments: args },
      })}\n`
    );
  });
}

function assertNoRunnerSecrets(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  const leaked = [
    REGISTRATION_TOKEN,
    RUNNER_AUTH_TOKEN,
    NESTED_REGISTRATION_TOKEN,
    NESTED_AUTH_TOKEN,
  ].filter(secret => serialized.includes(secret));

  assert.deepEqual(leaked, []);
}

function pipelinesToolset() {
  const toolset = TOOLSET_DEFINITIONS.find(definition => definition.id === "pipelines");
  if (!toolset) {
    throw new Error("pipelines toolset is missing");
  }
  return toolset;
}

describe("When placing runner tools", () => {
  describe("with the pipelines toolset", () => {
    it("should expose them as read-only opt-in tools", () => {
      const pipelines = pipelinesToolset();
      const defaultToolsets = TOOLSET_DEFINITIONS.filter(definition => definition.isDefault);

      assert.equal(pipelines.tools.has("list_project_runners"), true);
      assert.equal(pipelines.tools.has("get_runner"), true);
      assert.equal(readOnlyTools.has("list_project_runners"), true);
      assert.equal(readOnlyTools.has("get_runner"), true);
      assert.equal(pipelineToolNames.has("list_project_runners"), true);
      assert.equal(pipelineToolNames.has("get_runner"), true);
      assert.equal(destructiveTools.has("list_project_runners"), false);
      assert.equal(destructiveTools.has("get_runner"), false);
      assert.equal(
        defaultToolsets.some(definition => definition.tools.has("list_project_runners")),
        false
      );
      assert.equal(
        defaultToolsets.some(definition => definition.tools.has("get_runner")),
        false
      );
    });
  });
});

describe("When listing project runners", { concurrency: false }, () => {
  const captured: { listUrl: string } = { listUrl: "" };
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl = "";

  before(async () => {
    const port = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/runners`, (req, res) => {
      captured.listUrl = req.originalUrl;
      res.json([
        {
          id: 8,
          description: "docker-runner",
          runner_type: "project_type",
          status: "online",
          paused: false,
          token: RUNNER_AUTH_TOKEN,
          runners_token: REGISTRATION_TOKEN,
          projects: [
            {
              id: 123,
              name: "demo",
              runners_token: NESTED_REGISTRATION_TOKEN,
              token: NESTED_AUTH_TOKEN,
            },
          ],
        },
      ]);
    });
    mockGitLab.addMockHandler("get", `/runners/${TEST_RUNNER_ID}`, (_req, res) => {
      res.json({
        id: 8,
        description: "docker-runner",
        runner_type: "project_type",
        status: "online",
        paused: false,
        tag_list: ["docker", "linux"],
        run_untagged: false,
        locked: true,
        access_level: "ref_protected",
        token_expires_at: "2025-01-01T00:00:00.000Z",
        token: RUNNER_AUTH_TOKEN,
        runners_token: REGISTRATION_TOKEN,
        projects: [
          {
            id: 1,
            name: "demo",
            runners_token: NESTED_REGISTRATION_TOKEN,
            token: NESTED_AUTH_TOKEN,
          },
        ],
      });
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  describe("with type, status, paused, and tag_list filters", () => {
    it("should request GET /projects/:id/runners with those filters", async () => {
      const result = await callTool(
        "list_project_runners",
        {
          project_id: TEST_PROJECT_ID,
          type: "project_type",
          status: "online",
          paused: false,
          tag_list: ["docker", "linux"],
          page: 2,
          per_page: 5,
        },
        runnerEnv(mockGitLabUrl)
      );
      const url = new URL(captured.listUrl, "http://127.0.0.1");

      assert.equal(result.isError, false);
      assert.deepEqual(
        {
          path: url.pathname,
          type: url.searchParams.get("type"),
          status: url.searchParams.get("status"),
          paused: url.searchParams.get("paused"),
          tag_list: url.searchParams.get("tag_list"),
          page: url.searchParams.get("page"),
          per_page: url.searchParams.get("per_page"),
        },
        {
          path: `/api/v4/projects/${TEST_PROJECT_ID}/runners`,
          type: "project_type",
          status: "online",
          paused: "false",
          tag_list: "docker,linux",
          page: "2",
          per_page: "5",
        }
      );
    });
  });

  describe("with registration tokens in the list payload", () => {
    it("should return runner summary fields and omit every token", async () => {
      const result = await callTool(
        "list_project_runners",
        { project_id: TEST_PROJECT_ID },
        runnerEnv(mockGitLabUrl)
      );

      assert.equal(result.isError, false);
      assert.equal(Array.isArray(result.payload), true);
      const runners = Array.isArray(result.payload) ? result.payload : [];
      const runner = readRecord(runners[0]);
      assert.equal(runner.id, 8);
      assert.equal(runner.description, "docker-runner");
      assert.equal(runner.runner_type, "project_type");
      assert.equal(runner.status, "online");
      assert.equal(runner.paused, false);
      assertNoRunnerSecrets(result.payload);
    });
  });

  describe("with an unknown status", () => {
    it("should reject the call before querying GitLab", async () => {
      captured.listUrl = "";
      const result = await callTool(
        "list_project_runners",
        { project_id: TEST_PROJECT_ID, status: "bogus" },
        runnerEnv(mockGitLabUrl)
      );

      const errorText =
        typeof result.payload === "string" ? result.payload : JSON.stringify(result.payload);

      assert.equal(result.isError, true);
      assert.match(errorText, /status/);
      assert.doesNotMatch(errorText, /ECONNREFUSED|fetch failed/i);
      assert.equal(captured.listUrl, "");
    });
  });
});

describe("When getting a runner", { concurrency: false }, () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl = "";

  before(async () => {
    const port = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
    mockGitLab.addMockHandler("get", `/runners/${TEST_RUNNER_ID}`, (_req, res) => {
      res.json({
        id: 8,
        description: "docker-runner",
        runner_type: "project_type",
        status: "online",
        paused: false,
        tag_list: ["docker", "linux"],
        run_untagged: false,
        locked: true,
        access_level: "ref_protected",
        token_expires_at: "2025-01-01T00:00:00.000Z",
        token: RUNNER_AUTH_TOKEN,
        runners_token: REGISTRATION_TOKEN,
        projects: [
          {
            id: 1,
            name: "demo",
            runners_token: NESTED_REGISTRATION_TOKEN,
            token: NESTED_AUTH_TOKEN,
          },
        ],
      });
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  describe("with tag and access fields plus credentials", () => {
    it("should return scheduling fields and omit every token", async () => {
      const result = await callTool(
        "get_runner",
        { runner_id: TEST_RUNNER_ID },
        runnerEnv(mockGitLabUrl)
      );
      const runner = readRecord(result.payload);

      assert.equal(result.isError, false);
      assert.deepEqual(runner.tag_list, ["docker", "linux"]);
      assert.equal(runner.run_untagged, false);
      assert.equal(runner.locked, true);
      assert.equal(runner.access_level, "ref_protected");
      assert.equal(runner.token_expires_at, "2025-01-01T00:00:00.000Z");
      assertNoRunnerSecrets(result.payload);
    });
  });
});

const ALLOWED_PROJECT = {
  id: 123,
  name: "allowed",
  path_with_namespace: "group/allowed",
};
const OTHER_PROJECT = {
  id: 999,
  name: "other",
  path_with_namespace: "other/secret",
};
const PATH_ALLOWLIST = "group/allowed";

interface RunnerListPage {
  runners: Array<{ id: number }>;
  nextPage?: string;
}

function errorText(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

describe("When a project allowlist gates get_runner", { concurrency: false }, () => {
  const lookupState: {
    pages: RunnerListPage[];
    listUrls: string[];
    detailCalls: number;
  } = {
    pages: [],
    listUrls: [],
    detailCalls: 0,
  };
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl = "";

  function useRunnerPages(pages: RunnerListPage[]): void {
    lookupState.pages = pages;
    lookupState.listUrls = [];
    lookupState.detailCalls = 0;
  }

  function handleProjectRunners(
    req: { originalUrl: string; query: Record<string, unknown> },
    res: { json: (body: unknown) => void; set: (name: string, value: string) => void }
  ): void {
    lookupState.listUrls.push(req.originalUrl);
    const pageValue = req.query.page;
    const pageText = typeof pageValue === "string" ? pageValue : "1";
    const page = Number.parseInt(pageText, 10);
    const entry = lookupState.pages[page - 1];
    if (!entry) {
      res.json([]);
      return;
    }
    if (entry.nextPage !== undefined) {
      res.set("x-next-page", entry.nextPage);
    }
    res.json(entry.runners);
  }

  before(async () => {
    const port = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/runners`, (req, res) => {
      handleProjectRunners(req, res);
    });
    mockGitLab.addMockHandler(
      "get",
      `/projects/${encodeURIComponent(PATH_ALLOWLIST)}/runners`,
      (req, res) => {
        handleProjectRunners(req, res);
      }
    );
    mockGitLab.addMockHandler("get", `/runners/${TEST_RUNNER_ID}`, (_req, res) => {
      lookupState.detailCalls += 1;
      res.json({
        id: 8,
        description: "docker-runner",
        runner_type: "instance_type",
        status: "online",
        paused: false,
        tag_list: ["docker", "linux"],
        run_untagged: false,
        locked: true,
        access_level: "ref_protected",
        token_expires_at: "2025-01-01T00:00:00.000Z",
        token: RUNNER_AUTH_TOKEN,
        runners_token: REGISTRATION_TOKEN,
        projects: [ALLOWED_PROJECT, OTHER_PROJECT],
        groups: [{ id: 5, full_path: "other" }],
      });
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  describe("with the runner listed for the allowed project", () => {
    it("should return scheduling fields after verifying project membership", async () => {
      useRunnerPages([{ runners: [{ id: 8 }] }]);
      const result = await callTool(
        "get_runner",
        { runner_id: TEST_RUNNER_ID, project_id: TEST_PROJECT_ID },
        runnerEnv(mockGitLabUrl, TEST_PROJECT_ID)
      );
      const runner = readRecord(result.payload);

      assert.equal(result.isError, false);
      assert.deepEqual(runner.tag_list, ["docker", "linux"]);
      assert.equal(runner.access_level, "ref_protected");
      assert.equal(lookupState.detailCalls, 1);
      assertNoRunnerSecrets(result.payload);
    });
  });

  describe("with projects and groups outside the allowlist", () => {
    it("should omit those projects and groups", async () => {
      useRunnerPages([{ runners: [{ id: 8 }] }]);
      const result = await callTool(
        "get_runner",
        { runner_id: TEST_RUNNER_ID, project_id: TEST_PROJECT_ID },
        runnerEnv(mockGitLabUrl, TEST_PROJECT_ID)
      );
      const runner = readRecord(result.payload);

      assert.equal(result.isError, false);
      assert.deepEqual(runner.projects, [ALLOWED_PROJECT]);
      assert.equal(Object.hasOwn(runner, "groups"), false);
    });
  });

  describe("with an allowlist entry that is a project path", () => {
    it("should keep the project whose path is allowed", async () => {
      useRunnerPages([{ runners: [{ id: 8 }] }]);
      const result = await callTool(
        "get_runner",
        { runner_id: TEST_RUNNER_ID },
        runnerEnv(mockGitLabUrl, PATH_ALLOWLIST)
      );
      const runner = readRecord(result.payload);

      assert.equal(result.isError, false);
      assert.deepEqual(runner.projects, [ALLOWED_PROJECT]);
      assert.equal(lookupState.listUrls.length, 1);
    });
  });

  describe("with the runner absent from the allowed project", () => {
    it("should reject the call before reading runner details", async () => {
      useRunnerPages([{ runners: [{ id: 1 }] }]);
      const result = await callTool(
        "get_runner",
        { runner_id: TEST_RUNNER_ID, project_id: TEST_PROJECT_ID },
        runnerEnv(mockGitLabUrl, TEST_PROJECT_ID)
      );

      assert.equal(result.isError, true);
      assert.match(errorText(result.payload), /Runner not found/);
      assert.equal(lookupState.detailCalls, 0);
    });
  });

  describe("with more than one allowed project and no project_id", () => {
    it("should reject the call before querying GitLab", async () => {
      useRunnerPages([{ runners: [{ id: 8 }] }]);
      const result = await callTool(
        "get_runner",
        { runner_id: TEST_RUNNER_ID },
        runnerEnv(mockGitLabUrl, `${TEST_PROJECT_ID},456`)
      );

      assert.equal(result.isError, true);
      assert.match(errorText(result.payload), /Multiple projects allowed/);
      assert.deepEqual(lookupState.listUrls, []);
      assert.equal(lookupState.detailCalls, 0);
    });
  });

  describe("with a project_id outside the allowlist", () => {
    it("should deny access before querying GitLab", async () => {
      useRunnerPages([{ runners: [{ id: 8 }] }]);
      const result = await callTool(
        "get_runner",
        { runner_id: TEST_RUNNER_ID, project_id: "999" },
        runnerEnv(mockGitLabUrl, TEST_PROJECT_ID)
      );

      assert.equal(result.isError, true);
      assert.match(errorText(result.payload), /Access denied/);
      assert.deepEqual(lookupState.listUrls, []);
      assert.equal(lookupState.detailCalls, 0);
    });
  });

  describe("with a single allowed project and no project_id", () => {
    it("should verify the runner against that project", async () => {
      useRunnerPages([{ runners: [{ id: 8 }] }]);
      const result = await callTool(
        "get_runner",
        { runner_id: TEST_RUNNER_ID },
        runnerEnv(mockGitLabUrl, TEST_PROJECT_ID)
      );
      const listUrl = new URL(lookupState.listUrls[0] ?? "", "http://127.0.0.1");

      assert.equal(result.isError, false);
      assert.equal(listUrl.pathname, `/api/v4/projects/${TEST_PROJECT_ID}/runners`);
      assert.equal(listUrl.searchParams.get("per_page"), "100");
    });
  });

  describe("with the runner on a later page", () => {
    it("should follow pagination before returning details", async () => {
      useRunnerPages([{ runners: [{ id: 1 }], nextPage: "2" }, { runners: [{ id: 8 }] }]);
      const result = await callTool(
        "get_runner",
        { runner_id: TEST_RUNNER_ID, project_id: TEST_PROJECT_ID },
        runnerEnv(mockGitLabUrl, TEST_PROJECT_ID)
      );

      assert.equal(result.isError, false);
      assert.equal(lookupState.listUrls.length, 2);
      assert.equal(lookupState.detailCalls, 1);
    });
  });

  describe("with project_id and no allowlist", () => {
    it("should reject a runner that project cannot use before reading details", async () => {
      useRunnerPages([{ runners: [{ id: 1 }] }]);
      const result = await callTool(
        "get_runner",
        { runner_id: TEST_RUNNER_ID, project_id: TEST_PROJECT_ID },
        runnerEnv(mockGitLabUrl)
      );

      assert.equal(result.isError, true);
      assert.match(errorText(result.payload), /Runner not found/);
      assert.equal(lookupState.detailCalls, 0);
    });
  });

  describe("with project_id and no allowlist when the runner is listed", () => {
    it("should return projects and groups from runner details", async () => {
      useRunnerPages([{ runners: [{ id: 8 }] }]);
      const result = await callTool(
        "get_runner",
        { runner_id: TEST_RUNNER_ID, project_id: TEST_PROJECT_ID },
        runnerEnv(mockGitLabUrl)
      );
      const runner = readRecord(result.payload);

      assert.equal(result.isError, false);
      assert.deepEqual(runner.projects, [ALLOWED_PROJECT, OTHER_PROJECT]);
      assert.deepEqual(runner.groups, [{ id: 5, full_path: "other" }]);
    });
  });

  describe("with GITLAB_PROJECT_ID and no allowlist", () => {
    describe("when project_id is omitted and the runner is not on that project", () => {
      it("should reject the call before reading runner details", async () => {
        useRunnerPages([{ runners: [{ id: 1 }] }]);
        const result = await callTool(
          "get_runner",
          { runner_id: TEST_RUNNER_ID },
          { ...runnerEnv(mockGitLabUrl), GITLAB_PROJECT_ID: TEST_PROJECT_ID }
        );

        assert.equal(result.isError, true);
        assert.match(errorText(result.payload), /Runner not found/);
        assert.equal(lookupState.detailCalls, 0);
      });
    });

    describe("when project_id is omitted and the runner is listed", () => {
      it("should verify the runner against GITLAB_PROJECT_ID", async () => {
        useRunnerPages([{ runners: [{ id: 8 }] }]);
        const result = await callTool(
          "get_runner",
          { runner_id: TEST_RUNNER_ID },
          { ...runnerEnv(mockGitLabUrl), GITLAB_PROJECT_ID: TEST_PROJECT_ID }
        );
        const listUrl = new URL(lookupState.listUrls[0] ?? "", "http://127.0.0.1");

        assert.equal(result.isError, false);
        assert.equal(listUrl.pathname, `/api/v4/projects/${TEST_PROJECT_ID}/runners`);
      });

      it("should return projects and groups from runner details", async () => {
        useRunnerPages([{ runners: [{ id: 8 }] }]);
        const result = await callTool(
          "get_runner",
          { runner_id: TEST_RUNNER_ID },
          { ...runnerEnv(mockGitLabUrl), GITLAB_PROJECT_ID: TEST_PROJECT_ID }
        );
        const runner = readRecord(result.payload);

        assert.equal(result.isError, false);
        assert.deepEqual(runner.projects, [ALLOWED_PROJECT, OTHER_PROJECT]);
        assert.deepEqual(runner.groups, [{ id: 5, full_path: "other" }]);
      });
    });
  });
});
