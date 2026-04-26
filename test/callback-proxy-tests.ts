/**
 * Callback Proxy Mode Tests
 *
 * Tests for GITLAB_OAUTH_CALLBACK_PROXY=true — the mode where the MCP server
 * intercepts the OAuth callback from GitLab, exchanges the code for tokens
 * server-side, and redirects to the MCP client with a proxy code.
 */

import { describe, test, after, before } from "node:test";
import assert from "node:assert";
import { createHash, randomBytes } from "node:crypto";
import {
  launchServer,
  findAvailablePort,
  cleanupServers,
  ServerInstance,
  TransportMode,
  HOST,
} from "./utils/server-launcher.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_GITLAB_PORT_BASE = 9400;
const MCP_SERVER_PORT_BASE = 3400;
const MOCK_ACCESS_TOKEN = "ya29.mock-callback-proxy-token-123456";
const MOCK_REFRESH_TOKEN = "mock-refresh-token-abcdef";
const MOCK_APP_ID = "test-callback-proxy-app-id";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** Register a client via DCR and return the virtual client_id. */
async function registerClient(
  mcpBaseUrl: string,
  redirectUri: string
): Promise<string> {
  const res = await fetch(`${mcpBaseUrl}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      client_name: "callback-proxy-test",
    }),
  });
  assert.strictEqual(res.status, 201, `DCR failed: ${res.status}`);
  const data = (await res.json()) as { client_id: string };
  return data.client_id;
}

/** Hit /authorize and return the redirect Location without following it. */
async function authorize(
  mcpBaseUrl: string,
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  state: string
): Promise<URL> {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    scope: "api",
  });
  const res = await fetch(`${mcpBaseUrl}/authorize?${params}`, {
    redirect: "manual",
  });
  assert.strictEqual(res.status, 302, `Expected 302, got ${res.status}`);
  const location = res.headers.get("location");
  assert.ok(location, "Missing Location header");
  return new URL(location);
}

/** Simulate GitLab redirecting to the MCP server's /callback. */
async function simulateGitLabCallback(
  mcpBaseUrl: string,
  code: string,
  state: string
): Promise<{ status: number; location: string | null; body: string }> {
  const res = await fetch(
    `${mcpBaseUrl}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    { redirect: "manual" }
  );
  return {
    status: res.status,
    location: res.headers.get("location"),
    body: await res.text(),
  };
}

/** Exchange a proxy code for tokens via /token. */
async function exchangeToken(
  mcpBaseUrl: string,
  clientId: string,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${mcpBaseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }).toString(),
  });
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Callback Proxy Mode", () => {
  let mcpBaseUrl: string;
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  let servers: ServerInstance[] = [];
  const clientRedirectUri = "http://localhost:19999/oauth/callback";

  // Track the last code+verifier GitLab received so we can verify the proxy PKCE
  let lastTokenRequest: Record<string, string> = {};

  before(async () => {
    const mockPort = await findMockServerPort(MOCK_GITLAB_PORT_BASE);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_ACCESS_TOKEN],
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();

    // Mock GitLab token exchange — returns tokens and records the request
    mockGitLab.addRootHandler("post", "/oauth/token", (req, res) => {
      // Body may be URL-encoded (from handleCallback) — parse manually if needed
      let body = req.body ?? {};
      if (typeof body === "string") {
        body = Object.fromEntries(new URLSearchParams(body));
      } else if (!body.grant_type && req.headers["content-type"]?.includes("urlencoded")) {
        // express.json() didn't parse it — collect raw body
        let raw = "";
        req.on("data", (chunk: Buffer) => { raw += chunk.toString(); });
        req.on("end", () => {
          lastTokenRequest = Object.fromEntries(new URLSearchParams(raw));
          res.json({
            access_token: MOCK_ACCESS_TOKEN,
            token_type: "Bearer",
            expires_in: 7200,
            refresh_token: MOCK_REFRESH_TOKEN,
            scope: "api",
          });
        });
        return;
      }
      lastTokenRequest = body;
      res.json({
        access_token: MOCK_ACCESS_TOKEN,
        token_type: "Bearer",
        expires_in: 7200,
        refresh_token: MOCK_REFRESH_TOKEN,
        scope: "api",
      });
    });

    // Mock token introspection
    mockGitLab.addRootHandler("get", "/oauth/token/info", (req, res) => {
      const auth = req.headers["authorization"] as string | undefined;
      const token = auth?.replace(/^Bearer\s+/i, "");
      if (token !== MOCK_ACCESS_TOKEN) {
        res.status(401).json({ error: "invalid_token" });
        return;
      }
      res.json({
        resource_owner_id: 42,
        scopes: ["api"],
        expires_in_seconds: 7200,
        application: { uid: MOCK_APP_ID },
        created_at: Math.floor(Date.now() / 1000),
      });
    });

    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE);
    mcpBaseUrl = `http://${HOST}:${mcpPort}`;

    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: "true",
        GITLAB_MCP_OAUTH: "true",
        GITLAB_OAUTH_CALLBACK_PROXY: "true",
        GITLAB_OAUTH_APP_ID: MOCK_APP_ID,
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        MCP_SERVER_URL: mcpBaseUrl,
        MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: "true",
      },
    });
    servers.push(server);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) await mockGitLab.stop();
  });

  // ---- Happy path --------------------------------------------------------

  test("full flow: authorize → callback → token exchange", async () => {
    const clientPKCE = generatePKCE();
    const clientState = "test-state-123";

    // 1. Register client
    const clientId = await registerClient(mcpBaseUrl, clientRedirectUri);

    // 2. Authorize — should redirect to GitLab with fixed callback URL
    const gitlabUrl = await authorize(
      mcpBaseUrl,
      clientId,
      clientRedirectUri,
      clientPKCE.challenge,
      clientState
    );

    assert.strictEqual(gitlabUrl.hostname, new URL(mockGitLabUrl).hostname);
    assert.strictEqual(gitlabUrl.pathname, "/oauth/authorize");
    // redirect_uri should be the MCP server's /callback, NOT the client's
    assert.strictEqual(
      gitlabUrl.searchParams.get("redirect_uri"),
      `${mcpBaseUrl}/callback`
    );
    // State should be a proxy state, NOT the client's original state
    const proxyState = gitlabUrl.searchParams.get("state");
    assert.ok(proxyState);
    assert.notStrictEqual(proxyState, clientState);

    // 3. Simulate GitLab callback to MCP server
    const callbackResult = await simulateGitLabCallback(
      mcpBaseUrl,
      "gitlab-auth-code-xyz",
      proxyState
    );

    assert.strictEqual(callbackResult.status, 302);
    assert.ok(callbackResult.location);
    const clientCallbackUrl = new URL(callbackResult.location);
    // Should redirect to the CLIENT's callback URL
    assert.ok(clientCallbackUrl.href.startsWith(clientRedirectUri));
    // Should include a proxy code (not the GitLab code)
    const proxyCode = clientCallbackUrl.searchParams.get("code");
    assert.ok(proxyCode);
    assert.notStrictEqual(proxyCode, "gitlab-auth-code-xyz");
    // Should restore the client's original state
    assert.strictEqual(clientCallbackUrl.searchParams.get("state"), clientState);

    // 4. Exchange proxy code for tokens
    const tokenResult = await exchangeToken(
      mcpBaseUrl,
      clientId,
      proxyCode,
      clientPKCE.verifier,
      clientRedirectUri
    );

    assert.strictEqual(tokenResult.status, 200);
    assert.strictEqual(tokenResult.body.access_token, MOCK_ACCESS_TOKEN);
    assert.strictEqual(tokenResult.body.refresh_token, MOCK_REFRESH_TOKEN);
  });

  // ---- One-time use proxy code -------------------------------------------

  test("proxy code cannot be reused", async () => {
    const clientPKCE = generatePKCE();
    const clientId = await registerClient(mcpBaseUrl, clientRedirectUri);
    const gitlabUrl = await authorize(
      mcpBaseUrl, clientId, clientRedirectUri, clientPKCE.challenge, "state-reuse"
    );
    const proxyState = gitlabUrl.searchParams.get("state")!;

    const cb = await simulateGitLabCallback(mcpBaseUrl, "code-reuse", proxyState);
    const proxyCode = new URL(cb.location!).searchParams.get("code")!;

    // First exchange succeeds
    const first = await exchangeToken(
      mcpBaseUrl, clientId, proxyCode, clientPKCE.verifier, clientRedirectUri
    );
    assert.strictEqual(first.status, 200);

    // Second exchange with same code fails
    const second = await exchangeToken(
      mcpBaseUrl, clientId, proxyCode, clientPKCE.verifier, clientRedirectUri
    );
    assert.notStrictEqual(second.status, 200);
  });

  // ---- Unknown state parameter -------------------------------------------

  test("callback with unknown state returns 400", async () => {
    const result = await simulateGitLabCallback(
      mcpBaseUrl,
      "some-code",
      "unknown-state-value"
    );
    assert.strictEqual(result.status, 400);
    assert.ok(result.body.includes("Unknown or expired"));
  });

  // ---- PKCE verification failure -----------------------------------------

  test("token exchange with wrong code_verifier fails", async () => {
    const clientPKCE = generatePKCE();
    const clientId = await registerClient(mcpBaseUrl, clientRedirectUri);
    const gitlabUrl = await authorize(
      mcpBaseUrl, clientId, clientRedirectUri, clientPKCE.challenge, "state-pkce"
    );
    const proxyState = gitlabUrl.searchParams.get("state")!;

    const cb = await simulateGitLabCallback(mcpBaseUrl, "code-pkce", proxyState);
    const proxyCode = new URL(cb.location!).searchParams.get("code")!;

    // Exchange with WRONG verifier
    const result = await exchangeToken(
      mcpBaseUrl, clientId, proxyCode, "wrong-verifier-value", clientRedirectUri
    );
    assert.notStrictEqual(result.status, 200);
  });

  // ---- PKCE verifier omitted ---------------------------------------------

  test("token exchange without code_verifier fails when challenge was stored", async () => {
    const clientPKCE = generatePKCE();
    const clientId = await registerClient(mcpBaseUrl, clientRedirectUri);
    const gitlabUrl = await authorize(
      mcpBaseUrl, clientId, clientRedirectUri, clientPKCE.challenge, "state-no-verifier"
    );
    const proxyState = gitlabUrl.searchParams.get("state")!;

    const cb = await simulateGitLabCallback(mcpBaseUrl, "code-no-verifier", proxyState);
    const proxyCode = new URL(cb.location!).searchParams.get("code")!;

    // Exchange WITHOUT verifier — should fail
    const res = await fetch(`${mcpBaseUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code: proxyCode,
        redirect_uri: clientRedirectUri,
      }).toString(),
    });
    assert.notStrictEqual(res.status, 200);
  });

  // ---- Replayed state parameter ------------------------------------------

  test("state cannot be replayed after callback", async () => {
    const clientPKCE = generatePKCE();
    const clientId = await registerClient(mcpBaseUrl, clientRedirectUri);
    const gitlabUrl = await authorize(
      mcpBaseUrl, clientId, clientRedirectUri, clientPKCE.challenge, "state-replay"
    );
    const proxyState = gitlabUrl.searchParams.get("state")!;

    // First callback succeeds
    const first = await simulateGitLabCallback(mcpBaseUrl, "code-replay-1", proxyState);
    assert.strictEqual(first.status, 302);

    // Second callback with same state fails
    const second = await simulateGitLabCallback(mcpBaseUrl, "code-replay-2", proxyState);
    assert.strictEqual(second.status, 400);
  });

  // ---- Dual PKCE verification --------------------------------------------

  test("proxy uses its own PKCE pair with GitLab", async () => {
    const clientPKCE = generatePKCE();
    const clientId = await registerClient(mcpBaseUrl, clientRedirectUri);
    const gitlabUrl = await authorize(
      mcpBaseUrl, clientId, clientRedirectUri, clientPKCE.challenge, "state-dual-pkce"
    );

    // The code_challenge sent to GitLab should NOT be the client's challenge
    const gitlabChallenge = gitlabUrl.searchParams.get("code_challenge");
    assert.ok(gitlabChallenge);
    assert.notStrictEqual(gitlabChallenge, clientPKCE.challenge);

    // Complete the flow to verify the proxy verifier was sent to GitLab
    const proxyState = gitlabUrl.searchParams.get("state")!;
    await simulateGitLabCallback(mcpBaseUrl, "code-dual-pkce", proxyState);

    // The token request to GitLab should have a code_verifier that matches
    // the proxy challenge (not the client's verifier)
    assert.ok(lastTokenRequest.code_verifier);
    assert.notStrictEqual(lastTokenRequest.code_verifier, clientPKCE.verifier);
    const computedChallenge = createHash("sha256")
      .update(lastTokenRequest.code_verifier)
      .digest("base64url");
    assert.strictEqual(computedChallenge, gitlabChallenge);
  });
});
