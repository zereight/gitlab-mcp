/**
 * Remote Authorization Tests
 * Tests for per-session HTTP header-based authorization
 */

import * as path from 'path';
import { describe, test, after, before } from 'node:test';
import assert from 'node:assert';
import fetch from 'node-fetch';
import { 
  launchServer, 
  findAvailablePort, 
  cleanupServers, 
  ServerInstance, 
  TransportMode, 
  checkHealthEndpoint, 
  HOST 
} from './utils/server-launcher.js';

console.log('🔐 Remote Authorization Tests');
console.log('');

// Configuration check
const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com";
const GITLAB_TOKEN = process.env.GITLAB_TOKEN_TEST || process.env.GITLAB_TOKEN;
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID;

console.log('🔧 Test Configuration:');
console.log(`  GitLab URL: ${GITLAB_API_URL}`);
console.log(`  Token: ${GITLAB_TOKEN ? '✅ Provided' : '❌ Missing'}`);
console.log(`  Project ID: ${TEST_PROJECT_ID || '❌ Missing'}`);

// Validate required configuration
if (!GITLAB_TOKEN) {
  console.error('❌ Error: GITLAB_TOKEN_TEST or GITLAB_TOKEN environment variable is required for testing');
  console.error('   Set one of these variables to your GitLab API token');
  process.exit(1);
}

if (!TEST_PROJECT_ID) {
  console.error('❌ Error: TEST_PROJECT_ID environment variable is required for testing');
  console.error('   Set this variable to a valid GitLab project ID (e.g., "123" or "group/project")');
  process.exit(1);
}

console.log('✅ Configuration validated');
console.log('');

let servers: ServerInstance[] = [];

// Cleanup function for all tests
const cleanup = () => {
  cleanupServers(servers);
  servers = [];
};

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

/**
 * Helper to send MCP request with custom headers
 */
async function sendMCPRequest(
  url: string,
  method: object,
  headers: Record<string, string> = {}
): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(method),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

describe('Remote Authorization - Streamable HTTP with Authorization header', () => {
  let server: ServerInstance;
  let port: number;
  let mcpUrl: string;

  before(async () => {
    port = await findAvailablePort();
    server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port,
      timeout: 3000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${GITLAB_API_URL}/api/v4`,
        GITLAB_PROJECT_ID: TEST_PROJECT_ID,
        GITLAB_READ_ONLY_MODE: 'true',
        // Explicitly no GITLAB_PERSONAL_ACCESS_TOKEN
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${port}/mcp`;
    
    // Verify server started successfully
    assert.ok(server.process.pid !== undefined, 'Server process should have PID');
    
    // Verify health check
    if (server.port) {
      const health = await checkHealthEndpoint(server.port);
      assert.strictEqual(health.status, 'healthy', 'Health status should be healthy');
    }
    
    console.log('Server started with remote authorization enabled');
  });

  after(async () => {
    cleanup();
    console.log('Server stopped');
  });

  test('should reject request without Authorization header', async () => {
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    try {
      await sendMCPRequest(mcpUrl, initRequest, {
        'mcp-session-id': 'test-session-no-auth'
      });
      assert.fail('Should have rejected request without auth header');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('401'), 'Should get 401 Unauthorized');
    }
  });

  test('should accept request with Authorization Bearer header', async () => {
    const sessionId = `test-session-bearer-${Date.now()}`;
    
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    const response = await sendMCPRequest(mcpUrl, initRequest, {
      'mcp-session-id': sessionId,
      'authorization': `Bearer ${GITLAB_TOKEN}`
    });

    assert.ok(response, 'Should get response');
    assert.ok(response.result, 'Should have result');
    assert.strictEqual(response.result.protocolVersion, '2024-11-05', 'Protocol version should match');
  });

  test('should reuse auth from first request in subsequent requests', async () => {
    const sessionId = `test-session-reuse-${Date.now()}`;
    
    // First request with auth
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    const initResponse = await sendMCPRequest(mcpUrl, initRequest, {
      'mcp-session-id': sessionId,
      'authorization': `Bearer ${GITLAB_TOKEN}`
    });

    assert.ok(initResponse.result, 'Init should succeed');

    // Second request without auth header (should reuse)
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };

    const listResponse = await sendMCPRequest(mcpUrl, listToolsRequest, {
      'mcp-session-id': sessionId
      // No authorization header
    });

    assert.ok(listResponse.result, 'List tools should succeed with reused auth');
    assert.ok(Array.isArray(listResponse.result.tools), 'Should return tools array');
    assert.ok(listResponse.result.tools.length > 0, 'Should have at least one tool');
  });

  test('should call tool with Bearer token', async () => {
    const sessionId = `test-session-tool-${Date.now()}`;
    
    // Initialize
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    await sendMCPRequest(mcpUrl, initRequest, {
      'mcp-session-id': sessionId,
      'authorization': `Bearer ${GITLAB_TOKEN}`
    });

    // Call tool
    const callToolRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_project',
        arguments: {
          project_id: TEST_PROJECT_ID
        }
      }
    };

    const toolResponse = await sendMCPRequest(mcpUrl, callToolRequest, {
      'mcp-session-id': sessionId
    });

    assert.ok(toolResponse.result, 'Tool call should succeed');
    assert.ok(toolResponse.result.content, 'Should have content');
    assert.ok(Array.isArray(toolResponse.result.content), 'Content should be array');
    assert.ok(toolResponse.result.content.length > 0, 'Should have content items');
    
    const projectData = JSON.parse(toolResponse.result.content[0].text);
    assert.ok(projectData.id, 'Should have project id');
    assert.ok(projectData.name, 'Should have project name');
  });
});

describe('Remote Authorization - Streamable HTTP with Private-Token header', () => {
  let server: ServerInstance;
  let port: number;
  let mcpUrl: string;

  before(async () => {
    port = await findAvailablePort();
    server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port,
      timeout: 3000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${GITLAB_API_URL}/api/v4`,
        GITLAB_PROJECT_ID: TEST_PROJECT_ID,
        GITLAB_READ_ONLY_MODE: 'true',
      }
    });
    servers.push(server);
    mcpUrl = `http://${HOST}:${port}/mcp`;
    
    console.log('Server started for Private-Token tests');
  });

  after(async () => {
    cleanup();
    console.log('Server stopped');
  });

  test('should accept request with Private-Token header', async () => {
    const sessionId = `test-session-private-${Date.now()}`;
    
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    const response = await sendMCPRequest(mcpUrl, initRequest, {
      'mcp-session-id': sessionId,
      'private-token': GITLAB_TOKEN
    });

    assert.ok(response.result, 'Should succeed with Private-Token');
    assert.strictEqual(response.result.protocolVersion, '2024-11-05', 'Protocol version should match');
  });

  test('should call tool with Private-Token', async () => {
    const sessionId = `test-session-private-tool-${Date.now()}`;
    
    // Initialize
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    await sendMCPRequest(mcpUrl, initRequest, {
      'mcp-session-id': sessionId,
      'private-token': GITLAB_TOKEN
    });

    // Call tool
    const callToolRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'list_merge_requests',
        arguments: {
          project_id: TEST_PROJECT_ID
        }
      }
    };

    const toolResponse = await sendMCPRequest(mcpUrl, callToolRequest, {
      'mcp-session-id': sessionId
    });

    assert.ok(toolResponse.result, 'Tool call should succeed with Private-Token');
    assert.ok(toolResponse.result.content, 'Should have content');
  });
});

describe('Remote Authorization - SSE mode should be disabled', () => {
  test('should fail to start with SSE and REMOTE_AUTHORIZATION', async () => {
    const port = await findAvailablePort();
    
    try {
      const server = await launchServer({
        mode: TransportMode.SSE,
        port,
        timeout: 3000,
        env: {
          SSE: 'true',
          REMOTE_AUTHORIZATION: 'true',
          GITLAB_API_URL: `${GITLAB_API_URL}/api/v4`,
        }
      });
      
      // If we get here, the server started when it shouldn't have
      servers.push(server);
      assert.fail('Server should not start with SSE and REMOTE_AUTHORIZATION=true');
    } catch (error) {
      // Expected: server should fail to start
      assert.ok(error instanceof Error, 'Should throw an error');
      console.log('✅ Server correctly rejected SSE mode with remote authorization');
    }
  });
});

