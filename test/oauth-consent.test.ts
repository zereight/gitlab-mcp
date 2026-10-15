/**
 * Unit tests for oauth-consent.ts (callback proxy redirect URI policy and
 * consent page) and its use inside the OAuth provider. No server processes.
 */

import { describe, test } from "node:test";
import assert from "node:assert";
import { createHash, randomBytes } from "node:crypto";
import type { Response as ExpressResponse } from "express";

import {
  DEFAULT_ALLOWED_REDIRECT_URIS,
  RedirectUriPolicy,
  parseAllowedRedirectUris,
} from "../oauth-consent.js";
import { createGitLabOAuthProvider } from "../oauth-proxy.js";
import { loadKeyMaterialFromEnv, mintClientId } from "../stateless/index.js";
import type { StatelessKeyMaterial } from "../stateless/index.js";

const GITLAB_BASE = "https://gitlab.example.com";
const CALLBACK_URL = "https://mcp.example.com/callback";
const CLIENT_REDIRECT = "http://127.0.0.1:43123/callback";

// ---------------------------------------------------------------------------
// Fake express req/res
// ---------------------------------------------------------------------------

interface FakeRes {
  req: unknown;
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: string | null;
  jsonBody: unknown;
  redirectedTo: string | null;
  setHeader(name: string, value: string | string[]): FakeRes;
  status(code: number): FakeRes;
  send(body: string): FakeRes;
  json(body: unknown): FakeRes;
  redirect(statusOrUrl: number | string, url?: string): void;
}

function fakeRes(req: {
  method?: string;
  cookie?: string;
  body?: Record<string, string>;
}): FakeRes {
  const res: FakeRes = {
    req: {
      method: req.method ?? "GET",
      headers: req.cookie ? { cookie: req.cookie } : {},
      body: req.body,
    },
    statusCode: 200,
    headers: {},
    body: null,
    jsonBody: undefined,
    redirectedTo: null,
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
    json(body) {
      res.jsonBody = body;
      return res;
    },
    redirect(statusOrUrl, url) {
      res.statusCode = typeof statusOrUrl === "number" ? statusOrUrl : 302;
      res.redirectedTo = typeof statusOrUrl === "number" ? url! : statusOrUrl;
    },
  };
  return res;
}

function setCookies(res: FakeRes): string[] {
  const value = res.headers["set-cookie"];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function cookieHeaderFrom(res: FakeRes): string {
  return setCookies(res)
    .map(c => c.split(";")[0])
    .join("; ");
}

function material(secret = randomBytes(32).toString("base64url")): StatelessKeyMaterial {
  const m = loadKeyMaterialFromEnv(true, { OAUTH_STATELESS_SECRET: secret });
  assert.ok(m);
  return m!;
}

function makeProvider(
  options: {
    stateless?: StatelessKeyMaterial | null;
    callbackProxy?: boolean;
    allowed?: readonly string[];
    callbackUrl?: string;
  } = {}
) {
  const { stateless = null, callbackProxy = true, allowed, callbackUrl = CALLBACK_URL } = options;
  return createGitLabOAuthProvider(
    GITLAB_BASE,
    "real-gitlab-app-id",
    "Test Server",
    false,
    undefined,
    undefined,
    callbackProxy,
    callbackProxy ? callbackUrl : "",
    stateless
      ? { material: stateless, clientTtlSeconds: 86400, pendingTtlSeconds: 600, storedTtlSeconds: 600 }
      : null,
    allowed
  );
}

function authParams(redirectUri = CLIENT_REDIRECT) {
  const verifier = randomBytes(32).toString("base64url");
  return {
    state: "client-state",
    scopes: ["api"],
    redirectUri,
    codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

/** Run the consent page and approve it, returning the approval response. */
async function approve(
  provider: ReturnType<typeof makeProvider>,
  client: Parameters<ReturnType<typeof makeProvider>["authorize"]>[0],
  params: ReturnType<typeof authParams>
): Promise<FakeRes> {
  const page = fakeRes({});
  await provider.authorize(client, params, page as unknown as ExpressResponse);
  assert.strictEqual(page.statusCode, 200);
  const csrf = /name="consent_csrf" value="([^"]+)"/.exec(page.body ?? "")?.[1];
  assert.ok(csrf);
  const approved = fakeRes({
    method: "POST",
    cookie: cookieHeaderFrom(page),
    body: { consent_action: "approve", consent_csrf: csrf! },
  });
  await provider.authorize(client, params, approved as unknown as ExpressResponse);
  return approved;
}

// ---------------------------------------------------------------------------
// RedirectUriPolicy
// ---------------------------------------------------------------------------

describe("RedirectUriPolicy defaults", () => {
  const policy = new RedirectUriPolicy(DEFAULT_ALLOWED_REDIRECT_URIS);

  test("accepts known MCP client callbacks", () => {
    for (const uri of [
      "https://claude.ai/api/mcp/auth_callback",
      "https://claude.com/api/mcp/auth_callback",
      "https://chatgpt.com/connector_platform_oauth_redirect",
      "https://chatgpt.com/connector/oauth/g-abc123",
      "cursor://anysphere.cursor-mcp/oauth/callback",
    ]) {
      assert.ok(policy.allows(uri), uri);
    }
  });

  test("accepts loopback on any port and path", () => {
    for (const uri of [
      "http://localhost/callback",
      "http://localhost:33418/oauth/callback",
      "http://127.0.0.1:8765/cb?x=1",
      "http://[::1]:9000/",
    ]) {
      assert.ok(policy.allows(uri), uri);
    }
  });

  test("refuses everything else", () => {
    for (const uri of [
      "https://attacker.example/cb",
      "https://claude.ai.attacker.example/api/mcp/auth_callback",
      "https://claude.ai/api/mcp/auth_callback?next=https://attacker.example",
      "https://claude.ai/api/mcp/auth_callback#frag",
      "https://claude.ai:8443/api/mcp/auth_callback",
      "http://claude.ai/api/mcp/auth_callback",
      "https://chatgpt.com/connector/oauth",
      "https://chatgpt.com/connector/oauth/../../evil",
      "https://chatgpt.com/connector_platform_oauth_redirect/../evil",
      "http://localhost.attacker.example/cb",
      "http://localhost@attacker.example/cb",
      "https://localhost/cb",
      "http://127.0.0.2/cb",
      "cursor://anysphere.cursor-mcp/oauth/other",
      "javascript:alert(1)",
      "not a url",
    ]) {
      assert.ok(!policy.allows(uri), uri);
    }
  });
});

describe("parseAllowedRedirectUris / custom rules", () => {
  test("unset or empty means the defaults", () => {
    assert.deepStrictEqual(parseAllowedRedirectUris(undefined), [...DEFAULT_ALLOWED_REDIRECT_URIS]);
    assert.deepStrictEqual(parseAllowedRedirectUris(" , "), [...DEFAULT_ALLOWED_REDIRECT_URIS]);
  });

  test('"defaults" expands in place next to custom entries', () => {
    const entries = parseAllowedRedirectUris("https://a.example/cb, defaults");
    assert.strictEqual(entries[0], "https://a.example/cb");
    assert.deepStrictEqual(entries.slice(1), [...DEFAULT_ALLOWED_REDIRECT_URIS]);
  });

  test("a custom list replaces the defaults", () => {
    const policy = new RedirectUriPolicy(parseAllowedRedirectUris("https://a.example/oauth/*"));
    assert.ok(policy.allows("https://a.example/oauth/cb"));
    assert.ok(!policy.allows("https://a.example/other"));
    assert.ok(!policy.allows("https://a.example:444/oauth/cb"));
    assert.ok(!policy.allows("http://localhost:1234/cb"));
    assert.ok(!policy.allows("https://claude.ai/api/mcp/auth_callback"));
  });

  test('"*" allows any redirect URI', () => {
    const policy = new RedirectUriPolicy(["*"]);
    assert.ok(policy.allowsAny);
    assert.ok(policy.allows("https://anything.example/cb"));
    assert.ok(!policy.allows("https://anything.example/cb#frag"));
  });

  test("rejects entries that would match more than intended", () => {
    for (const entry of [
      "https://a.example*",
      "https://*.a.example/cb",
      "https://a.example/oauth*",
      "https://a.example/cb?x=*",
      "https://a.example/cb#frag",
      "https://user@a.example/cb",
      "not a url",
    ]) {
      assert.throws(() => new RedirectUriPolicy([entry]), /GITLAB_OAUTH_ALLOWED_REDIRECT_URIS/, entry);
    }
  });
});

// ---------------------------------------------------------------------------
// Provider integration
// ---------------------------------------------------------------------------

describe("callback proxy provider: registration and authorize", () => {
  test("registerClient refuses redirect URIs outside the policy", async () => {
    const provider = makeProvider();
    await assert.rejects(
      async () =>
        provider.clientsStore.registerClient!({
          redirect_uris: [CLIENT_REDIRECT, "https://attacker.example/cb"],
          token_endpoint_auth_method: "none",
        }),
      (err: Error & { errorCode?: string }) => err.errorCode === "invalid_redirect_uri"
    );
  });

  test("passthrough mode keeps accepting any redirect URI (GitLab checks it)", async () => {
    const provider = makeProvider({ callbackProxy: false });
    const client = await provider.clientsStore.registerClient!({
      redirect_uris: ["https://attacker.example/cb"],
      token_endpoint_auth_method: "none",
    });
    const res = fakeRes({});
    await provider.authorize(client, authParams("https://attacker.example/cb"), res as unknown as ExpressResponse);
    const gitlab = new URL(res.redirectedTo!);
    assert.strictEqual(gitlab.origin, GITLAB_BASE);
    assert.strictEqual(gitlab.searchParams.get("redirect_uri"), "https://attacker.example/cb");
  });

  test("a signed client_id minted before the policy is refused at /authorize without redirecting", async () => {
    const m = material();
    const provider = makeProvider({ stateless: m });
    const attackerUri = "https://attacker.example/cb";
    const clientId = mintClientId(m, {
      redirectUris: [attackerUri],
      grantTypes: ["authorization_code"],
      clientName: "old registration",
    });
    const client = await provider.clientsStore.getClient(clientId);
    assert.ok(client);
    const res = fakeRes({});
    await provider.authorize(client!, authParams(attackerUri), res as unknown as ExpressResponse);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.redirectedTo, null);
    assert.deepStrictEqual((res.jsonBody as { error: string }).error, "invalid_request");
  });

  test("https deployments use __Host- cookies with Secure", async () => {
    const provider = makeProvider();
    const client = await provider.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
    });
    const page = fakeRes({});
    await provider.authorize(client, authParams(), page as unknown as ExpressResponse);
    const [csrf] = setCookies(page);
    assert.match(csrf, /^__Host-gitlab_mcp_oauth_csrf=[A-Za-z0-9_-]{43}; Path=\/; Max-Age=600; HttpOnly; SameSite=Lax; Secure$/);

    const approved = await approve(provider, client, authParams());
    assert.strictEqual(new URL(approved.redirectedTo!).origin, GITLAB_BASE);
    const remember = setCookies(approved).find(c => c.startsWith("__Host-gitlab_mcp_oauth_consent_"));
    assert.ok(remember);
    assert.match(remember!, /; Secure$/);
  });

  test("http deployments (local dev) drop the __Host- prefix and Secure", async () => {
    const provider = makeProvider({ callbackUrl: "http://127.0.0.1:3000/callback" });
    const client = await provider.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
    });
    const page = fakeRes({});
    await provider.authorize(client, authParams(), page as unknown as ExpressResponse);
    const [csrf] = setCookies(page);
    assert.match(csrf, /^gitlab_mcp_oauth_csrf=/);
    assert.ok(!csrf.includes("Secure"));
  });

  test("an approval made on one pod is honoured by another pod with the same secret", async () => {
    const secret = randomBytes(32).toString("base64url");
    const podA = makeProvider({ stateless: material(secret) });
    const podB = makeProvider({ stateless: material(secret) });
    const podC = makeProvider({ stateless: material() });

    const client = await podA.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
    });
    const approved = await approve(podA, client, authParams());
    const remembered = cookieHeaderFrom(approved);

    const onB = fakeRes({ cookie: remembered });
    await podB.authorize(
      (await podB.clientsStore.getClient(client.client_id))!,
      authParams(),
      onB as unknown as ExpressResponse
    );
    assert.strictEqual(new URL(onB.redirectedTo!).origin, GITLAB_BASE);

    // A deployment with a different secret does not trust the cookie.
    const onC = fakeRes({ cookie: remembered });
    await podC.authorize(client, authParams(), onC as unknown as ExpressResponse);
    assert.strictEqual(onC.redirectedTo, null);
    assert.strictEqual(onC.statusCode, 200);
  });

  test("an approval is bound to the redirect URI it was given for", async () => {
    const provider = makeProvider();
    const otherRedirect = "http://127.0.0.1:43123/other";
    const client = await provider.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT, otherRedirect],
      token_endpoint_auth_method: "none",
    });
    const approved = await approve(provider, client, authParams());
    const res = fakeRes({ cookie: cookieHeaderFrom(approved) });
    await provider.authorize(client, authParams(otherRedirect), res as unknown as ExpressResponse);
    assert.strictEqual(res.redirectedTo, null);
    assert.strictEqual(res.statusCode, 200);
  });

  test("the consent form carries every authorize parameter back", async () => {
    const provider = makeProvider();
    const client = await provider.clientsStore.registerClient!({
      redirect_uris: [CLIENT_REDIRECT],
      token_endpoint_auth_method: "none",
      client_name: "Editor",
    });
    const params = { ...authParams(), resource: new URL("https://mcp.example.com/mcp") };
    const page = fakeRes({});
    await provider.authorize(client, params, page as unknown as ExpressResponse);
    const html = page.body ?? "";
    for (const [name, value] of [
      ["client_id", client.client_id],
      ["redirect_uri", CLIENT_REDIRECT],
      ["response_type", "code"],
      ["code_challenge", params.codeChallenge],
      ["code_challenge_method", "S256"],
      ["scope", "api"],
      ["state", "client-state"],
      ["resource", "https://mcp.example.com/mcp"],
    ]) {
      assert.ok(html.includes(`name="${name}" value="${value}"`), `${name} missing`);
    }
    assert.strictEqual(page.headers["x-frame-options"], "DENY");
    assert.strictEqual(page.headers["cache-control"], "no-store");
    assert.match(String(page.headers["content-security-policy"]), /default-src 'none'/);
  });
});
