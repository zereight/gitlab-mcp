import { describe, test } from "node:test";
import assert from "node:assert";
import type { Request } from "express";
import { getForwardedPublicBaseUrl } from "../../utils/forwarded-public-base-url.js";

function req(headers: Record<string, string | string[]>): Request {
  return { headers } as unknown as Request;
}

describe("getForwardedPublicBaseUrl", () => {
  test("returns undefined unless proxy headers are trusted", () => {
    assert.strictEqual(
      getForwardedPublicBaseUrl(req({ "x-forwarded-proto": "https", "x-forwarded-host": "gitlab.example.com" }), false),
      undefined
    );
  });

  test("builds a public base URL from forwarded headers", () => {
    assert.strictEqual(
      getForwardedPublicBaseUrl(
        req({
          "x-forwarded-proto": "https",
          "x-forwarded-host": "mcp.example.com",
          "x-forwarded-prefix": "/gitlab-mcp/",
        }),
        true
      ),
      "https://mcp.example.com/gitlab-mcp"
    );
  });

  test("uses the last comma-separated forwarded value", () => {
    assert.strictEqual(
      getForwardedPublicBaseUrl(
        req({
          "x-forwarded-proto": "http, https",
          "x-forwarded-host": "internal, mcp.example.com",
        }),
        true
      ),
      "https://mcp.example.com"
    );
  });

  test("parses quoted Forwarded header values", () => {
    assert.strictEqual(
      getForwardedPublicBaseUrl(
        req({
          forwarded: 'for=192.0.2.43; proto="https"; host="mcp.example.com"',
          "x-forwarded-prefix": "/gitlab-mcp",
        }),
        true
      ),
      "https://mcp.example.com/gitlab-mcp"
    );
  });

  test("rejects unsafe host and prefix values", () => {
    assert.strictEqual(
      getForwardedPublicBaseUrl(req({ "x-forwarded-proto": "https", "x-forwarded-host": "bad/host" }), true),
      undefined
    );
    assert.strictEqual(
      getForwardedPublicBaseUrl(
        req({
          "x-forwarded-proto": "https",
          "x-forwarded-host": "mcp.example.com",
          "x-forwarded-prefix": "//evil",
        }),
        true
      ),
      "https://mcp.example.com"
    );
  });
});
