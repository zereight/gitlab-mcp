/**
 * Client Pool Test Suite
 * Tests connection pooling limits and functionality
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
const MOCK_TOKEN = 'glpat-mock-token-12345';
const POOL_MAX_SIZE = 2;

// Port ranges
const MOCK_GITLAB_PORT_BASE = 9500;
const MCP_SERVER_PORT_BASE = 3500;

console.log('🏊 Client Pool Test Suite');
console.log('');

describe('Client Pool Limits', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let mockGitLabUrl: string;

  before(async () => {
    // Start mock GitLab server
    const mockPort = await findMockServerPort(MOCK_GITLAB_PORT_BASE);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();

    // Start MCP server with pool limit
    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        ENABLE_DYNAMIC_API_URL: 'true', // Enable dynamic URLs to test pooling
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_POOL_MAX_SIZE: String(POOL_MAX_SIZE),
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    console.log(`Mock GitLab: ${mockGitLabUrl}`);
    console.log(`MCP Server: ${mcpUrl}`);
    console.log(`Pool Max Size: ${POOL_MAX_SIZE}`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('should enforce pool size limit', async () => {
    // The pool size is configured to 2.
    // We will connect with 3 distinct URLs.
    // The first 2 should succeed (or fail with network error), adding to the pool.
    // The 3rd should fail with "Pool is full".

    // URL 1: 127.0.0.1 (Real mock server)
    const url1 = `${mockGitLabUrl}/api/v4`;
    const client1 = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`,
      'x-gitlab-api-url': url1
    });
    await client1.connect(mcpUrl);
    await client1.callTool('list_projects', { per_page: 1 });
    console.log('  ✓ Request 1 (127.0.0.1) succeeded');
    await client1.disconnect();

    // URL 2: localhost (Real mock server, distinct string)
    const url2 = url1.replace('127.0.0.1', 'localhost');
    const client2 = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`,
      'x-gitlab-api-url': url2
    });
    await client2.connect(mcpUrl);
    try {
        await client2.callTool('list_projects', { per_page: 1 });
        console.log('  ✓ Request 2 (localhost) succeeded');
    } catch (e) {
        // It might fail if localhost isn't listening or something, but it shouldn't be pool full
        console.log('  ! Request 2 failed:', e);
        if (String(e).includes('capacity reached')) {
            assert.fail('Request 2 failed with pool limit error prematurely');
        }
    }
    await client2.disconnect();

    // URL 3: gitlab-3.example.com (Fake, distinct string)
    // This should trigger the pool limit check
    const client3 = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`,
      'x-gitlab-api-url': 'https://gitlab-3.example.com/api/v4'
    });
    await client3.connect(mcpUrl);
    
    try {
      await client3.callTool('list_projects', { per_page: 1 });
      assert.fail('Request 3 should have failed with pool limit error');
    } catch (error: any) {
      console.log('  ℹ️  Error received:', error.message);
      assert.ok(
        error.message.includes('capacity reached') || error.message.includes('pool is full'), 
        'Error should be about server capacity'
      );
    }
    await client3.disconnect();
  });
});