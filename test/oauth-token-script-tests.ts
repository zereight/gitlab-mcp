#!/usr/bin/env tsx

/**
 * OAuth Token Script Tests
 * Tests for external token script functionality
 */

import * as fs from 'fs';
import * as path from 'path';
import { GitLabOAuth } from '../oauth.js';

// Test configuration
const TEST_TOKEN = 'glpat-test-token-from-script';
const TEST_GITLAB_URL = 'https://gitlab.com';
const TEST_TOKEN_PATH = path.join(process.cwd(), '.test-gitlab-token-script.json');

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

// Helper function to create a test script
function createTestScript(scriptPath: string, token: string): void {
  const scriptContent = process.platform === 'win32'
    ? `@echo off\necho ${token}`
    : `#!/bin/sh\necho "${token}"`;
  
  fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
}

// Helper function to cleanup test files
function cleanup(): void {
  const filesToClean = [
    TEST_TOKEN_PATH,
    path.join(process.cwd(), 'test-script.sh'),
    path.join(process.cwd(), 'test-script.bat'),
    path.join(process.cwd(), 'test-error-script.sh'),
    path.join(process.cwd(), 'test-error-script.bat'),
    path.join(process.cwd(), 'test-timeout-script.sh'),
    path.join(process.cwd(), 'test-timeout-script.bat'),
  ];

  for (const file of filesToClean) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

// Test 1: Token script with simple command
async function testTokenScriptSimpleCommand(): Promise<void> {
  const scriptPath = process.platform === 'win32' 
    ? path.join(process.cwd(), 'test-script.bat')
    : path.join(process.cwd(), 'test-script.sh');
  
  createTestScript(scriptPath, TEST_TOKEN);
  
  const oauth = new GitLabOAuth({
    clientId: 'not-used',
    redirectUri: 'http://127.0.0.1:8888/callback',
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
    tokenScript: scriptPath,
  });

  const token = await oauth.getAccessToken();
  assert(token === TEST_TOKEN, `Expected token to be ${TEST_TOKEN}, got ${token}`);
}

// Test 2: Token script with arguments
async function testTokenScriptWithArgs(): Promise<void> {
  // Create a script that echoes its first argument
  const scriptPath = process.platform === 'win32'
    ? path.join(process.cwd(), 'test-script.bat')
    : path.join(process.cwd(), 'test-script.sh');
  
  const scriptContent = process.platform === 'win32'
    ? '@echo off\necho %1'
    : '#!/bin/sh\necho "$1"';
  
  fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
  
  const oauth = new GitLabOAuth({
    clientId: 'not-used',
    redirectUri: 'http://127.0.0.1:8888/callback',
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
    tokenScript: `${scriptPath} ${TEST_TOKEN}`,
  });

  const token = await oauth.getAccessToken();
  assert(token === TEST_TOKEN, `Expected token to be ${TEST_TOKEN}, got ${token}`);
}

// Test 3: Token script with quoted arguments
async function testTokenScriptQuotedArgs(): Promise<void> {
  const scriptPath = process.platform === 'win32'
    ? path.join(process.cwd(), 'test-script.bat')
    : path.join(process.cwd(), 'test-script.sh');
  
  const scriptContent = process.platform === 'win32'
    ? '@echo off\necho %1'
    : '#!/bin/sh\necho "$1"';
  
  fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
  
  const tokenWithSpace = 'token with space';
  const oauth = new GitLabOAuth({
    clientId: 'not-used',
    redirectUri: 'http://127.0.0.1:8888/callback',
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
    tokenScript: `${scriptPath} "${tokenWithSpace}"`,
  });

  const token = await oauth.getAccessToken();
  assert(token === tokenWithSpace, `Expected token to be '${tokenWithSpace}', got '${token}'`);
}

// Test 4: Token script that outputs to stderr (should still work)
async function testTokenScriptWithStderr(): Promise<void> {
  const scriptPath = process.platform === 'win32'
    ? path.join(process.cwd(), 'test-script.bat')
    : path.join(process.cwd(), 'test-script.sh');
  
  const scriptContent = process.platform === 'win32'
    ? `@echo off\necho Warning message >&2\necho ${TEST_TOKEN}`
    : `#!/bin/sh\necho "Warning message" >&2\necho "${TEST_TOKEN}"`;
  
  fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
  
  const oauth = new GitLabOAuth({
    clientId: 'not-used',
    redirectUri: 'http://127.0.0.1:8888/callback',
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
    tokenScript: scriptPath,
  });

  const token = await oauth.getAccessToken();
  assert(token === TEST_TOKEN, `Expected token to be ${TEST_TOKEN}, got ${token}`);
}

// Test 5: Token script that returns empty output (should fail)
async function testTokenScriptEmptyOutput(): Promise<void> {
  const scriptPath = process.platform === 'win32'
    ? path.join(process.cwd(), 'test-script.bat')
    : path.join(process.cwd(), 'test-script.sh');
  
  const scriptContent = process.platform === 'win32'
    ? '@echo off\n'
    : '#!/bin/sh\n';
  
  fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
  
  const oauth = new GitLabOAuth({
    clientId: 'not-used',
    redirectUri: 'http://127.0.0.1:8888/callback',
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
    tokenScript: scriptPath,
  });

  let errorThrown = false;
  try {
    await oauth.getAccessToken();
  } catch (error) {
    errorThrown = true;
    assert(
      error instanceof Error && error.message.includes('empty output'),
      'Should throw error about empty output'
    );
  }
  
  assert(errorThrown, 'Should have thrown an error for empty output');
}

// Test 6: Token script that doesn't exist (should fail)
async function testTokenScriptNotFound(): Promise<void> {
  const oauth = new GitLabOAuth({
    clientId: 'not-used',
    redirectUri: 'http://127.0.0.1:8888/callback',
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
    tokenScript: '/nonexistent/script',
  });

  let errorThrown = false;
  try {
    await oauth.getAccessToken();
  } catch (error) {
    errorThrown = true;
    assert(
      error instanceof Error && error.message.includes('Token script execution failed'),
      'Should throw error about script execution failure'
    );
  }
  
  assert(errorThrown, 'Should have thrown an error for nonexistent script');
}

// Test 7: Token script with whitespace and newlines (should be trimmed)
async function testTokenScriptWhitespace(): Promise<void> {
  const scriptPath = process.platform === 'win32'
    ? path.join(process.cwd(), 'test-script.bat')
    : path.join(process.cwd(), 'test-script.sh');
  
  const scriptContent = process.platform === 'win32'
    ? `@echo off\necho.\necho ${TEST_TOKEN}\necho.`
    : `#!/bin/sh\necho ""\necho "${TEST_TOKEN}"\necho ""`;
  
  fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
  
  const oauth = new GitLabOAuth({
    clientId: 'not-used',
    redirectUri: 'http://127.0.0.1:8888/callback',
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
    tokenScript: scriptPath,
  });

  const token = await oauth.getAccessToken();
  // The token should be extracted correctly even with extra newlines
  assert(token.includes(TEST_TOKEN), `Expected token to contain ${TEST_TOKEN}, got ${token}`);
}

// Test 8: Configuration with token script doesn't require client ID
async function testConfigWithoutClientId(): Promise<void> {
  const scriptPath = process.platform === 'win32'
    ? path.join(process.cwd(), 'test-script.bat')
    : path.join(process.cwd(), 'test-script.sh');
  
  createTestScript(scriptPath, TEST_TOKEN);
  
  // This should not throw even without a valid client ID
  const oauth = new GitLabOAuth({
    clientId: 'placeholder',
    redirectUri: 'http://127.0.0.1:8888/callback',
    gitlabUrl: TEST_GITLAB_URL,
    scopes: ['api'],
    tokenStoragePath: TEST_TOKEN_PATH,
    tokenScript: scriptPath,
  });

  const token = await oauth.getAccessToken();
  assert(token === TEST_TOKEN, `Expected token to be ${TEST_TOKEN}, got ${token}`);
}

// Main test runner
async function runTokenScriptTests(): Promise<boolean> {
  console.log('🚀 OAuth Token Script Tests\n');
  console.log('='.repeat(50));

  // Clean up before tests
  cleanup();

  // Run tests
  await runTest('Token script with simple command', testTokenScriptSimpleCommand);
  await runTest('Token script with arguments', testTokenScriptWithArgs);
  await runTest('Token script with quoted arguments', testTokenScriptQuotedArgs);
  await runTest('Token script with stderr output', testTokenScriptWithStderr);
  await runTest('Token script with empty output (should fail)', testTokenScriptEmptyOutput);
  await runTest('Token script not found (should fail)', testTokenScriptNotFound);
  await runTest('Token script with whitespace trimming', testTokenScriptWhitespace);
  await runTest('Configuration with token script (no client ID required)', testConfigWithoutClientId);

  // Cleanup after tests
  cleanup();

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
  const reportPath = 'test-results-oauth-token-script.json';
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 Detailed results saved to ${reportPath}`);

  return failed === 0;
}

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runTokenScriptTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error running tests:', error);
      process.exit(1);
    });
}

export { runTokenScriptTests, testResults };
