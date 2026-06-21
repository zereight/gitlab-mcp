import { describe, test } from "node:test";
import assert from "node:assert";
import {
  isInitializationRequestBody,
  isUnauthenticatedDiscoveryRequestBody,
  readMcpSessionIdHeader,
  redactSessionIdForLog,
} from "../../server/request-helpers.js";

describe("streamable request helpers", () => {
  test("redacts stateless session ids and truncates legacy ids", () => {
    assert.strictEqual(redactSessionIdForLog(undefined), "<none>");
    assert.strictEqual(redactSessionIdForLog("v1.sid.secret-payload"), "v1.sid.<redacted>");
    assert.strictEqual(redactSessionIdForLog("123456789abcdef"), "12345678…");
    assert.strictEqual(redactSessionIdForLog("short"), "short");
  });

  test("detects initialize requests in single and batch bodies", () => {
    assert.strictEqual(isInitializationRequestBody({ method: "initialize" }), true);
    assert.strictEqual(
      isInitializationRequestBody([{ method: "tools/list" }, { method: "initialize" }]),
      true
    );
    assert.strictEqual(isInitializationRequestBody({ method: "tools/list" }), false);
    assert.strictEqual(isInitializationRequestBody(null), false);
  });

  test("allows only discovery methods in unauthenticated discovery bodies", () => {
    assert.strictEqual(isUnauthenticatedDiscoveryRequestBody({ method: "tools/list" }), true);
    assert.strictEqual(
      isUnauthenticatedDiscoveryRequestBody([
        { method: "initialize" },
        { method: "notifications/initialized" },
        { method: "tools/list" },
      ]),
      true
    );
    assert.strictEqual(
      isUnauthenticatedDiscoveryRequestBody([{ method: "tools/list" }, { method: "call_tool" }]),
      false
    );
    assert.strictEqual(isUnauthenticatedDiscoveryRequestBody(undefined), false);
  });

  test("normalizes Mcp-Session-Id headers", () => {
    assert.strictEqual(readMcpSessionIdHeader({ headers: { "mcp-session-id": "sid-1" } }), "sid-1");
    assert.strictEqual(readMcpSessionIdHeader({ headers: { "mcp-session-id": "" } }), undefined);
    assert.strictEqual(
      readMcpSessionIdHeader({ headers: { "mcp-session-id": ["sid-1", "sid-2"] } }),
      undefined
    );
    assert.strictEqual(readMcpSessionIdHeader({ headers: {} }), undefined);
  });
});
