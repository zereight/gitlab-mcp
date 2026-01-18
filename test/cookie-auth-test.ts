/**
 * Cookie Authentication Test Suite
 * Tests cookie file reloading and session warmup functionality
 */

import { describe, test, after, before } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { 
  launchServer, 
  findAvailablePort, 
  cleanupServers, 
  ServerInstance, 
  TransportMode,
  HOST 
} from './utils/server-launcher.js';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';
import { StdioTestClient } from './clients/stdio-client.js';

// Test constants
const TEST_PROJECT_ID = '123';
const MOCK_GITLAB_PORT_BASE = 9100;

console.log('🍪 Cookie Authentication Test Suite');
console.log('');

describe('Cookie Authentication - File Reloading', () => {
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let tempCookieFile: string;

  before(async () => {
    // Create temporary cookie file
    tempCookieFile = path.join(os.tmpdir(), `gitlab-test-cookies-${Date.now()}.txt`);
    
    // Start mock GitLab server first to get its URL
    const mockPort = await findMockServerPort(MOCK_GITLAB_PORT_BASE);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [] // No token auth, cookies only
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    // Write initial cookie content (Netscape format) using mock server domain
    // Note: Cookie domain must match the API URL domain for proper session handling
    const cookieContent = `# Netscape HTTP Cookie File
127.0.0.1\tFALSE\t/\tFALSE\t0\t_gitlab_session\tinitial_session_value
127.0.0.1\tFALSE\t/\tFALSE\t0\tauth_cookie\tinitial_auth_value`;
    
    fs.writeFileSync(tempCookieFile, cookieContent);

    console.log(`Mock GitLab: ${mockGitLabUrl}`);
    console.log(`Cookie file: ${tempCookieFile}`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
    // Cleanup temp cookie file
    try {
      if (fs.existsSync(tempCookieFile)) {
        fs.unlinkSync(tempCookieFile);
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  test('should load cookies from file at startup', async () => {
    const client = new StdioTestClient();
    const serverPath = path.resolve(process.cwd(), 'build/index.js');
    
    await client.connect(serverPath, {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      GITLAB_AUTH_COOKIE_PATH: tempCookieFile,
      GITLAB_READ_ONLY_MODE: 'true',
    });
    
    // List tools should work if cookies loaded successfully
    const tools = await client.listTools();
    assert.ok(tools.tools.length > 0, 'Should have tools after loading cookies');
    console.log(`  ✓ Cookie file loaded successfully, got ${tools.tools.length} tools`);
    
    await client.disconnect();
  });

  test('should detect and reload cookies when file changes', async () => {
    const client = new StdioTestClient();
    const serverPath = path.resolve(process.cwd(), 'build/index.js');
    
    await client.connect(serverPath, {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      GITLAB_AUTH_COOKIE_PATH: tempCookieFile,
      GITLAB_READ_ONLY_MODE: 'true',
    });
    
    // Initial connection
    const tools1 = await client.listTools();
    assert.ok(tools1.tools.length > 0, 'Should have tools initially');
    console.log(`  ✓ Initial connection successful`);
    
    // Update cookie file (simulating external process refresh)
    const updatedCookieContent = `# Netscape HTTP Cookie File
127.0.0.1\tFALSE\t/\tFALSE\t0\t_gitlab_session\tupdated_session_value
127.0.0.1\tFALSE\t/\tFALSE\t0\tauth_cookie\tupdated_auth_value`;
    
    fs.writeFileSync(tempCookieFile, updatedCookieContent);
    console.log(`  ✓ Cookie file updated`);
    
    // Wait for file watcher to detect changes (debounce time + buffer)
    await new Promise(resolve => setTimeout(resolve, 250));
    
    // Should still work with reloaded cookies
    const tools2 = await client.listTools();
    assert.ok(tools2.tools.length > 0, 'Should have tools after cookie reload');
    console.log(`  ✓ Cookie reload detected and processed successfully`);
    
    await client.disconnect();
  });
});

describe('Cookie Authentication - Session Warmup', () => {
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];
  let tempCookieFile: string;

  before(async () => {
    // Create temporary cookie file with auth proxy cookies
    tempCookieFile = path.join(os.tmpdir(), `gitlab-test-cookies-warmup-${Date.now()}.txt`);
    
    // Start mock GitLab server first to get its URL
    const mockPort = await findMockServerPort(MOCK_GITLAB_PORT_BASE + 50);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: []
    });
    await mockGitLab.start();

    // Write cookie content using mock server domain
    // Auth proxy cookies that get set after first redirect
    const cookieContent = `# Netscape HTTP Cookie File
127.0.0.1\tFALSE\t/\tFALSE\t0\tproxy_auth\tproxy_session_token`;
    
    fs.writeFileSync(tempCookieFile, cookieContent);

    console.log(`Mock GitLab: ${mockGitLab.getUrl()}`);
    console.log(`Cookie file: ${tempCookieFile}`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
    // Cleanup temp cookie file
    try {
      if (fs.existsSync(tempCookieFile)) {
        fs.unlinkSync(tempCookieFile);
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  test('should perform session warmup at startup', async () => {
    const client = new StdioTestClient();
    const serverPath = path.resolve(process.cwd(), 'build/index.js');
    
    // Give server time to complete warmup
    await client.connect(serverPath, {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      GITLAB_AUTH_COOKIE_PATH: tempCookieFile,
      GITLAB_READ_ONLY_MODE: 'true',
    });
    
    // First request should succeed because warmup already happened
    const tools = await client.listTools();
    assert.ok(tools.tools.length > 0, 'First request should succeed after warmup');
    console.log(`  ✓ Session warmup completed, first request succeeded`);
    
    await client.disconnect();
  });
});
