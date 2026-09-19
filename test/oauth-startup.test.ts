/**
 * OAuth startup tests.
 *
 * - isAuthInvalidTokenResponse: pure classifier — refresh failures that mean
 *   "re-login would fix it" vs transient/config errors that must not open a browser.
 * - ensureOAuthToken: lazy first-use delivery — the caller must receive the
 *   token even when the on-disk token is still valid (regression: returning
 *   early on hasValidToken() alone leaves requests unauthenticated).
 *
 * Temp token files + a loopback mock for /oauth/token only; no MCP server.
 * The missing-token and invalid_grant paths start the interactive browser
 * flow and are deliberately not covered here.
 */

import { describe, test, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as http from "node:http";
import { GitLabOAuth, ensureOAuthToken, isAuthInvalidTokenResponse } from "../oauth.js";

const validTokenFile = {
  access_token: "cached-access-token",
  refresh_token: "cached-refresh-token",
  expires_in: 7200,
  created_at: Date.now(),
  token_type: "Bearer",
};

const expiredTokenFile = {
  ...validTokenFile,
  created_at: Date.now() - 10 * 3600 * 1000,
};

const tmpDirs: string[] = [];
const servers: http.Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTokenFile(data: object): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oauth-startup-"));
  tmpDirs.push(dir);
  const file = path.join(dir, "token.json");
  fs.writeFileSync(file, JSON.stringify(data));
  return file;
}

function makeClient(tokenStoragePath: string, gitlabUrl: string, extra?: { tokenScript?: string }): GitLabOAuth {
  return new GitLabOAuth({
    clientId: "test-client",
    redirectUri: "http://127.0.0.1:8888/callback",
    gitlabUrl,
    scopes: ["api"],
    tokenStoragePath,
    ...extra,
  });
}

async function startTokenServer(handler: () => { status: number; json: unknown }): Promise<{
  url: string;
  bodies: string[];
}> {
  const bodies: string[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      bodies.push(body);
      const { status, json } = handler();
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(json));
    });
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  assert(addr && typeof addr !== "string");
  return { url: `http://127.0.0.1:${addr.port}`, bodies };
}

describe("isAuthInvalidTokenResponse", () => {
  test("400 invalid_grant is auth-invalid", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(400, '{"error":"invalid_grant"}'), true);
  });

  test("400 invalid_token is auth-invalid", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(400, '{"error":"invalid_token"}'), true);
  });

  test("401 invalid_grant is auth-invalid", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(401, '{"error":"invalid_grant"}'), true);
  });

  test("400 invalid_client is not auth-invalid (config error)", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(400, '{"error":"invalid_client"}'), false);
  });

  test("400 invalid_request is not auth-invalid (config error)", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(400, '{"error":"invalid_request"}'), false);
  });

  test("500 server_error is not auth-invalid (transient)", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(500, '{"error":"server_error"}'), false);
  });

  test("429 is not auth-invalid (rate limited)", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(429, '{"error":"invalid_grant"}'), false);
  });

  test("non-JSON body is not auth-invalid", () => {
    assert.strictEqual(isAuthInvalidTokenResponse(400, "gateway timeout"), false);
  });
});

describe("ensureOAuthToken", () => {
  test("null client is a no-op", async () => {
    const delivered: string[] = [];
    await ensureOAuthToken(null, null, t => {
      delivered.push(t);
    });
    await ensureOAuthToken(undefined, undefined, t => {
      delivered.push(t);
    });
    assert.deepStrictEqual(delivered, []);
  });

  test("first call with valid cached token delivers it without network", async () => {
    // Closed port: any fetch attempt fails, proving the cached path is network-free.
    const client = makeClient(makeTokenFile(validTokenFile), "http://127.0.0.1:9");
    const delivered: string[] = [];
    await ensureOAuthToken(client, null, t => {
      delivered.push(t);
    });
    assert.deepStrictEqual(delivered, ["cached-access-token"]);
  });

  test("already-held valid token is not re-delivered", async () => {
    const client = makeClient(makeTokenFile(validTokenFile), "http://127.0.0.1:9");
    const delivered: string[] = [];
    await ensureOAuthToken(client, "cached-access-token", t => {
      delivered.push(t);
    });
    assert.deepStrictEqual(delivered, []);
  });

  test("expired token refreshes via /oauth/token and persists", async () => {
    const { url, bodies } = await startTokenServer(() => ({
      status: 200,
      json: {
        access_token: "fresh-token",
        refresh_token: "fresh-refresh",
        expires_in: 7200,
        token_type: "Bearer",
      },
    }));
    const file = makeTokenFile(expiredTokenFile);
    const client = makeClient(file, url);
    const delivered: string[] = [];
    await ensureOAuthToken(client, null, t => {
      delivered.push(t);
    });
    assert.deepStrictEqual(delivered, ["fresh-token"]);
    assert.strictEqual(bodies.length, 1);
    assert.match(bodies[0], /grant_type=refresh_token/);
    assert.match(bodies[0], /refresh_token=cached-refresh-token/);
    const saved = JSON.parse(fs.readFileSync(file, "utf8")) as { access_token: string };
    assert.strictEqual(saved.access_token, "fresh-token");
  });

  test("transient refresh failure propagates without opening a browser", async () => {
    const { url } = await startTokenServer(() => ({ status: 500, json: { error: "server_error" } }));
    const client = makeClient(makeTokenFile(expiredTokenFile), url);
    const delivered: string[] = [];
    // Rejection (not a browser popup) proves the no-browser path.
    await assert.rejects(
      () =>
        ensureOAuthToken(client, null, t => {
          delivered.push(t);
        }),
      /Token refresh failed: 500/
    );
    assert.deepStrictEqual(delivered, []);
  });

  test("token script resolves once, then fast path holds", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oauth-startup-"));
    tmpDirs.push(dir);
    const client = makeClient(path.join(dir, "token.json"), "http://127.0.0.1:9", {
      tokenScript: "echo script-token-1",
    });
    const delivered: string[] = [];
    await ensureOAuthToken(client, null, t => {
      delivered.push(t);
    });
    assert.deepStrictEqual(delivered, ["script-token-1"]);
    await ensureOAuthToken(client, delivered[0], t => {
      delivered.push(t);
    });
    assert.deepStrictEqual(delivered, ["script-token-1"]);
  });
});
