/**
 * Auth Retry Tests
 * Unit tests for headersToPlainObject, isNonReplayableBody, and wrapWithAuthRetry.
 *
 * These are pure-function / DI-based tests — no env vars or external services needed.
 */

import { describe, test } from "node:test";
import assert from "node:assert";
import nodeFetch, { Headers, Response } from "node-fetch";
import {
  headersToPlainObject,
  isNonReplayableBody,
  wrapWithAuthRetry,
  type AuthRetryConfig,
} from "../auth-retry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(status: number): typeof nodeFetch {
  return (async () => new Response("", { status })) as any;
}

function mockFetchThenRetry(): typeof nodeFetch {
  let callCount = 0;
  return (async () => {
    callCount++;
    return new Response("", { status: callCount === 1 ? 401 : 200 });
  }) as any;
}

function makeConfig(overrides?: Partial<AuthRetryConfig>): AuthRetryConfig {
  return {
    isOAuthEnabled: () => true,
    refreshToken: async () => "new-token",
    onTokenRefreshed: () => {},
    buildAuthHeaders: () => ({ Authorization: "Bearer new-token" }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// headersToPlainObject
// ---------------------------------------------------------------------------

describe("headersToPlainObject", () => {
  test("null returns empty object", () => {
    assert.deepStrictEqual(headersToPlainObject(null), {});
  });

  test("undefined returns empty object", () => {
    assert.deepStrictEqual(headersToPlainObject(undefined), {});
  });

  test("plain object passed through", () => {
    const obj = { "Content-Type": "application/json", Accept: "text/html" };
    assert.deepStrictEqual(headersToPlainObject(obj), obj);
  });

  test("Headers instance normalized", () => {
    const h = new Headers();
    h.set("x-custom", "value1");
    h.set("authorization", "Bearer tok");
    const result = headersToPlainObject(h);
    assert.strictEqual(result["x-custom"], "value1");
    assert.strictEqual(result["authorization"], "Bearer tok");
  });

  test("array of tuples normalized", () => {
    const arr: [string, string][] = [
      ["x-foo", "bar"],
      ["x-baz", "qux"],
    ];
    assert.deepStrictEqual(headersToPlainObject(arr), {
      "x-foo": "bar",
      "x-baz": "qux",
    });
  });
});

// ---------------------------------------------------------------------------
// isNonReplayableBody
// ---------------------------------------------------------------------------

describe("isNonReplayableBody", () => {
  test("null returns false", () => {
    assert.strictEqual(isNonReplayableBody(null), false);
  });

  test("undefined returns false", () => {
    assert.strictEqual(isNonReplayableBody(undefined), false);
  });

  test("empty string returns false", () => {
    assert.strictEqual(isNonReplayableBody(""), false);
  });

  test("plain string returns false", () => {
    assert.strictEqual(isNonReplayableBody("hello"), false);
  });

  test("object with .pipe() returns true (stream-like)", () => {
    assert.strictEqual(isNonReplayableBody({ pipe: () => {} }), true);
  });

  test("object with .read() returns true (stream-like)", () => {
    assert.strictEqual(isNonReplayableBody({ read: () => {} }), true);
  });

  test("object with .getBuffer() and .getBoundary() returns true (FormData-like)", () => {
    assert.strictEqual(
      isNonReplayableBody({ getBuffer: () => {}, getBoundary: () => {} }),
      true,
    );
  });

  test("object with only .getBuffer() (no .getBoundary()) returns false", () => {
    assert.strictEqual(isNonReplayableBody({ getBuffer: () => {} }), false);
  });
});

// ---------------------------------------------------------------------------
// wrapWithAuthRetry
// ---------------------------------------------------------------------------

describe("wrapWithAuthRetry", () => {
  test("non-401 response passes through unchanged", async () => {
    const wrapped = wrapWithAuthRetry(mockFetch(200), makeConfig());
    const res = await wrapped("http://example.com");
    assert.strictEqual(res.status, 200);
  });

  test("401 when OAuth disabled passes through unchanged", async () => {
    const config = makeConfig({ isOAuthEnabled: () => false });
    const wrapped = wrapWithAuthRetry(mockFetch(401), config);
    const res = await wrapped("http://example.com");
    assert.strictEqual(res.status, 401);
  });

  test("401 with OAuth enabled triggers refresh and retry", async () => {
    let refreshCalled = false;
    let tokenSet: string | null = null;

    const config = makeConfig({
      refreshToken: async () => {
        refreshCalled = true;
        return "refreshed-token";
      },
      onTokenRefreshed: (token: string) => {
        tokenSet = token;
      },
      buildAuthHeaders: () => ({ Authorization: "Bearer refreshed-token" }),
    });

    const base = mockFetchThenRetry();
    const wrapped = wrapWithAuthRetry(base, config);
    const res = await wrapped("http://example.com");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(refreshCalled, true);
    assert.strictEqual(tokenSet, "refreshed-token");
  });

  test("401 with non-replayable body skips retry", async () => {
    let refreshCalled = false;
    const config = makeConfig({
      refreshToken: async () => {
        refreshCalled = true;
        return "tok";
      },
    });

    const wrapped = wrapWithAuthRetry(mockFetch(401), config);
    const res = await wrapped("http://example.com", {
      body: { pipe: () => {} } as any, // stream-like
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(refreshCalled, false);
  });

  test("concurrent 401s only trigger one refresh (stampede test)", async () => {
    let refreshCount = 0;
    let resolveRefresh: (v: string) => void = () => {};

    const config = makeConfig({
      refreshToken: () => {
        refreshCount++;
        return new Promise<string>((resolve) => {
          resolveRefresh = resolve;
        });
      },
      buildAuthHeaders: () => ({ Authorization: "Bearer stamped" }),
    });

    // Each call returns 401 first, then 200 on retry
    let callCount = 0;
    const base: typeof nodeFetch = (async () => {
      callCount++;
      // First two calls are the initial requests (both 401)
      // Next two are the retries (both 200)
      return new Response("", { status: callCount <= 2 ? 401 : 200 });
    }) as any;

    const wrapped = wrapWithAuthRetry(base, config);

    // Fire two concurrent requests
    const p1 = wrapped("http://example.com/a");
    const p2 = wrapped("http://example.com/b");

    // Wait a tick for both to hit the refresh path
    await new Promise((r) => setTimeout(r, 10));

    // Resolve the single pending refresh
    resolveRefresh("stamped-token");

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(refreshCount, 1, "refresh should be called exactly once");
  });

  test("token refresh failure returns original 401 response", async () => {
    const config = makeConfig({
      refreshToken: async () => {
        throw new Error("refresh exploded");
      },
    });

    const wrapped = wrapWithAuthRetry(mockFetch(401), config);
    const res = await wrapped("http://example.com");
    assert.strictEqual(res.status, 401);
  });
});
