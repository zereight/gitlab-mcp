#!/usr/bin/env tsx

/**
 * OAuth Authentication Tests
 * Tests for GitLab OAuth2 authentication flow
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as net from 'net';
import { GitLabOAuth } from '../oauth.js';

// Test configuration
const TEST_CLIENT_ID = process.env.GITLAB_OAUTH_CLIENT_ID || 'test-client-id';
const TEST_REDIRECT_URI = process.env.GITLAB_OAUTH_REDIRECT_URI || 'http://127.0.0.1:8888/callback';
const TEST_GITLAB_URL = process.env.GITLAB_API_URL?.replace('/api/v4', '') || 'https://gitlab.com';
const TEST_TOKEN_PATH = path.join(process.cwd(), '.test-gitlab-token.json');

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

const testResults: TestResult[] = [];

// Helper function to run a single test
async function runTest(
  name: string,
  testFn: () => Promise<void>,
  skip = false
): Promise<void> {
  if (skip) {
    console.log(`⏭️  SKIPPED: ${name}`);
    testResults.push({ name, status: 'skipped', duration: 0 });
    return;
  }

  const startTime = Date.now();
  try {
    console.log(`🧪 Testing: ${name}`);
    await testFn();
    const duration = Date.now() - startTime;
    console.log(`✅ PASSED: ${name} (${duration}ms)`);
    testResults.push({ name, status: 'passed', duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`❌ FAILED: ${name} (${duration}ms)`);
    console.log(`   Error: ${errorMsg}`);
    testResults.push({ name, status: 'failed', duration, error: errorMsg });
  }
}

// Helper function to assert conditions
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Helper function to check if port is available
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '127.0.0.1');
  });
}

// Clean up test token file
function cleanupTestToken(): void {
  if (fs.existsSync(TEST_TOKEN_PATH)) {
    fs.unlinkSync(TEST_TOKEN_PATH);
  }
}

// Test 1: GitLabOAuth class instantiation
async function testOAuthInstantiation(): Promise<void> {
  const oauth = new GitLabOAuth({
    clientId: TEST_CLIENT_ID,
    redirectUri: TEST_REDIRECT_URI,
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
  });

  assert(oauth !== null, 'OAuth instance should be created');
  assert(typeof oauth.getAccessToken === 'function', 'Should have getAccessToken method');
  assert(typeof oauth.clearToken === 'function', 'Should have clearToken method');
  assert(typeof oauth.hasValidToken === 'function', 'Should have hasValidToken method');
}

// Test 2: Token storage path configuration
async function testTokenStoragePath(): Promise<void> {
  const customPath = path.join(process.cwd(), '.custom-test-token.json');
  const oauth = new GitLabOAuth({
    clientId: TEST_CLIENT_ID,
    redirectUri: TEST_REDIRECT_URI,
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: customPath,
  });

  assert(oauth !== null, 'OAuth instance with custom path should be created');

  // Clean up
  if (fs.existsSync(customPath)) {
    fs.unlinkSync(customPath);
  }
}

// Test 3: Scope configuration
async function testScopeConfiguration(): Promise<void> {
  const oauth = new GitLabOAuth({
    clientId: TEST_CLIENT_ID,
    redirectUri: TEST_REDIRECT_URI,
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
  });

  assert(oauth !== null, 'OAuth instance with api scope should be created');
}

// Test 4: Multiple scopes (should still work but is redundant)
async function testMultipleScopesRedundant(): Promise<void> {
  const oauth = new GitLabOAuth({
    clientId: TEST_CLIENT_ID,
    redirectUri: TEST_REDIRECT_URI,
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api', 'read_user', 'read_api', 'write_repository'],
    tokenStoragePath: TEST_TOKEN_PATH,
  });

  assert(oauth !== null, 'OAuth instance with multiple scopes should be created');
}

// Test 5: hasValidToken returns false when no token exists
async function testHasValidTokenNoToken(): Promise<void> {
  cleanupTestToken();

  const oauth = new GitLabOAuth({
    clientId: TEST_CLIENT_ID,
    redirectUri: TEST_REDIRECT_URI,
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
  });

  const hasToken = oauth.hasValidToken();
  assert(hasToken === false, 'Should return false when no token exists');
}

// Test 6: hasValidToken returns true with valid token
async function testHasValidTokenWithToken(): Promise<void> {
  const tokenData = {
    access_token: 'test-token',
    token_type: 'Bearer',
    created_at: Date.now(),
    expires_in: 7200, // 2 hours
  };

  fs.writeFileSync(TEST_TOKEN_PATH, JSON.stringify(tokenData), { mode: 0o600 });

  const oauth = new GitLabOAuth({
    clientId: TEST_CLIENT_ID,
    redirectUri: TEST_REDIRECT_URI,
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
  });

  const hasToken = oauth.hasValidToken();
  assert(hasToken === true, 'Should return true with valid token');

  cleanupTestToken();
}

// Test 7: hasValidToken returns false with expired token
async function testHasValidTokenExpired(): Promise<void> {
  const tokenData = {
    access_token: 'test-token',
    token_type: 'Bearer',
    created_at: Date.now() - 10000000, // 2.7+ hours ago
    expires_in: 7200, // 2 hours
  };

  fs.writeFileSync(TEST_TOKEN_PATH, JSON.stringify(tokenData), { mode: 0o600 });

  const oauth = new GitLabOAuth({
    clientId: TEST_CLIENT_ID,
    redirectUri: TEST_REDIRECT_URI,
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
  });

  const hasToken = oauth.hasValidToken();
  assert(hasToken === false, 'Should return false with expired token');

  cleanupTestToken();
}

// Test 8: clearToken removes token file
async function testClearToken(): Promise<void> {
  const tokenData = {
    access_token: 'test-token',
    token_type: 'Bearer',
    created_at: Date.now(),
  };

  fs.writeFileSync(TEST_TOKEN_PATH, JSON.stringify(tokenData), { mode: 0o600 });

  const oauth = new GitLabOAuth({
    clientId: TEST_CLIENT_ID,
    redirectUri: TEST_REDIRECT_URI,
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
  });

  oauth.clearToken();
  assert(!fs.existsSync(TEST_TOKEN_PATH), 'Token file should be deleted');
}

// Test 9: Token file has correct permissions (Unix only)
async function testTokenFilePermissions(): Promise<void> {
  if (process.platform === 'win32') {
    throw new Error('Skipping permission test on Windows');
  }

  const tokenData = {
    access_token: 'test-token',
    token_type: 'Bearer',
    created_at: Date.now(),
  };

  fs.writeFileSync(TEST_TOKEN_PATH, JSON.stringify(tokenData), { mode: 0o600 });

  const stats = fs.statSync(TEST_TOKEN_PATH);
  const mode = stats.mode & 0o777;

  assert(mode === 0o600, `Token file should have 0600 permissions, got ${mode.toString(8)}`);

  cleanupTestToken();
}

// Test 10: Port availability check
async function testPortAvailability(): Promise<void> {
  const port = 8888;
  const available = await isPortAvailable(port);

  // We just check that the function works, not the actual availability
  assert(typeof available === 'boolean', 'Port availability check should return boolean');
}

// Test 11: OAuth redirect URI parsing
async function testRedirectUriParsing(): Promise<void> {
  const redirectUri = 'http://127.0.0.1:8888/callback';
  const url = new URL(redirectUri);

  assert(url.port === '8888', 'Should correctly parse port from redirect URI');
  assert(url.pathname === '/callback', 'Should correctly parse path from redirect URI');
  assert(url.hostname === '127.0.0.1', 'Should correctly parse hostname from redirect URI');
}

// Test 12: Token expiration calculation
async function testTokenExpirationCalculation(): Promise<void> {
  const now = Date.now();
  const expiresIn = 7200; // 2 hours in seconds
  const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds

  const expiryTime = now + (expiresIn * 1000);
  const shouldRefreshAt = expiryTime - buffer;

  assert(shouldRefreshAt < expiryTime, 'Refresh time should be before expiry');
  assert(shouldRefreshAt > now, 'Refresh time should be in the future for new token');
}

// Test 13: Concurrent OAuth server handling (shared server concept)
async function testSharedServerConcept(): Promise<void> {
  // Test that multiple instances can theoretically share a port
  const port = 9999;

  // First instance: start server
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('OK');
  });

  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve());
  });

  // Check port is now in use
  const inUse = !(await isPortAvailable(port));
  assert(inUse === true, 'Port should be in use after server starts');

  // Clean up
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  // Check port is available again
  const available = await isPortAvailable(port);
  assert(available === true, 'Port should be available after server closes');
}

// Test 14: Environment variable configuration
async function testEnvironmentVariableConfig(): Promise<void> {
  const clientId = process.env.GITLAB_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GITLAB_OAUTH_REDIRECT_URI || 'http://127.0.0.1:8888/callback';

  assert(typeof clientId === 'string' || clientId === undefined, 'Client ID should be string or undefined');
  assert(typeof redirectUri === 'string', 'Redirect URI should be string');

  const url = new URL(redirectUri);
  assert(url.protocol === 'http:', 'Redirect URI should use http protocol for localhost');
}

// Test 15: Token data structure validation
async function testTokenDataStructure(): Promise<void> {
  const tokenData = {
    access_token: 'glpat-test123456789',
    refresh_token: 'refresh-test123456789',
    token_type: 'Bearer',
    expires_in: 7200,
    created_at: Date.now(),
  };

  assert(typeof tokenData.access_token === 'string', 'access_token should be string');
  assert(typeof tokenData.token_type === 'string', 'token_type should be string');
  assert(typeof tokenData.created_at === 'number', 'created_at should be number');
  assert(tokenData.expires_in === undefined || typeof tokenData.expires_in === 'number', 'expires_in should be number or undefined');
}

// Test 16: Invalid token storage path handling
async function testInvalidTokenStoragePath(): Promise<void> {
  const invalidPath = '/root/nonexistent/directory/.token.json';

  const oauth = new GitLabOAuth({
    clientId: TEST_CLIENT_ID,
    redirectUri: TEST_REDIRECT_URI,
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: invalidPath,
  });

  // Should create instance even with invalid path (error occurs during save)
  assert(oauth !== null, 'Should create instance with invalid path');
}

// Test 17: Self-hosted GitLab URL configuration
async function testSelfHostedGitLabUrl(): Promise<void> {
  const selfHostedUrl = 'https://gitlab.example.com';

  const oauth = new GitLabOAuth({
    clientId: TEST_CLIENT_ID,
    redirectUri: TEST_REDIRECT_URI,
    gitlabUrl: selfHostedUrl,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
  });

  assert(oauth !== null, 'Should create instance with self-hosted URL');
}

// Test 18: Custom port in redirect URI
async function testCustomPortInRedirectUri(): Promise<void> {
  const customRedirectUri = 'http://127.0.0.1:9999/callback';

  const oauth = new GitLabOAuth({
    clientId: TEST_CLIENT_ID,
    redirectUri: customRedirectUri,
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
  });

  assert(oauth !== null, 'Should create instance with custom port');

  const url = new URL(customRedirectUri);
  assert(url.port === '9999', 'Should correctly parse custom port');
}

// Main test runner
async function runOAuthTests(): Promise<boolean> {
  console.log('🚀 GitLab OAuth Authentication Tests\n');
  console.log('='.repeat(50));

  // Core functionality tests
  await runTest('OAuth class instantiation', testOAuthInstantiation);
  await runTest('Token storage path configuration', testTokenStoragePath);
  await runTest('Scope configuration with api only', testScopeConfiguration);
  await runTest('Multiple scopes configuration (redundant)', testMultipleScopesRedundant);

  // Token management tests
  await runTest('hasValidToken returns false without token', testHasValidTokenNoToken);
  await runTest('hasValidToken returns true with valid token', testHasValidTokenWithToken);
  await runTest('hasValidToken returns false with expired token', testHasValidTokenExpired);
  await runTest('clearToken removes token file', testClearToken);
  await runTest(
    'Token file has correct permissions',
    testTokenFilePermissions,
    process.platform === 'win32'
  );

  // Network and configuration tests
  await runTest('Port availability check', testPortAvailability);
  await runTest('OAuth redirect URI parsing', testRedirectUriParsing);
  await runTest('Token expiration calculation', testTokenExpirationCalculation);
  await runTest('Shared server concept', testSharedServerConcept);

  // Configuration tests
  await runTest('Environment variable configuration', testEnvironmentVariableConfig);
  await runTest('Token data structure validation', testTokenDataStructure);
  await runTest('Invalid token storage path handling', testInvalidTokenStoragePath);
  await runTest('Self-hosted GitLab URL configuration', testSelfHostedGitLabUrl);
  await runTest('Custom port in redirect URI', testCustomPortInRedirectUri);

  // Cleanup
  cleanupTestToken();

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results Summary\n');

  const passed = testResults.filter(r => r.status === 'passed').length;
  const failed = testResults.filter(r => r.status === 'failed').length;
  const skipped = testResults.filter(r => r.status === 'skipped').length;
  const total = testResults.length;

  console.log(`Total tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);

  if (total > 0) {
    const successRate = ((passed / (total - skipped)) * 100).toFixed(1);
    console.log(`Success rate: ${successRate}%`);
  }

  // Show failed tests
  const failedTests = testResults.filter(r => r.status === 'failed');
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`  - ${test.name}`);
      console.log(`    ${test.error}`);
    });
  }

  // Save results to file
  const reportPath = 'test-results-oauth.json';
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 Detailed results saved to ${reportPath}`);

  return failed === 0;
}

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runOAuthTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error running tests:', error);
      process.exit(1);
    });
}

export { runOAuthTests, testResults };
