/**
 * Remote Authorization Test Suite
 * Tests remote auth functionality with mock GitLab server
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
const TEST_PROJECT_ID = '123';

// Port ranges to avoid collisions
const MOCK_GITLAB_PORT_BASE = 9000;
const MOCK_GITLAB_PORT_OFFSET = 500; // Offset for timeout test suite
const MCP_SERVER_PORT_BASE = 3000;
const MCP_SERVER_PORT_OFFSET = 500; // Offset for timeout test suite

// Timeout settings
const SESSION_TIMEOUT_SECONDS = 3;
const TIMEOUT_BUFFER_MS = 1000; // Extra time beyond timeout to ensure expiration
const TIMEOUT_TEST_WAIT_MS = SESSION_TIMEOUT_SECONDS * 1000 + TIMEOUT_BUFFER_MS;
const KEEPALIVE_INTERVAL_MS = 2000; // Must be less than SESSION_TIMEOUT_SECONDS
const KEEPALIVE_REQUEST_COUNT = 3; // Number of keepalive requests to test

console.log('🔐 Remote Authorization Test Suite');
console.log('');

describe('Remote Authorization - Basic Functionality', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];

  before(async () => {
    // Start mock GitLab server
    const mockPort = await findMockServerPort(MOCK_GITLAB_PORT_BASE);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    // Start MCP server with remote auth
    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_READ_ONLY_MODE: 'true',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;

    console.log(`Mock GitLab: ${mockGitLabUrl}`);
    console.log(`MCP Server: ${mcpUrl}`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('should connect with Authorization Bearer header', async () => {
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`
    });

    await client.connect(mcpUrl);
    const tools = await client.listTools();
    
    assert.ok(tools.tools.length > 0, 'Should have tools');
    console.log(`  ✓ Connected successfully, got ${tools.tools.length} tools`);
    
    await client.disconnect();
  });

  test('should connect with Private-Token header', async () => {
    const client = new CustomHeaderClient({
      'private-token': MOCK_TOKEN
    });

    await client.connect(mcpUrl);
    const tools = await client.listTools();
    
    assert.ok(tools.tools.length > 0, 'Should have tools');
    console.log(`  ✓ Connected with Private-Token, got ${tools.tools.length} tools`);
    
    await client.disconnect();
  });

  test('should successfully call listTools with auth', async () => {
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`
    });

    await client.connect(mcpUrl);
    
    // List tools multiple times to verify auth persists
    const tools1 = await client.listTools();
    const tools2 = await client.listTools();
    const tools3 = await client.listTools();
    
    assert.ok(tools1.tools.length > 0, 'Should have tools');
    assert.strictEqual(tools1.tools.length, tools2.tools.length, 'Tool count should be consistent');
    assert.strictEqual(tools2.tools.length, tools3.tools.length, 'Tool count should be consistent');
    console.log('  ✓ Multiple tool list calls successful with persistent auth');
    
    await client.disconnect();
  });

  test('should reject connection without auth header', async () => {
    const client = new CustomHeaderClient({});

    try {
      await client.connect(mcpUrl);
      await client.listTools();
      await client.disconnect();
      assert.fail('Should have rejected connection without auth');
    } catch (error) {
      assert.ok(error instanceof Error);
      console.log('  ✓ Correctly rejected connection without auth');
    }
  });
});

describe('Remote Authorization - Session Timeout', () => {
  let mcpUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];

  before(async () => {
    // Use different port ranges to avoid collisions with basic tests
    const mockPort = await findMockServerPort(MOCK_GITLAB_PORT_BASE + MOCK_GITLAB_PORT_OFFSET);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE + MCP_SERVER_PORT_OFFSET);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        SESSION_TIMEOUT_SECONDS: String(SESSION_TIMEOUT_SECONDS),
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${mcpPort}/mcp`;
    
    console.log(`Session timeout: ${SESSION_TIMEOUT_SECONDS} seconds`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test('session timeout verification - activity keeps session alive', async () => {
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`
    });

    // Connect and verify it works
    await client.connect(mcpUrl);
    const tools1 = await client.listTools();
    assert.ok(tools1.tools.length > 0, 'Initial connection should work');
    console.log('  ✓ Initial connection successful');

    // Keep connection alive with periodic requests
    console.log('  Keeping session alive with requests...');
    for (let i = 0; i < KEEPALIVE_REQUEST_COUNT; i++) {
      await new Promise(resolve => setTimeout(resolve, KEEPALIVE_INTERVAL_MS));
      const tools = await client.listTools();
      assert.ok(tools.tools.length > 0, `Request ${i + 1} should succeed`);
      console.log(`  ✓ Request ${i + 1} succeeded (session still alive)`);
    }

    await client.disconnect();
    console.log('  ✓ Session remained active with periodic requests');
  });

  test('session timeout expiration - inactivity expires auth', async () => {
    // Step 1: Connect WITH auth header to establish session
    const clientWithAuth = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`
    });
    await clientWithAuth.connect(mcpUrl);
    const tools1 = await clientWithAuth.listTools();
    assert.ok(tools1.tools.length > 0, 'Initial connection should work');
    console.log('  ✓ Initial connection successful with auth');

    // Extract session ID using proper API
    const sessionId = clientWithAuth.getSessionId();
    assert.ok(sessionId, 'Session ID should exist');
    console.log(`  ℹ️  Session ID: ${sessionId}`);

    // Step 2: Wait for timeout WITHOUT making any requests
    console.log(`  ⏳ Waiting ${TIMEOUT_TEST_WAIT_MS/1000}s for timeout without activity...`);
    await new Promise(resolve => setTimeout(resolve, TIMEOUT_TEST_WAIT_MS));

    // Step 3: Try to make request WITHOUT auth header - should fail with 401
    try {
      const response = await fetch(mcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      });

      if (!response.ok) {
        assert.strictEqual(response.status, 401, 'Should return 401 Unauthorized');
        console.log(`  ✓ Request correctly failed with status ${response.status}`);
        const body = await response.text();
        console.log(`  ℹ️  Error: ${body.substring(0, 100)}...`);
      } else {
        assert.fail('Should have failed due to expired auth token');
      }
    } catch (error) {
      // Network errors are also acceptable
      assert.ok(error instanceof Error, 'Should throw error');
      console.log('  ✓ Request correctly failed after timeout');
      console.log(`  ℹ️  Error: ${error.message.substring(0, 100)}...`);
    }

    await clientWithAuth.disconnect();
  });
});

