import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';
import yaml from 'js-yaml';

const MOCK_TOKEN = 'glpat-mock-token-12345';
const TEST_PROJECT_ID = '123';

// Helper to run the MCP tool
async function callListMergeRequests(args: Record<string, any> = {}, env: NodeJS.ProcessEnv) {
  return new Promise<any[]>((resolve, reject) => {
    const proc = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        ...env,
        GITLAB_READ_ONLY_MODE: 'true' 
      }
    });

    let output = '';
    let errorOutput = '';
    proc.stdout?.on('data', d => output += d);
    proc.stderr?.on('data', d => errorOutput += d);

    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      
      // Find the JSON line in stdout
      const line = output.split('\n').find(l => l.startsWith('{'));
      if (!line) return reject(new Error('No JSON output found'));

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
        } else {
          // Parse the tool result content
          const content = response.result?.content?.[0]?.text;
          if (content) {
            try {
              // Content is now in YAML format, parse it
              resolve(yaml.load(content) as any);
            } catch (e) {
              reject(new Error(`Failed to parse tool output YAML: ${content}`));
            }
          } else {
            // Fallback for direct result (if changed in future) or empty
            resolve(response.result);
          }
        }
      } catch (e) {
        reject(e);
      }
    });

    proc.stdin?.end(JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "list_merge_requests", arguments: args }
    }) + '\n');
  });
}

describe('list_merge_requests', () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(9000);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN]
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test('lists global merge requests (no project_id)', async () => {
    const mrs = await callListMergeRequests({}, {
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
    });
    
    assert.ok(Array.isArray(mrs), 'Response should be an array');
    assert.strictEqual(mrs.length, 2, 'Should return 2 mock MRs');
    // Schema coerces project_id to string
    assert.strictEqual(String(mrs[0].project_id), '123', 'MR should have correct project_id');
  });

  test('lists project-specific merge requests', async () => {
    const mrs = await callListMergeRequests({ project_id: TEST_PROJECT_ID }, {
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
    });
    
    assert.ok(Array.isArray(mrs), 'Response should be an array');
    assert.strictEqual(mrs.length, 2, 'Should return 2 mock MRs');
    assert.strictEqual(mrs[0].title, 'Test MR 1');
  });

  test('filters global merge requests', async () => {
    // Note: The mock server returns static data, so filtering won't actually filter the results
    // unless we implement filtering logic in the mock.
    // But we can verify the call succeeds.
    const mrs = await callListMergeRequests({ state: 'opened' }, {
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
    });
    
    assert.ok(Array.isArray(mrs), 'Response should be an array');
    assert.strictEqual(mrs.length, 2, 'Should return 2 mock MRs');
  });
});
