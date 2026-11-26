import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deleteScratch } from "../live/cleanup.js";

function harness(...responses: Array<[number, Record<string, string>?]>) {
  const calls: number[] = [];
  const waits: number[] = [];
  const logs: string[] = [];
  const send = async () => {
    const [status, headers] = responses[calls.length] ?? responses[responses.length - 1];
    calls.push(status);
    return new Response(null, { status, headers });
  };
  const io = {
    sleep: async (ms: number) => {
      waits.push(ms);
    },
    log: (line: string) => {
      logs.push(line);
    },
    now: () => Date.parse("2026-01-01T00:00:00Z"),
  };
  const run = () => deleteScratch(send, "branch scratch", "delete it by hand", io);
  return { calls, waits, logs, run };
}

describe("live cleanup: deleteScratch", () => {
  test("204 deletes once without logging", async () => {
    const h = harness([204]);
    await h.run();
    assert.deepEqual(h.calls, [204]);
    assert.deepEqual(h.waits, []);
    assert.deepEqual(h.logs, []);
  });

  test("404 counts as already deleted", async () => {
    const h = harness([404]);
    await h.run();
    assert.deepEqual(h.calls, [404]);
    assert.deepEqual(h.logs, []);
  });

  test("429 waits for Retry-After, then succeeds", async () => {
    const h = harness([429, { "Retry-After": "2" }], [204]);
    await h.run();
    assert.deepEqual(h.calls, [429, 204]);
    assert.deepEqual(h.waits, [2000]);
    assert.deepEqual(h.logs, []);
  });

  test("429 waits until RateLimit-Reset without Retry-After", async () => {
    const reset = String(Date.parse("2026-01-01T00:00:07Z") / 1000);
    const h = harness([429, { "RateLimit-Reset": reset }], [204]);
    await h.run();
    assert.deepEqual(h.waits, [7000]);
    assert.deepEqual(h.logs, []);
  });

  test("429 without headers backs off exponentially", async () => {
    const h = harness([429], [429], [429], [204]);
    await h.run();
    assert.deepEqual(h.calls, [429, 429, 429, 204]);
    assert.deepEqual(h.waits, [1000, 2000, 4000]);
    assert.deepEqual(h.logs, []);
  });

  test("429 with a wait over the 30s cap sleeps in capped chunks, then retries once", async () => {
    const h = harness([429, { "Retry-After": "90" }], [204]);
    await h.run();
    assert.deepEqual(h.calls, [429, 204]);
    assert.deepEqual(h.waits, [30_000, 30_000, 30_000]);
    assert.deepEqual(h.logs, []);
  });

  test("429 with a wait over the 5 minute ceiling gives up without sleeping", async () => {
    const reset = String(Date.parse("2026-01-01T00:10:00Z") / 1000);
    const cases: Array<Record<string, string>> = [
      { "Retry-After": "600" },
      { "RateLimit-Reset": reset },
    ];
    for (const headers of cases) {
      const h = harness([429, headers], [204]);
      await h.run();
      assert.deepEqual(h.calls, [429]);
      assert.deepEqual(h.waits, []);
      assert.deepEqual(h.logs, [
        "could not delete branch scratch (429, advertised wait exceeds the 5 minute ceiling); delete it by hand",
      ]);
    }
  });

  test("429 on every attempt logs once and does not throw", async () => {
    const h = harness([429, { "Retry-After": "1" }]);
    await h.run();
    assert.equal(h.calls.length, 5);
    assert.equal(h.waits.length, 4);
    assert.deepEqual(h.logs, ["could not delete branch scratch (429); delete it by hand"]);
  });

  test("a non-429 error is not retried, logs, and does not throw", async () => {
    for (const status of [403, 500]) {
      const h = harness([status], [204]);
      await h.run();
      assert.deepEqual(h.calls, [status]);
      assert.deepEqual(h.waits, []);
      assert.deepEqual(h.logs, [`could not delete branch scratch (${status}); delete it by hand`]);
    }
  });

  test("in a finally block, delete still runs when disconnect throws", async () => {
    const h = harness([429], [204]);
    await assert.rejects(
      async () => {
        try {
          throw new Error("disconnect failed");
        } finally {
          await h.run();
        }
      },
      { message: "disconnect failed" }
    );
    assert.deepEqual(h.calls, [429, 204]);
    assert.deepEqual(h.logs, []);
  });
});
