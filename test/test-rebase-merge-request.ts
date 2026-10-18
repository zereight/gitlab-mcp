import { after, before, describe, it, test } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { RebaseMergeRequestSchema } from "../schemas.js";
import {
  TOOLSET_DEFINITIONS,
  deleteTools,
  destructiveTools,
  readOnlyTools,
} from "../tools/registry.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-rebase-merge-request";
const TEST_PROJECT_ID = "123";
const OLD_SHA = "1111111111111111111111111111111111111111";
const NEW_SHA = "2222222222222222222222222222222222222222";
const REBASE_FAILED = "Rebase failed: Rebase locally, resolve all conflicts, then push the branch.";

// One merge request IID per scenario, so the mock handlers stay independent.
const MR_ENQUEUE_ONLY = "1";
const MR_SKIP_CI = "2";
const MR_SUCCESS = "3";
const MR_FAILED = "4";
const MR_TIMEOUT = "5";
const MR_FORBIDDEN = "6";
const MR_STALE_THEN_MOVED = "7";
const MR_NOOP = "8";
const MR_RECHECK_TIMEOUT = "9";
const MR_SLOW_POLL = "10";

function buildMergeRequest(iid: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `100${iid}`,
    iid,
    project_id: TEST_PROJECT_ID,
    title: "Rebase me",
    description: null,
    state: "opened",
    author: {
      id: "1",
      username: "octocat",
      name: "Octo Cat",
      avatar_url: null,
      web_url: "https://gitlab.example.com/octocat",
    },
    source_branch: "feature/rebase",
    target_branch: "main",
    web_url: `https://gitlab.example.com/group/project/-/merge_requests/${iid}`,
    created_at: "2026-10-14T00:00:00.000Z",
    updated_at: "2026-10-14T00:00:00.000Z",
    merged_at: null,
    closed_at: null,
    merge_commit_sha: null,
    sha: OLD_SHA,
    merge_error: null,
    rebase_in_progress: false,
    ...overrides,
  };
}

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
      },
    });

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

      const response = JSON.parse(line);
      if (response.error) {
        reject(new Error(response.error.message ?? JSON.stringify(response.error)));
        return;
      }

      const content = response.result?.content?.[0]?.text;
      if (!content) {
        resolve(response.result);
        return;
      }

      try {
        resolve(JSON.parse(content));
      } catch {
        resolve(content);
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

describe("When parsing rebase_merge_request arguments", () => {
  describe("with only the required fields", () => {
    it("should wait by default and leave skip_ci unset", () => {
      const parsed = RebaseMergeRequestSchema.parse({
        project_id: TEST_PROJECT_ID,
        merge_request_iid: 7,
      });

      assert.strictEqual(parsed.merge_request_iid, "7");
      assert.strictEqual(parsed.wait, true);
      assert.strictEqual(parsed.skip_ci, undefined);
    });
  });

  describe("with string booleans", () => {
    it("should read 'false' as false", () => {
      const parsed = RebaseMergeRequestSchema.parse({
        project_id: TEST_PROJECT_ID,
        merge_request_iid: "7",
        skip_ci: "false",
        wait: "false",
      });

      assert.strictEqual(parsed.skip_ci, false);
      assert.strictEqual(parsed.wait, false);
    });
  });

  describe("with a timeout above the limit", () => {
    it("should reject the arguments", () => {
      assert.throws(() =>
        RebaseMergeRequestSchema.parse({
          project_id: TEST_PROJECT_ID,
          merge_request_iid: "7",
          timeout_seconds: 601,
        })
      );
    });
  });
});

describe("When registering rebase_merge_request", () => {
  it("should belong to the merge_requests toolset", () => {
    const toolset = TOOLSET_DEFINITIONS.find(definition => definition.id === "merge_requests");

    assert.ok(toolset?.tools.has("rebase_merge_request"));
  });

  it("should be destructive but stay available in modify mode", () => {
    assert.ok(destructiveTools.has("rebase_merge_request"));
    assert.equal(deleteTools.has("rebase_merge_request"), false);
    assert.equal(readOnlyTools.has("rebase_merge_request"), false);
  });
});

describe("rebase_merge_request tool", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  const rebaseBodies = new Map<string, Record<string, unknown>>();
  const statusQueries = new Map<string, Array<Record<string, unknown>>>();
  const statusObservedAt = new Map<string, number[]>();
  const statusQueriesBeforeRebase = new Map<string, number>();

  function statusObservationSpanMs(iid: string): number {
    const observedAt = statusObservedAt.get(iid) ?? [];
    const startedAt = observedAt[0];
    const finishedAt = observedAt[observedAt.length - 1];
    if (startedAt === undefined || finishedAt === undefined) {
      return 0;
    }
    return finishedAt - startedAt;
  }

  function addRebaseHandler(iid: string) {
    mockGitLab.addMockHandler(
      "put",
      `/projects/${TEST_PROJECT_ID}/merge_requests/${iid}/rebase`,
      (req, res) => {
        rebaseBodies.set(iid, req.body);
        statusQueriesBeforeRebase.set(iid, statusQueries.get(iid)?.length ?? 0);
        res.status(202).json({ rebase_in_progress: true });
      }
    );
  }

  function addStatusHandler(iid: string, states: Array<Record<string, unknown>>) {
    const queries: Array<Record<string, unknown>> = [];
    const observedAt: number[] = [];
    statusQueries.set(iid, queries);
    statusObservedAt.set(iid, observedAt);
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/merge_requests/${iid}`,
      (req, res) => {
        queries.push({ ...req.query });
        observedAt.push(Date.now());
        const state = states[Math.min(queries.length - 1, states.length - 1)];
        res.json(buildMergeRequest(iid, state));
      }
    );
  }

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    for (const iid of [
      MR_ENQUEUE_ONLY,
      MR_SKIP_CI,
      MR_SUCCESS,
      MR_FAILED,
      MR_TIMEOUT,
      MR_STALE_THEN_MOVED,
      MR_NOOP,
      MR_RECHECK_TIMEOUT,
      MR_SLOW_POLL,
    ]) {
      addRebaseHandler(iid);
    }
    addStatusHandler(MR_ENQUEUE_ONLY, [{ rebase_in_progress: true }]);
    // The first GET of a waiting call reads the head before the rebase.
    addStatusHandler(MR_SUCCESS, [
      { rebase_in_progress: false },
      { rebase_in_progress: true },
      { rebase_in_progress: false, sha: NEW_SHA },
    ]);
    addStatusHandler(MR_FAILED, [
      { rebase_in_progress: false },
      { rebase_in_progress: false, merge_error: REBASE_FAILED },
    ]);
    addStatusHandler(MR_TIMEOUT, [{ rebase_in_progress: true }]);
    addStatusHandler(MR_FORBIDDEN, [{ rebase_in_progress: false }]);
    // First post-rebase poll is the pre-job "finished" snapshot. in_progress then
    // resumes the normal wait, past the 3-recheck cap, until the head moves.
    addStatusHandler(MR_STALE_THEN_MOVED, [
      { rebase_in_progress: false },
      { rebase_in_progress: false },
      { rebase_in_progress: true },
      { rebase_in_progress: true },
      { rebase_in_progress: true },
      { rebase_in_progress: false, sha: NEW_SHA },
    ]);
    addStatusHandler(MR_NOOP, [{ rebase_in_progress: false }]);
    // The new sha is only on the third extra poll, which a 1s timeout cannot reach.
    addStatusHandler(MR_RECHECK_TIMEOUT, [
      { rebase_in_progress: false },
      { rebase_in_progress: false },
      { rebase_in_progress: false },
      { rebase_in_progress: false },
      { rebase_in_progress: false, sha: NEW_SHA },
    ]);

    // The head read answers at once; the poll after the rebase answers after the 1s timeout.
    const slowPollQueries: Array<Record<string, unknown>> = [];
    statusQueries.set(MR_SLOW_POLL, slowPollQueries);
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/merge_requests/${MR_SLOW_POLL}`,
      (req, res) => {
        slowPollQueries.push({ ...req.query });
        if (slowPollQueries.length === 1) {
          res.json(buildMergeRequest(MR_SLOW_POLL, { rebase_in_progress: false }));
          return;
        }
        setTimeout(() => {
          res.json(buildMergeRequest(MR_SLOW_POLL, { rebase_in_progress: true }));
        }, 1500);
      }
    );

    mockGitLab.addMockHandler(
      "put",
      `/projects/${TEST_PROJECT_ID}/merge_requests/${MR_FORBIDDEN}/rebase`,
      (_req, res) => {
        res.status(403).json({ message: "403 Forbidden - Cannot push to source branch" });
      }
    );

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  const env = () => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "merge_requests",
  });

  test("rebase_merge_request with wait false returns the enqueue response without polling", async () => {
    const result = await callTool(
      "rebase_merge_request",
      { project_id: TEST_PROJECT_ID, merge_request_iid: MR_ENQUEUE_ONLY, wait: false },
      env()
    );

    assert.deepStrictEqual(result, { rebase_in_progress: true });
    assert.deepStrictEqual(rebaseBodies.get(MR_ENQUEUE_ONLY), {});
    assert.strictEqual(statusQueries.get(MR_ENQUEUE_ONLY)?.length, 0);
  });

  test("rebase_merge_request forwards skip_ci in the request body", async () => {
    await callTool(
      "rebase_merge_request",
      { project_id: TEST_PROJECT_ID, merge_request_iid: MR_SKIP_CI, skip_ci: true, wait: false },
      env()
    );

    assert.deepStrictEqual(rebaseBodies.get(MR_SKIP_CI), { skip_ci: true });
  });

  test("rebase_merge_request polls until the rebase ends and reports that the head moved", async () => {
    const result = await callTool(
      "rebase_merge_request",
      { project_id: TEST_PROJECT_ID, merge_request_iid: MR_SUCCESS, poll_interval_seconds: 1 },
      env()
    );

    assert.strictEqual(result.rebase_in_progress, false);
    assert.strictEqual(result.merge_error, null);
    assert.strictEqual(result.sha, NEW_SHA);
    assert.strictEqual(result.previous_sha, OLD_SHA);
    assert.strictEqual(result.head_changed, true);
    const queries = statusQueries.get(MR_SUCCESS) ?? [];
    assert.strictEqual(queries.length, 3);
    assert.strictEqual(statusQueriesBeforeRebase.get(MR_SUCCESS), 1);
    assert.ok(queries.every(query => query.include_rebase_in_progress === "true"));
  });

  test("rebase_merge_request returns merge_error and an unmoved head when the rebase fails", async () => {
    const result = await callTool(
      "rebase_merge_request",
      { project_id: TEST_PROJECT_ID, merge_request_iid: MR_FAILED },
      env()
    );

    assert.strictEqual(result.rebase_in_progress, false);
    assert.strictEqual(result.merge_error, REBASE_FAILED);
    assert.strictEqual(result.previous_sha, OLD_SHA);
    assert.strictEqual(result.head_changed, false);
    assert.strictEqual(statusQueries.get(MR_FAILED)?.length, 2);
  });

  test("rebase_merge_request reports a timeout while the rebase still runs", async () => {
    await assert.rejects(
      () =>
        callTool(
          "rebase_merge_request",
          {
            project_id: TEST_PROJECT_ID,
            merge_request_iid: MR_TIMEOUT,
            timeout_seconds: 1,
            poll_interval_seconds: 1,
          },
          env()
        ),
      /Timed out waiting for terminal status/
    );
  });

  test("rebase_merge_request reports a timeout when a poll is still in flight at the deadline", async () => {
    await assert.rejects(
      () =>
        callTool(
          "rebase_merge_request",
          {
            project_id: TEST_PROJECT_ID,
            merge_request_iid: MR_SLOW_POLL,
            timeout_seconds: 1,
            poll_interval_seconds: 1,
          },
          env()
        ),
      /Timed out waiting for terminal status/
    );
    assert.strictEqual(statusQueries.get(MR_SLOW_POLL)?.length, 2);
  });

  test("rebase_merge_request keeps waiting when the first finished poll still has the old sha", async () => {
    const result = await callTool(
      "rebase_merge_request",
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: MR_STALE_THEN_MOVED,
        poll_interval_seconds: 1,
      },
      env()
    );

    assert.strictEqual(result.sha, NEW_SHA);
    assert.strictEqual(result.previous_sha, OLD_SHA);
    assert.strictEqual(result.head_changed, true);
    assert.strictEqual(statusQueries.get(MR_STALE_THEN_MOVED)?.length, 6);
  });

  test("rebase_merge_request reports an unchanged head after bounded rechecks when nothing moved", async () => {
    const result = await callTool(
      "rebase_merge_request",
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: MR_NOOP,
        poll_interval_seconds: 1,
        timeout_seconds: 30,
      },
      env()
    );

    assert.strictEqual(result.sha, OLD_SHA);
    assert.strictEqual(result.previous_sha, OLD_SHA);
    assert.strictEqual(result.head_changed, false);
    assert.strictEqual(result.merge_error, null);
    assert.strictEqual(statusQueries.get(MR_NOOP)?.length, 5);
    const spanMs = statusObservationSpanMs(MR_NOOP);
    assert.ok(spanMs >= 2000 && spanMs < 12000);
  });

  test("rebase_merge_request does not spend extra rechecks past timeout_seconds", async () => {
    const result = await callTool(
      "rebase_merge_request",
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: MR_RECHECK_TIMEOUT,
        poll_interval_seconds: 1,
        timeout_seconds: 1,
      },
      env()
    );

    assert.strictEqual(result.sha, OLD_SHA);
    assert.strictEqual(result.head_changed, false);
    assert.ok((statusQueries.get(MR_RECHECK_TIMEOUT)?.length ?? 0) <= 3);
    assert.ok(statusObservationSpanMs(MR_RECHECK_TIMEOUT) < 2200);
  });

  test("rebase_merge_request returns GitLab's error when the source branch is not pushable", async () => {
    const result = await callTool(
      "rebase_merge_request",
      { project_id: TEST_PROJECT_ID, merge_request_iid: MR_FORBIDDEN },
      env()
    );

    assert.match(String(result), /403/);
    assert.match(String(result), /Cannot push to source branch/);
  });
});
