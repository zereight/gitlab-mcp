/**
 * OAUTH_DISABLE_REFRESH_TOKEN (#890).
 *
 * With the flag on, the MCP OAuth proxy never renews a GitLab token with a
 * refresh token: issued tokens carry no refresh_token (callback proxy mode
 * drops it before storing or sealing the proxy code), the refresh_token grant
 * fails with invalid_grant before GitLab is contacted, and DCR responses leave
 * refresh_token out of grant_types. With the flag off, all paths behave as before.
 *
 * GitLab is stubbed by patching fetch. config.ts reads env and argv at module
 * load, so config parsing runs in child processes (see test/cli/boolean-flags.test.ts).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import * as path from "node:path";
import * as url from "node:url";
import { afterEach, beforeEach, describe, test } from "node:test";
import express from "express";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

import { createGitLabOAuthProvider } from "../oauth-proxy.js";
import { loadKeyMaterialFromEnv, openStoredTokensCode } from "../stateless/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.resolve(__dirname, "cli/load-config-snapshot.ts");

const GITLAB_BASE = "https://gitlab.example.com";
const CALLBACK_URL = "https://mcp.example.com/callback";
const CLIENT_REDIRECT = "https://client.example.com/cb";
const OLD_REFRESH_TOKEN = "client-held-refresh-token-890";
const GITLAB_TOKENS = {
  access_token: "gl-access-890",
  token_type: "Bearer",
  expires_in: 7200,
  refresh_token: "gl-refresh-890",
};

const MODES = ["passthrough", "callback-proxy", "callback-proxy-stateless"] as const;
type Mode = (typeof MODES)[number];

const STORED_TTL_SECONDS = 600;

function makeMaterial() {
  return loadKeyMaterialFromEnv(true, {
    OAUTH_STATELESS_SECRET: randomBytes(32).toString("base64url"),
  });
}

function makeProvider(
  disableRefreshToken: boolean,
  mode: Mode = "passthrough",
  material = mode === "callback-proxy-stateless" ? makeMaterial() : null
) {
  const callbackProxy = mode !== "passthrough";
  return createGitLabOAuthProvider(
    GITLAB_BASE,
    "gitlab-app-id",
    "Test Server",
    false,
    undefined,
    undefined,
    callbackProxy,
    callbackProxy ? CALLBACK_URL : "",
    material
      ? {
          material,
          clientTtlSeconds: 86400,
          pendingTtlSeconds: 600,
          storedTtlSeconds: STORED_TTL_SECONDS,
        }
      : null,
    [CLIENT_REDIRECT],
    disableRefreshToken
  );
}

type Provider = ReturnType<typeof makeProvider>;

// Only GitLab URLs are stubbed; requests to the local token endpoint pass through.
let gitlabCalls: { url: string; body: Record<string, string> }[] = [];
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  gitlabCalls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const target =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (new URL(target).origin !== GITLAB_BASE) {
      return originalFetch(input, init);
    }
    const body: Record<string, string> = {};
    if (typeof init?.body === "string") {
      new URLSearchParams(init.body).forEach((v, k) => (body[k] = v));
    }
    gitlabCalls.push({ url: target, body });
    return new Response(JSON.stringify(GITLAB_TOKENS), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
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
    return true;
  };
}

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

/** Runs /authorize and /callback; returns the proxy code sent to the client. */
async function runCallback(provider: Provider) {
  const registered = await provider.clientsStore.registerClient!({
    redirect_uris: [CLIENT_REDIRECT],
    token_endpoint_auth_method: "none",
  });
  const verifier = randomBytes(32).toString("base64url");
  const authorizeRes = makeAuthorizeRes();
  await provider.authorize(
    registered,
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
  const proxyCode = new URL(callbackRes.redirectedTo!).searchParams.get("code")!;
  return { registered, verifier, proxyCode };
}

/** Returns what the MCP client gets back from POST /token (authorization_code). */
async function issueTokens(provider: Provider, mode: Mode) {
  if (mode === "passthrough") {
    const client: OAuthClientInformationFull = {
      client_id: "mcp-client",
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
    };
    return provider.exchangeAuthorizationCode(client, "gitlab-code", "verifier", CLIENT_REDIRECT);
  }

  const { registered, verifier, proxyCode } = await runCallback(provider);
  return provider.exchangeAuthorizationCode(registered, proxyCode, verifier, CLIENT_REDIRECT);
}

describe("OAUTH_DISABLE_REFRESH_TOKEN — refresh_token grant", () => {
  test("off: refreshes through GitLab and returns its tokens", async () => {
    const provider = makeProvider(false);
    const tokens = await provider.exchangeRefreshToken(
      { client_id: "mcp-client", redirect_uris: [CLIENT_REDIRECT] },
      OLD_REFRESH_TOKEN
    );
    assert.deepEqual(tokens, GITLAB_TOKENS);
    assert.equal(gitlabCalls.length, 1);
    assert.equal(gitlabCalls[0].url, `${GITLAB_BASE}/oauth/token`);
    assert.equal(gitlabCalls[0].body.grant_type, "refresh_token");
    assert.equal(gitlabCalls[0].body.refresh_token, OLD_REFRESH_TOKEN);
  });

  for (const mode of MODES) {
    test(`on (${mode}): rejects with invalid_grant without calling GitLab`, async () => {
      const provider = makeProvider(true, mode);
      await assert.rejects(
        () =>
          provider.exchangeRefreshToken(
            { client_id: "mcp-client", redirect_uris: [CLIENT_REDIRECT] },
            OLD_REFRESH_TOKEN
          ),
        (err: unknown) => {
          hasErrorCode("invalid_grant")(err);
          assert.ok(!String((err as Error).message).includes(OLD_REFRESH_TOKEN));
          return true;
        }
      );
      assert.equal(gitlabCalls.length, 0, "GitLab /oauth/token must not be called");
    });
  }
});

describe("OAUTH_DISABLE_REFRESH_TOKEN — issued tokens", () => {
  for (const mode of MODES) {
    test(`off (${mode}): refresh_token is handed to the client`, async () => {
      const tokens = await issueTokens(makeProvider(false, mode), mode);
      assert.deepEqual(tokens, GITLAB_TOKENS);
    });

    test(`on (${mode}): refresh_token is omitted, the rest is unchanged`, async () => {
      const tokens = await issueTokens(makeProvider(true, mode), mode);
      const { refresh_token: _refreshToken, ...expected } = GITLAB_TOKENS;
      assert.deepEqual(tokens, expected);
      assert.equal("refresh_token" in tokens, false);
    });
  }
});

describe("OAUTH_DISABLE_REFRESH_TOKEN — tokens held after /callback", () => {
  // What the proxy code carries before the client redeems it at /token.
  type StoredTokensView = {
    _storedTokens: { get(code: string): { tokens: OAuthTokens } | undefined };
  };

  async function heldTokens(disableRefreshToken: boolean, stateless: boolean) {
    if (!stateless) {
      const provider = makeProvider(disableRefreshToken, "callback-proxy");
      const { proxyCode } = await runCallback(provider);
      return (provider as unknown as StoredTokensView)._storedTokens.get(proxyCode)?.tokens;
    }
    const material = makeMaterial()!;
    const provider = makeProvider(disableRefreshToken, "callback-proxy-stateless", material);
    const { proxyCode } = await runCallback(provider);
    return openStoredTokensCode(material, proxyCode, STORED_TTL_SECONDS)?.t;
  }

  for (const stateless of [false, true]) {
    const where = stateless ? "sealed proxy code" : "in-memory LRU";

    test(`off: ${where} keeps GitLab's refresh_token`, async () => {
      assert.deepEqual(await heldTokens(false, stateless), GITLAB_TOKENS);
    });

    test(`on: ${where} holds no refresh_token`, async () => {
      const tokens = await heldTokens(true, stateless);
      const { refresh_token: _refreshToken, ...expected } = GITLAB_TOKENS;
      assert.deepEqual(tokens, expected);
    });
  }
});

describe("OAUTH_DISABLE_REFRESH_TOKEN — DCR grant_types", () => {
  async function register(
    disableRefreshToken: boolean,
    mode: Mode,
    grantTypes: string[] | undefined
  ) {
    const provider = makeProvider(disableRefreshToken, mode);
    const registered = await provider.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
      ...(grantTypes ? { grant_types: grantTypes } : {}),
    });
    const stored = await provider.clientsStore.getClient(registered.client_id);
    return { returned: registered.grant_types, stored: stored?.grant_types };
  }

  // passthrough uses the in-memory client cache, stateless signs grant_types into client_id.
  for (const mode of ["passthrough", "callback-proxy-stateless"] as const) {
    test(`off (${mode}): requested grant_types are kept`, async () => {
      const both = ["authorization_code", "refresh_token"];
      assert.deepEqual(await register(false, mode, both), { returned: both, stored: both });
      assert.deepEqual(await register(false, mode, ["refresh_token"]), {
        returned: ["refresh_token"],
        stored: ["refresh_token"],
      });
    });

    test(`on (${mode}): refresh_token is removed from grant_types`, async () => {
      const codeOnly = { returned: ["authorization_code"], stored: ["authorization_code"] };
      assert.deepEqual(
        await register(true, mode, ["authorization_code", "refresh_token"]),
        codeOnly
      );
      assert.deepEqual(await register(true, mode, ["refresh_token"]), codeOnly);
      assert.deepEqual(await register(true, mode, undefined), codeOnly);
    });
  }
});

describe("OAUTH_DISABLE_REFRESH_TOKEN — SDK /token endpoint", () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()));
    server = undefined;
  });

  async function postToken(disableRefreshToken: boolean, form: Record<string, string>) {
    const app = express();
    app.use(
      "/token",
      tokenHandler({ provider: makeProvider(disableRefreshToken), rateLimit: false })
    );
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

  test("on: refresh_token grant → 400 invalid_grant, GitLab not called", async () => {
    const { status, body } = await postToken(true, {
      grant_type: "refresh_token",
      refresh_token: OLD_REFRESH_TOKEN,
    });
    assert.equal(status, 400);
    assert.equal(body.error, "invalid_grant");
    assert.match(String(body.error_description), /start a new authorization/);
    assert.ok(!JSON.stringify(body).includes(OLD_REFRESH_TOKEN));
    assert.equal(gitlabCalls.length, 0);
  });

  test("on: authorization_code grant → 200 without refresh_token", async () => {
    const { status, body } = await postToken(true, {
      grant_type: "authorization_code",
      code: "gitlab-code",
      code_verifier: "verifier",
      redirect_uri: CLIENT_REDIRECT,
    });
    assert.equal(status, 200);
    assert.equal(body.access_token, GITLAB_TOKENS.access_token);
    assert.equal(body.expires_in, GITLAB_TOKENS.expires_in);
    assert.equal("refresh_token" in body, false);
  });

  test("off: refresh_token grant → 200 with GitLab's new tokens", async () => {
    const { status, body } = await postToken(false, {
      grant_type: "refresh_token",
      refresh_token: OLD_REFRESH_TOKEN,
    });
    assert.equal(status, 200);
    assert.deepEqual(body, GITLAB_TOKENS);
    assert.equal(gitlabCalls.length, 1);
  });
});

describe("OAUTH_DISABLE_REFRESH_TOKEN — config parsing", () => {
  function loadFlag(env: Record<string, string>, argv: readonly string[] = []): boolean {
    const childEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && key !== "OAUTH_DISABLE_REFRESH_TOKEN") {
        childEnv[key] = value;
      }
    }
    const stdout = execFileSync(process.execPath, ["--import", "tsx/esm", SNAPSHOT_PATH, ...argv], {
      env: { ...childEnv, ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const value = (JSON.parse(stdout) as { OAUTH_DISABLE_REFRESH_TOKEN?: unknown })
      .OAUTH_DISABLE_REFRESH_TOKEN;
    assert.equal(typeof value, "boolean");
    return value as boolean;
  }

  test("unset → off", () => {
    assert.equal(loadFlag({}), false);
  });

  test('"true" → on', () => {
    assert.equal(loadFlag({ OAUTH_DISABLE_REFRESH_TOKEN: "true" }), true);
  });

  test('"false" → off', () => {
    assert.equal(loadFlag({ OAUTH_DISABLE_REFRESH_TOKEN: "false" }), false);
  });

  test("other values (yes, 1, TRUE, empty) → off", () => {
    for (const value of ["yes", "1", "TRUE", ""]) {
      assert.equal(loadFlag({ OAUTH_DISABLE_REFRESH_TOKEN: value }), false, `value ${value}`);
    }
  });

  test("bare --oauth-disable-refresh-token → on", () => {
    assert.equal(loadFlag({}, ["--oauth-disable-refresh-token"]), true);
  });

  test("--oauth-disable-refresh-token false overrides the env var", () => {
    assert.equal(
      loadFlag({ OAUTH_DISABLE_REFRESH_TOKEN: "true" }, ["--oauth-disable-refresh-token", "false"]),
      false
    );
  });
});
