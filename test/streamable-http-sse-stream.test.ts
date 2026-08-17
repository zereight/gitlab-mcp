import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import {
  cleanupServers,
  findAvailablePort,
  HOST,
  launchServer,
  ServerInstance,
  TransportMode,
} from "./utils/server-launcher.js";
import { findMockServerPort, MockGitLabServer } from "./utils/mock-gitlab-server.js";

const VALID_TOKEN = "test-token-sse-stream-12345";

async function postJsonRpc(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const sessionId = response.headers.get("mcp-session-id");
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("text/event-stream")) {
    const dataLines = text
      .split("\n")
      .filter(line => line.startsWith("data: "))
      .map(line => line.slice(6));
    const lastLine = dataLines.at(-1);
    const parsedData = lastLine && lastLine.length > 0 ? JSON.parse(lastLine) : null;
    return {
      status: response.status,
      data: parsedData,
      sessionId,
      text,
    };
  }

  const parsedData = text.length > 0 ? JSON.parse(text) : null;
  return {
    status: response.status,
    data: parsedData,
    sessionId,
    text,
  };
}

describe("When Streamable HTTP server is running", () => {
  let mockGitLab: MockGitLabServer | null = null;
  let server: ServerInstance | null = null;
  let mcpUrl = "";

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [VALID_TOKEN],
    });
    await mockGitLab.start();

    const port = await findAvailablePort(3720);
    server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port,
      timeout: 10_000,
      env: {
        STREAMABLE_HTTP: "true",
        REMOTE_AUTHORIZATION: "true",
        GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY: "true",
        GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        GITLAB_TOOLSETS: "merge_requests",
      },
    });
    mcpUrl = `http://${HOST}:${port}/mcp`;
  });

  after(async () => {
    if (server) {
      await cleanupServers([server]);
      server = null;
    }
    if (mockGitLab) {
      await mockGitLab.stop();
      mockGitLab = null;
    }
  });

  describe("with initialize handshake", () => {
    it("should advertise tools.listChanged capability in server capabilities", async () => {
      // Given: initialize request body
      const initBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      };

      // When: client sends initialize request to /mcp
      const response = await postJsonRpc(mcpUrl, initBody);

      // Then: response should be 200 and include tools.listChanged: true
      assert.strictEqual(response.status, 200, response.text);
      assert.ok(response.sessionId, "initialize should return Mcp-Session-Id");

      const result = response.data?.result;
      assert.ok(typeof result === "object" && result !== null, "Result should be an object");
      assert.ok(result.capabilities?.tools, "capabilities.tools should be defined");
      assert.strictEqual(result.capabilities.tools.listChanged, true, "tools.listChanged capability must be true");
    });
  });

  describe("with GET requests on /mcp", () => {
    it("should return 406 when Accept header lacks text/event-stream", async () => {
      // Given: GET request without Accept: text/event-stream
      const response = await fetch(mcpUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      // When: server evaluates the request
      const body = await response.json();

      // Then: server should respond with 406 Not Acceptable
      assert.strictEqual(response.status, 406);
      assert.strictEqual(body?.error, "Not Acceptable");
      const allowHeader = response.headers.get("allow");
      assert.ok(allowHeader?.includes("GET"), "Allow header should contain GET");
      assert.ok(allowHeader?.includes("POST"), "Allow header should contain POST");
      assert.ok(allowHeader?.includes("DELETE"), "Allow header should contain DELETE");
    });

    it("should return 400 when Mcp-Session-Id header is missing", async () => {
      // Given: GET request with Accept: text/event-stream but without Mcp-Session-Id
      const response = await fetch(mcpUrl, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
        },
      });

      // When: server evaluates the request
      const body = await response.json();

      // Then: server should respond with 400 Bad Request
      assert.strictEqual(response.status, 400);
      assert.strictEqual(body?.error, "Bad Request");
    });

    it("should return 404 when Mcp-Session-Id does not match any active session", async () => {
      // Given: GET request with unknown session ID
      const response = await fetch(mcpUrl, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          "Mcp-Session-Id": "non-existent-session-id-12345",
        },
      });

      // When: server evaluates the request
      const body = await response.json();

      // Then: server should respond with 404 Session not found
      assert.strictEqual(response.status, 404);
      assert.strictEqual(body?.error, "Session not found");
    });

    it("should establish SSE stream when valid Mcp-Session-Id and Accept header are provided", async () => {
      // Given: an initialized session
      const initBody = {
        jsonrpc: "2.0",
        id: 10,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "sse-stream-client", version: "1.0.0" },
        },
      };
      const initResponse = await postJsonRpc(mcpUrl, initBody);
      const sessionId = initResponse.sessionId;
      assert.ok(sessionId, "Session ID should be present");

      // When: client connects with GET /mcp and Accept: text/event-stream
      const abortController = new AbortController();
      const sseResponse = await fetch(mcpUrl, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          "Mcp-Session-Id": sessionId,
        },
        signal: abortController.signal,
      });

      // Then: response should be 200 with Content-Type text/event-stream
      assert.strictEqual(sseResponse.status, 200);
      const contentType = sseResponse.headers.get("content-type") ?? "";
      assert.ok(contentType.includes("text/event-stream"), "Content-Type must be text/event-stream");

      abortController.abort();
    });

    it("should receive list_changed notification over SSE stream when discover_tools runs", async () => {
      // Given: an authenticated session connected to GET /mcp SSE stream
      const initBody = {
        jsonrpc: "2.0",
        id: 20,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "sse-notify-client", version: "1.0.0" },
        },
      };
      const initResponse = await postJsonRpc(mcpUrl, initBody, {
        "Private-Token": VALID_TOKEN,
      });
      const sessionId = initResponse.sessionId;
      assert.ok(sessionId, "Session ID should be present");

      // Initialized notification
      await postJsonRpc(
        mcpUrl,
        {
          jsonrpc: "2.0",
          method: "notifications/initialized",
        },
        {
          "mcp-session-id": sessionId,
          "Private-Token": VALID_TOKEN,
        }
      );

      const abortController = new AbortController();
      const sseResponse = await fetch(mcpUrl, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          "Mcp-Session-Id": sessionId,
          "Private-Token": VALID_TOKEN,
        },
        signal: abortController.signal,
      });
      assert.strictEqual(sseResponse.status, 200);

      const streamReader = sseResponse.body?.getReader();
      assert.ok(streamReader, "SSE response body reader should exist");

      const decoder = new TextDecoder();
      let receivedEvents = "";

      // Background listener to collect SSE chunks
      const readPromise = (async () => {
        try {
          while (true) {
            const { done, value } = await streamReader.read();
            if (done) break;
            receivedEvents += decoder.decode(value, { stream: true });
            if (receivedEvents.includes("notifications/tools/list_changed")) {
              break;
            }
          }
        } catch {
          // Stream closed or aborted
        }
      })();

      // When: client calls discover_tools to activate pipelines category
      const discoverResponse = await postJsonRpc(
        mcpUrl,
        {
          jsonrpc: "2.0",
          id: 21,
          method: "tools/call",
          params: {
            name: "discover_tools",
            arguments: {
              category: "pipelines",
            },
          },
        },
        {
          "mcp-session-id": sessionId,
          "Private-Token": VALID_TOKEN,
        }
      );

      // Then: discover_tools succeeds and list_changed notification arrives on SSE stream
      assert.strictEqual(discoverResponse.status, 200, discoverResponse.text);
      await Promise.race([
        readPromise,
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);

      abortController.abort();
      assert.ok(
        receivedEvents.includes("notifications/tools/list_changed"),
        `SSE stream should receive notifications/tools/list_changed. Received: ${receivedEvents}`
      );
    });
  });

  describe("with unsupported HTTP methods", () => {
    it("should return 405 Method Not Allowed for PUT requests", async () => {
      // Given: PUT request to /mcp
      const response = await fetch(mcpUrl, { method: "PUT" });

      // When: server evaluates the method
      const body = await response.json();

      // Then: server should respond with 405 Method Not Allowed
      assert.strictEqual(response.status, 405);
      assert.strictEqual(body?.error, "Method Not Allowed");
      const allowHeader = response.headers.get("allow");
      assert.ok(allowHeader?.includes("GET"), "Allow header must contain GET");
      assert.ok(allowHeader?.includes("POST"), "Allow header must contain POST");
      assert.ok(allowHeader?.includes("DELETE"), "Allow header must contain DELETE");
    });
  });
});
