/**
 * Auth Retry Tests
 * Unit tests for headersToPlainObject, isNonReplayableBody, and wrapWithAuthRetry.
 *
 * These are pure-function / DI-based tests — no env vars or external services needed.
 */

import { describe, test } from "node:test";
import assert from "node:assert";
import { Readable } from "node:stream";
import { Response } from "undici";
import {
  headersToPlainObject,
  isNonReplayableBody,
  wrapWithAuthRetry,
  type AuthRetryConfig,
  type FetchFn,
} from "../auth-retry.js";

function mockFetch(status: number): FetchFn {
  return async () => new Response("", { status });
}

function mockFetchThenRetry(): FetchFn {
  let callCount = 0;
  return async () => {
    callCount++;
    return new Response("", { status: callCount === 1 ? 401 : 200 });
  };
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

  test("Web ReadableStream returns true", () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
    assert.strictEqual(isNonReplayableBody(stream), true);
  });
});

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
      body: Readable.from([]),
      duplex: "half",
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(refreshCalled, false);
  });

  test("401 with Web ReadableStream body skips retry", async () => {
    let refreshCalled = false;
    const config = makeConfig({
      refreshToken: async () => {
        refreshCalled = true;
        return "tok";
      },
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
    const wrapped = wrapWithAuthRetry(mockFetch(401), config);
    const res = await wrapped("http://example.com", {
      body: stream,
      duplex: "half",
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
        return new Promise<string>(resolve => {
          resolveRefresh = resolve;
        });
      },
      buildAuthHeaders: () => ({ Authorization: "Bearer stamped" }),
    });

    let callCount = 0;
    const base: FetchFn = async () => {
      callCount++;
      return new Response("", { status: callCount <= 2 ? 401 : 200 });
    };

    const wrapped = wrapWithAuthRetry(base, config);

    const p1 = wrapped("http://example.com/a");
    const p2 = wrapped("http://example.com/b");

    await new Promise(r => setTimeout(r, 10));

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
