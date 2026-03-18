/**
 * MCP OAuth Proxy End-to-End Tests
 *
 * Tests the GITLAB_MCP_OAUTH mode where the MCP server acts as an OAuth proxy
 * between MCP clients and a GitLab instance. Uses a mock GitLab server to
 * simulate the full OAuth flow without real credentials.
 *
 * Flow under test:
 *   1. MCP client discovers OAuth metadata via /.well-known/oauth-authorization-server
 *   2. MCP client registers via /register (Dynamic Client Registration)
 *   3. MCP client redirects user to /authorize -> MCP server redirects to GitLab
 *   4. GitLab callback returns to /gitlab/callback -> MCP server redirects to client
 *   5. MCP client exchanges code for token via /token
 *   6. MCP client calls /mcp with Bearer token
 */

import { describe, test, after, before } from 'node:test';
import assert from 'node:assert';
import {
  launchServer,
  findAvailablePort,
  cleanupServers,
  ServerInstance,
  TransportMode,
  HOST,
} from './utils/server-launcher.js';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';
import { createHash, randomUUID } from 'node:crypto';
import { URL, URLSearchParams } from 'node:url';

// Test constants

const MOCK_GITLAB_TOKEN = 'glpat-mock-oauth-token-abcdef1234';
const MOCK_GITLAB_REFRESH_TOKEN = 'mock-refresh-token-xyz';
const MOCK_OAUTH_APP_ID = 'test-oauth-app-id';
const MOCK_OAUTH_APP_SECRET = 'test-oauth-app-secret';

// Port ranges (offset from remote-auth tests to avoid collisions)
const MOCK_GITLAB_PORT_BASE = 9200;
const MCP_SERVER_PORT_BASE = 3200;

console.log('--- MCP OAuth Proxy Test Suite ---');
console.log('');

// PKCE helpers

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString('base64url')
    .replace(/[^a-zA-Z0-9\-._~]/g, '')
    .slice(0, 64);
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// Helper: parse MCP response (may be JSON or SSE)

async function parseMcpResponse(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    // Parse SSE: look for "data:" lines containing JSON
    const text = await res.text();
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const jsonStr = line.slice(5).trim();
        if (jsonStr) {
          return JSON.parse(jsonStr);
        }
      }
    }
    throw new Error('No JSON data found in SSE response');
  }
  return res.json();
}

// Helper: perform a fetch that does NOT follow redirects

async function fetchNoRedirect(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, redirect: 'manual' });
}

// Test suite

describe('MCP OAuth Proxy - Discovery and Registration', () => {
  let mcpBaseUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];

  before(async () => {
    // Start mock GitLab with OAuth endpoints
    const mockPort = await findMockServerPort(MOCK_GITLAB_PORT_BASE);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_GITLAB_TOKEN],
    });

    // Register mock OAuth endpoints on the GitLab server
    registerMockGitLabOAuthEndpoints(mockGitLab);

    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    // Start MCP server in MCP OAuth mode
    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 8000,
      env: {
        STREAMABLE_HTTP: 'true',
        GITLAB_MCP_OAUTH: 'true',
        GITLAB_API_URL: mockGitLabUrl,
        GITLAB_OAUTH_APP_ID: MOCK_OAUTH_APP_ID,
        GITLAB_OAUTH_APP_SECRET: MOCK_OAUTH_APP_SECRET,
        MCP_SERVER_URL: `http://${HOST}:${mcpPort}`,
        MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: 'true',
        GITLAB_READ_ONLY_MODE: 'true',
      },
    });
    servers.push(server);
    mcpBaseUrl = `http://${HOST}:${mcpPort}`;

    console.log(`  Mock GitLab: ${mockGitLabUrl}`);
    console.log(`  MCP Server:  ${mcpBaseUrl}`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('should expose OAuth authorization server metadata', async () => {
    const res = await fetch(`${mcpBaseUrl}/.well-known/oauth-authorization-server`);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);

    const metadata = (await res.json()) as Record<string, unknown>;
    assert.ok(metadata.issuer, 'metadata should have issuer');
    assert.ok(metadata.authorization_endpoint, 'metadata should have authorization_endpoint');
    assert.ok(metadata.token_endpoint, 'metadata should have token_endpoint');
    assert.ok(metadata.registration_endpoint, 'metadata should have registration_endpoint');

    console.log('  OK: OAuth metadata returned correctly');
  });

  test('should expose protected resource metadata', async () => {
    const res = await fetch(`${mcpBaseUrl}/.well-known/oauth-protected-resource`);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);

    const metadata = (await res.json()) as Record<string, unknown>;
    assert.ok(metadata.resource, 'metadata should have resource');

    console.log('  OK: Protected resource metadata returned correctly');
  });

  test('should support Dynamic Client Registration', async () => {
    const res = await fetch(`${mcpBaseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        redirect_uris: ['http://127.0.0.1:9999/callback'],
        client_name: 'test-mcp-client',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
    });

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);

    const client = (await res.json()) as Record<string, unknown>;
    assert.ok(client.client_id, 'response should have client_id');
    assert.ok(
      typeof client.client_id === 'string' && (client.client_id as string).startsWith('mcp-'),
      'client_id should start with mcp-'
    );

    console.log(`  OK: Dynamic Client Registration succeeded, client_id=${client.client_id}`);
  });

  test('should reject /mcp without Bearer token', async () => {
    const res = await fetch(`${mcpBaseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      }),
    });

    assert.ok(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
    console.log(`  OK: /mcp correctly rejected unauthenticated request (${res.status})`);
  });
});

describe('MCP OAuth Proxy - Full OAuth Flow', () => {
  let mcpBaseUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(MOCK_GITLAB_PORT_BASE + 100);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_GITLAB_TOKEN],
    });
    registerMockGitLabOAuthEndpoints(mockGitLab);
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();

    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE + 100);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 8000,
      env: {
        STREAMABLE_HTTP: 'true',
        GITLAB_MCP_OAUTH: 'true',
        GITLAB_API_URL: mockGitLabUrl,
        GITLAB_OAUTH_APP_ID: MOCK_OAUTH_APP_ID,
        GITLAB_OAUTH_APP_SECRET: MOCK_OAUTH_APP_SECRET,
        MCP_SERVER_URL: `http://${HOST}:${mcpPort}`,
        MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: 'true',
        GITLAB_READ_ONLY_MODE: 'true',
      },
    });
    servers.push(server);
    mcpBaseUrl = `http://${HOST}:${mcpPort}`;

    console.log(`  Mock GitLab: ${mockGitLabUrl}`);
    console.log(`  MCP Server:  ${mcpBaseUrl}`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('should complete full OAuth flow: register -> authorize -> callback -> token -> use', async () => {
    // 1. Dynamic Client Registration
    const registerRes = await fetch(`${mcpBaseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        redirect_uris: ['http://127.0.0.1:19999/callback'],
        client_name: 'e2e-test-client',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
    });
    assert.strictEqual(registerRes.status, 201, `DCR failed: ${registerRes.status}`);
    const clientInfo = (await registerRes.json()) as { client_id: string };
    console.log(`  Step 1/5: DCR OK, client_id=${clientInfo.client_id}`);

    // 2. Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const mcpState = randomUUID();

    // 3. Authorization request -> should redirect to GitLab
    const authUrl = new URL(`${mcpBaseUrl}/authorize`);
    authUrl.searchParams.set('client_id', clientInfo.client_id);
    authUrl.searchParams.set('redirect_uri', 'http://127.0.0.1:19999/callback');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', mcpState);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('scope', 'api read_api read_user');

    const authRes = await fetchNoRedirect(authUrl.toString());
    assert.ok(
      authRes.status === 302 || authRes.status === 303,
      `Expected redirect from /authorize, got ${authRes.status}`
    );

    const gitlabRedirectUrl = authRes.headers.get('location');
    assert.ok(gitlabRedirectUrl, 'Should have Location header');

    const gitlabUrl = new URL(gitlabRedirectUrl);
    assert.ok(
      gitlabUrl.pathname === '/oauth/authorize',
      `GitLab redirect should point to /oauth/authorize, got ${gitlabUrl.pathname}`
    );
    assert.strictEqual(gitlabUrl.searchParams.get('client_id'), MOCK_OAUTH_APP_ID);
    const gitlabState = gitlabUrl.searchParams.get('state');
    assert.ok(gitlabState, 'GitLab redirect should have state');

    console.log('  Step 2/5: Authorization redirect to GitLab OK');

    // 4. Simulate GitLab redirecting back to MCP server callback
    //    In real flow, GitLab would redirect after user approves.
    //    We simulate by calling the callback directly with a mock code.
    const mockGitLabCode = 'mock-authorization-code-' + randomUUID();

    // Register a token exchange handler on mock GitLab that will accept this code
    registerTokenExchangeHandler(mockGitLab, mockGitLabCode);

    const callbackUrl = `${mcpBaseUrl}/gitlab/callback?code=${encodeURIComponent(mockGitLabCode)}&state=${encodeURIComponent(gitlabState!)}`;
    const callbackRes = await fetchNoRedirect(callbackUrl);

    assert.ok(
      callbackRes.status === 302 || callbackRes.status === 303,
      `Expected redirect from /gitlab/callback, got ${callbackRes.status}`
    );

    const clientRedirectUrl = callbackRes.headers.get('location');
    assert.ok(clientRedirectUrl, 'Callback should redirect to client redirect_uri');

    const clientRedirect = new URL(clientRedirectUrl);
    const mcpCode = clientRedirect.searchParams.get('code');
    const returnedState = clientRedirect.searchParams.get('state');
    assert.ok(mcpCode, 'Client redirect should have code');
    assert.strictEqual(returnedState, mcpState, 'State should match original');

    console.log('  Step 3/5: GitLab callback -> client redirect OK');

    // 5. Exchange MCP authorization code for tokens
    const tokenRes = await fetch(`${mcpBaseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: mcpCode!,
        client_id: clientInfo.client_id,
        redirect_uri: 'http://127.0.0.1:19999/callback',
        code_verifier: codeVerifier,
      }).toString(),
    });

    assert.strictEqual(tokenRes.status, 200, `Token exchange failed: ${tokenRes.status} ${await tokenRes.clone().text()}`);
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      token_type: string;
      expires_in?: number;
      refresh_token?: string;
    };
    assert.ok(tokens.access_token, 'Should have access_token');
    assert.ok(tokens.access_token.startsWith('mcp-at-'), 'MCP access token should have mcp-at- prefix');
    assert.strictEqual(tokens.token_type, 'Bearer');

    console.log('  Step 4/5: Token exchange OK');

    // 6. Use the MCP access token to call /mcp
    //    StreamableHTTP requires Accept: application/json, text/event-stream
    const mcpRes = await fetch(`${mcpBaseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${tokens.access_token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'e2e-test', version: '1.0.0' },
        },
      }),
    });

    assert.strictEqual(mcpRes.status, 200, `MCP request failed: ${mcpRes.status}`);
    const mcpBody = await parseMcpResponse(mcpRes);
    assert.ok(mcpBody.result || mcpBody.jsonrpc, 'Should receive valid JSON-RPC response');

    console.log('  Step 5/5: Authenticated MCP request OK');
    console.log('  FULL OAuth flow completed successfully');
  });
});

describe('MCP OAuth Proxy - Token Refresh', () => {
  let mcpBaseUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];

  before(async () => {
    const mockPort = await findMockServerPort(MOCK_GITLAB_PORT_BASE + 200);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_GITLAB_TOKEN],
    });
    registerMockGitLabOAuthEndpoints(mockGitLab);
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE + 200);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 8000,
      env: {
        STREAMABLE_HTTP: 'true',
        GITLAB_MCP_OAUTH: 'true',
        GITLAB_API_URL: mockGitLabUrl,
        GITLAB_OAUTH_APP_ID: MOCK_OAUTH_APP_ID,
        GITLAB_OAUTH_APP_SECRET: MOCK_OAUTH_APP_SECRET,
        MCP_SERVER_URL: `http://${HOST}:${mcpPort}`,
        MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: 'true',
        GITLAB_READ_ONLY_MODE: 'true',
      },
    });
    servers.push(server);
    mcpBaseUrl = `http://${HOST}:${mcpPort}`;
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('should refresh tokens using refresh_token grant', async () => {
    // First complete the full OAuth flow to get tokens
    const { accessToken, refreshToken, clientId } = await performFullOAuthFlow(
      mcpBaseUrl,
      mockGitLab
    );
    assert.ok(refreshToken, 'Should have refresh token');

    console.log('  OAuth flow completed, testing refresh...');

    // Now use the refresh token to get new tokens
    const refreshRes = await fetch(`${mcpBaseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken!,
        client_id: clientId,
      }).toString(),
    });

    assert.strictEqual(refreshRes.status, 200, `Token refresh failed: ${refreshRes.status}`);
    const newTokens = (await refreshRes.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type: string;
    };
    assert.ok(newTokens.access_token, 'Should have new access_token');
    assert.notStrictEqual(newTokens.access_token, accessToken, 'New access token should differ');

    console.log('  OK: Token refresh succeeded');

    // Verify the new token works
    const mcpRes = await fetch(`${mcpBaseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${newTokens.access_token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'refresh-test', version: '1.0.0' },
        },
      }),
    });

    assert.strictEqual(mcpRes.status, 200, `MCP request with refreshed token failed: ${mcpRes.status}`);
    console.log('  OK: Refreshed token works for MCP requests');
  });
});

/** Tracks authorization codes the mock GitLab will accept. */
const validGitLabCodes = new Set<string>();
/** The last refresh token the mock GitLab issued (used for validation). */
let lastIssuedRefreshToken: string = MOCK_GITLAB_REFRESH_TOKEN;

function registerMockGitLabOAuthEndpoints(mockGitLab: MockGitLabServer): void {
  // GET /oauth/authorize - would normally render login page; we just return 200
  // (In real tests, the MCP server redirects to this; we never actually hit it
  //  because we simulate the callback directly.)
  mockGitLab.addRootHandler('get', '/oauth/authorize', (_req, res) => {
    res.status(200).json({ message: 'Mock GitLab authorize endpoint' });
  });

  // POST /oauth/token - token exchange/refresh endpoint
  mockGitLab.addRootHandler('post', '/oauth/token', (req, res) => {
    // Parse body (express.json() should handle this)
    const grantType = req.body?.grant_type;

    if (grantType === 'authorization_code') {
      const code = req.body?.code;
      if (!code || !validGitLabCodes.has(code)) {
        res.status(400).json({
          error: 'invalid_grant',
          error_description: `Unknown or already-used authorization code: ${code}`,
        });
        return;
      }
      // Consume the code (one-time use)
      validGitLabCodes.delete(code);

      const refreshToken = 'mock-refresh-token-' + randomUUID().slice(0, 8);
      lastIssuedRefreshToken = refreshToken;

      res.status(200).json({
        access_token: MOCK_GITLAB_TOKEN,
        token_type: 'bearer',
        expires_in: 7200,
        refresh_token: refreshToken,
        scope: 'api read_api read_user',
        created_at: Math.floor(Date.now() / 1000),
      });
    } else if (grantType === 'refresh_token') {
      const rt = req.body?.refresh_token;
      if (!rt || rt !== lastIssuedRefreshToken) {
        res.status(400).json({
          error: 'invalid_grant',
          error_description: `Unknown refresh token: ${rt}`,
        });
        return;
      }

      // Issue a new refresh token and track it
      const newRefreshToken = 'mock-new-refresh-token-' + randomUUID().slice(0, 8);
      lastIssuedRefreshToken = newRefreshToken;

      res.status(200).json({
        access_token: MOCK_GITLAB_TOKEN,
        token_type: 'bearer',
        expires_in: 7200,
        refresh_token: newRefreshToken,
        scope: 'api read_api read_user',
        created_at: Math.floor(Date.now() / 1000),
      });
    } else {
      res.status(400).json({ error: 'unsupported_grant_type' });
    }
  });

  // GET /oauth/token/info - token info endpoint for verification
  mockGitLab.addRootHandler('get', '/oauth/token/info', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.includes(MOCK_GITLAB_TOKEN)) {
      res.status(200).json({
        resource_owner_id: 1,
        scope: ['api', 'read_api', 'read_user'],
        expires_in: 7200,
        application: { uid: MOCK_OAUTH_APP_ID },
        created_at: Math.floor(Date.now() / 1000),
      });
    } else {
      res.status(401).json({ error: 'invalid_token' });
    }
  });

  // POST /oauth/revoke - token revocation (just acknowledge)
  mockGitLab.addRootHandler('post', '/oauth/revoke', (_req, res) => {
    res.status(200).json({});
  });
}

/**
 * Register a one-time token exchange handler that accepts a specific code.
 * This simulates GitLab accepting the authorization code.
 */
function registerTokenExchangeHandler(_mockGitLab: MockGitLabServer, expectedCode: string): void {
  validGitLabCodes.add(expectedCode);
}

/**
 * Perform the full OAuth flow and return tokens + client_id.
 * Reusable helper for tests that need an authenticated session.
 */
async function performFullOAuthFlow(
  mcpBaseUrl: string,
  mockGitLab: MockGitLabServer
): Promise<{ accessToken: string; refreshToken?: string; clientId: string }> {
  // 1. Register
  const registerRes = await fetch(`${mcpBaseUrl}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      redirect_uris: ['http://127.0.0.1:19998/callback'],
      client_name: 'helper-flow-client',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  const clientInfo = (await registerRes.json()) as { client_id: string };

  // 2. PKCE
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const mcpState = randomUUID();

  // 3. Authorize
  const authUrl = new URL(`${mcpBaseUrl}/authorize`);
  authUrl.searchParams.set('client_id', clientInfo.client_id);
  authUrl.searchParams.set('redirect_uri', 'http://127.0.0.1:19998/callback');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', mcpState);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const authRes = await fetchNoRedirect(authUrl.toString());
  const gitlabRedirectUrl = authRes.headers.get('location')!;
  const gitlabState = new URL(gitlabRedirectUrl).searchParams.get('state')!;

  // 4. Callback
  const mockCode = 'helper-code-' + randomUUID();
  registerTokenExchangeHandler(mockGitLab, mockCode);
  const callbackUrl = `${mcpBaseUrl}/gitlab/callback?code=${encodeURIComponent(mockCode)}&state=${encodeURIComponent(gitlabState)}`;
  const callbackRes = await fetchNoRedirect(callbackUrl);
  const clientRedirectUrl = callbackRes.headers.get('location')!;
  const mcpCode = new URL(clientRedirectUrl).searchParams.get('code')!;

  // 5. Token exchange
  const tokenRes = await fetch(`${mcpBaseUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: mcpCode,
      client_id: clientInfo.client_id,
      redirect_uri: 'http://127.0.0.1:19998/callback',
      code_verifier: codeVerifier,
    }).toString(),
  });
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
  };

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    clientId: clientInfo.client_id,
  };
}
