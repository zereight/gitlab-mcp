/**
 * Test suite for getEffectiveProjectId function
 * Tests the behavior of project ID resolution with different environment configurations
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { 
  launchServer, 
  findAvailablePort, 
  cleanupServers, 
  ServerInstance, 
  TransportMode,
  HOST 
} from './utils/server-launcher.js';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';
import { StreamableHTTPTestClient } from './clients/streamable-http-client.js';

const MOCK_TOKEN = 'glpat-mock-token-12345';
const DEFAULT_PROJECT_ID = '123';
const OTHER_PROJECT_ID = '456';

console.log('🔍 Testing getEffectiveProjectId functionality');
console.log('');

describe('getEffectiveProjectId - No GITLAB_ALLOWED_PROJECT_IDS', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let client: StreamableHTTPTestClient;

  before(async () => {
    // Start mock GitLab server
    const mockPort = await findMockServerPort(9100);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    // Start MCP server WITHOUT GITLAB_ALLOWED_PROJECT_IDS
    const mcpPort = await findAvailablePort(3100);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_PROJECT_ID: DEFAULT_PROJECT_ID,
        GITLAB_READ_ONLY_MODE: 'true',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    
    client = new StreamableHTTPTestClient();
    await client.connect(mcpUrl);
    
    console.log(`Mock GitLab: ${mockGitLabUrl}`);
    console.log(`MCP Server: ${mcpUrl}`);
    console.log(`Default Project: ${DEFAULT_PROJECT_ID}`);
  });

  after(async () => {
    if (client) {
      await client.disconnect();
    }
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('should use GITLAB_PROJECT_ID when no project_id is provided', async () => {
    // Call get_project without specifying project_id
    const result = await client.callTool('get_project', {
      project_id: ''
    });
    
    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const project = JSON.parse(content.text);
    
    // The mock server should receive a request for the default project
    assert.strictEqual(project.id, DEFAULT_PROJECT_ID, 'Should use GITLAB_PROJECT_ID as default');
    console.log(`  ✓ Used default project ${DEFAULT_PROJECT_ID} when no project_id provided`);
  });

  test('should prioritize passed project_id over GITLAB_PROJECT_ID', async () => {
    // Call get_project with a different project_id
    const result = await client.callTool('get_project', {
      project_id: OTHER_PROJECT_ID
    });
    
    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const project = JSON.parse(content.text);
    
    // Should use the passed project_id, not GITLAB_PROJECT_ID
    assert.strictEqual(project.id, OTHER_PROJECT_ID, 'Should use passed project_id');
    console.log(`  ✓ Used passed project_id ${OTHER_PROJECT_ID} instead of default ${DEFAULT_PROJECT_ID}`);
  });
});

describe('getEffectiveProjectId - With single GITLAB_ALLOWED_PROJECT_IDS', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let client: StreamableHTTPTestClient;

  before(async () => {
    // Start mock GitLab server
    const mockPort = await findMockServerPort(9200);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    // Start MCP server WITH single GITLAB_ALLOWED_PROJECT_IDS
    const mcpPort = await findAvailablePort(3200);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_PROJECT_ID: DEFAULT_PROJECT_ID,
        GITLAB_ALLOWED_PROJECT_IDS: DEFAULT_PROJECT_ID,
        GITLAB_READ_ONLY_MODE: 'true',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    
    client = new StreamableHTTPTestClient();
    await client.connect(mcpUrl);
    
    console.log(`Mock GitLab: ${mockGitLabUrl}`);
    console.log(`MCP Server: ${mcpUrl}`);
    console.log(`Allowed Project: ${DEFAULT_PROJECT_ID}`);
  });

  after(async () => {
    if (client) {
      await client.disconnect();
    }
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('should use single allowed project as default', async () => {
    const result = await client.callTool('get_project', {
      project_id: ''
    });
    
    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const project = JSON.parse(content.text);
    
    assert.strictEqual(project.id, DEFAULT_PROJECT_ID, 'Should use allowed project as default');
    console.log(`  ✓ Used allowed project ${DEFAULT_PROJECT_ID} as default`);
  });

  test('should reject access to non-allowed project', async () => {
    try {
      await client.callTool('get_project', {
        project_id: OTHER_PROJECT_ID
      });
      assert.fail('Should have rejected access to non-allowed project');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('Access denied'), 'Should indicate access denied');
      console.log('  ✓ Correctly rejected access to non-allowed project');
    }
  });
});

describe('getEffectiveProjectId - With multiple GITLAB_ALLOWED_PROJECT_IDS', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let client: StreamableHTTPTestClient;

  before(async () => {
    // Start mock GitLab server
    const mockPort = await findMockServerPort(9300);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    // Start MCP server WITH multiple GITLAB_ALLOWED_PROJECT_IDS
    const mcpPort = await findAvailablePort(3300);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_ALLOWED_PROJECT_IDS: `${DEFAULT_PROJECT_ID},${OTHER_PROJECT_ID}`,
        GITLAB_READ_ONLY_MODE: 'true',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    
    client = new StreamableHTTPTestClient();
    await client.connect(mcpUrl);
    
    console.log(`Mock GitLab: ${mockGitLabUrl}`);
    console.log(`MCP Server: ${mcpUrl}`);
    console.log(`Allowed Projects: ${DEFAULT_PROJECT_ID},${OTHER_PROJECT_ID}`);
  });

  after(async () => {
    if (client) {
      await client.disconnect();
    }
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('should require explicit project_id when multiple projects allowed', async () => {
    try {
      await client.callTool('get_project', {
        project_id: ''
      });
      assert.fail('Should have required explicit project_id');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('Please specify a project ID'), 'Should require project ID');
      console.log('  ✓ Correctly required explicit project_id');
    }
  });

  test('should allow access to first allowed project', async () => {
    const result = await client.callTool('get_project', {
      project_id: DEFAULT_PROJECT_ID
    });
    
    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const project = JSON.parse(content.text);
    
    assert.strictEqual(project.id, DEFAULT_PROJECT_ID, 'Should allow first project');
    console.log(`  ✓ Allowed access to first project ${DEFAULT_PROJECT_ID}`);
  });

  test('should allow access to second allowed project', async () => {
    const result = await client.callTool('get_project', {
      project_id: OTHER_PROJECT_ID
    });
    
    assert.ok(result.content, 'Should have content');
    const content = result.content[0];
    assert.ok('text' in content, 'Content should have text');
    const project = JSON.parse(content.text);
    
    assert.strictEqual(project.id, OTHER_PROJECT_ID, 'Should allow second project');
    console.log(`  ✓ Allowed access to second project ${OTHER_PROJECT_ID}`);
  });
});
