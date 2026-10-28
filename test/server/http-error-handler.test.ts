import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { describe, it } from "node:test";
import express from "express";
import { createHttpErrorHandler, type HttpErrorLogger } from "../../server/http-error-handler.js";

const LEAK_PROBE = "approval_password_leak_probe_948";
const TWENTY_KIB = 20 * 1024;

interface LogRecord {
  readonly level: "warn" | "error";
  readonly fields: Record<string, unknown>;
  readonly message: string;
}

function createLogRecorder(): { logger: HttpErrorLogger; records: LogRecord[] } {
  const records: LogRecord[] = [];
  return {
    logger: {
      warn(fields: Record<string, unknown>, message: string): void {
        records.push({ level: "warn", fields, message });
      },
      error(fields: Record<string, unknown>, message: string): void {
        records.push({ level: "error", fields, message });
      },
    },
    records,
  };
}

function brokenJsonWithSecret(): string {
  return `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"arguments":{"approval_password":"${LEAK_PROBE}"}`;
}

function createTestApp(logger: HttpErrorLogger, jsonLimit = "1mb"): express.Express {
  const app = express();
  const parser = express.json({ limit: jsonLimit });
  app.post("/mcp", parser, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.post("/messages", parser, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.post("/boom", (_req, _res) => {
    throw new Error(`secret-in-message ${LEAK_PROBE}`);
  });
  app.use(createHttpErrorHandler(logger));
  return app;
}

function listeningUrl(server: http.Server): string {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected a TCP listen address");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function withTestServer(
  logger: HttpErrorLogger,
  run: (baseUrl: string) => Promise<void>,
  jsonLimit?: string
): Promise<void> {
  const server = createTestApp(logger, jsonLimit).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(listeningUrl(server));
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function postJson(url: string, body: string): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body,
  });
}

function assertNoSecretLeak(value: unknown): void {
  assert.equal(JSON.stringify(value).includes(LEAK_PROBE), false);
}

describe("When an HTTP JSON body cannot be parsed", () => {
  describe("with POST /mcp carrying credentials in the raw body", () => {
    it("should return a JSON-RPC parse error", async () => {
      const { logger } = createLogRecorder();
      await withTestServer(logger, async baseUrl => {
        const response = await postJson(`${baseUrl}/mcp`, brokenJsonWithSecret());
        const payload: unknown = await response.json();

        assert.equal(response.status, 400);
        assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
        assert.deepEqual(payload, {
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null,
        });
      });
    });

    it("should log type and status without the request body", async () => {
      const { logger, records } = createLogRecorder();
      await withTestServer(logger, async baseUrl => {
        await postJson(`${baseUrl}/mcp`, brokenJsonWithSecret());
      });

      assert.equal(records.length, 1);
      const record = records[0];
      if (record === undefined) {
        throw new Error("expected a log record");
      }
      assert.equal(record.level, "warn");
      assert.equal(record.message, "HTTP request error");
      assert.equal(record.fields.type, "entity.parse.failed");
      assert.equal(record.fields.status, 400);
      assert.equal(record.fields.method, "POST");
      assert.equal(record.fields.path, "/mcp");
      assert.equal("body" in record.fields, false);
      assert.equal("err" in record.fields, false);
      assertNoSecretLeak(record);
    });
  });

  describe("with POST /messages carrying credentials in the raw body", () => {
    it("should return a JSON-RPC parse error", async () => {
      const { logger } = createLogRecorder();
      await withTestServer(logger, async baseUrl => {
        const response = await postJson(`${baseUrl}/messages`, brokenJsonWithSecret());
        const payload: unknown = await response.json();

        assert.equal(response.status, 400);
        assert.deepEqual(payload, {
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null,
        });
      });
    });
  });

  describe("with a valid JSON body", () => {
    it("should leave the route response unchanged", async () => {
      const { logger, records } = createLogRecorder();
      await withTestServer(logger, async baseUrl => {
        const response = await postJson(`${baseUrl}/mcp`, JSON.stringify({ ok: true }));

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
        assert.equal(records.length, 0);
      });
    });
  });
});

describe("When a request body exceeds the parser limit", () => {
  describe("with the error handler registered", () => {
    it("should still respond with 413", async () => {
      const { logger } = createLogRecorder();
      await withTestServer(
        logger,
        async baseUrl => {
          const response = await postJson(
            `${baseUrl}/mcp`,
            JSON.stringify({ pad: "a".repeat(TWENTY_KIB) })
          );

          assert.equal(response.status, 413);
          assert.deepEqual(await response.json(), { error: "Payload Too Large" });
        },
        "1kb"
      );
    });
  });
});

describe("When a route throws", () => {
  describe("with a secret in the error message", () => {
    it("should respond with a generic 500 and omit the secret from logs", async () => {
      const { logger, records } = createLogRecorder();
      await withTestServer(logger, async baseUrl => {
        const response = await postJson(`${baseUrl}/boom`, "{}");
        const payload: unknown = await response.json();

        assert.equal(response.status, 500);
        assert.deepEqual(payload, { error: "Internal server error" });
        assert.equal(records.length, 1);
        const record = records[0];
        if (record === undefined) {
          throw new Error("expected a log record");
        }
        assert.equal(record.level, "error");
        assert.equal(record.fields.type, "Error");
        assert.equal(record.fields.status, 500);
        assertNoSecretLeak(record);
        assertNoSecretLeak(payload);
      });
    });
  });
});
