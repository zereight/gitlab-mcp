import { describe, it, test } from "node:test";
import assert from "node:assert";
import {
  isInitializationRequestBody,
  isUnauthenticatedDiscoveryRequestBody,
  parseProjectScopeHeader,
  readAcceptHeader,
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
    assert.strictEqual(isUnauthenticatedDiscoveryRequestBody({ method: "server/discover" }), true);
    assert.strictEqual(
      isUnauthenticatedDiscoveryRequestBody([
        { method: "initialize" },
        { method: "notifications/initialized" },
        { method: "tools/list" },
        { method: "server/discover" },
      ]),
      true
    );
    assert.strictEqual(
      isUnauthenticatedDiscoveryRequestBody([
        { method: "tools/list" },
        { method: "call_tool" },
        { method: "tools/call" },
      ]),
      false
    );
    assert.strictEqual(
      isUnauthenticatedDiscoveryRequestBody([
        { method: "server/discover" },
        { method: "tools/call" },
      ]),
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

  test("joins duplicate Accept headers so text/event-stream is not dropped", () => {
    assert.strictEqual(
      readAcceptHeader({ headers: { accept: "application/json, text/event-stream" } }),
      "application/json, text/event-stream"
    );
    assert.strictEqual(
      readAcceptHeader({ headers: { accept: ["application/json", "text/event-stream"] } }),
      "application/json, text/event-stream"
    );
    assert.strictEqual(readAcceptHeader({ headers: {} }), "");
  });
});

describe("When parsing an X-GitLab-Allowed-Project-Ids value", () => {
  describe("with whitespace and empty entries around the ids", () => {
    it("should return the trimmed ids", () => {
      const scope = parseProjectScopeHeader(" 1 , ,group/project ,", []);

      assert.deepStrictEqual(scope, { projectIds: ["1", "group/project"] });
    });
  });

  describe("with no id at all", () => {
    it("should return an error", () => {
      const scope = parseProjectScopeHeader(" , ", []);

      assert.ok("error" in scope);
    });
  });

  describe("with an id outside a configured allowlist", () => {
    it("should return an error instead of widening the allowlist", () => {
      const scope = parseProjectScopeHeader("1,3", ["1", "2"]);

      assert.ok("error" in scope);
    });
  });

  describe("with ids inside a configured allowlist", () => {
    it("should narrow the allowlist to them", () => {
      const scope = parseProjectScopeHeader("2", ["1", "2"]);

      assert.deepStrictEqual(scope, { projectIds: ["2"] });
    });
  });
});
