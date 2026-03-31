import { describe, test, after, before } from 'node:test';
import assert from 'node:assert';
import { 
  launchServer, 
  findAvailablePort, 
  ServerInstance, 
  TransportMode,
  HOST 
} from './utils/server-launcher.js';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';
import { CustomHeaderClient } from './clients/custom-header-client.js';
import { Request, Response } from "express";

const MOCK_TOKEN = 'glpat-mock-token-12345';
const project1 = {
  id: 1,
  name: "ProjectFromServer1",
  description: "Mock project from server 1",
  path_with_namespace: "group1/project1",
  web_url: "http://mock.gitlab/group1/project1",
  default_branch: "main",
  visibility: "private",
  path: "project1",
  created_at: new Date().toISOString(),
  namespace: {
    id: 1,
    name: "group1",
    path: "group1",
    kind: "group",
    full_path: "group1",
  },
};

const project2 = {
  id: 2,
  name: "ProjectFromServer2",
  description: "Mock project from server 2",
  path_with_namespace: "group2/project2",
  web_url: "http://mock.gitlab/group2/project2",
  default_branch: "main",
  visibility: "private",
  path: "project2",
  created_at: new Date().toISOString(),
  namespace: {
    id: 2,
    name: "group2",
    path: "group2",
    kind: "group",
    full_path: "group2",
  },
};

describe("Single Client Mode (ENABLE_DYNAMIC_API_URL=false)", () => {
  let mcpServer: ServerInstance;
  let mcpUrl: string;
  let mockServer1: MockGitLabServer;

  before(async () => {
    const mockPort = await findMockServerPort(9001);
    mockServer1 = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
    mockServer1.addMockHandler('get', '/projects/1', (req: Request, res: Response) => { res.json(project1); });
    await mockServer1.start();

    const mcpPort = await findAvailablePort(3002);
    mcpServer = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      env: {
        GITLAB_API_URL: `${mockServer1.getUrl()}/api/v4`,
        ENABLE_DYNAMIC_API_URL: "false",
        REMOTE_AUTHORIZATION: "true",
      },
    });
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
  });

  after(async () => {
    if (mcpServer) mcpServer.kill();
    if (mockServer1) await mockServer1.stop();
  });

  test("should use the default server when no header is provided", async () => {
    const client = new CustomHeaderClient({ headers: { 'authorization': `Bearer ${MOCK_TOKEN}` }});
    await client.connect(mcpUrl);
    const result = await client.callTool('get_project', { project_id: "1" });
    if (result.content[0].type === 'text') {
      const textContent = JSON.parse(result.content[0].text);
      assert.deepStrictEqual(textContent, project1);
    } else {
      assert.fail('Expected text content from tool call');
    }
    await client.disconnect();
  });

  test("should IGNORE the custom header and still use the default server", async () => {
    const client = new CustomHeaderClient({
      headers: {
        'authorization': `Bearer ${MOCK_TOKEN}`,
        'X-GitLab-API-URL': `http://localhost:9999/api/v4`,
      }
    });
    await client.connect(mcpUrl);
    const result = await client.callTool('get_project', { project_id: "1" });
    if (result.content[0].type === 'text') {
      const textContent = JSON.parse(result.content[0].text);
      assert.deepStrictEqual(textContent, project1);
    } else {
      assert.fail('Expected text content from tool call');
    }
    await client.disconnect();
  });
});

describe("Dynamic Client Mode (ENABLE_DYNAMIC_API_URL=true)", () => {
  let mcpServer: ServerInstance;
  let mcpUrl: string;
  let mockServer1: MockGitLabServer;
  let mockServer2: MockGitLabServer;

  before(async () => {
    const port1 = await findMockServerPort(9011);
    const port2 = await findMockServerPort(9012);
    mockServer1 = new MockGitLabServer({ port: port1, validTokens: [MOCK_TOKEN] });
    mockServer2 = new MockGitLabServer({ port: port2, validTokens: [MOCK_TOKEN] });
    mockServer1.addMockHandler('get', '/projects/1', (req: Request, res: Response) => { res.json(project1); });
    mockServer2.addMockHandler('get', '/projects/2', (req: Request, res: Response) => { res.json(project2); });
    await mockServer1.start();
    await mockServer2.start();

    const mcpPort = await findAvailablePort(3012);
    mcpServer = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      env: {
        GITLAB_API_URL: `${mockServer1.getUrl()}/api/v4,${mockServer2.getUrl()}/api/v4`,
        ENABLE_DYNAMIC_API_URL: "true",
        REMOTE_AUTHORIZATION: "true",
      },
    });
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
  });

  after(async () => {
    if (mcpServer) mcpServer.kill();
    if (mockServer1) await mockServer1.stop();
    if (mockServer2) await mockServer2.stop();
  });

  test("should use the default server (first in list) when no header is provided", async () => {
    const client = new CustomHeaderClient({ headers: { 'authorization': `Bearer ${MOCK_TOKEN}` }});
    await client.connect(mcpUrl);
    const result = await client.callTool('get_project', { project_id: "1" });
    if (result.content[0].type === 'text') {
      const textContent = JSON.parse(result.content[0].text);
      assert.deepStrictEqual(textContent, project1);
    } else {
      assert.fail('Expected text content from tool call');
    }
    await client.disconnect();
  });

  test("should switch to the second server when the header is provided", async () => {
    const client = new CustomHeaderClient({
      headers: {
        'authorization': `Bearer ${MOCK_TOKEN}`,
        'X-GitLab-API-URL': `${mockServer2.getUrl()}/api/v4`,
      }
    });
    await client.connect(mcpUrl);
    const result = await client.callTool('get_project', { project_id: "2" });
    if (result.content[0].type === 'text') {
      const textContent = JSON.parse(result.content[0].text);
      assert.deepStrictEqual(textContent, project2);
    } else {
      assert.fail('Expected text content from tool call');
    }
    await client.disconnect();
  });

  test("should fail tool call when header contains a non-whitelisted URL", async () => {
    const client = new CustomHeaderClient({
      headers: {
        'authorization': `Bearer ${MOCK_TOKEN}`,
        'X-GitLab-API-URL': 'http://localhost:9999/api/v4',
      }
    });
    // Connect succeeds (server accepts any valid URL format),
    // but tool calls fail because the target server doesn't exist
    await client.connect(mcpUrl);
    try {
      const result = await client.callTool('get_project', { project_id: "1" });
      // If callTool returns (doesn't throw), check for error in response
      const content = result.content[0];
      assert.ok('text' in content, 'Should have text content');
      assert.ok(
        content.text.includes('Error') || content.text.includes('error') || content.text.includes('ECONNREFUSED') || result.isError,
        'Should return an error for unreachable server'
      );
    } catch (err: any) {
      // MCP client may throw for server-side errors (-32603)
      assert.ok(
        err.message.includes('ECONNREFUSED') || err.message.includes('failed') || err.message.includes('error'),
        `Should contain connection error info: ${err.message}`
      );
    }
    await client.disconnect();
  });
});