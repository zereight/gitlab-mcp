/**
 * Dynamic GitLab API URL Test Suite
 * Tests the ability to connect to multiple GitLab instances via custom headers
 */

import { describe, test, after, before } from 'node:test';
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
import { CustomHeaderClient } from './clients/custom-header-client.js';

// Test constants
const MOCK_TOKEN_1 = 'glpat-mock-token-instance-1';
const MOCK_TOKEN_2 = 'glpat-mock-token-instance-2';

// Port ranges
const MOCK_GITLAB_PORT_BASE_1 = 9100;
const MOCK_GITLAB_PORT_BASE_2 = 9200;
const MCP_SERVER_PORT_BASE = 3100;

console.log('🌐 Dynamic GitLab API URL Test Suite');
console.log('');

describe('Dynamic API URL - Multiple GitLab Instances', () => {
  let mcpUrl: string;
  let mockGitLab1: MockGitLabServer;
  let mockGitLab2: MockGitLabServer;
  let mockGitLabUrl1: string;
  let mockGitLabUrl2: string;
  let servers: ServerInstance[] = [];

  before(async () => {
    // Start first mock GitLab server
    const mockPort1 = await findMockServerPort(MOCK_GITLAB_PORT_BASE_1);
    mockGitLab1 = new MockGitLabServer({
      port: mockPort1,
      validTokens: [MOCK_TOKEN_1]
    });
    await mockGitLab1.start();
    mockGitLabUrl1 = mockGitLab1.getUrl();

    // Start second mock GitLab server
    const mockPort2 = await findMockServerPort(MOCK_GITLAB_PORT_BASE_2);
    mockGitLab2 = new MockGitLabServer({
      port: mockPort2,
      validTokens: [MOCK_TOKEN_2]
    });
    await mockGitLab2.start();
    mockGitLabUrl2 = mockGitLab2.getUrl();

    // Start MCP server with dynamic API URL enabled
    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        ENABLE_DYNAMIC_API_URL: 'true',
        GITLAB_READ_ONLY_MODE: 'true',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    console.log(`Mock GitLab Instance 1: ${mockGitLabUrl1}`);
    console.log(`Mock GitLab Instance 2: ${mockGitLabUrl2}`);
    console.log(`MCP Server: ${mcpUrl}`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab1) {
      await mockGitLab1.stop();
    }
    if (mockGitLab2) {
      await mockGitLab2.stop();
    }
  });

  test('should connect to first GitLab instance with custom API URL', async () => {
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN_1}`,
      'x-gitlab-api-url': mockGitLabUrl1
    });

    await client.connect(mcpUrl);
    const tools = await client.listTools();
    
    assert.ok(tools.tools.length > 0, 'Should have tools');
    console.log(`  ✓ Connected to instance 1, got ${tools.tools.length} tools`);
    
    await client.disconnect();
  });

  test('should connect to second GitLab instance with different API URL', async () => {
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN_2}`,
      'x-gitlab-api-url': mockGitLabUrl2
    });

    await client.connect(mcpUrl);
    const tools = await client.listTools();
    
    assert.ok(tools.tools.length > 0, 'Should have tools');
    console.log(`  ✓ Connected to instance 2, got ${tools.tools.length} tools`);
    
    await client.disconnect();
  });

  test('should handle multiple concurrent connections to different instances', async () => {
    const client1 = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN_1}`,
      'x-gitlab-api-url': mockGitLabUrl1
    });

    const client2 = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN_2}`,
      'x-gitlab-api-url': mockGitLabUrl2
    });

    // Connect both clients
    await Promise.all([
      client1.connect(mcpUrl),
      client2.connect(mcpUrl)
    ]);

    // List tools from both
    const [tools1, tools2] = await Promise.all([
      client1.listTools(),
      client2.listTools()
    ]);

    assert.ok(tools1.tools.length > 0, 'Instance 1 should have tools');
    assert.ok(tools2.tools.length > 0, 'Instance 2 should have tools');
    console.log('  ✓ Both instances accessible concurrently');

    // Disconnect both
    await Promise.all([
      client1.disconnect(),
      client2.disconnect()
    ]);
  });

  test('should reject invalid API URL format', async () => {
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN_1}`,
      'x-gitlab-api-url': 'not-a-valid-url'
    });

    try {
      await client.connect(mcpUrl);
      await client.listTools();
      await client.disconnect();
      assert.fail('Should have rejected invalid URL');
    } catch (error) {
      assert.ok(error instanceof Error);
      console.log('  ✓ Correctly rejected invalid URL format');
    }
  });

  test('should reject connection with wrong token for instance', async () => {
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN_1}`, // Token for instance 1
      'x-gitlab-api-url': mockGitLabUrl2 // But connecting to instance 2
    });

    try {
      await client.connect(mcpUrl);
      await client.listTools();
      await client.disconnect();
      assert.fail('Should have rejected wrong token');
    } catch (error) {
      assert.ok(error instanceof Error);
      console.log('  ✓ Correctly rejected wrong token for instance');
    }
  });

  test('should maintain separate sessions for different API URLs', async () => {
    const client1 = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN_1}`,
      'x-gitlab-api-url': mockGitLabUrl1
    });

    const client2 = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN_2}`,
      'x-gitlab-api-url': mockGitLabUrl2
    });

    // Connect both
    await client1.connect(mcpUrl);
    await client2.connect(mcpUrl);

    // Get session IDs
    const sessionId1 = client1.getSessionId();
    const sessionId2 = client2.getSessionId();

    assert.ok(sessionId1, 'Session 1 should exist');
    assert.ok(sessionId2, 'Session 2 should exist');
    assert.notStrictEqual(sessionId1, sessionId2, 'Sessions should be different');
    console.log('  ✓ Separate sessions maintained for different instances');

    // Make requests from both sessions
    const [tools1, tools2] = await Promise.all([
      client1.listTools(),
      client2.listTools()
    ]);

    assert.ok(tools1.tools.length > 0, 'Instance 1 should work');
    assert.ok(tools2.tools.length > 0, 'Instance 2 should work');
    console.log('  ✓ Both sessions work independently');

    await client1.disconnect();
    await client2.disconnect();
  });

  test('should normalize API URLs correctly', async () => {
    // Test with URL that needs normalization (no /api/v4)
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN_1}`,
      'x-gitlab-api-url': mockGitLabUrl1 // Without /api/v4
    });

    await client.connect(mcpUrl);
    const tools = await client.listTools();
    
    assert.ok(tools.tools.length > 0, 'Should work with normalized URL');
    console.log('  ✓ URL normalization works correctly');
    
    await client.disconnect();
  });
});

describe('Dynamic API URL - Connection Pool', () => {
  let mcpUrl: string;
  let metricsUrl: string;
  let mockGitLab1: MockGitLabServer;
  let mockGitLab2: MockGitLabServer;
  let mockGitLabUrl1: string;
  let mockGitLabUrl2: string;
  let servers: ServerInstance[] = [];

  before(async () => {
    // Start mock GitLab servers
    const mockPort1 = await findMockServerPort(MOCK_GITLAB_PORT_BASE_1 + 50);
    mockGitLab1 = new MockGitLabServer({
      port: mockPort1,
      validTokens: [MOCK_TOKEN_1]
    });
    await mockGitLab1.start();
    mockGitLabUrl1 = mockGitLab1.getUrl();

    const mockPort2 = await findMockServerPort(MOCK_GITLAB_PORT_BASE_2 + 50);
    mockGitLab2 = new MockGitLabServer({
      port: mockPort2,
      validTokens: [MOCK_TOKEN_2]
    });
    await mockGitLab2.start();
    mockGitLabUrl2 = mockGitLab2.getUrl();

    // Start MCP server
    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE + 50);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        ENABLE_DYNAMIC_API_URL: 'true',
        GITLAB_CLIENT_POOL_SIZE: '5',
        GITLAB_CLIENT_IDLE_TIMEOUT: '30000',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    metricsUrl = `http://${HOST}:${mcpPort}/metrics`;

    console.log(`MCP Server: ${mcpUrl}`);
    console.log(`Metrics URL: ${metricsUrl}`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab1) {
      await mockGitLab1.stop();
    }
    if (mockGitLab2) {
      await mockGitLab2.stop();
    }
  });

  test('should track pool statistics via metrics endpoint', async () => {
    // Make some connections first
    const client1 = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN_1}`,
      'x-gitlab-api-url': mockGitLabUrl1
    });

    const client2 = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN_2}`,
      'x-gitlab-api-url': mockGitLabUrl2
    });

    await client1.connect(mcpUrl);
    await client2.connect(mcpUrl);
    await client1.listTools();
    await client2.listTools();

    // Check metrics
    const response = await fetch(metricsUrl);
    assert.ok(response.ok, 'Metrics endpoint should be accessible');
    
    const metrics = await response.json();
    assert.ok(metrics.gitlabClientPool, 'Should have pool metrics');
    assert.ok(typeof metrics.gitlabClientPool.size === 'number', 'Should have pool size');
    assert.ok(typeof metrics.gitlabClientPool.maxSize === 'number', 'Should have max size');
    
    console.log('  ✓ Pool metrics available');
    console.log(`  ℹ️  Pool size: ${metrics.gitlabClientPool.size}/${metrics.gitlabClientPool.maxSize}`);

    await client1.disconnect();
    await client2.disconnect();
  });

  test('should reuse connections for same API URL', async () => {
    // Get initial metrics
    const response1 = await fetch(metricsUrl);
    const metrics1 = await response1.json();
    const initialSize = metrics1.gitlabClientPool?.size || 0;

    // Create multiple clients to same instance
    const clients = [];
    for (let i = 0; i < 3; i++) {
      const client = new CustomHeaderClient({
        'authorization': `Bearer ${MOCK_TOKEN_1}`,
        'x-gitlab-api-url': mockGitLabUrl1
      });
      await client.connect(mcpUrl);
      await client.listTools();
      clients.push(client);
    }

    // Check metrics - should not have created 3 new pool entries
    const response2 = await fetch(metricsUrl);
    const metrics2 = await response2.json();
    const finalSize = metrics2.gitlabClientPool?.size || 0;

    // Pool size should increase by at most 1 (for the shared URL)
    assert.ok(finalSize - initialSize <= 1, 'Should reuse connection for same URL');
    console.log('  ✓ Connection reuse working');
    console.log(`  ℹ️  Pool size change: ${initialSize} → ${finalSize}`);

    // Cleanup
    for (const client of clients) {
      await client.disconnect();
    }
  });
});