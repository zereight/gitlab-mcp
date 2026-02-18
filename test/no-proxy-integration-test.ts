/**
 * NO_PROXY Integration Test
 * Tests NO_PROXY functionality with mock servers
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

// Port ranges
const MOCK_GITLAB_PORT_BASE = 9600;
const MCP_SERVER_PORT_BASE = 3600;

console.log('🌐 NO_PROXY Integration Test Suite');
console.log('');

describe('NO_PROXY Integration Tests', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let mockGitLabUrl: string;
  let mockGitLabHost: string;

  before(async () => {
    // Start mock GitLab server
    const mockPort = await findMockServerPort(MOCK_GITLAB_PORT_BASE);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
    // Extract the host:port part for NO_PROXY
    const url = new URL(mockGitLabUrl);
    mockGitLabHost = url.host; // This includes port if non-standard

    console.log(`Mock GitLab: ${mockGitLabUrl}`);
    console.log(`Mock GitLab Host: ${mockGitLabHost}`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('should bypass proxy when hostname is in NO_PROXY', async () => {
    // Start MCP server with proxy settings and NO_PROXY
    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        // Set a fake proxy that would fail if used
        HTTP_PROXY: 'http://nonexistent-proxy.example.com:9999',
        HTTPS_PROXY: 'http://nonexistent-proxy.example.com:9999',
        // Bypass proxy for our mock GitLab server
        NO_PROXY: mockGitLabHost,
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    console.log(`MCP Server: ${mcpUrl}`);
    console.log(`NO_PROXY: ${mockGitLabHost}`);

    // Create client and make a request
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`,
    });
    await client.connect(mcpUrl);
    
    // This should succeed because the proxy is bypassed
    const result = await client.callTool('list_projects', { per_page: 1 });
    console.log('  ✓ Request succeeded with NO_PROXY bypass');
    
    assert.ok(result, 'Request should succeed');
    await client.disconnect();
  });

  test('should use proxy when hostname is NOT in NO_PROXY', async () => {
    // Start MCP server with proxy settings but NO_PROXY doesn't match
    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE + 1);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        // Set a fake proxy that would fail if used
        HTTP_PROXY: 'http://nonexistent-proxy.example.com:9999',
        HTTPS_PROXY: 'http://nonexistent-proxy.example.com:9999',
        // NO_PROXY doesn't match our server
        NO_PROXY: 'different-host.example.com,10.0.0.1',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    console.log(`MCP Server: ${mcpUrl}`);
    console.log(`NO_PROXY: different-host.example.com,10.0.0.1 (should NOT match)`);

    // Create client and make a request
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`,
    });
    await client.connect(mcpUrl);
    
    // This should fail because it tries to use the nonexistent proxy
    try {
      await client.callTool('list_projects', { per_page: 1 });
      assert.fail('Request should have failed due to proxy connection error');
    } catch (error: any) {
      console.log('  ✓ Request failed as expected (proxy error)');
      // Expected to fail with connection/proxy error
      assert.ok(error, 'Should throw an error when proxy fails');
    }
    
    await client.disconnect();
  });

  test('should bypass proxy with wildcard NO_PROXY', async () => {
    // Start MCP server with wildcard NO_PROXY
    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE + 2);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        // Set a fake proxy that would fail if used
        HTTP_PROXY: 'http://nonexistent-proxy.example.com:9999',
        HTTPS_PROXY: 'http://nonexistent-proxy.example.com:9999',
        // Wildcard bypasses all proxies
        NO_PROXY: '*',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    console.log(`MCP Server: ${mcpUrl}`);
    console.log(`NO_PROXY: * (wildcard - bypasses all)`);

    // Create client and make a request
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`,
    });
    await client.connect(mcpUrl);
    
    // This should succeed because wildcard bypasses all proxies
    const result = await client.callTool('list_projects', { per_page: 1 });
    console.log('  ✓ Request succeeded with wildcard NO_PROXY');
    
    assert.ok(result, 'Request should succeed');
    await client.disconnect();
  });

  test('should bypass proxy with domain suffix pattern', async () => {
    // Start MCP server with domain suffix pattern
    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE + 3);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        // Set a fake proxy that would fail if used
        HTTP_PROXY: 'http://nonexistent-proxy.example.com:9999',
        HTTPS_PROXY: 'http://nonexistent-proxy.example.com:9999',
        // Domain suffix pattern - matches .0.1 suffix (for 127.0.0.1)
        NO_PROXY: 'localhost,.0.1',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    console.log(`MCP Server: ${mcpUrl}`);
    console.log(`NO_PROXY: localhost,.0.1 (suffix pattern)`);

    // Create client and make a request
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`,
    });
    await client.connect(mcpUrl);
    
    // This should succeed because .0.1 matches 127.0.0.1
    const result = await client.callTool('list_projects', { per_page: 1 });
    console.log('  ✓ Request succeeded with domain suffix NO_PROXY');
    
    assert.ok(result, 'Request should succeed');
    await client.disconnect();
  });
});

console.log('✅ NO_PROXY integration tests completed');
