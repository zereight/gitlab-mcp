/**
 * Test concurrent requests on the same session
 * This tests the fix for the issue where concurrent tool calls on the same session hang indefinitely
 */

import assert from 'node:assert';
import { describe, test, before, after } from 'node:test';
import { CustomHeaderClient } from './clients/custom-header-client.js';
import { TransportMode, type TestServer, launchServer } from './utils/server-launcher.js';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';

describe('Concurrent Requests on Same Session', () => {
  let server: TestServer;
  let mockGitLab: MockGitLabServer;
  const MOCK_TOKEN = 'glpat-test-token-concurrent';
  let mcpUrl: string;
  let mockGitLabUrl: string;

  before(async () => {
    // Start mock GitLab server
    const mockPort = await findMockServerPort(9300);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
    console.log(`Mock GitLab server started at ${mockGitLabUrl}`);

    // Find available port for MCP server
    const mcpPort = await findMockServerPort(3400);

    // Start MCP server with Streamable HTTP transport
    server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      env: {
        LOG_LEVEL: 'info',
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        ENABLE_DYNAMIC_API_URL: 'true',
      }
    });

    mcpUrl = `http://127.0.0.1:${server.port}/mcp`;
    console.log(`MCP server started at ${mcpUrl}`);
  });

  after(async () => {
    await server?.stop();
    await mockGitLab?.stop();
  });

  test('should handle concurrent tool calls on the same session', async () => {
    console.log('\n=== Testing Concurrent Tool Calls on Same Session ===');

    // Create a single client instance
    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`,
      'x-gitlab-api-url': mockGitLabUrl
    });

    // Connect to server
    await client.connect(mcpUrl);
    console.log('  ✓ Client connected');

    // Get the session ID
    const sessionId = client.getSessionId();
    assert.ok(sessionId, 'Session ID should exist');
    console.log(`  ℹ️  Session ID: ${sessionId}`);

    // Test 1: Sequential calls (baseline - should work)
    console.log('\n  📝 Test 1: Sequential calls (baseline)');
    const start1 = Date.now();

    await client.callTool('list_merge_requests', {
      project_id: '1',
      state: 'opened',
    });
    console.log('    ✅ Call 1 completed');

    await client.callTool('get_project', {
      project_id: '1',
    });
    console.log('    ✅ Call 2 completed');

    const duration1 = Date.now() - start1;
    console.log(`    ⏱️  Sequential duration: ${duration1}ms`);

    // Test 2: Concurrent calls (the bug scenario)
    console.log('\n  📝 Test 2: Concurrent calls (this previously hung)');
    const start2 = Date.now();

    // Make two concurrent calls with the same session
    const [result1, result2] = await Promise.all([
      client.callTool('list_merge_requests', {
        project_id: '1',
        state: 'opened',
      }),
      client.callTool('get_project', {
        project_id: '1',
      }),
    ]);

    const duration2 = Date.now() - start2;
    console.log('    ✅ Call 1 completed');
    console.log('    ✅ Call 2 completed');
    console.log(`    ⏱️  Concurrent duration: ${duration2}ms`);

    // Verify results are valid
    assert.ok(result1, 'Result 1 should exist');
    assert.ok(result2, 'Result 2 should exist');

    // Test 3: Multiple concurrent calls (stress test)
    console.log('\n  📝 Test 3: Multiple concurrent calls (stress test)');
    const start3 = Date.now();

    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        client.callTool('get_project', {
          project_id: '1',
        })
      );
    }

    const results = await Promise.all(promises);
    const duration3 = Date.now() - start3;
    
    console.log(`    ✅ All ${results.length} calls completed`);
    console.log(`    ⏱️  Duration: ${duration3}ms`);

    // Verify all results are valid
    for (const result of results) {
      assert.ok(result, 'Result should exist');
    }

    // Disconnect
    await client.disconnect();
    console.log('\n  ✓ Client disconnected');
    console.log('\n  ✅ All concurrent request tests passed!');
  });

  test('should handle interleaved concurrent and sequential calls', async () => {
    console.log('\n=== Testing Interleaved Concurrent and Sequential Calls ===');

    const client = new CustomHeaderClient({
      'authorization': `Bearer ${MOCK_TOKEN}`,
      'x-gitlab-api-url': mockGitLabUrl
    });

    await client.connect(mcpUrl);

    // Make concurrent calls
    const [r1, r2] = await Promise.all([
      client.callTool('get_project', { project_id: '1' }),
      client.callTool('get_project', { project_id: '1' }),
    ]);
    console.log('  ✅ First concurrent batch completed');

    // Make a sequential call
    await client.callTool('get_project', { project_id: '1' });
    console.log('  ✅ Sequential call completed');

    // Make more concurrent calls
    const [r3, r4, r5] = await Promise.all([
      client.callTool('get_project', { project_id: '1' }),
      client.callTool('get_project', { project_id: '1' }),
      client.callTool('get_project', { project_id: '1' }),
    ]);
    console.log('  ✅ Second concurrent batch completed');

    // Verify all results
    assert.ok(r1 && r2 && r3 && r4 && r5, 'All results should exist');

    await client.disconnect();
    console.log('  ✅ Interleaved test passed!');
  });
});
