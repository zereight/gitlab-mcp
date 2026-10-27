/**
 * GitLab rejections of the refresh_token and authorization_code grants (#928).
 *
 * GitLab rotates refresh tokens, so parallel sessions that refresh with the same
 * token get 400 invalid_grant for all but the first. The proxy must pass that on
 * as invalid_grant (HTTP 400) so MCP clients restart authorization instead of
 * retrying the dead token against a 500 server_error. Other failures (5xx, 401,
 * other 4xx, unparsable bodies) stay server_error.
 *
 * GitLab is stubbed by patching fetch; requests to the local /token endpoint pass through.
 */

import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, test } from "node:test";
import express from "express";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

import { createGitLabOAuthProvider } from "../oauth-proxy.js";

const GITLAB_BASE = "https://gitlab.example.com";
const REDIRECT_URI = "https://client.example.com/cb";
const REFRESH_TOKEN = "client-held-refresh-token-928";
const AUTH_CODE = "gitlab-auth-code-928";
const GITLAB_INVALID_GRANT = {
  error: "invalid_grant",
  error_description:
    "The provided authorization grant is invalid, expired, revoked, does not match the redirection URI used in the authorization request, or was issued to another client.",
};

function makeProvider() {
  return createGitLabOAuthProvider(GITLAB_BASE, "gitlab-app-id", "Test Server", false);
}

type GitLabReply = { status: number; body: string };
let gitlabReply: GitLabReply;
let originalFetch: typeof globalThis.fetch;

function jsonReply(status: number, body: unknown): GitLabReply {
  return { status, body: JSON.stringify(body) };
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const target =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (new URL(target).origin !== GITLAB_BASE) {
      return originalFetch(input, init);
    }
    return new Response(gitlabReply.body, { status: gitlabReply.status });
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function hasErrorCode(code: string) {
  return (err: unknown) => {
    assert.equal(
      (err as { errorCode?: string }).errorCode,
      code,
      `unexpected error: ${String(err)}`
    );
    assert.ok(!String((err as Error).message).includes(REFRESH_TOKEN));
    assert.ok(!String((err as Error).message).includes(AUTH_CODE));
    return true;
  };
}

describe("GitLab token rejection — provider", () => {
  const client = {} as OAuthClientInformationFull;

  test("refresh: 400 invalid_grant → invalid_grant", async () => {
    gitlabReply = jsonReply(400, GITLAB_INVALID_GRANT);
    await assert.rejects(
      () => makeProvider().exchangeRefreshToken(client, REFRESH_TOKEN),
      hasErrorCode("invalid_grant")
    );
  });

  test("refresh: 400 invalid_request → server_error", async () => {
    gitlabReply = jsonReply(400, { error: "invalid_request", error_description: "Missing" });
    await assert.rejects(
      () => makeProvider().exchangeRefreshToken(client, REFRESH_TOKEN),
      hasErrorCode("server_error")
    );
  });

  test("refresh: 500 → server_error", async () => {
    gitlabReply = jsonReply(500, { error: "invalid_grant" });
    await assert.rejects(
      () => makeProvider().exchangeRefreshToken(client, REFRESH_TOKEN),
      hasErrorCode("server_error")
    );
  });

  test("refresh: 400 with a non-JSON body → server_error", async () => {
    gitlabReply = { status: 400, body: "<html>Bad Request</html>" };
    await assert.rejects(
      () => makeProvider().exchangeRefreshToken(client, REFRESH_TOKEN),
      hasErrorCode("server_error")
    );
  });

  test("refresh: 400 with an empty body → server_error", async () => {
    gitlabReply = { status: 400, body: "" };
    await assert.rejects(
      () => makeProvider().exchangeRefreshToken(client, REFRESH_TOKEN),
      hasErrorCode("server_error")
    );
  });

  test("refresh: 400 with another error code → server_error", async () => {
    gitlabReply = jsonReply(400, { error: "invalid_scope" });
    await assert.rejects(
      () => makeProvider().exchangeRefreshToken(client, REFRESH_TOKEN),
      hasErrorCode("server_error")
    );
  });

  test("refresh: 401 invalid_client → server_error", async () => {
    gitlabReply = jsonReply(401, { error: "invalid_client" });
    await assert.rejects(
      () => makeProvider().exchangeRefreshToken(client, REFRESH_TOKEN),
      hasErrorCode("server_error")
    );
  });

  test("authorization_code: 400 invalid_grant → invalid_grant", async () => {
    gitlabReply = jsonReply(400, GITLAB_INVALID_GRANT);
    await assert.rejects(
      () => makeProvider().exchangeAuthorizationCode(client, AUTH_CODE, "verifier", REDIRECT_URI),
      hasErrorCode("invalid_grant")
    );
  });

  test("authorization_code: 500 → server_error", async () => {
    gitlabReply = jsonReply(500, { error: "server_error" });
    await assert.rejects(
      () => makeProvider().exchangeAuthorizationCode(client, AUTH_CODE, "verifier", REDIRECT_URI),
      hasErrorCode("server_error")
    );
  });

  test("authorization_code: 401 invalid_client → server_error", async () => {
    gitlabReply = jsonReply(401, { error: "invalid_client" });
    await assert.rejects(
      () => makeProvider().exchangeAuthorizationCode(client, AUTH_CODE, "verifier", REDIRECT_URI),
      hasErrorCode("server_error")
    );
  });
});

describe("GitLab token rejection — SDK /token endpoint", () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()));
    server = undefined;
  });

  async function postToken(form: Record<string, string>) {
    const app = express();
    app.use("/token", tokenHandler({ provider: makeProvider(), rateLimit: false }));
    server = await new Promise<Server>(resolve => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: "mcp-client", ...form }).toString(),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  const refreshForm = { grant_type: "refresh_token", refresh_token: REFRESH_TOKEN };
  const codeForm = {
    grant_type: "authorization_code",
    code: AUTH_CODE,
    code_verifier: "verifier",
    redirect_uri: REDIRECT_URI,
  };

  test("refresh: GitLab 400 invalid_grant → 400 invalid_grant", async () => {
    gitlabReply = jsonReply(400, GITLAB_INVALID_GRANT);
    const { status, body } = await postToken(refreshForm);
    assert.equal(status, 400);
    assert.equal(body.error, "invalid_grant");
    assert.ok(!JSON.stringify(body).includes(REFRESH_TOKEN));
  });

  test("refresh: GitLab 400 invalid_request → 500 server_error", async () => {
    gitlabReply = jsonReply(400, { error: "invalid_request" });
    const { status, body } = await postToken(refreshForm);
    assert.equal(status, 500);
    assert.equal(body.error, "server_error");
  });

  test("refresh: GitLab 500 → 500 server_error", async () => {
    gitlabReply = jsonReply(500, { error: "server_error" });
    const { status, body } = await postToken(refreshForm);
    assert.equal(status, 500);
    assert.equal(body.error, "server_error");
  });

  test("refresh: GitLab 400 non-JSON → 500 server_error", async () => {
    gitlabReply = { status: 400, body: "Bad Request" };
    const { status, body } = await postToken(refreshForm);
    assert.equal(status, 500);
    assert.equal(body.error, "server_error");
  });

  test("refresh: GitLab 401 → 500 server_error", async () => {
    gitlabReply = jsonReply(401, { error: "invalid_client" });
    const { status, body } = await postToken(refreshForm);
    assert.equal(status, 500);
    assert.equal(body.error, "server_error");
  });

  test("authorization_code: GitLab 400 invalid_grant → 400 invalid_grant", async () => {
    gitlabReply = jsonReply(400, GITLAB_INVALID_GRANT);
    const { status, body } = await postToken(codeForm);
    assert.equal(status, 400);
    assert.equal(body.error, "invalid_grant");
    assert.ok(!JSON.stringify(body).includes(AUTH_CODE));
  });

  test("authorization_code: GitLab 500 → 500 server_error", async () => {
    gitlabReply = jsonReply(500, { error: "server_error" });
    const { status, body } = await postToken(codeForm);
    assert.equal(status, 500);
    assert.equal(body.error, "server_error");
  });
});
