import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';

const MOCK_TOKEN = 'glpat-mock-token-12345';
const TEST_PROJECT_ID = '123';
const TEST_MR_IID = '1';

// Helper to call get_merge_request_diffs
async function callGetMergeRequestDiffs(args: Record<string, any> = {}, env: NodeJS.ProcessEnv) {
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
              resolve(JSON.parse(content));
            } catch (e) {
              reject(new Error(`Failed to parse tool output JSON: ${content}`));
            }
          } else {
            resolve(response.result);
          }
        }
      } catch (e) {
        reject(e);
      }
    });

    proc.stdin?.end(JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "get_merge_request_diffs", arguments: args }
    }) + '\n');
  });
}

describe('get_merge_request_diffs with excluded_file_patterns', () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(9100);
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

  test('returns all diffs without filtering', async () => {
    const diffs = await callGetMergeRequestDiffs(
      { project_id: TEST_PROJECT_ID, merge_request_iid: TEST_MR_IID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
      }
    );

    assert.ok(Array.isArray(diffs), 'Response should be an array');
    assert.strictEqual(diffs.length, 4, 'Should return 4 diffs');
    assert.strictEqual(diffs[0].new_path, 'src/index.ts');
    assert.strictEqual(diffs[1].new_path, 'vendor/package/file.js');
    assert.strictEqual(diffs[2].new_path, 'README.md');
    assert.strictEqual(diffs[3].new_path, 'package-lock.json');
  });

  test('filters out vendor folder with ^vendor/ pattern', async () => {
    const diffs = await callGetMergeRequestDiffs(
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: TEST_MR_IID,
        excluded_file_patterns: ['^vendor/']
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
      }
    );

    assert.ok(Array.isArray(diffs), 'Response should be an array');
    assert.strictEqual(diffs.length, 3, 'Should return 3 diffs (vendor filtered out)');
    assert.strictEqual(diffs[0].new_path, 'src/index.ts');
    assert.strictEqual(diffs[1].new_path, 'README.md');
    assert.strictEqual(diffs[2].new_path, 'package-lock.json');
  });

  test('filters out package-lock.json with package-lock pattern', async () => {
    const diffs = await callGetMergeRequestDiffs(
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: TEST_MR_IID,
        excluded_file_patterns: ['package-lock\\.json']
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
      }
    );

    assert.ok(Array.isArray(diffs), 'Response should be an array');
    assert.strictEqual(diffs.length, 3, 'Should return 3 diffs (package-lock.json filtered out)');
    assert.strictEqual(diffs[0].new_path, 'src/index.ts');
    assert.strictEqual(diffs[1].new_path, 'vendor/package/file.js');
    assert.strictEqual(diffs[2].new_path, 'README.md');
  });

  test('filters multiple patterns at once', async () => {
    const diffs = await callGetMergeRequestDiffs(
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: TEST_MR_IID,
        excluded_file_patterns: ['^vendor/', 'package-lock\\.json']
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
      }
    );

    assert.ok(Array.isArray(diffs), 'Response should be an array');
    assert.strictEqual(diffs.length, 2, 'Should return 2 diffs (vendor and package-lock filtered out)');
    assert.strictEqual(diffs[0].new_path, 'src/index.ts');
    assert.strictEqual(diffs[1].new_path, 'README.md');
  });
});
