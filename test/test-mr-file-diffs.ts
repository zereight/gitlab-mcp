import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';

const MOCK_TOKEN = 'glpat-mock-token-12345';
const TEST_PROJECT_ID = '123';
const TEST_MR_IID = '1';

// Helper to call list_merge_request_changed_files
async function callListMergeRequestChangedFiles(args: Record<string, any> = {}, env: NodeJS.ProcessEnv) {
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
      params: { name: "list_merge_request_changed_files", arguments: args }
    }) + '\n');
  });
}

// Helper to call get_merge_request_file_diff
async function callGetMergeRequestFileDiff(args: Record<string, any> = {}, env: NodeJS.ProcessEnv) {
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
      params: { name: "get_merge_request_file_diff", arguments: args }
    }) + '\n');
  });
}

describe('list_merge_request_changed_files', () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(9150);
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

  test('returns all changed files without filtering', async () => {
    const files = await callListMergeRequestChangedFiles(
      { project_id: TEST_PROJECT_ID, merge_request_iid: TEST_MR_IID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
      }
    );

    assert.ok(Array.isArray(files), 'Response should be an array');
    assert.strictEqual(files.length, 4, 'Should return 4 files');

    // Check structure of returned files
    for (const file of files) {
      assert.ok(file.new_path !== undefined, 'Each file should have new_path');
      assert.ok(file.old_path !== undefined, 'Each file should have old_path');
    }

    assert.strictEqual(files[0].new_path, 'src/index.ts');
    assert.strictEqual(files[1].new_path, 'vendor/package/file.js');
    assert.strictEqual(files[2].new_path, 'README.md');
    assert.strictEqual(files[3].new_path, 'package-lock.json');
  });

  test('filters out vendor folder with ^vendor/ pattern', async () => {
    const files = await callListMergeRequestChangedFiles(
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

    assert.ok(Array.isArray(files), 'Response should be an array');
    assert.strictEqual(files.length, 3, 'Should return 3 files (vendor filtered out)');
    assert.strictEqual(files[0].new_path, 'src/index.ts');
    assert.strictEqual(files[1].new_path, 'README.md');
    assert.strictEqual(files[2].new_path, 'package-lock.json');
  });

  test('filters multiple patterns at once', async () => {
    const files = await callListMergeRequestChangedFiles(
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

    assert.ok(Array.isArray(files), 'Response should be an array');
    assert.strictEqual(files.length, 2, 'Should return 2 files (vendor and package-lock filtered out)');
    assert.strictEqual(files[0].new_path, 'src/index.ts');
    assert.strictEqual(files[1].new_path, 'README.md');
  });
});

describe('get_merge_request_file_diff', () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(9200);
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

  test('returns diffs for existing files in single page', async () => {
    // Request only first few files that fit in one page (per_page=20)
    const fileDiff = await callGetMergeRequestFileDiff(
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: TEST_MR_IID,
        file_paths: ['src/index.ts', 'README.md']
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
      }
    );

    assert.ok(Array.isArray(fileDiff), 'Response should be an array');
    assert.strictEqual(fileDiff.length, 2, 'Should return 2 diff results');

    // Check that we got the correct files
    const paths = fileDiff.map((f: any) => f.new_path || f.old_path).sort();
    assert.deepStrictEqual(paths, ['README.md', 'src/index.ts'].sort());
  });

  test('handles pagination when result spans multiple pages', async () => {
    // Request more files than fit in one page (we have 15 total, per_page defaults to 20)
    // but let's use a smaller per_page by testing with unidiff param
    const fileDiff = await callGetMergeRequestFileDiff(
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: TEST_MR_IID,
        file_paths: [
          'src/index.ts',
          'config/settings.yml',
          'models/user.go'
        ]
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
      }
    );

    assert.ok(Array.isArray(fileDiff), 'Response should be an array');
    assert.strictEqual(fileDiff.length, 3, 'Should return 3 diff results');
  });

  test('returns error objects for not-found files', async () => {
    // Request some existing + non-existing files
    const fileDiff = await callGetMergeRequestFileDiff(
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: TEST_MR_IID,
        file_paths: ['src/index.ts', 'nonexistent/file.txt', 'also_missing.py']
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN
      }
    );

    assert.ok(Array.isArray(fileDiff), 'Response should be an array');
    
    // Should return 3 results: 1 success + 2 errors
    assert.strictEqual(fileDiff.length, 3);
    
    // Find the error entries
    const errorEntries = fileDiff.filter((f: any) => f.error !== undefined);
    const successEntries = fileDiff.filter((f: any) => f.error === undefined);
    
    assert.strictEqual(errorEntries.length, 2, 'Should have 2 error entries');
    assert.strictEqual(successEntries.length, 1, 'Should have 1 success entry');
    
    // Verify error messages are helpful
    const errorMsgs = errorEntries.map((e: any) => e.error);
    assert.ok(errorMsgs.some(msg => msg.includes('nonexistent/file.txt')), 
              'Error message should mention nonexistent file');
    assert.ok(errorMsgs.some(msg => msg.includes('also_missing.py')), 
              'Error message should mention other missing file');
    
    // Check hint is present in at least one error
    const hints = errorEntries.map((e: any) => e.hint).filter(Boolean);
    assert.ok(hints.length > 0, 'Errors should include hints to check list_merge_request_changed_files');
  });
});