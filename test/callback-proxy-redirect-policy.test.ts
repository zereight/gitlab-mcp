/**
 * Callback proxy mode: redirect URI allowlist and consent page.
 *
 * In callback proxy mode GitLab only ever sees the server's own /callback URL,
 * so it cannot check where the proxy code goes next. Before the allowlist and
 * consent page, anyone could register a client with their own redirect_uri,
 * send a victim an /authorize link and receive the victim's GitLab tokens:
 *
 *   POST /register {redirect_uris:[attacker]}  ->  victim opens /authorize
 *     -> GitLab consent for the operator's app -> /callback
 *     -> 302 attacker?code=<proxy code> -> attacker POST /token -> tokens
 *
 * These tests drive a real server over HTTP against a mock GitLab.
 */

import { describe, test, after, before } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import {
  launchServer,
  findAvailablePort,
  cleanupServers,
  ServerInstance,
  TransportMode,
  HOST,
} from "./utils/server-launcher.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MCP_SERVER_PORT_BASE = 3470;
const MOCK_ACCESS_TOKEN = "glpat-mock-redirect-policy-token";
const MOCK_REFRESH_TOKEN = "mock-redirect-policy-refresh";
const MOCK_APP_ID = "test-redirect-policy-app-id";
const LOOPBACK_REDIRECT = "http://localhost:19999/oauth/callback";
const ATTACKER_REDIRECT = "https://attacker.example/cb";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function register(
  baseUrl: string,
  redirectUri: string,
  clientName = "redirect-policy-test"
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redirect_uris: [redirectUri], client_name: clientName }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function registerOk(baseUrl: string, redirectUri: string, clientName?: string): Promise<string> {
  const result = await register(baseUrl, redirectUri, clientName);
  assert.strictEqual(result.status, 201, `DCR failed: ${JSON.stringify(result.body)}`);
  return result.body.client_id as string;
}

function authorizeQuery(clientId: string, redirectUri: string, challenge: string, state: string): string {
  return new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope: "api",
  }).toString();
}

/** Turn Set-Cookie headers into a Cookie request header value. */
function cookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map(cookie => cookie.split(";")[0])
    .join("; ");
}

function cookieValue(res: Response, name: string): string | undefined {
  for (const cookie of res.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const eq = pair.indexOf("=");
    if (pair.slice(0, eq) === name) return pair.slice(eq + 1);
  }
  return undefined;
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Read the hidden inputs of the consent form. */
function consentFormFields(html: string): URLSearchParams {
  const fields = new URLSearchParams();
  for (const match of html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) {
    fields.set(match[1], unescapeHtml(match[2]));
  }
  return fields;
}

async function postConsent(
  baseUrl: string,
  fields: URLSearchParams,
  cookie: string | undefined,
  action: "approve" | "deny"
): Promise<Response> {
  const body = new URLSearchParams(fields);
  body.set("consent_action", action);
  return fetch(`${baseUrl}/authorize`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body.toString(),
  });
}

async function simulateGitLabCallback(baseUrl: string, code: string, state: string): Promise<Response> {
  return fetch(
    `${baseUrl}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    { redirect: "manual" }
  );
}

async function exchangeToken(
  baseUrl: string,
  clientId: string,
  code: string,
  verifier: string,
  redirectUri: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }).toString(),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function startMockGitLab(): Promise<MockGitLabServer> {
  const mock = new MockGitLabServer({
    port: await findMockServerPort(),
    validTokens: [MOCK_ACCESS_TOKEN],
  });
  await mock.start();
  mock.addRootHandler("post", "/oauth/token", (_req, res) => {
    res.json({
      access_token: MOCK_ACCESS_TOKEN,
      token_type: "Bearer",
      expires_in: 7200,
      refresh_token: MOCK_REFRESH_TOKEN,
      scope: "api",
    });
  });
  return mock;
}

async function startServer(
  mock: MockGitLabServer,
  extraEnv: Record<string, string> = {}
): Promise<{ server: ServerInstance; baseUrl: string }> {
  const port = await findAvailablePort(MCP_SERVER_PORT_BASE);
  const baseUrl = `http://${HOST}:${port}`;
  const server = await launchServer({
    mode: TransportMode.STREAMABLE_HTTP,
    port,
    timeout: 5000,
    env: {
      STREAMABLE_HTTP: "true",
      GITLAB_MCP_OAUTH: "true",
      GITLAB_OAUTH_CALLBACK_PROXY: "true",
      GITLAB_OAUTH_APP_ID: MOCK_APP_ID,
      GITLAB_API_URL: `${mock.getUrl()}/api/v4`,
      MCP_SERVER_URL: baseUrl,
      MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: "true",
      ...extraEnv,
    },
  });
  return { server, baseUrl };
}

// ---------------------------------------------------------------------------
// Default allowlist
// ---------------------------------------------------------------------------

describe("callback proxy: redirect URI allowlist and consent", () => {
  let mock: MockGitLabServer;
  let baseUrl: string;
  // DCR allows 20 registrations per hour per IP; reuse one client where the
  // test does not depend on a fresh client_id.
  let sharedClientId: string;
  const servers: ServerInstance[] = [];

  before(async () => {
    mock = await startMockGitLab();
    const started = await startServer(mock);
    servers.push(started.server);
    baseUrl = started.baseUrl;
    sharedClientId = await registerOk(baseUrl, LOOPBACK_REDIRECT, "My Editor");
  });

  after(async () => {
    cleanupServers(servers);
    if (mock) await mock.stop();
  });

  test("an attacker-registered redirect_uri cannot receive the victim's tokens", async () => {
    const attacker = generatePKCE();
    const reg = await register(baseUrl, ATTACKER_REDIRECT, "Totally Legit Client");

    if (reg.status === 201) {
      // Walk the old chain so a regression shows exactly what leaks.
      const clientId = reg.body.client_id as string;
      const victimClick = await fetch(
        `${baseUrl}/authorize?${authorizeQuery(clientId, ATTACKER_REDIRECT, attacker.challenge, "s")}`,
        { redirect: "manual" }
      );
      const gitlab = new URL(victimClick.headers.get("location") ?? "about:blank");
      const proxyState = gitlab.searchParams.get("state");
      if (victimClick.status === 302 && proxyState) {
        const callback = await simulateGitLabCallback(baseUrl, "victim-gitlab-code", proxyState);
        const delivered = new URL(callback.headers.get("location") ?? "about:blank");
        const proxyCode = delivered.searchParams.get("code") ?? "";
        const stolen = await exchangeToken(
          baseUrl,
          clientId,
          proxyCode,
          attacker.verifier,
          ATTACKER_REDIRECT
        );
        assert.fail(
          `DCR accepted ${ATTACKER_REDIRECT}; victim's code was sent to ${delivered.origin} ` +
            `and /token returned ${stolen.status} (access_token ${
              stolen.body.access_token === MOCK_ACCESS_TOKEN ? "LEAKED" : "not issued"
            })`
        );
      }
      assert.fail(`DCR accepted ${ATTACKER_REDIRECT} (status 201)`);
    }

    assert.strictEqual(reg.status, 400);
    assert.strictEqual(reg.body.error, "invalid_redirect_uri");
  });

  test("lookalike hosts and paths outside the allowlist are refused at registration", async () => {
    for (const uri of [
      "https://claude.ai.attacker.example/api/mcp/auth_callback",
      "https://claude.ai/api/mcp/auth_callback/../../steal",
      "https://chatgpt.com/connector_platform_oauth_redirect/extra",
      "https://attacker.example/connector/oauth/abc",
      "http://localhost.attacker.example/cb",
    ]) {
      const reg = await register(baseUrl, uri);
      assert.strictEqual(reg.status, 400, `${uri} should be refused`);
      assert.strictEqual(reg.body.error, "invalid_redirect_uri");
    }
  });

  test("known client callbacks and loopback URIs can still register", async () => {
    for (const uri of [
      "https://claude.ai/api/mcp/auth_callback",
      "https://claude.com/api/mcp/auth_callback",
      "https://chatgpt.com/connector_platform_oauth_redirect",
      "https://chatgpt.com/connector/oauth/abc123",
      "cursor://anysphere.cursor-mcp/oauth/callback",
      "http://localhost:33418/callback",
      "http://127.0.0.1:8765/oauth/callback",
      "http://[::1]:9000/cb",
    ]) {
      const reg = await register(baseUrl, uri);
      assert.strictEqual(reg.status, 201, `${uri} should be accepted: ${JSON.stringify(reg.body)}`);
    }
  });

  test("/authorize shows a consent page instead of going straight to GitLab", async () => {
    const pkce = generatePKCE();
    const clientId = sharedClientId;
    const res = await fetch(
      `${baseUrl}/authorize?${authorizeQuery(clientId, LOOPBACK_REDIRECT, pkce.challenge, "st")}`,
      { redirect: "manual" }
    );

    assert.strictEqual(
      res.status,
      200,
      `expected consent page, got ${res.status} -> ${res.headers.get("location")}`
    );
    assert.match(res.headers.get("content-type") ?? "", /^text\/html/);
    assert.match(res.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.strictEqual(res.headers.get("x-frame-options"), "DENY");
    const csrf = res.headers.getSetCookie().find(c => c.startsWith("gitlab_mcp_oauth_csrf="));
    assert.ok(csrf, "CSRF cookie should be set");
    assert.match(csrf!, /HttpOnly/);
    assert.match(csrf!, /SameSite=Lax/);

    const html = await res.text();
    assert.ok(html.includes("http://localhost:19999"), "page should show where the code goes");
    assert.ok(html.includes("My Editor via GitLab MCP Server"));
    assert.ok(!html.includes(mock.getUrl()), "GitLab URL must not appear before approval");
  });

  test("client_name is escaped on the consent page", async () => {
    const pkce = generatePKCE();
    const clientId = await registerOk(baseUrl, LOOPBACK_REDIRECT, '<img src=x onerror="alert(1)">');
    const res = await fetch(
      `${baseUrl}/authorize?${authorizeQuery(clientId, LOOPBACK_REDIRECT, pkce.challenge, "st")}`,
      { redirect: "manual" }
    );
    const html = await res.text();
    assert.ok(!html.includes("<img"), "raw markup must not reach the page");
    assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  });

  test("approval without the matching CSRF cookie is refused", async () => {
    const pkce = generatePKCE();
    const clientId = sharedClientId;
    const page = await fetch(
      `${baseUrl}/authorize?${authorizeQuery(clientId, LOOPBACK_REDIRECT, pkce.challenge, "st")}`,
      { redirect: "manual" }
    );
    const fields = consentFormFields(await page.text());
    assert.ok(fields.get("consent_csrf"), "form should carry a CSRF token");

    // Cross-site POST: SameSite=Lax keeps the cookie off the request.
    const noCookie = await postConsent(baseUrl, fields, undefined, "approve");
    assert.strictEqual(noCookie.status, 403);
    assert.strictEqual(noCookie.headers.get("location"), null);

    const wrongCookie = await postConsent(
      baseUrl,
      fields,
      `gitlab_mcp_oauth_csrf=${randomBytes(32).toString("base64url")}`,
      "approve"
    );
    assert.strictEqual(wrongCookie.status, 403);
    assert.strictEqual(wrongCookie.headers.get("location"), null);
  });

  test("deny sends access_denied back to the client", async () => {
    const pkce = generatePKCE();
    const clientId = sharedClientId;
    const page = await fetch(
      `${baseUrl}/authorize?${authorizeQuery(clientId, LOOPBACK_REDIRECT, pkce.challenge, "deny-state")}`,
      { redirect: "manual" }
    );
    const denied = await postConsent(
      baseUrl,
      consentFormFields(await page.text()),
      cookieHeader(page),
      "deny"
    );
    assert.strictEqual(denied.status, 302);
    const location = new URL(denied.headers.get("location")!);
    assert.strictEqual(`${location.origin}${location.pathname}`, LOOPBACK_REDIRECT);
    assert.strictEqual(location.searchParams.get("error"), "access_denied");
    assert.strictEqual(location.searchParams.get("state"), "deny-state");
  });

  test("approve completes the flow and is remembered for that client", async () => {
    const pkce = generatePKCE();
    const clientId = sharedClientId;
    const query = authorizeQuery(clientId, LOOPBACK_REDIRECT, pkce.challenge, "approve-state");
    const page = await fetch(`${baseUrl}/authorize?${query}`, { redirect: "manual" });
    const approved = await postConsent(
      baseUrl,
      consentFormFields(await page.text()),
      cookieHeader(page),
      "approve"
    );

    assert.strictEqual(approved.status, 302);
    const gitlab = new URL(approved.headers.get("location")!);
    assert.strictEqual(gitlab.origin, mock.getUrl());
    assert.strictEqual(gitlab.pathname, "/oauth/authorize");
    assert.strictEqual(gitlab.searchParams.get("redirect_uri"), `${baseUrl}/callback`);

    const callback = await simulateGitLabCallback(
      baseUrl,
      "gitlab-code-approved",
      gitlab.searchParams.get("state")!
    );
    assert.strictEqual(callback.status, 302);
    const delivered = new URL(callback.headers.get("location")!);
    assert.strictEqual(`${delivered.origin}${delivered.pathname}`, LOOPBACK_REDIRECT);
    assert.strictEqual(delivered.searchParams.get("state"), "approve-state");
    const tokens = await exchangeToken(
      baseUrl,
      clientId,
      delivered.searchParams.get("code")!,
      pkce.verifier,
      LOOPBACK_REDIRECT
    );
    assert.strictEqual(tokens.status, 200);
    assert.strictEqual(tokens.body.access_token, MOCK_ACCESS_TOKEN);

    // Next sign-in from the same client skips the page.
    const remembered = cookieHeader(approved);
    assert.match(remembered, /gitlab_mcp_oauth_consent_[0-9a-f]{16}=/);
    const again = await fetch(`${baseUrl}/authorize?${query}`, {
      redirect: "manual",
      headers: { Cookie: remembered },
    });
    assert.strictEqual(again.status, 302);
    assert.strictEqual(new URL(again.headers.get("location")!).origin, mock.getUrl());

    // A different client does not inherit the approval.
    const otherId = await registerOk(baseUrl, LOOPBACK_REDIRECT);
    const other = await fetch(
      `${baseUrl}/authorize?${authorizeQuery(otherId, LOOPBACK_REDIRECT, pkce.challenge, "x")}`,
      { redirect: "manual", headers: { Cookie: remembered } }
    );
    assert.strictEqual(other.status, 200);
  });

  test("a forged approval cookie is ignored", async () => {
    const pkce = generatePKCE();
    const clientId = sharedClientId;
    const query = authorizeQuery(clientId, LOOPBACK_REDIRECT, pkce.challenge, "forged");
    const page = await fetch(`${baseUrl}/authorize?${query}`, { redirect: "manual" });
    const approved = await postConsent(
      baseUrl,
      consentFormFields(await page.text()),
      cookieHeader(page),
      "approve"
    );
    const name = approved.headers
      .getSetCookie()
      .map(c => c.split("=")[0])
      .find(n => n.startsWith("gitlab_mcp_oauth_consent_"));
    assert.ok(name);
    const value = cookieValue(approved, name!)!;
    const [expires] = value.split(".");

    for (const forged of [
      `${expires}.${randomBytes(32).toString("base64url")}`,
      `${Number(expires) + 1}.${value.split(".")[1]}`,
      "9999999999",
    ]) {
      const res: Response = await fetch(`${baseUrl}/authorize?${query}`, {
        redirect: "manual",
        headers: { Cookie: `${name}=${forged}` },
      });
      assert.strictEqual(res.status, 200, `forged cookie ${forged} should not skip consent`);
    }
  });

  test("/authorize answers a refused redirect_uri directly, never by redirecting to it", async () => {
    // A client registered with an allowed URI cannot switch to another one:
    // the SDK rejects unregistered redirect_uri values with a direct 400.
    const pkce = generatePKCE();
    const clientId = sharedClientId;
    const res = await fetch(
      `${baseUrl}/authorize?${authorizeQuery(clientId, ATTACKER_REDIRECT, pkce.challenge, "x")}`,
      { redirect: "manual" }
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.headers.get("location"), null);
  });
});

// ---------------------------------------------------------------------------
// Operator-configured allowlist
// ---------------------------------------------------------------------------

describe("callback proxy: GITLAB_OAUTH_ALLOWED_REDIRECT_URIS", () => {
  let mock: MockGitLabServer;
  const servers: ServerInstance[] = [];

  before(async () => {
    mock = await startMockGitLab();
  });

  after(async () => {
    cleanupServers(servers);
    if (mock) await mock.stop();
  });

  test("an explicit list replaces the defaults", async () => {
    const { server, baseUrl } = await startServer(mock, {
      GITLAB_OAUTH_ALLOWED_REDIRECT_URIS: "https://tools.internal.example/oauth/*",
    });
    servers.push(server);

    assert.strictEqual(
      (await register(baseUrl, "https://tools.internal.example/oauth/mcp/callback")).status,
      201
    );
    assert.strictEqual((await register(baseUrl, LOOPBACK_REDIRECT)).status, 400);
    assert.strictEqual(
      (await register(baseUrl, "https://claude.ai/api/mcp/auth_callback")).status,
      400
    );
  });

  test('"defaults" keeps the built-in list next to custom entries', async () => {
    const { server, baseUrl } = await startServer(mock, {
      GITLAB_OAUTH_ALLOWED_REDIRECT_URIS: "defaults, https://tools.internal.example/cb",
    });
    servers.push(server);

    assert.strictEqual((await register(baseUrl, "https://tools.internal.example/cb")).status, 201);
    assert.strictEqual((await register(baseUrl, LOOPBACK_REDIRECT)).status, 201);
    assert.strictEqual((await register(baseUrl, ATTACKER_REDIRECT)).status, 400);
  });

  test('"*" accepts any redirect_uri but still shows the consent page', async () => {
    const { server, baseUrl } = await startServer(mock, {
      GITLAB_OAUTH_ALLOWED_REDIRECT_URIS: "*",
    });
    servers.push(server);

    const clientId = await registerOk(baseUrl, ATTACKER_REDIRECT);
    const pkce = generatePKCE();
    const res = await fetch(
      `${baseUrl}/authorize?${authorizeQuery(clientId, ATTACKER_REDIRECT, pkce.challenge, "x")}`,
      { redirect: "manual" }
    );
    assert.strictEqual(res.status, 200);
    assert.ok((await res.text()).includes("https://attacker.example"));
  });

  test("an invalid entry stops the server at startup", async () => {
    const child = spawn(process.execPath, [path.resolve("build/index.js")], {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        GITLAB_DISABLE_VERSION_CHECK: "true",
        STREAMABLE_HTTP: "true",
        GITLAB_MCP_OAUTH: "true",
        GITLAB_OAUTH_CALLBACK_PROXY: "true",
        GITLAB_OAUTH_APP_ID: MOCK_APP_ID,
        GITLAB_API_URL: `${mock.getUrl()}/api/v4`,
        MCP_SERVER_URL: "http://127.0.0.1:1",
        MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: "true",
        PORT: String(await findAvailablePort(MCP_SERVER_PORT_BASE + 50)),
        GITLAB_OAUTH_ALLOWED_REDIRECT_URIS: "https://*.example.com/cb",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", chunk => (output += chunk));
    child.stderr.on("data", chunk => (output += chunk));
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    const code = await new Promise<number | null>(resolve => child.on("close", resolve));
    clearTimeout(timer);

    assert.notStrictEqual(code, 0);
    assert.notStrictEqual(code, null, "server should exit on its own, not be killed");
    assert.match(output, /GITLAB_OAUTH_ALLOWED_REDIRECT_URIS/);
  });
});
