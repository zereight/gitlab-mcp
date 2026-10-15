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

const MOCK_TOKEN = "glpat-dynamic-url-token";
const NAMESPACE_TOOLS = "list_namespaces,get_namespace,verify_namespace";

const mockNamespace = {
  id: 7,
  name: "Team",
  path: "team",
  kind: "group",
  full_path: "team",
  parent_id: null,
  avatar_url: null,
  web_url: "https://gitlab.mock/groups/team",
};

function addNamespaceHandlers(gitlab: MockGitLabServer, hits: string[]): void {
  gitlab.addMockHandler("get", "/namespaces", (req, res) => {
    hits.push(req.path);
    res.json([mockNamespace]);
  });
  gitlab.addMockHandler("get", "/namespaces/team", (req, res) => {
    hits.push(req.path);
    res.json(mockNamespace);
  });
  gitlab.addMockHandler("get", "/namespaces/team/exists", (req, res) => {
    hits.push(req.path);
    res.json({ exists: true });
  });
}

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
  let mcpPort: number;
  let mcpUrl: string;
  let secondaryHit = false;
  const primaryNamespaceHits: string[] = [];
  const secondaryNamespaceHits: string[] = [];
  let getAttackerHits = () => 0;

  before(async () => {
    const primaryPort = await findMockServerPort();
    primaryGitLab = new MockGitLabServer({ port: primaryPort, validTokens: [MOCK_TOKEN] });
    addNamespaceHandlers(primaryGitLab, primaryNamespaceHits);
    await primaryGitLab.start();

    const secondaryPort = await findMockServerPort();
    secondaryGitLab = new MockGitLabServer({ port: secondaryPort, validTokens: [MOCK_TOKEN] });
    secondaryGitLab.addMockHandler("get", "/projects/1/issues", (_req, res) => {
      secondaryHit = true;
      res.json([]);
    });
    addNamespaceHandlers(secondaryGitLab, secondaryNamespaceHits);
    await secondaryGitLab.start();

    const attackerPort = await findAvailablePort(9300);
    const attacker = await startAttackerServer(attackerPort);
    attackerServer = attacker.server;
    getAttackerHits = attacker.getHits;

    mcpPort = await findAvailablePort(3100);
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
        GITLAB_TOOLS: NAMESPACE_TOOLS,
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

  test("sends namespace tool requests to the dynamic API URL", async () => {
    const client = new CustomHeaderClient({
      authorization: `Bearer ${MOCK_TOKEN}`,
      "x-gitlab-api-url": `${secondaryGitLab.getUrl()}/api/v4`,
    });

    await client.connect(mcpUrl);
    try {
      await client.callTool("list_namespaces", {});
      await client.callTool("get_namespace", { namespace_id: "team" });
      await client.callTool("verify_namespace", { path: "team" });
    } finally {
      await client.disconnect();
    }

    assert.deepStrictEqual(secondaryNamespaceHits, [
      "/namespaces",
      "/namespaces/team",
      "/namespaces/team/exists",
    ]);
    assert.deepStrictEqual(primaryNamespaceHits, [], "default API URL must not receive the calls");
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

  test("returns remediation text when download proxy rejects untrusted dynamic hosts", async () => {
    const server = attackerServer;
    assert.ok(server, "attacker server should be running");
    const attackerUrl = `http://${HOST}:${(server.address() as { port: number }).port}/api/v4`;

    const response = await fetch(
      `http://${HOST}:${mcpPort}/downloads/job-artifacts?project_id=1&job_id=1`,
      {
        headers: {
          "Private-Token": MOCK_TOKEN,
          "x-gitlab-api-url": attackerUrl,
        },
      }
    );

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /not allowed/);
    assert.match(body.error, /GITLAB_ALLOWED_HOSTS/);
    assert.strictEqual(getAttackerHits(), 0, "download proxy must not forward to untrusted hosts");
  });
});
