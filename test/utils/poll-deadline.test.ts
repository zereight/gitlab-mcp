import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import { fetchStatusBeforeDeadline, POLL_TIMEOUT_MESSAGE } from "../../utils/poll-deadline.js";

// AbortSignal.timeout does not keep the process alive, so hold it open until the abort.
function waitForAbort(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const keepAlive = setInterval(() => {}, 1000);
    signal.addEventListener(
      "abort",
      () => {
        clearInterval(keepAlive);
        resolve();
      },
      { once: true }
    );
  });
}

async function rejectAfterAbort(signal: AbortSignal, error: () => unknown): Promise<never> {
  await waitForAbort(signal);
  throw error();
}

describe("When fetchStatusBeforeDeadline runs", () => {
  test("should return the fetched value before the deadline", async () => {
    const value = await fetchStatusBeforeDeadline(async () => "finished", Date.now() + 1000);

    assert.equal(value, "finished");
  });

  test("should time out without fetching once the deadline has passed", async () => {
    let fetched = false;

    await assert.rejects(
      fetchStatusBeforeDeadline(async () => {
        fetched = true;
        return "finished";
      }, Date.now() - 1),
      { message: POLL_TIMEOUT_MESSAGE }
    );
    assert.equal(fetched, false);
  });

  test("should report an abort by the deadline signal as a timeout", async () => {
    let reason: unknown;

    await assert.rejects(
      fetchStatusBeforeDeadline(
        signal =>
          rejectAfterAbort(signal, () => {
            reason = signal.reason;
            return signal.reason;
          }),
        Date.now() + 20
      ),
      (error: Error) => {
        assert.equal(error.message, POLL_TIMEOUT_MESSAGE);
        assert.equal(error.cause, reason);
        return true;
      }
    );
  });

  test("should report a body read that starts after the deadline as a timeout", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"status":"running"}');
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;

    try {
      await assert.rejects(
        fetchStatusBeforeDeadline(async signal => {
          const response = await fetch(`http://127.0.0.1:${port}/`, { signal });
          await waitForAbort(signal);
          return response.json();
        }, Date.now() + 1000),
        (error: Error) => {
          assert.equal(error.message, POLL_TIMEOUT_MESSAGE);
          // An abort of the request itself would leave the TimeoutError reason here.
          assert.equal((error.cause as Error).name, "AbortError");
          return true;
        }
      );
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });

  test("should keep another error that lands after the deadline", async () => {
    const failure = new Error("GitLab API error: 500 Internal Server Error");

    await assert.rejects(
      fetchStatusBeforeDeadline(signal => rejectAfterAbort(signal, () => failure), Date.now() + 20),
      error => error === failure
    );
  });

  test("should keep an error that lands before the deadline", async () => {
    const failure = new Error("GitLab API error: 404 Not Found");

    await assert.rejects(
      fetchStatusBeforeDeadline(async () => {
        throw failure;
      }, Date.now() + 1000),
      error => error === failure
    );
  });
});
