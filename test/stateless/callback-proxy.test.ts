/**
 * Cross-pod integration tests for the callback-proxy flow in stateless mode.
 *
 * Verifies that /authorize, /callback, and /token can all land on different
 * provider instances sharing only OAUTH_STATELESS_SECRET, reproducing the
 * exact HPA scenario that breaks today's _pendingAuth / _storedTokens
 * BoundedLRUMaps.
 *
 * GitLab's /oauth/token endpoint is stubbed via a fetch monkey-patch so the
 * tests run offline.
 */

import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";

import { createGitLabOAuthProvider } from "../../oauth-proxy.js";
import {
  loadKeyMaterialFromEnv,
  looksLikeStatelessState,
  looksLikeStatelessStoredTokensCode,
  mintPendingAuthState,
  mintStoredTokensCode,
  openPendingAuthState,
  openStoredTokensCode,
} from "../../stateless/index.js";
import type { StatelessKeyMaterial } from "../../stateless/index.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GITLAB_BASE = "https://gitlab.example.com";
const CALLBACK_URL = "https://mcp.example.com/callback";
const CLIENT_REDIRECT = "https://client.example.com/cb";

function secret(): string {
  return randomBytes(32).toString("base64url");
}

function loadMaterial(current: string, previous?: string): StatelessKeyMaterial {
  const env: NodeJS.ProcessEnv = {
    OAUTH_STATELESS_MODE: "true",
    OAUTH_STATELESS_SECRET: current,
  };
  if (previous) env.OAUTH_STATELESS_SECRET_PREVIOUS = previous;
  const m = loadKeyMaterialFromEnv(env);
  assert.ok(m);
  return m!;
}

function makeProvider(
  material: StatelessKeyMaterial | null,
  { callbackProxy = true }: { callbackProxy?: boolean } = {}
) {
  return createGitLabOAuthProvider(
    GITLAB_BASE,
    "real-gitlab-app-id",
    "Test Server",
    false,
    undefined,
    callbackProxy,
    callbackProxy ? CALLBACK_URL : "",
    material
      ? {
          material,
          clientTtlSeconds: 86400,
          pendingTtlSeconds: 600,
          storedTtlSeconds: 600,
        }
      : null
  );
}

// Stub GitLab's /oauth/token endpoint using a fetch monkey-patch. The
// captured calls are returned for assertions.
interface CapturedCall {
  url: string;
  body: Record<string, string>;
}

function installFetchStub(
  response: {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
  }
): { restore: () => void; calls: CapturedCall[] } {
  const origFetch = globalThis.fetch;
  const calls: CapturedCall[] = [];
  // Use the typed global fetch signature so TS is happy.
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const bodyText = typeof init?.body === "string" ? (init.body as string) : "";
    const body: Record<string, string> = {};
    new URLSearchParams(bodyText).forEach((v, k) => (body[k] = v));
    calls.push({ url, body });
    return new Response(
      JSON.stringify({
        access_token: response.access_token,
        refresh_token: response.refresh_token ?? "r-token",
        token_type: response.token_type ?? "Bearer",
        expires_in: response.expires_in ?? 7200,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }) as typeof globalThis.fetch;
  return {
    restore: () => {
      globalThis.fetch = origFetch;
    },
    calls,
  };
}

// Minimal express-style Request/Response fakes. The provider only reads
// req.query and calls res.status / res.send / res.redirect.
interface FakeRes {
  statusCode: number;
  body: string | null;
  redirectedTo: string | null;
  status: (code: number) => FakeRes;
  send: (text: string) => FakeRes;
  redirect: (url: string) => FakeRes;
}

function makeFakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: null,
    redirectedTo: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(text) {
      this.body = text;
      return this;
    },
    redirect(url) {
      this.statusCode = 302;
      this.redirectedTo = url;
      return this;
    },
  };
  return res;
}

function fakeReq(query: Record<string, string>): ExpressRequest {
  return { query } as unknown as ExpressRequest;
}

// A response wrapper that captures authorize redirects.
interface AuthorizeRes {
  redirect: (url: string) => void;
  redirectedTo: string | null;
}

function makeAuthorizeRes(): AuthorizeRes {
  const r: AuthorizeRes = {
    redirectedTo: null,
    redirect(url) {
      r.redirectedTo = url;
    },
  };
  return r;
}

// ---------------------------------------------------------------------------
// Unit-level tests for the mint/open helpers
// ---------------------------------------------------------------------------

describe("mintPendingAuthState / openPendingAuthState", () => {
  test("roundtrip across pods", () => {
    const s = secret();
    const podA = loadMaterial(s);
    const podB = loadMaterial(s);
    const state = mintPendingAuthState(podA, {
      clientId: "v1.cid.xyz",
      clientRedirectUri: CLIENT_REDIRECT,
      clientState: "client-state-123",
      clientCodeChallenge: "challenge-abc",
      proxyCodeVerifier: "proxy-verifier-def",
    });
    assert.ok(looksLikeStatelessState(state));
    const opened = openPendingAuthState(podB, state, 600);
    assert.ok(opened);
    assert.equal(opened!.cid, "v1.cid.xyz");
    assert.equal(opened!.cru, CLIENT_REDIRECT);
    assert.equal(opened!.cs, "client-state-123");
    assert.equal(opened!.ccc, "challenge-abc");
    assert.equal(opened!.pcv, "proxy-verifier-def");
  });

  test("tampered state rejected", () => {
    const m = loadMaterial(secret());
    const state = mintPendingAuthState(m, {
      clientId: "a",
      clientRedirectUri: "b",
      clientCodeChallenge: "c",
      proxyCodeVerifier: "d",
    });
    const parts = state.split(".");
    const blob = Buffer.from(parts[2], "base64url");
    blob[Math.floor(blob.length / 2)] ^= 0xff;
    parts[2] = blob.toString("base64url");
    const bad = parts.join(".");
    assert.equal(openPendingAuthState(m, bad, 600), null);
  });

  test("expired state rejected", () => {
    const m = loadMaterial(secret());
    const past = Math.floor(Date.now() / 1000) - 3600;
    const state = mintPendingAuthState(m, {
      clientId: "a",
      clientRedirectUri: "b",
      clientCodeChallenge: "c",
      proxyCodeVerifier: "d",
      now: () => past,
    });
    assert.equal(openPendingAuthState(m, state, 60), null);
  });

  test("omitted clientState roundtrips", () => {
    const m = loadMaterial(secret());
    const state = mintPendingAuthState(m, {
      clientId: "a",
      clientRedirectUri: "b",
      clientCodeChallenge: "c",
      proxyCodeVerifier: "d",
    });
    const opened = openPendingAuthState(m, state, 600);
    assert.ok(opened);
    assert.equal(opened!.cs, undefined);
  });
});

describe("mintStoredTokensCode / openStoredTokensCode", () => {
  test("roundtrip across pods", () => {
    const s = secret();
    const podA = loadMaterial(s);
    const podB = loadMaterial(s);
    const tokens = {
      access_token: "gitlab-access-token-value",
      refresh_token: "gitlab-refresh-token-value",
      token_type: "Bearer",
      expires_in: 7200,
    };
    const code = mintStoredTokensCode(podA, {
      tokens,
      clientId: "v1.cid.xyz",
      clientRedirectUri: CLIENT_REDIRECT,
      clientCodeChallenge: "challenge",
    });
    assert.ok(looksLikeStatelessStoredTokensCode(code));
    const opened = openStoredTokensCode(podB, code, 600);
    assert.ok(opened);
    assert.equal(opened!.t.access_token, tokens.access_token);
    assert.equal(opened!.t.refresh_token, tokens.refresh_token);
    assert.equal(opened!.cid, "v1.cid.xyz");
  });
});

// ---------------------------------------------------------------------------
// Cross-pod provider integration: /authorize on A → /callback on B → /token on C
// ---------------------------------------------------------------------------

describe("callback-proxy cross-pod flow (stateless)", () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    stub = installFetchStub({ access_token: "gl-access-123" });
  });

  afterEach(() => {
    stub.restore();
  });

  test("authorize(A) → callback(B) → exchangeAuthorizationCode(C) all work", async () => {
    const sharedSecret = secret();
    const podA = makeProvider(loadMaterial(sharedSecret));
    const podB = makeProvider(loadMaterial(sharedSecret));
    const podC = makeProvider(loadMaterial(sharedSecret));

    // Step 1: register client on podA (signed client_id → every pod can read it)
    const registered = await podA.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
    });

    // Step 2: authorize on podA — captures the redirect URL to GitLab
    const clientCodeVerifier = randomBytes(32).toString("base64url");
    const clientCodeChallenge = createHash("sha256")
      .update(clientCodeVerifier)
      .digest("base64url");
    const authorizeRes = makeAuthorizeRes();
    await podA.authorize(
      registered,
      {
        state: "client-state-xyz",
        scopes: ["api"],
        redirectUri: CLIENT_REDIRECT,
        codeChallenge: clientCodeChallenge,
      },
      authorizeRes as unknown as ExpressResponse
    );
    assert.ok(authorizeRes.redirectedTo, "authorize should redirect");
    const gitlabUrl = new URL(authorizeRes.redirectedTo!);
    assert.equal(gitlabUrl.origin + gitlabUrl.pathname, `${GITLAB_BASE}/oauth/authorize`);
    const proxyState = gitlabUrl.searchParams.get("state");
    assert.ok(proxyState, "proxy state present");
    assert.ok(
      looksLikeStatelessState(proxyState!),
      "state should be sealed in stateless mode"
    );

    // Step 3: GitLab redirects to our /callback — on a DIFFERENT pod (B).
    // No state shared; only OAUTH_STATELESS_SECRET is shared.
    const cbReq = fakeReq({ code: "gitlab-auth-code-abc", state: proxyState! });
    const cbRes = makeFakeRes();
    await podB.handleCallback(
      cbReq as unknown as ExpressRequest,
      cbRes as unknown as ExpressResponse
    );
    assert.equal(cbRes.statusCode, 302, "callback should redirect to client");
    assert.ok(cbRes.redirectedTo);
    const clientCallbackUrl = new URL(cbRes.redirectedTo!);
    assert.equal(
      clientCallbackUrl.origin + clientCallbackUrl.pathname,
      CLIENT_REDIRECT
    );
    assert.equal(clientCallbackUrl.searchParams.get("state"), "client-state-xyz");
    const proxyCode = clientCallbackUrl.searchParams.get("code");
    assert.ok(proxyCode);
    assert.ok(
      looksLikeStatelessStoredTokensCode(proxyCode!),
      "proxy code should be sealed in stateless mode"
    );

    // Verify the GitLab token exchange happened with the correct verifier.
    assert.equal(stub.calls.length, 1);
    assert.equal(stub.calls[0].url, `${GITLAB_BASE}/oauth/token`);
    assert.equal(stub.calls[0].body.code, "gitlab-auth-code-abc");
    assert.equal(stub.calls[0].body.redirect_uri, CALLBACK_URL);
    assert.ok(stub.calls[0].body.code_verifier, "proxy code_verifier in token call");

    // Step 4: MCP client redeems the proxy code on a THIRD pod (C).
    const podCClient = await podC.clientsStore.getClient(registered.client_id);
    assert.ok(podCClient);
    const tokens = await podC.exchangeAuthorizationCode(
      podCClient!,
      proxyCode!,
      clientCodeVerifier,
      CLIENT_REDIRECT
    );
    assert.equal(tokens.access_token, "gl-access-123");
  });

  test("exchangeAuthorizationCode rejects wrong PKCE verifier", async () => {
    const s = secret();
    const pod = makeProvider(loadMaterial(s));
    const registered = await pod.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
    });
    const correctVerifier = randomBytes(32).toString("base64url");
    const correctChallenge = createHash("sha256")
      .update(correctVerifier)
      .digest("base64url");
    const authorizeRes = makeAuthorizeRes();
    await pod.authorize(
      registered,
      {
        state: "s",
        scopes: ["api"],
        redirectUri: CLIENT_REDIRECT,
        codeChallenge: correctChallenge,
      },
      authorizeRes as unknown as ExpressResponse
    );
    const proxyState = new URL(authorizeRes.redirectedTo!).searchParams.get("state")!;
    const cbRes = makeFakeRes();
    await pod.handleCallback(
      fakeReq({ code: "gitlab-code", state: proxyState }) as unknown as ExpressRequest,
      cbRes as unknown as ExpressResponse
    );
    const proxyCode = new URL(cbRes.redirectedTo!).searchParams.get("code")!;

    // Redeem with wrong code_verifier
    const wrongVerifier = randomBytes(32).toString("base64url");
    await assert.rejects(
      () =>
        pod.exchangeAuthorizationCode(
          registered,
          proxyCode,
          wrongVerifier,
          CLIENT_REDIRECT
        ),
      /PKCE verification failed/
    );
  });

  test("exchangeAuthorizationCode rejects wrong client_id", async () => {
    const s = secret();
    const pod = makeProvider(loadMaterial(s));
    const r1 = await pod.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
    });
    const r2 = await pod.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
    });
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const aRes = makeAuthorizeRes();
    await pod.authorize(
      r1,
      {
        state: "s",
        scopes: ["api"],
        redirectUri: CLIENT_REDIRECT,
        codeChallenge: challenge,
      },
      aRes as unknown as ExpressResponse
    );
    const proxyState = new URL(aRes.redirectedTo!).searchParams.get("state")!;
    const cbRes = makeFakeRes();
    await pod.handleCallback(
      fakeReq({ code: "g", state: proxyState }) as unknown as ExpressRequest,
      cbRes as unknown as ExpressResponse
    );
    const proxyCode = new URL(cbRes.redirectedTo!).searchParams.get("code")!;
    // Try to redeem as r2 (different client_id)
    await assert.rejects(
      () => pod.exchangeAuthorizationCode(r2, proxyCode, verifier, CLIENT_REDIRECT),
      /Invalid client for authorization code/
    );
  });

  test("exchangeAuthorizationCode rejects wrong redirect_uri", async () => {
    const s = secret();
    const pod = makeProvider(loadMaterial(s));
    const registered = await pod.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
    });
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const aRes = makeAuthorizeRes();
    await pod.authorize(
      registered,
      {
        state: "s",
        scopes: ["api"],
        redirectUri: CLIENT_REDIRECT,
        codeChallenge: challenge,
      },
      aRes as unknown as ExpressResponse
    );
    const proxyState = new URL(aRes.redirectedTo!).searchParams.get("state")!;
    const cbRes = makeFakeRes();
    await pod.handleCallback(
      fakeReq({ code: "g", state: proxyState }) as unknown as ExpressRequest,
      cbRes as unknown as ExpressResponse
    );
    const proxyCode = new URL(cbRes.redirectedTo!).searchParams.get("code")!;
    await assert.rejects(
      () =>
        pod.exchangeAuthorizationCode(
          registered,
          proxyCode,
          verifier,
          "https://attacker.example/cb"
        ),
      /Invalid redirect_uri for authorization code/
    );
  });

  test("stale state rejected at /callback", async () => {
    const s = secret();
    const pod = makeProvider(loadMaterial(s));
    // Bogus state that wasn't minted by this provider (or wasn't minted at all)
    const cbRes = makeFakeRes();
    await pod.handleCallback(
      fakeReq({ code: "g", state: "v1.ps.totally-bogus" }) as unknown as ExpressRequest,
      cbRes as unknown as ExpressResponse
    );
    assert.equal(cbRes.statusCode, 400);
    assert.match(cbRes.body ?? "", /Unknown or expired state/i);
  });

  test("legacy non-stateless provider still works (no regression)", async () => {
    const pod = makeProvider(null);
    const registered = await pod.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
    });
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const aRes = makeAuthorizeRes();
    await pod.authorize(
      registered,
      {
        state: "s",
        scopes: ["api"],
        redirectUri: CLIENT_REDIRECT,
        codeChallenge: challenge,
      },
      aRes as unknown as ExpressResponse
    );
    const legacyState = new URL(aRes.redirectedTo!).searchParams.get("state")!;
    assert.ok(!looksLikeStatelessState(legacyState), "legacy state is a UUID, not sealed");
    const cbRes = makeFakeRes();
    await pod.handleCallback(
      fakeReq({ code: "g", state: legacyState }) as unknown as ExpressRequest,
      cbRes as unknown as ExpressResponse
    );
    assert.equal(cbRes.statusCode, 302);
    const proxyCode = new URL(cbRes.redirectedTo!).searchParams.get("code")!;
    assert.ok(!looksLikeStatelessStoredTokensCode(proxyCode), "legacy code is a UUID");
    const tokens = await pod.exchangeAuthorizationCode(
      registered,
      proxyCode,
      verifier,
      CLIENT_REDIRECT
    );
    assert.equal(tokens.access_token, "gl-access-123");
  });

  test("different secret on pod B rejects the sealed state", async () => {
    const podA = makeProvider(loadMaterial(secret()));
    const podB = makeProvider(loadMaterial(secret())); // different secret
    const registered = await podA.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
    });
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const aRes = makeAuthorizeRes();
    await podA.authorize(
      registered,
      {
        state: "s",
        scopes: ["api"],
        redirectUri: CLIENT_REDIRECT,
        codeChallenge: challenge,
      },
      aRes as unknown as ExpressResponse
    );
    const proxyState = new URL(aRes.redirectedTo!).searchParams.get("state")!;
    const cbRes = makeFakeRes();
    await podB.handleCallback(
      fakeReq({ code: "g", state: proxyState }) as unknown as ExpressRequest,
      cbRes as unknown as ExpressResponse
    );
    assert.equal(cbRes.statusCode, 400);
    assert.match(cbRes.body ?? "", /Unknown or expired state/i);
  });
});

after(() => {
  // no global resources
});
