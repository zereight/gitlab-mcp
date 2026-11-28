import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { callToolWithBackoff, fetchWithBackoff } from "../live/rate-limit.js";

const NOW = Date.parse("2026-01-01T00:00:00Z");
const HTTP_ERROR_META = "io.github.zereight.gitlab-mcp/http-error";

function recorder() {
  const waits: number[] = [];
  const logs: string[] = [];
  const io = {
    sleep: async (ms: number) => {
      waits.push(ms);
    },
    log: (line: string) => {
      logs.push(line);
    },
    now: () => NOW,
  };
  return { waits, logs, io };
}

function fetchHarness(...responses: Array<[number, Record<string, string>?]>) {
  const { waits, logs, io } = recorder();
  const calls: number[] = [];
  const sent: Response[] = [];
  const send = async () => {
    const [status, headers] = responses[calls.length] ?? responses[responses.length - 1];
    calls.push(status);
    const response = new Response(`body ${calls.length}`, { status, headers });
    sent.push(response);
    return response;
  };
  const run = () => fetchWithBackoff(send, io);
  return { calls, sent, waits, logs, run };
}

describe("live rate limit: fetchWithBackoff", () => {
  test("200 is returned from the first attempt", async () => {
    const h = fetchHarness([200]);
    const response = await h.run();
    assert.equal(response, h.sent[0]);
    assert.deepEqual(h.calls, [200]);
    assert.deepEqual(h.waits, []);
    assert.deepEqual(h.logs, []);
  });

  test("429 waits for Retry-After, then returns the 200", async () => {
    const h = fetchHarness([429, { "Retry-After": "2" }], [200]);
    const response = await h.run();
    assert.equal(response, h.sent[1]);
    assert.deepEqual(h.calls, [429, 200]);
    assert.deepEqual(h.waits, [2000]);
    assert.deepEqual(h.logs, ["GitLab returned 429; retrying in 2s"]);
  });

  test("429 with Retry-After as an HTTP date waits until that date", async () => {
    const h = fetchHarness([429, { "Retry-After": "Thu, 01 Jan 2026 00:00:05 GMT" }], [200]);
    await h.run();
    assert.deepEqual(h.waits, [5000]);
  });

  test("429 without Retry-After waits until RateLimit-Reset", async () => {
    const reset = String(Date.parse("2026-01-01T00:00:07Z") / 1000);
    const h = fetchHarness([429, { "RateLimit-Reset": reset }], [200]);
    await h.run();
    assert.deepEqual(h.waits, [7000]);
  });

  test("429 without headers backs off exponentially", async () => {
    const h = fetchHarness([429], [429], [429], [200]);
    await h.run();
    assert.deepEqual(h.calls, [429, 429, 429, 200]);
    assert.deepEqual(h.waits, [1000, 2000, 4000]);
  });

  test("a wait over 30 s is slept in chunks of at most 30 s", async () => {
    const h = fetchHarness([429, { "Retry-After": "90" }], [200]);
    await h.run();
    assert.deepEqual(h.calls, [429, 200]);
    assert.deepEqual(h.waits, [30_000, 30_000, 30_000]);
    assert.deepEqual(h.logs, ["GitLab returned 429; retrying in 90s"]);
  });

  test("gives up after 5 attempts and returns the last 429 with its body", async () => {
    const h = fetchHarness([429, { "Retry-After": "1" }]);
    const response = await h.run();
    assert.equal(h.calls.length, 5);
    assert.deepEqual(h.waits, [1000, 1000, 1000, 1000]);
    assert.equal(response, h.sent[4]);
    assert.equal(response.status, 429);
    assert.equal(await response.text(), "body 5");
    assert.equal(h.logs.length, 5);
    assert.equal(h.logs[4], "GitLab returned 429 5 times; giving up");
  });

  test("an advertised wait above the 5 minute ceiling returns that 429 without sleeping", async () => {
    const reset = String(Date.parse("2026-01-01T00:10:00Z") / 1000);
    const cases: Array<Record<string, string>> = [
      { "Retry-After": "600" },
      { "RateLimit-Reset": reset },
    ];
    for (const headers of cases) {
      const h = fetchHarness([429, headers], [200]);
      const response = await h.run();
      assert.deepEqual(h.calls, [429]);
      assert.deepEqual(h.waits, []);
      assert.equal(response, h.sent[0]);
      assert.equal(await response.text(), "body 1");
      assert.deepEqual(h.logs, [
        "GitLab returned 429; a 600s wait passes the 5 minute ceiling; giving up",
      ]);
    }
  });

  test("waits that add up past the 5 minute ceiling stop the retries", async () => {
    const h = fetchHarness([429, { "Retry-After": "120" }]);
    const response = await h.run();
    assert.deepEqual(h.calls, [429, 429, 429]);
    assert.equal(
      h.waits.reduce((sum, ms) => sum + ms, 0),
      240_000
    );
    assert.equal(response, h.sent[2]);
  });

  test("other statuses are returned from the first attempt, body intact", async () => {
    for (const status of [400, 401, 403, 404, 409, 500, 503]) {
      const h = fetchHarness([status, { "Retry-After": "1" }], [200]);
      const response = await h.run();
      assert.deepEqual(h.calls, [status]);
      assert.deepEqual(h.waits, []);
      assert.deepEqual(h.logs, []);
      assert.equal(response, h.sent[0]);
      assert.equal(await response.text(), "body 1");
    }
  });

  test("send is called again for each attempt, so a POST body is rebuilt", async () => {
    const bodies: string[] = [];
    const { io, waits } = recorder();
    const response = await fetchWithBackoff(async () => {
      const request = new Request("http://gitlab.invalid/api/v4/projects/1/triggers", {
        method: "POST",
        body: JSON.stringify({ description: "e2e" }),
      });
      bodies.push(await request.text());
      return new Response(null, {
        status: bodies.length < 3 ? 429 : 201,
        headers: { "Retry-After": "1" },
      });
    }, io);
    assert.equal(response.status, 201);
    assert.deepEqual(bodies, Array(3).fill('{"description":"e2e"}'));
    assert.deepEqual(waits, [1000, 1000]);
  });
});

function errorResult(text: string, meta?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text }],
    isError: true,
    ...(meta ? { _meta: { [HTTP_ERROR_META]: meta } } : {}),
  };
}

const OK: CallToolResult = { content: [{ type: "text", text: '{"status":"success"}' }] };
const RATE_LIMITED = errorResult(
  "GitLab API error: 429 Too Many Requests\nRetry later\nNext: wait and retry; lower per_page or paginate if the client is bursting.",
  { status: 429 }
);
const STALE_COMMIT = errorResult(
  'GitLab API error: 400 Bad Request\n{"message":"You are attempting to update a file that has changed since you started editing it."}',
  { status: 400 }
);

type Outcome = CallToolResult | Error;

function toolHarness(...outcomes: Outcome[]) {
  const { waits, logs, io } = recorder();
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const client = {
    async callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult> {
      calls.push({ name, args });
      const outcome = outcomes[calls.length - 1] ?? outcomes[outcomes.length - 1];
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
  const run = () => callToolWithBackoff(client, "fake_tool", { project_id: "1" }, io);
  return { calls, waits, logs, run };
}

describe("live rate limit: callToolWithBackoff", () => {
  test("a successful result is returned from the first call", async () => {
    const h = toolHarness(OK);
    assert.equal(await h.run(), OK);
    assert.deepEqual(h.calls, [{ name: "fake_tool", args: { project_id: "1" } }]);
    assert.deepEqual(h.waits, []);
    assert.deepEqual(h.logs, []);
  });

  test("a 429 error result is retried after 15 s, then the success is returned", async () => {
    const h = toolHarness(RATE_LIMITED, OK);
    assert.equal(await h.run(), OK);
    assert.equal(h.calls.length, 2);
    assert.deepEqual(h.waits, [15_000]);
    assert.deepEqual(h.logs, ["fake_tool: GitLab rate limit (429); retrying in 15s"]);
  });

  test("the Retry-After the server forwards in _meta is honored", async () => {
    const h = toolHarness(
      errorResult("GitLab API error: 429 Too Many Requests", { status: 429, retryAfter: "47" }),
      OK
    );
    assert.equal(await h.run(), OK);
    assert.deepEqual(h.waits, [30_000, 17_000]);
    assert.deepEqual(h.logs, ["fake_tool: GitLab rate limit (429); retrying in 47s"]);
  });

  test("429 wording without _meta is retried", async () => {
    for (const text of [
      "GitLab API error: 429 \nRetry later",
      'GraphQL request failed (429): {"message":"Too Many Requests"}',
      "GitLab API Rate Limit Exceeded: User API Key Rate limit exceeded",
    ]) {
      const h = toolHarness(errorResult(text), OK);
      assert.equal(await h.run(), OK, text);
      assert.deepEqual(h.waits, [15_000], text);
    }
  });

  test("execute_graphql's rate-limited data reply is retried; other replies are not", async () => {
    const limited: CallToolResult = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "GraphQL request failed: GitLab API error: 429 Too Many Requests\nRetry later",
          }),
        },
      ],
    };
    const h = toolHarness(limited, OK);
    assert.equal(await h.run(), OK);
    assert.deepEqual(h.waits, [15_000]);

    for (const text of [
      JSON.stringify({ error: "GraphQL request failed: fetch failed" }),
      JSON.stringify({ data: { note: "Too Many Requests" } }),
      JSON.stringify({ error: "Too Many Requests", data: null }),
    ]) {
      const reply: CallToolResult = { content: [{ type: "text", text }] };
      const other = toolHarness(reply, OK);
      assert.equal(await other.run(), reply, text);
      assert.equal(other.calls.length, 1, text);
    }
  });

  test("a stale last_commit_id rejection is returned from the first call", async () => {
    const h = toolHarness(STALE_COMMIT, OK);
    assert.equal(await h.run(), STALE_COMMIT);
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.waits, []);
    assert.deepEqual(h.logs, []);
  });

  test("other error results are returned from the first call, even with 429 in a path", async () => {
    for (const result of [
      errorResult(
        'GitLab API error: 404 Not Found\n{"message":"404 Group Not Found"}\nNext: check group_id',
        { status: 404 }
      ),
      errorResult("GitLab API error: 404 Not Found on /projects/429/issues/429", { status: 404 }),
      errorResult("Access denied: project 429 is not in GITLAB_ALLOWED_PROJECT_IDS"),
      errorResult("list_namespaces is not allowed while a project allowlist is in effect"),
      errorResult("GitLab API error: 403 Forbidden\ninsufficient_scope", { status: 403 }),
      // The HTTP status wins over wording that happens to look like a rate limit.
      errorResult('GitLab API error: 400 Bad Request\n{"message":"Too Many Requests in title"}', {
        status: 400,
      }),
    ]) {
      const h = toolHarness(result, OK);
      assert.equal(await h.run(), result);
      assert.equal(h.calls.length, 1);
      assert.deepEqual(h.waits, []);
    }
  });

  test("a thrown error that is not a rate limit propagates unchanged", async () => {
    const error = new Error("Failed to call tool 'fake_tool': MCP error -32001: Request timed out");
    const h = toolHarness(error, OK);
    await assert.rejects(h.run(), thrown => thrown === error);
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.waits, []);
  });

  test("a thrown rate-limit error is retried", async () => {
    const h = toolHarness(
      new Error(
        "Failed to call tool 'fake_tool': MCP error -32603: GitLab API error: 429 Too Many Requests"
      ),
      OK
    );
    assert.equal(await h.run(), OK);
    assert.deepEqual(h.waits, [15_000]);
  });

  test("gives up after 3 retries and returns the last error result", async () => {
    const results = [1, 2, 3, 4].map(n => errorResult(`GitLab API error: 429 (${n})`));
    const h = toolHarness(...results);
    assert.equal(await h.run(), results[3]);
    assert.equal(h.calls.length, 4);
    assert.deepEqual(h.waits, [15_000, 30_000, 30_000]);
    assert.equal(h.logs.at(-1), "fake_tool: GitLab rate limit (429) after 3 retries; giving up");
  });

  test("gives up after 3 retries and throws the last thrown rate-limit error", async () => {
    const errors = [1, 2, 3, 4].map(n => new Error(`Rate limit exceeded (${n})`));
    const h = toolHarness(...errors);
    await assert.rejects(h.run(), thrown => thrown === errors[3]);
    assert.equal(h.calls.length, 4);
  });

  test("a forwarded Retry-After above the 5 minute ceiling returns that result at once", async () => {
    const limited = errorResult("GitLab API error: 429 Too Many Requests", {
      status: 429,
      retryAfter: "600",
    });
    const h = toolHarness(limited, OK);
    assert.equal(await h.run(), limited);
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.waits, []);
    assert.deepEqual(h.logs, [
      "fake_tool: GitLab rate limit (429); a 600s wait passes the 5 minute ceiling; giving up",
    ]);
  });

  test("an SDK Client is called with { name, arguments }", async () => {
    const sdk = new Client({ name: "live-rate-limit-test", version: "1.0.0" });
    const params: unknown[] = [];
    const replies = [RATE_LIMITED, OK];
    sdk.callTool = (async (request: unknown) => {
      params.push(request);
      return replies[params.length - 1];
    }) as Client["callTool"];
    const { io, waits } = recorder();
    assert.equal(await callToolWithBackoff(sdk, "fake_tool", { project_id: "1" }, io), OK);
    assert.deepEqual(params, [
      { name: "fake_tool", arguments: { project_id: "1" } },
      { name: "fake_tool", arguments: { project_id: "1" } },
    ]);
    assert.deepEqual(waits, [15_000]);
  });
});
