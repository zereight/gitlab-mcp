/**
 * Regression tests for OAuth endpoint rate limiting behind trusted proxies.
 */

import { describe, test, after, before } from "node:test";
import assert from "node:assert";
import {
  launchServer,
  findAvailablePort,
  cleanupServers,
  ServerInstance,
  TransportMode,
  HOST,
} from "./utils/server-launcher.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_GITLAB_PORT_BASE = 9210;
const MCP_SERVER_PORT_BASE = 3210;
const MOCK_CLIENT_ID = "mock-app-uid-from-dcr";

function addOAuthEndpoints(mockGitLab: MockGitLabServer, baseUrl: string): void {
  mockGitLab.addRootHandler("post", "/oauth/register", (req, res) => {
    res.status(201).json({
      client_id: MOCK_CLIENT_ID,
      client_name: req.body?.client_name ?? "test",
      redirect_uris: req.body?.redirect_uris ?? [],
      token_endpoint_auth_method: "none",
      require_pkce: true,
    });
  });

  mockGitLab.addRootHandler("get", "/.well-known/oauth-authorization-server", (_req, res) => {
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      revocation_endpoint: `${baseUrl}/oauth/revoke`,
      scopes_supported: ["api", "read_api", "read_user"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
    });
  });
}

describe("When MCP OAuth runs behind a trusted proxy", () => {
  describe("with X-Forwarded-For containing client ports", () => {
    let mcpBaseUrl: string;
    let mockGitLab: MockGitLabServer;
    let servers: ServerInstance[] = [];

    before(async () => {
      const mockPort = await findMockServerPort();
      mockGitLab = new MockGitLabServer({ port: mockPort, validTokens: [] });
      await mockGitLab.start();

      const mockGitLabUrl = mockGitLab.getUrl();
      addOAuthEndpoints(mockGitLab, mockGitLabUrl);

      const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE);
      mcpBaseUrl = `http://${HOST}:${mcpPort}`;

      const server = await launchServer({
        mode: TransportMode.STREAMABLE_HTTP,
        port: mcpPort,
        timeout: 5000,
        env: {
          STREAMABLE_HTTP: "true",
          GITLAB_MCP_OAUTH: "true",
          MCP_TRUST_PROXY: "true",
          GITLAB_OAUTH_APP_ID: "test-oauth-app-id",
          GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
          MCP_SERVER_URL: mcpBaseUrl,
          MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: "true",
        },
      });
      servers.push(server);
    });

    after(async () => {
      cleanupServers(servers);
      if (mockGitLab) {
        await mockGitLab.stop();
      }
    });

    test("should not return 500 from /register", async () => {
      const res = await fetch(`${mcpBaseUrl}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "160.79.106.36:38914",
        },
        body: JSON.stringify({
          redirect_uris: ["https://client.example/callback"],
          client_name: "proxy-rate-limit-test",
        }),
      });

      assert.notEqual(res.status, 500, "rate-limit key generation should not crash /register");
      assert.strictEqual(res.status, 201, "DCR should succeed behind forwarded IPv4:port");
    });

    test("should not return 500 from /authorize", async () => {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: MOCK_CLIENT_ID,
        redirect_uri: "https://client.example/callback",
        code_challenge: "challenge",
        code_challenge_method: "S256",
        state: "proxy-rate-limit-state",
        scope: "api",
      });

      const res = await fetch(`${mcpBaseUrl}/authorize?${params}`, {
        redirect: "manual",
        headers: {
          "X-Forwarded-For": "[2001:db8::1]:5678",
        },
      });

      assert.notEqual(res.status, 500, "rate-limit key generation should not crash /authorize");
    });

    test("should not return 500 from /token", async () => {
      const res = await fetch(`${mcpBaseUrl}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Forwarded-For": "160.79.106.36:38914",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: MOCK_CLIENT_ID,
          code: "invalid-code",
          redirect_uri: "https://client.example/callback",
        }),
      });

      assert.notEqual(res.status, 500, "rate-limit key generation should not crash /token");
    });

    test("should not return 500 from /revoke", async () => {
      const res = await fetch(`${mcpBaseUrl}/revoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Forwarded-For": "[2001:db8::1]",
        },
        body: new URLSearchParams({
          token: "invalid-token",
        }),
      });

      assert.notEqual(res.status, 500, "rate-limit key generation should not crash /revoke");
    });
  });
});
