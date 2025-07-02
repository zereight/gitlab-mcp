/**
 * GitLab MCP Server Transport Tests
 * Tests all three transport modes: stdio, SSE, and streamable-http
 */

import * as path from 'path';
import { describe, test, after, before } from 'node:test';
import assert from 'node:assert';
import { launchServer, findAvailablePort, cleanupServers, ServerInstance, TransportMode, checkHealthEndpoint, HOST } from './utils/server-launcher.js';
import { StdioTestClient } from './clients/stdio-client.js';
import { SSETestClient } from './clients/sse-client.js';
import { StreamableHTTPTestClient } from './clients/streamable-http-client.js';
import { MCPClientInterface } from './clients/client.js';
import { ListToolsResult } from '@modelcontextprotocol/sdk/types.js';

console.log('🚀 GitLab MCP Server Tests');
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

describe('GitLab MCP Server - Stdio Transport', () => {
  let client: MCPClientInterface;

  // Prepare environment variables for stdio server
  const stdioEnv: Record<string, string> = {
    GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN,
    GITLAB_API_URL: `${GITLAB_API_URL}/api/v4`,
    GITLAB_PROJECT_ID: TEST_PROJECT_ID,
    GITLAB_READ_ONLY_MODE: 'true',
    // Explicitly disable other transport modes to ensure stdio mode
    SSE: 'false',
    STREAMABLE_HTTP: 'false'
  };

  before(async () => {
    client = new StdioTestClient();
    const serverPath = path.resolve(process.cwd(), 'build/index.js');
    await client.connect(serverPath, stdioEnv);
    assert.ok(client.isConnected, 'Client should be connected');
    console.log('Client connected to stdio server');
  });

  after(async () => {
    if (client && client.isConnected) {
      await client.disconnect();
    }
  });

  test('should list tools via stdio', async () => {
    const tools = await client.listTools();
    assert.ok(tools !== null && tools !== undefined, 'Tools response should be defined');
    assert.ok('tools' in tools, 'Response should have tools property');
    assert.ok(Array.isArray(tools.tools) && tools.tools.length > 0, 'Tools array should not be empty');
    
    // Check for specific GitLab tools with proper typing
    const toolNames = tools.tools.map(tool => tool.name);
    assert.ok(toolNames.includes('list_merge_requests'), 'Should have list_merge_requests tool');
    assert.ok(toolNames.includes('get_project'), 'Should have get_project tool');
    
    // Verify tools have proper structure
    const gitlabTools = tools.tools.filter(tool => 
      tool.name === 'list_merge_requests' || tool.name === 'get_project'
    );
    assert.ok(gitlabTools.length >= 2, 'Should have at least 2 GitLab tools');
    
    for (const tool of gitlabTools) {
      assert.ok(tool.description !== null && tool.description !== undefined, `Tool ${tool.name} should have description`);
      assert.ok('inputSchema' in tool, `Tool ${tool.name} should have input schema`);
    }
  });

  test('should call list_merge_requests tool via stdio', async () => {
    const result = await client.callTool('list_merge_requests', {
      project_id: TEST_PROJECT_ID
    });
    
    assert.ok(result !== null && result !== undefined, 'Tool call result should be defined');
    assert.ok('content' in result, 'Result should have content property');
  });

  test('should call get_project tool via stdio', async () => {
    const result = await client.callTool('get_project', {
      project_id: TEST_PROJECT_ID
    });
    
    // Verify proper CallToolResult structure
    assert.ok(result !== null && result !== undefined, 'Tool call result should be defined');
    assert.ok('content' in result, 'Result should have content property');
    assert.ok(Array.isArray(result.content), 'Content should be an array');
    assert.ok(result.content.length > 0, 'Content array should not be empty');
    
    // Check content structure
    const firstContent = result.content[0];
    assert.ok(firstContent !== null && firstContent !== undefined, 'First content item should be defined');
    assert.ok('type' in firstContent, 'Content item should have type');
    assert.strictEqual(firstContent.type, 'text', 'Content type should be text');
    assert.ok('text' in firstContent, 'Text content should have text property');
    
    // Verify it's valid JSON containing project info
    const projectData = JSON.parse((firstContent as any).text);
    assert.ok(projectData !== null && projectData !== undefined, 'Project data should be parseable JSON');
    assert.ok('id' in projectData, 'Project should have id');
    assert.ok('name' in projectData, 'Project should have name');
  });
});

describe('GitLab MCP Server - SSE Transport', () => {
  let server: ServerInstance;
  let client: MCPClientInterface;
  let port: number;

  before(async () => {
    port = await findAvailablePort();
    server = await launchServer({
      mode: TransportMode.SSE,
      port,
      timeout: 3000,
      env: {
        SSE: 'true',
        STREAMABLE_HTTP: 'false'
      }
    });
    servers.push(server);
    
    // Verify server started successfully
    assert.ok(server.process.pid !== undefined, 'Server process should have PID');
    assert.strictEqual(server.mode, TransportMode.SSE, 'Server mode should be SSE');
    assert.strictEqual(server.port, port, 'Server should use correct port');
    
    // Verify health check
    const health = await checkHealthEndpoint(server.port);
    assert.strictEqual(health.status, 'healthy', 'Health status should be healthy');
    assert.strictEqual(health.transport, 'sse', 'Transport should be SSE');
    assert.ok(health.version !== null && health.version !== undefined, 'Version should be defined');
    
    // Create and connect client
    client = new SSETestClient();
    await client.connect(`http://${HOST}:${port}/sse`);
    assert.ok(client.isConnected, 'Client should be connected');
    assert.ok(await client.testConnection(), 'Connection test should pass');
    console.log('Client connected to SSE server');
  });

  after(async () => {
    if (client && client.isConnected) {
      await client.disconnect();
    }
    cleanup();
    console.log('Client disconnected from SSE server');
  });

  test('should list tools via SSE', async () => {
    const tools = await client.listTools();
    assert.ok(tools !== null && tools !== undefined, 'Tools response should be defined');
    assert.ok('tools' in tools, 'Response should have tools property');
    assert.ok(Array.isArray(tools.tools) && tools.tools.length > 0, 'Tools array should not be empty');
    
    // Check for specific GitLab tools
    const toolNames = tools.tools.map((tool: any) => tool.name);
    assert.ok(toolNames.includes('list_merge_requests'), 'Should have list_merge_requests tool');
    assert.ok(toolNames.includes('get_project'), 'Should have get_project tool');
  });

  test('should call list_merge_requests tool via SSE', async () => {
    const result = await client.callTool('list_merge_requests', {
      project_id: TEST_PROJECT_ID
    });
    
    assert.ok(result !== null && result !== undefined, 'Tool call result should be defined');
    assert.ok('content' in result, 'Result should have content property');
  });

  test('should call get_project tool via SSE', async () => {
    const result = await client.callTool('get_project', {
      project_id: TEST_PROJECT_ID
    });
    assert.ok(result !== null && result !== undefined, 'Tool call result should be defined');
    assert.ok('content' in result, 'Result should have content property');
  });
});

describe('GitLab MCP Server - Streamable HTTP Transport', () => {
  let server: ServerInstance;
  let client: MCPClientInterface;
  let port: number;

  before(async () => {
    port = await findAvailablePort();
    server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port,
      timeout: 3000,
      env: {
        SSE: 'false',
        STREAMABLE_HTTP: 'true'
      }
    });
    servers.push(server);
    
    // Verify server started successfully
    assert.ok(server.process.pid !== undefined, 'Server process should have PID');
    assert.strictEqual(server.mode, TransportMode.STREAMABLE_HTTP, 'Server mode should be streamable-http');
    assert.strictEqual(server.port, port, 'Server should use correct port');

    // Verify health check
    const health = await checkHealthEndpoint(server.port);
    assert.strictEqual(health.status, 'healthy', 'Health status should be healthy');
    assert.strictEqual(health.transport, 'streamable-http', 'Transport should be streamable-http');
    assert.ok(health.version !== null && health.version !== undefined, 'Version should be defined');
    assert.ok(health.activeSessions !== null && health.activeSessions !== undefined, 'Active sessions should be defined');
    
    // Create and connect client
    client = new StreamableHTTPTestClient();
    await client.connect(`http://${HOST}:${port}/mcp`);
    assert.ok(client.isConnected, 'Client should be connected');
    assert.ok(await client.testConnection(), 'Connection test should pass');

    console.log('Client connected to Streamable HTTP server');
  });

  after(async () => {
    if (client && client.isConnected) {
      await client.disconnect();
    }
    cleanup();
    console.log('Client disconnected from Streamable HTTP server');
  });

  test('should list tools via Streamable HTTP', async () => {
    const tools: ListToolsResult = await client.listTools();
    assert.ok(tools !== null && tools !== undefined, 'Tools response should be defined');
    assert.ok('tools' in tools, 'Response should have tools property');
    assert.ok(Array.isArray(tools.tools) && tools.tools.length > 0, 'Tools array should not be empty');
    
    // Check for specific GitLab tools
    const toolNames = tools.tools.map((tool: any) => tool.name);
    assert.ok(toolNames.includes('list_merge_requests'), 'Should have list_merge_requests tool');
    assert.ok(toolNames.includes('get_project'), 'Should have get_project tool');
  });

  test('should call list_merge_requests tool via Streamable HTTP', async () => {
    const result = await client.callTool('list_merge_requests', {
      project_id: TEST_PROJECT_ID
    });
    assert.ok(result !== null && result !== undefined, 'Tool call result should be defined');
    assert.ok('content' in result, 'Result should have content property');
  });

  test('should call get_project tool via Streamable HTTP', async () => {
    const result = await client.callTool('get_project', {
      project_id: TEST_PROJECT_ID
    });
    
    assert.ok(result !== null && result !== undefined, 'Tool call result should be defined');
    assert.ok('content' in result, 'Result should have content property');
  });
});