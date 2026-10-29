/**
 * GITLAB_OAUTH_ALLOWED_GROUPS enforcement beyond the authorization-code exchange.
 *
 * Covers:
 *   - verifyAccessToken (every OAuth-authenticated /mcp request)
 *   - exchangeRefreshToken
 *   - the per-token membership cache
 *   - Private-Token / JOB-TOKEN header auth and sealed stateless session ids
 *     on a launched server
 */

import { describe, test, after, before } from "node:test";
import assert from "node:assert";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  launchServer,
  findAvailablePort,
  cleanupServers,
  ServerInstance,
  TransportMode,
  HOST,
} from "./utils/server-launcher.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import { loadKeyMaterialFromEnv, mintSessionId } from "../stateless/index.js";

const MEMBER_TOKEN = "member-oauth-token-0123456789abcdef";
const NON_MEMBER_TOKEN = "nonmember-oauth-token-0123456789abcdef";
const MEMBER_PAT = "glpat-member-pat-0123456789abcdef";
const NON_MEMBER_PAT = "glpat-nonmember-pat-0123456789abcdef";
const JOB_TOKEN = "jobtoken-allowed-groups-0123456789";
const REFRESHED_MEMBER_TOKEN = "refreshed-member-token-0123456789";
const REFRESHED_NON_MEMBER_TOKEN = "refreshed-nonmember-token-0123456789";

const MEMBER_TOKENS = new Set([MEMBER_TOKEN, MEMBER_PAT, REFRESHED_MEMBER_TOKEN]);
const PAT_TOKENS = new Set([MEMBER_PAT, NON_MEMBER_PAT]);
const ALL_TOKENS = [
  MEMBER_TOKEN,
  NON_MEMBER_TOKEN,
  MEMBER_PAT,
  NON_MEMBER_PAT,
  JOB_TOKEN,
  REFRESHED_MEMBER_TOKEN,
  REFRESHED_NON_MEMBER_TOKEN,
];

/** Groups GitLab reports for a token: members sit in a subgroup, others in a look-alike path. */
function groupsFor(token: string): Array<{ full_path: string }> {
  return MEMBER_TOKENS.has(token) ? [{ full_path: "my-org/team-a" }] : [{ full_path: "my-org2" }];
}

function tokenInfoFor(token: string) {
  const isPat = PAT_TOKENS.has(token);
  return {
    resource_owner_id: MEMBER_TOKENS.has(token) ? 1 : 2,
    scopes: ["api"],
    expires_in_seconds: isPat ? null : 7200,
    application: isPat ? null : { uid: "some-other-oauth-app" },
    created_at: Math.floor(Date.now() / 1000),
  };
}

const initBody = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "allowed-groups-test", version: "1.0.0" },
  },
});

const listToolsBody = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

async function postMcp(url: string, headers: Record<string, string>, body = initBody) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body,
  });
  const text = await res.text();
  return {
    status: res.status,
    sid: res.headers.get("mcp-session-id"),
    wwwAuthenticate: res.headers.get("www-authenticate"),
    text,
  };
}

// ---------------------------------------------------------------------------
// Provider-level tests
// ---------------------------------------------------------------------------

describe("Allowed groups — OAuth provider", () => {
  let stubServer: Server;
  let stubUrl: string;
  let groupsCalls: string[] = [];
  let groupsStatus = 200;

  before(async () => {
    const { createServer } = await import("node:http");
    stubServer = createServer((req, res) => {
      const url = new URL(req.url!, "http://127.0.0.1");
      const bearer = (req.headers["authorization"] ?? "").replace(/^Bearer\s+/i, "");
      res.setHeader("Content-Type", "application/json");

      if (req.method === "GET" && url.pathname === "/oauth/token/info") {
        if (!ALL_TOKENS.includes(bearer)) {
          res.writeHead(401).end(JSON.stringify({ error: "invalid_token" }));
          return;
        }
        res.writeHead(200).end(JSON.stringify(tokenInfoFor(bearer)));
        return;
      }

      if (req.method === "POST" && url.pathname === "/oauth/token") {
        let raw = "";
        req.on("data", chunk => (raw += chunk));
        req.on("end", () => {
          const params = new URLSearchParams(raw);
          const grantType = params.get("grant_type");
          let accessToken: string | null = null;
          if (grantType === "authorization_code") {
            accessToken = params.get("code") === "member-code" ? MEMBER_TOKEN : NON_MEMBER_TOKEN;
          } else if (grantType === "refresh_token") {
            const refreshToken = params.get("refresh_token");
            if (refreshToken === "member-refresh") accessToken = REFRESHED_MEMBER_TOKEN;
            if (refreshToken === "nonmember-refresh") accessToken = REFRESHED_NON_MEMBER_TOKEN;
          }
          if (!accessToken) {
            res.writeHead(400).end(JSON.stringify({ error: "invalid_grant" }));
            return;
          }
          res.writeHead(200).end(
            JSON.stringify({
              access_token: accessToken,
              token_type: "bearer",
              expires_in: 7200,
              refresh_token: "rotated-refresh",
              scope: "api",
            })
          );
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/v4/groups") {
        groupsCalls.push(bearer);
        if (groupsStatus !== 200) {
          res.writeHead(groupsStatus).end(JSON.stringify({ message: "unavailable" }));
          return;
        }
        res.writeHead(200, { "x-total-pages": "1" }).end(JSON.stringify(groupsFor(bearer)));
        return;
      }

      res.writeHead(404).end("{}");
    });

    await new Promise<void>(resolve => stubServer.listen(0, "127.0.0.1", resolve));
    const addr = stubServer.address() as { port: number };
    stubUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(() => {
    stubServer.close();
  });

  async function makeProvider(allowedGroups: string[] | null = ["my-org"]) {
    groupsCalls = [];
    groupsStatus = 200;
    const { createGitLabOAuthProvider } = await import("../oauth-proxy.js");
    return createGitLabOAuthProvider(
      stubUrl,
      "test-app-id",
      "GitLab MCP Server",
      false,
      undefined,
      allowedGroups ?? undefined
    );
  }

  const client = {} as OAuthClientInformationFull;

  function hasErrorCode(code: string) {
    return (err: unknown) => {
      assert.strictEqual(
        (err as { errorCode?: string }).errorCode,
        code,
        `unexpected error: ${String(err)}`
      );
      return true;
    };
  }

  test("verifyAccessToken rejects a valid token whose user is outside the allowed groups", async () => {
    const provider = await makeProvider();
    await assert.rejects(
      () => provider.verifyAccessToken(NON_MEMBER_TOKEN),
      hasErrorCode("insufficient_scope")
    );
    assert.deepStrictEqual(groupsCalls, [NON_MEMBER_TOKEN]);
  });

  test("verifyAccessToken accepts a token whose user is in an allowed group", async () => {
    const provider = await makeProvider();
    const info = await provider.verifyAccessToken(MEMBER_TOKEN);
    assert.strictEqual(info.token, MEMBER_TOKEN);
    assert.strictEqual(info.clientId, "some-other-oauth-app");
    assert.deepStrictEqual(groupsCalls, [MEMBER_TOKEN]);
  });

  test("verifyAccessToken reports unknown tokens as invalid_token without a groups lookup", async () => {
    const provider = await makeProvider();
    await assert.rejects(
      () => provider.verifyAccessToken("not-a-known-token-0123456789"),
      hasErrorCode("invalid_token")
    );
    assert.strictEqual(groupsCalls.length, 0);
  });

  test("verifyAccessToken applies the group check to personal access tokens", async () => {
    const provider = await makeProvider();
    const info = await provider.verifyAccessToken(MEMBER_PAT);
    assert.strictEqual(info.clientId, "dynamic");
    await assert.rejects(
      () => provider.verifyAccessToken(NON_MEMBER_PAT),
      hasErrorCode("insufficient_scope")
    );
  });

  test("exchangeRefreshToken returns no tokens for a user outside the allowed groups", async () => {
    const provider = await makeProvider();
    await assert.rejects(
      () => provider.exchangeRefreshToken(client, "nonmember-refresh"),
      hasErrorCode("invalid_grant")
    );
    assert.deepStrictEqual(groupsCalls, [REFRESHED_NON_MEMBER_TOKEN]);
  });

  test("exchangeAuthorizationCode returns no tokens for a user outside the allowed groups", async () => {
    const provider = await makeProvider();
    await assert.rejects(
      () => provider.exchangeAuthorizationCode(client, "nonmember-code"),
      hasErrorCode("invalid_grant")
    );
    assert.deepStrictEqual(groupsCalls, [NON_MEMBER_TOKEN]);
  });

  test("exchangeRefreshToken returns tokens for a member", async () => {
    const provider = await makeProvider();
    const tokens = await provider.exchangeRefreshToken(client, "member-refresh");
    assert.strictEqual(tokens.access_token, REFRESHED_MEMBER_TOKEN);
    assert.deepStrictEqual(groupsCalls, [REFRESHED_MEMBER_TOKEN]);
  });

  test("membership is cached: two verifyAccessToken calls make one groups lookup", async () => {
    const provider = await makeProvider();
    await provider.verifyAccessToken(MEMBER_TOKEN);
    await provider.verifyAccessToken(MEMBER_TOKEN);
    assert.strictEqual(groupsCalls.length, 1);
  });

  test("non-membership is cached as well", async () => {
    const provider = await makeProvider();
    await assert.rejects(() => provider.verifyAccessToken(NON_MEMBER_TOKEN));
    await assert.rejects(() => provider.verifyAccessToken(NON_MEMBER_TOKEN));
    assert.strictEqual(groupsCalls.length, 1);
  });

  test("different tokens are looked up separately", async () => {
    const provider = await makeProvider();
    await provider.verifyAccessToken(MEMBER_TOKEN);
    await provider.verifyAccessToken(MEMBER_PAT);
    assert.deepStrictEqual(groupsCalls, [MEMBER_TOKEN, MEMBER_PAT]);
  });

  test("cached membership expires after five minutes", async () => {
    const provider = await makeProvider();
    await provider.verifyAccessToken(MEMBER_TOKEN);

    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 4 * 60 * 1000;
      await provider.verifyAccessToken(MEMBER_TOKEN);
      assert.strictEqual(groupsCalls.length, 1, "still cached before the TTL");

      Date.now = () => realNow() + 5 * 60 * 1000 + 1000;
      await provider.verifyAccessToken(MEMBER_TOKEN);
      assert.strictEqual(groupsCalls.length, 2, "looked up again after the TTL");
    } finally {
      Date.now = realNow;
    }
  });

  test("cache keys are SHA-256 digests, not raw tokens", async () => {
    const provider = await makeProvider();
    await provider.verifyAccessToken(MEMBER_TOKEN);
    const cache = (provider as unknown as { _groupMembershipCache: { _map: Map<string, unknown> } })
      ._groupMembershipCache;
    const keys = [...cache._map.keys()];
    assert.strictEqual(keys.length, 1);
    assert.match(keys[0], /^[0-9a-f]{64}$/);
    assert.ok(!keys[0].includes(MEMBER_TOKEN));
  });

  test("a failed groups lookup (5xx) is not cached", async () => {
    const provider = await makeProvider();
    groupsStatus = 503;
    await assert.rejects(
      () => provider.verifyAccessToken(MEMBER_TOKEN),
      hasErrorCode("server_error")
    );
    groupsStatus = 200;
    const info = await provider.verifyAccessToken(MEMBER_TOKEN);
    assert.strictEqual(info.token, MEMBER_TOKEN);
    assert.strictEqual(groupsCalls.length, 2);
  });

  test("authorization-code exchange result is reused by the next verifyAccessToken", async () => {
    const provider = await makeProvider();
    const tokens = await provider.exchangeAuthorizationCode(client, "member-code");
    await provider.verifyAccessToken(tokens.access_token);
    assert.deepStrictEqual(groupsCalls, [MEMBER_TOKEN]);
  });

  test("no allowed groups: no groups lookups and tokens are accepted as before", async () => {
    const provider = await makeProvider(null);
    const info = await provider.verifyAccessToken(NON_MEMBER_TOKEN);
    assert.strictEqual(info.token, NON_MEMBER_TOKEN);
    const tokens = await provider.exchangeRefreshToken(client, "nonmember-refresh");
    assert.strictEqual(tokens.access_token, REFRESHED_NON_MEMBER_TOKEN);
    assert.strictEqual(groupsCalls.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Server-level tests
// ---------------------------------------------------------------------------

async function startMockGitLab(groupsCalls: string[]) {
  const mockGitLab = new MockGitLabServer({
    port: await findMockServerPort(),
    validTokens: ALL_TOKENS,
  });
  await mockGitLab.start();
  const baseUrl = mockGitLab.getUrl();

  mockGitLab.addRootHandler("get", "/oauth/token/info", (req, res) => {
    const token = (req.headers["authorization"] ?? "").replace(/^Bearer\s+/i, "");
    if (token !== MEMBER_TOKEN && token !== NON_MEMBER_TOKEN) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }
    res.json(tokenInfoFor(token));
  });
  mockGitLab.addRootHandler("get", "/.well-known/oauth-authorization-server", (_req, res) => {
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      response_types_supported: ["code"],
      code_challenge_methods_supported: ["S256"],
    });
  });
  mockGitLab.addMockHandler("get", "/groups", (req, res) => {
    const token = (req as typeof req & { gitlabToken?: string }).gitlabToken ?? "";
    groupsCalls.push(token);
    res.setHeader("x-total-pages", "1");
    res.json(groupsFor(token));
  });
  // CI job tokens can read their own job but not list the user's groups.
  mockGitLab.addMockHandler("get", "/job", (_req, res) => {
    res.json({ id: 1, pipeline: { id: 1, project_id: 1 } });
  });

  return mockGitLab;
}

function oauthServerEnv(mockGitLabUrl: string, mcpBaseUrl: string, extra: Record<string, string>) {
  return {
    STREAMABLE_HTTP: "true",
    GITLAB_MCP_OAUTH: "true",
    GITLAB_OAUTH_APP_ID: "test-oauth-app-id",
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    MCP_SERVER_URL: mcpBaseUrl,
    MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: "true",
    ...extra,
  };
}

describe("Allowed groups — /mcp request authentication", () => {
  const groupsCalls: string[] = [];
  const servers: ServerInstance[] = [];
  let mockGitLab: MockGitLabServer;
  let mcpUrl: string;

  before(async () => {
    mockGitLab = await startMockGitLab(groupsCalls);
    const port = await findAvailablePort(4600);
    const mcpBaseUrl = `http://${HOST}:${port}`;
    mcpUrl = `${mcpBaseUrl}/mcp`;
    servers.push(
      await launchServer({
        mode: TransportMode.STREAMABLE_HTTP,
        port,
        timeout: 5000,
        env: oauthServerEnv(mockGitLab.getUrl(), mcpBaseUrl, {
          GITLAB_OAUTH_ALLOWED_GROUPS: "my-org",
        }),
      })
    );
  });

  after(async () => {
    cleanupServers(servers);
    await mockGitLab?.stop();
  });

  test("Private-Token of a user outside the allowed groups is rejected with 403", async () => {
    const res = await postMcp(mcpUrl, { "Private-Token": NON_MEMBER_PAT });
    assert.strictEqual(res.status, 403, res.text);
    assert.strictEqual(res.sid, null);
    assert.match(res.text, /allowed group/i);
  });

  test("Private-Token of a member is accepted", async () => {
    const res = await postMcp(mcpUrl, { "Private-Token": MEMBER_PAT });
    assert.strictEqual(res.status, 200, res.text);
    assert.ok(res.sid, "session id issued");

    const followUp = await postMcp(
      mcpUrl,
      { "Private-Token": MEMBER_PAT, "Mcp-Session-Id": res.sid! },
      listToolsBody
    );
    assert.strictEqual(followUp.status, 200, followUp.text);
  });

  test("invalid Private-Token is still rejected with 401", async () => {
    const res = await postMcp(mcpUrl, { "Private-Token": "glpat-unknown-token-0123456789" });
    assert.strictEqual(res.status, 401, res.text);
    assert.strictEqual(res.sid, null);
  });

  test("JOB-TOKEN is rejected with 403 when allowed groups are configured", async () => {
    const res = await postMcp(mcpUrl, { "JOB-TOKEN": JOB_TOKEN });
    assert.strictEqual(res.status, 403, res.text);
    assert.strictEqual(res.sid, null);
    assert.match(res.text, /JOB-TOKEN/);
  });

  test("OAuth Bearer token of a user outside the allowed groups is rejected with 403", async () => {
    const res = await postMcp(mcpUrl, { Authorization: `Bearer ${NON_MEMBER_TOKEN}` });
    assert.strictEqual(res.status, 403, res.text);
    assert.strictEqual(res.sid, null);
    assert.match(res.wwwAuthenticate ?? "", /insufficient_scope/);
  });

  test("OAuth Bearer token of a member is accepted", async () => {
    const res = await postMcp(mcpUrl, { Authorization: `Bearer ${MEMBER_TOKEN}` });
    assert.strictEqual(res.status, 200, res.text);
    assert.ok(res.sid, "session id issued");
  });
});

describe("Allowed groups — sealed stateless session ids", () => {
  const groupsCalls: string[] = [];
  const servers: ServerInstance[] = [];
  const secret = randomBytes(32).toString("base64url");
  let mockGitLab: MockGitLabServer;
  let mcpUrl: string;

  before(async () => {
    mockGitLab = await startMockGitLab(groupsCalls);
    const port = await findAvailablePort(4650);
    const mcpBaseUrl = `http://${HOST}:${port}`;
    mcpUrl = `${mcpBaseUrl}/mcp`;
    servers.push(
      await launchServer({
        mode: TransportMode.STREAMABLE_HTTP,
        port,
        timeout: 5000,
        env: oauthServerEnv(mockGitLab.getUrl(), mcpBaseUrl, {
          GITLAB_OAUTH_ALLOWED_GROUPS: "my-org",
          OAUTH_STATELESS_MODE: "true",
          OAUTH_STATELESS_SECRET: secret,
        }),
      })
    );
  });

  after(async () => {
    cleanupServers(servers);
    await mockGitLab?.stop();
  });

  function sealedSid(header: "Authorization" | "Private-Token" | "JOB-TOKEN", token: string) {
    const material = loadKeyMaterialFromEnv(true, {
      OAUTH_STATELESS_SECRET: secret,
    } as NodeJS.ProcessEnv)!;
    return mintSessionId(material, {
      header,
      token,
      apiUrl: `${mockGitLab.getUrl()}/api/v4`,
    });
  }

  test("sid-only request whose sealed token belongs to a non-member is rejected with 403", async () => {
    const res = await postMcp(
      mcpUrl,
      { "Mcp-Session-Id": sealedSid("Private-Token", NON_MEMBER_PAT) },
      listToolsBody
    );
    assert.strictEqual(res.status, 403, res.text);
  });

  test("sid-only request whose sealed token is a JOB-TOKEN is rejected with 403", async () => {
    const res = await postMcp(
      mcpUrl,
      { "Mcp-Session-Id": sealedSid("JOB-TOKEN", JOB_TOKEN) },
      listToolsBody
    );
    assert.strictEqual(res.status, 403, res.text);
  });

  test("sid-only request whose sealed token belongs to a member is accepted", async () => {
    const res = await postMcp(
      mcpUrl,
      { "Mcp-Session-Id": sealedSid("Authorization", MEMBER_TOKEN) },
      listToolsBody
    );
    assert.strictEqual(res.status, 200, res.text);
  });
});

describe("Allowed groups — not configured", () => {
  const groupsCalls: string[] = [];
  const servers: ServerInstance[] = [];
  let mockGitLab: MockGitLabServer;
  let mcpUrl: string;

  before(async () => {
    mockGitLab = await startMockGitLab(groupsCalls);
    const port = await findAvailablePort(4700);
    const mcpBaseUrl = `http://${HOST}:${port}`;
    mcpUrl = `${mcpBaseUrl}/mcp`;
    servers.push(
      await launchServer({
        mode: TransportMode.STREAMABLE_HTTP,
        port,
        timeout: 5000,
        env: oauthServerEnv(mockGitLab.getUrl(), mcpBaseUrl, {}),
      })
    );
  });

  after(async () => {
    cleanupServers(servers);
    await mockGitLab?.stop();
  });

  test("Private-Token, JOB-TOKEN and Bearer tokens are accepted without groups lookups", async () => {
    const headerSets: Array<Record<string, string>> = [
      { "Private-Token": NON_MEMBER_PAT },
      { "JOB-TOKEN": JOB_TOKEN },
      { Authorization: `Bearer ${NON_MEMBER_TOKEN}` },
    ];
    for (const headers of headerSets) {
      const res = await postMcp(mcpUrl, headers);
      assert.strictEqual(res.status, 200, `${Object.keys(headers)[0]}: ${res.text}`);
    }
    assert.strictEqual(groupsCalls.length, 0);
  });
});
