/**
 * Rejected proxy authorization codes in callback-proxy mode (#940).
 *
 * A code that is unknown, expired, already used, issued to another client,
 * redeemed with another redirect_uri or a wrong PKCE verifier, or that belongs
 * to a user outside the allowed groups is invalid_grant (HTTP 400, RFC 6749
 * §5.2 / RFC 7636 §4.6); an empty code_verifier is invalid_request. MCP clients
 * then restart authorization instead of treating the failure as a server fault.
 * An exchange already in progress and a full replay cache stay server_error
 * (HTTP 500).
 *
 * Binding and PKCE rejections still leave the code redeemable by the client it
 * was issued to; a used or expired code stays rejected.
 *
 * GitLab is stubbed by patching fetch; requests to the local /token endpoint pass through.
 */

import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, test } from "node:test";
import express from "express";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

import { createGitLabOAuthProvider } from "../oauth-proxy.js";
import { loadKeyMaterialFromEnv } from "../stateless/index.js";

const GITLAB_BASE = "https://gitlab.example.com";
const CALLBACK_URL = "https://mcp.example.com/callback";
const CLIENT_REDIRECT = "https://client.example.com/cb";
const OTHER_REDIRECT = "https://other.example.com/cb";
const STORED_TTL_SECONDS = 600;
const PENDING_AUTH_TTL_MS = 10 * 60 * 1000;
const GITLAB_TOKENS = {
  access_token: "gl-access-940",
  token_type: "Bearer",
  expires_in: 7200,
  refresh_token: "gl-refresh-940",
};

const MODES = ["callback-proxy", "callback-proxy-stateless"] as const;
type Mode = (typeof MODES)[number];

function makeProvider(mode: Mode, allowedGroups?: string[]) {
  const material =
    mode === "callback-proxy-stateless"
      ? loadKeyMaterialFromEnv(true, {
          OAUTH_STATELESS_SECRET: randomBytes(32).toString("base64url"),
        })
      : null;
  return createGitLabOAuthProvider(
    GITLAB_BASE,
    "gitlab-app-id",
    "Test Server",
    false,
    undefined,
    allowedGroups,
    true,
    CALLBACK_URL,
    material
      ? {
          material,
          clientTtlSeconds: 86400,
          pendingTtlSeconds: 600,
          storedTtlSeconds: STORED_TTL_SECONDS,
        }
      : null,
    [CLIENT_REDIRECT]
  );
}

type Provider = ReturnType<typeof makeProvider>;

type ProviderInternals = {
  _usedProxyCodes: { tryReserve(key: string, ttlSeconds: number): unknown; maxSize: number };
  _storedTokens: { get(code: string): { createdAt: number } | undefined };
};

function internals(provider: Provider) {
  return provider as unknown as ProviderInternals;
}

// Groups GitLab reports for the token owner; only read when allowed groups are set.
let gitlabGroups: Array<{ full_path: string }>;
let originalFetch: typeof globalThis.fetch;
let server: Server | undefined;

beforeEach(() => {
  gitlabGroups = [{ full_path: "my-org" }];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const target =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(target);
    if (url.origin !== GITLAB_BASE) {
      return originalFetch(input, init);
    }
    const body = url.pathname === "/api/v4/groups" ? gitlabGroups : GITLAB_TOKENS;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

// Consent is covered in test/oauth-consent.test.ts; this approves it.
function makeAuthorizeRes() {
  const csrf = randomBytes(32).toString("base64url");
  const r = {
    req: {
      method: "POST",
      headers: { cookie: `__Host-gitlab_mcp_oauth_csrf=${csrf}` },
      body: { consent_action: "approve", consent_csrf: csrf },
    },
    redirectedTo: null as string | null,
    redirect(target: string) {
      r.redirectedTo = target;
    },
    setHeader() {},
  };
  return r;
}

function makeCallbackRes() {
  const r = {
    statusCode: 200,
    redirectedTo: null as string | null,
    status(code: number) {
      r.statusCode = code;
      return r;
    },
    send() {
      return r;
    },
    redirect(target: string) {
      r.statusCode = 302;
      r.redirectedTo = target;
      return r;
    },
  };
  return r;
}

function registerClient(provider: Provider) {
  return provider.clientsStore.registerClient!({
    redirect_uris: [CLIENT_REDIRECT],
    token_endpoint_auth_method: "none",
  });
}

/** Runs /authorize and /callback; returns the proxy code sent to the client. */
async function runCallback(provider: Provider) {
  const client = await registerClient(provider);
  const verifier = randomBytes(32).toString("base64url");
  const authorizeRes = makeAuthorizeRes();
  await provider.authorize(
    client,
    {
      state: "client-state",
      scopes: ["api"],
      redirectUri: CLIENT_REDIRECT,
      codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
    },
    authorizeRes as unknown as ExpressResponse
  );
  const state = new URL(authorizeRes.redirectedTo!).searchParams.get("state")!;
  const callbackRes = makeCallbackRes();
  await provider.handleCallback(
    { query: { code: "gitlab-code", state } } as unknown as ExpressRequest,
    callbackRes as unknown as ExpressResponse
  );
  assert.equal(callbackRes.statusCode, 302, "callback should redirect to the client");
  const code = new URL(callbackRes.redirectedTo!).searchParams.get("code")!;
  return { client, verifier, code };
}

type TokenResponse = { status: number; body: Record<string, unknown> };

/** Mounts the SDK /token handler on the provider; returns a POST /token helper. */
async function tokenEndpoint(provider: Provider) {
  const app = express();
  app.use("/token", tokenHandler({ provider, rateLimit: false }));
  server = await new Promise<Server>(resolve => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return async (form: Record<string, string>): Promise<TokenResponse> => {
    const res = await fetch(`http://127.0.0.1:${port}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
}

function codeGrant(
  client: OAuthClientInformationFull,
  code: string,
  verifier: string,
  redirectUri = CLIENT_REDIRECT
) {
  return {
    grant_type: "authorization_code",
    client_id: client.client_id,
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  };
}

function assertOAuthError(res: TokenResponse, status: number, error: string, description: RegExp) {
  assert.equal(res.status, status, `unexpected response: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.error, error);
  assert.match(String(res.body.error_description), description);
  assert.equal("access_token" in res.body, false);
}

function assertTokens(res: TokenResponse) {
  assert.equal(res.status, 200, `unexpected response: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.access_token, GITLAB_TOKENS.access_token);
}

for (const mode of MODES) {
  describe(`callback-proxy /token rejections (${mode})`, () => {
    test("unknown code → 400 invalid_grant", async () => {
      const provider = makeProvider(mode);
      const post = await tokenEndpoint(provider);
      const client = await registerClient(provider);

      const res = await post(codeGrant(client, "not-a-proxy-code", "any-verifier"));
      assertOAuthError(res, 400, "invalid_grant", /Invalid or expired authorization code/);
    });

    test("code redeemed twice → 400 invalid_grant on every replay", async () => {
      const provider = makeProvider(mode);
      const post = await tokenEndpoint(provider);
      const { client, verifier, code } = await runCallback(provider);

      assertTokens(await post(codeGrant(client, code, verifier)));
      const replayed =
        mode === "callback-proxy-stateless"
          ? /Authorization code already used/
          : /Invalid or expired authorization code/;
      for (let i = 0; i < 2; i++) {
        assertOAuthError(
          await post(codeGrant(client, code, verifier)),
          400,
          "invalid_grant",
          replayed
        );
      }
    });

    test("another client's code → 400 invalid_grant; its client can still redeem it", async () => {
      const provider = makeProvider(mode);
      const post = await tokenEndpoint(provider);
      const { client, verifier, code } = await runCallback(provider);
      const otherClient = await registerClient(provider);

      const res = await post(codeGrant(otherClient, code, verifier));
      assertOAuthError(res, 400, "invalid_grant", /Invalid client for authorization code/);
      assertTokens(await post(codeGrant(client, code, verifier)));
    });

    test("different redirect_uri → 400 invalid_grant; the code still works", async () => {
      const provider = makeProvider(mode);
      const post = await tokenEndpoint(provider);
      const { client, verifier, code } = await runCallback(provider);

      const res = await post(codeGrant(client, code, verifier, OTHER_REDIRECT));
      assertOAuthError(res, 400, "invalid_grant", /Invalid redirect_uri for authorization code/);
      assertTokens(await post(codeGrant(client, code, verifier)));
    });

    test("wrong code_verifier → 400 invalid_grant; the code still works", async () => {
      const provider = makeProvider(mode);
      const post = await tokenEndpoint(provider);
      const { client, verifier, code } = await runCallback(provider);

      const res = await post(codeGrant(client, code, randomBytes(32).toString("base64url")));
      assertOAuthError(res, 400, "invalid_grant", /PKCE verification failed/);
      assertTokens(await post(codeGrant(client, code, verifier)));
    });

    // The SDK rejects an omitted code_verifier itself; an empty one reaches the provider.
    test("empty code_verifier → 400 invalid_request; the code still works", async () => {
      const provider = makeProvider(mode);
      const post = await tokenEndpoint(provider);
      const { client, verifier, code } = await runCallback(provider);

      const res = await post(codeGrant(client, code, ""));
      assertOAuthError(res, 400, "invalid_request", /PKCE code_verifier is required/);
      assertTokens(await post(codeGrant(client, code, verifier)));
    });

    test("user outside the allowed groups → 400 invalid_grant", async () => {
      const provider = makeProvider(mode, ["my-org"]);
      const post = await tokenEndpoint(provider);
      const { client, verifier, code } = await runCallback(provider);
      gitlabGroups = [{ full_path: "other-org" }];

      const res = await post(codeGrant(client, code, verifier));
      assertOAuthError(res, 400, "invalid_grant", /not a member of an allowed group/);
    });
  });
}

describe("callback-proxy /token rejections (callback-proxy-stateless only)", () => {
  test("code sealed with another secret → 400 invalid_grant", async () => {
    const provider = makeProvider("callback-proxy-stateless");
    const post = await tokenEndpoint(provider);
    const client = await registerClient(provider);
    const { verifier, code } = await runCallback(makeProvider("callback-proxy-stateless"));

    const res = await post(codeGrant(client, code, verifier));
    assertOAuthError(res, 400, "invalid_grant", /Invalid or expired authorization code/);
  });

  test("exchange already in progress → 500 server_error", async () => {
    const provider = makeProvider("callback-proxy-stateless");
    const post = await tokenEndpoint(provider);
    const { client, verifier, code } = await runCallback(provider);
    const codeHash = createHash("sha256").update(code).digest("hex");
    internals(provider)._usedProxyCodes.tryReserve(codeHash, STORED_TTL_SECONDS);

    const res = await post(codeGrant(client, code, verifier));
    assertOAuthError(res, 500, "server_error", /exchange in progress/);
  });

  test("replay cache full → 500 server_error", async () => {
    const provider = makeProvider("callback-proxy-stateless");
    const post = await tokenEndpoint(provider);
    const { client, verifier, code } = await runCallback(provider);
    const cache = internals(provider)._usedProxyCodes;
    for (let i = 0; i < cache.maxSize; i++) {
      cache.tryReserve(`fill-${i}`, STORED_TTL_SECONDS);
    }

    const res = await post(codeGrant(client, code, verifier));
    assertOAuthError(res, 500, "server_error", /Authorization server busy/);
  });
});

describe("callback-proxy /token rejections (callback-proxy only)", () => {
  test("expired code → 400 invalid_grant and stays rejected", async () => {
    const provider = makeProvider("callback-proxy");
    const post = await tokenEndpoint(provider);
    const { client, verifier, code } = await runCallback(provider);
    internals(provider)._storedTokens.get(code)!.createdAt -= PENDING_AUTH_TTL_MS + 1000;

    const res = await post(codeGrant(client, code, verifier));
    assertOAuthError(res, 400, "invalid_grant", /Authorization code expired/);
    const retry = await post(codeGrant(client, code, verifier));
    assertOAuthError(retry, 400, "invalid_grant", /Invalid or expired authorization code/);
  });
});
