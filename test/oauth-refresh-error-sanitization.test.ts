import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { afterEach, test } from "node:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { createGitLabOAuthProvider } from "../oauth-proxy.js";

const base = "https://gitlab.example.com";
const secret = "test-refresh-secret-must-not-escape";
const lowercaseSecret = "synthetic_secret_value";
const originalFetch = globalThis.fetch;
let server: Server | undefined;
let calls = 0;
let upstreamResponse: Response | undefined;

afterEach(async () => {
  globalThis.fetch = originalFetch;
  const activeServer = server;
  if (activeServer) await new Promise<void>(resolve => activeServer.close(() => resolve()));
  server = undefined;
  calls = 0;
  upstreamResponse = undefined;
});

/** Exercise the SDK token endpoint with a stubbed GitLab response and verify diagnostics stay private. */
async function refresh(
  status: number,
  body: string,
  transportError = false,
  bodyReadError = false
) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === `${base}/oauth/token`) {
      calls++;
      const form = new URLSearchParams(String(init?.body));
      assert.equal(form.get("grant_type"), "refresh_token");
      assert.equal(form.get("refresh_token"), secret);
      if (transportError) throw new Error(`connection failed ${secret}`);
      upstreamResponse = new Response(body, {
        status,
        headers: { "Content-Type": "application/json" },
      });
      if (bodyReadError)
        upstreamResponse.text = async () => {
          throw new Error(secret);
        };
      return upstreamResponse;
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  const provider = createGitLabOAuthProvider(base, "test-app");
  const app = express();
  app.use("/token", tokenHandler({ provider, rateLimit: false }));
  server = await new Promise<Server>(resolve => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const response = await originalFetch(
    `http://127.0.0.1:${(server.address() as AddressInfo).port}/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: "mcp-client",
        grant_type: "refresh_token",
        refresh_token: secret,
      }),
    }
  );
  const result = (await response.json()) as Record<string, unknown>;
  assert.equal(calls, 1, "never retry a refresh grant that may rotate credentials");
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.ok(!JSON.stringify(result).includes(lowercaseSecret));
  if (upstreamResponse && status >= 400 && !bodyReadError)
    assert.equal(upstreamResponse.bodyUsed, true);
  return { status: response.status, body: result };
}

test("400 invalid_grant stays invalid_grant and drains the body without leaking secrets", async () => {
  const result = await refresh(
    400,
    JSON.stringify({ error: "invalid_grant", error_description: secret })
  );
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "invalid_grant");
});

for (const [status, body] of [
  [401, JSON.stringify({ error: "invalid_grant", error_description: secret })],
  [503, JSON.stringify({ error: "invalid_grant", error_description: secret })],
  [400, JSON.stringify({ error: "invalid_client", error_description: secret })],
  [400, JSON.stringify({ error: secret })],
  [400, JSON.stringify({ error: lowercaseSecret })],
  [400, secret],
] as const) {
  test(`non-grant rejection ${status} remains a sanitized server error: ${body.length}`, async () => {
    const result = await refresh(status, body);
    assert.equal(result.status, 500);
    assert.equal(result.body.error, "server_error");
  });
}

test("response read failures remain sanitized service errors", async () => {
  const result = await refresh(400, secret, false, true);
  assert.equal(result.status, 500);
  assert.equal(result.body.error, "server_error");
});

test("transport failures remain sanitized service errors", async () => {
  const result = await refresh(500, "", true);
  assert.equal(result.status, 500);
  assert.equal(result.body.error, "server_error");
});

test("successful refresh returns the replacement credentials", async () => {
  const tokens = {
    access_token: "test-new-access",
    refresh_token: "test-new-refresh",
    token_type: "Bearer",
    expires_in: 7200,
  };
  const result = await refresh(200, JSON.stringify(tokens));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, tokens);
});

test("upstream bodies and transport details never enter logs", () => {
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx/esm",
      "--input-type=module",
      "-e",
      `
    import { createGitLabOAuthProvider } from "./oauth-proxy.ts";
    const provider = createGitLabOAuthProvider("https://gitlab.example.com", "test-app");
    for (const transport of [false, true, "unsafe_code", "lowercase_code", "read_failure"]) {
      globalThis.fetch = async () => {
        if (transport === true) throw new Error("${secret}");
        if (transport === "lowercase_code") return new Response(JSON.stringify({error:"${lowercaseSecret}"}), {status:400});
        if (transport === "unsafe_code") return new Response(JSON.stringify({error:"${secret}"}), {status:400});
        if (transport === "read_failure") return {ok:false,status:400,text:async()=>{throw new Error("${secret}")}};
        return new Response(JSON.stringify({error:"invalid_grant", error_description:"${secret}", refresh_token:"${secret}"}), {status:400});
      };
      try { await provider.exchangeRefreshToken({client_id:"test"}, "${secret}"); } catch {}
    }
  `,
    ],
    { encoding: "utf8", env: { ...process.env, LOG_FORMAT: "json" } }
  );
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stderr, /GitLab token refresh rejected/);
  assert.ok(!child.stderr.includes(secret));
  assert.ok(!child.stdout.includes(secret));
  assert.ok(!child.stderr.includes(lowercaseSecret));
  assert.ok(!child.stdout.includes(lowercaseSecret));
  const rejected = child.stderr
    .trim()
    .split("\n")
    .map(line => JSON.parse(line) as Record<string, unknown>)
    .filter(entry => entry.msg === "GitLab token refresh rejected");
  assert.equal(rejected.length, 3);
  for (const entry of rejected) {
    assert.equal(entry.status, 400);
    assert.ok(!("error" in entry), "upstream error values must never enter diagnostics");
  }
});
