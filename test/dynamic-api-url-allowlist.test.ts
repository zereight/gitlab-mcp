import { after, before, describe, test } from "node:test";
import assert from "node:assert";
import { createServer, Server } from "node:http";
import {
  cleanupServers,
  findAvailablePort,
  HOST,
  launchServer,
  ServerInstance,
  TransportMode,
} from "./utils/server-launcher.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import { CustomHeaderClient } from "./clients/custom-header-client.js";

const MOCK_TOKEN = `glpat-${"dynamic-url-token"}`;

async function startAttackerServer(
  port: number
): Promise<{ server: Server; getHits: () => number }> {
  let hits = 0;
  const server = createServer((_req, res) => {
    hits++;
    res.writeHead(200, { "content-type": "application/json" });
    res.end("[]");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return { server, getHits: () => hits };
}

describe("Dynamic API URL allowlist", () => {
  let primaryGitLab: MockGitLabServer;
  let secondaryGitLab: MockGitLabServer;
  let attackerServer: Server | undefined;
  let mcpServer: ServerInstance | undefined;
  let mcpUrl: string;
  let secondaryHit = false;
  let getAttackerHits = () => 0;

  before(async () => {
    const primaryPort = await findMockServerPort(9100);
    primaryGitLab = new MockGitLabServer({ port: primaryPort, validTokens: [MOCK_TOKEN] });
    await primaryGitLab.start();

    const secondaryPort = await findMockServerPort(9200);
    secondaryGitLab = new MockGitLabServer({ port: secondaryPort, validTokens: [MOCK_TOKEN] });
    secondaryGitLab.addMockHandler("get", "/projects/1/issues", (_req, res) => {
      secondaryHit = true;
      res.json([]);
    });
    await secondaryGitLab.start();

    const attackerPort = await findAvailablePort(9300);
    const attacker = await startAttackerServer(attackerPort);
    attackerServer = attacker.server;
    getAttackerHits = attacker.getHits;

    const mcpPort = await findAvailablePort(3100);
    mcpServer = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: "true",
        REMOTE_AUTHORIZATION: "true",
        ENABLE_DYNAMIC_API_URL: "true",
        GITLAB_API_URL: `${primaryGitLab.getUrl()}/api/v4`,
        GITLAB_ALLOWED_HOSTS: `${secondaryGitLab.getUrl()}/api/v4`,
      },
    });
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
  });

  after(async () => {
    if (mcpServer) cleanupServers([mcpServer]);
    await primaryGitLab?.stop();
    await secondaryGitLab?.stop();
    const server = attackerServer;
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  });

  test("allows dynamic API URLs on configured hosts", async () => {
    const client = new CustomHeaderClient({
      authorization: `Bearer ${MOCK_TOKEN}`,
      "x-gitlab-api-url": `${secondaryGitLab.getUrl()}/api/v4`,
    });

    await client.connect(mcpUrl);
    await client.callTool("list_issues", { project_id: "1" });
    await client.disconnect();

    assert.strictEqual(secondaryHit, true, "allowed dynamic host should receive GitLab calls");
  });

  test("rejects dynamic API URLs on unconfigured hosts before forwarding tokens", async () => {
    const server = attackerServer;
    assert.ok(server, "attacker server should be running");
    const attackerUrl = `http://${HOST}:${(server.address() as { port: number }).port}/api/v4`;
    const client = new CustomHeaderClient({
      authorization: `Bearer ${MOCK_TOKEN}`,
      "x-gitlab-api-url": attackerUrl,
    });

    let connected = false;
    try {
      await client.connect(mcpUrl);
      connected = true;
      await client.callTool("list_issues", { project_id: "1" });
    } catch {
      // Expected: the session is rejected before any GitLab API request is made.
    } finally {
      await client.disconnect();
    }

    assert.strictEqual(connected, false, "untrusted dynamic host should not initialize a session");
    assert.strictEqual(
      getAttackerHits(),
      0,
      "token-bearing requests must not reach untrusted hosts"
    );
  });
});
