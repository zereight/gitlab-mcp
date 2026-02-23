import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MOCK_TOKEN = 'glpat-mock-token-12345';
const TEST_PROJECT_ID = '123';
const TEST_JOB_ID = '456';
const TEST_ENCODED_ARTIFACT_PATH = 'reports/report#1.txt';

// Helper to run an MCP tool via the built server
async function callTool(
  toolName: string,
  args: Record<string, any>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const proc = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...env,
        GITLAB_READ_ONLY_MODE: 'true',
        USE_PIPELINE: 'true',
      },
    });

    let output = '';
    let errorOutput = '';
    proc.stdout?.on('data', (d: Buffer) => (output += d));
    proc.stderr?.on('data', (d: Buffer) => (errorOutput += d));

    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));

      const line = output.split('\n').find((l) => l.startsWith('{'));
      if (!line) return reject(new Error('No JSON output found'));

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
        } else {
          const content = response.result?.content?.[0]?.text;
          if (content) {
            try {
              resolve(JSON.parse(content));
            } catch {
              // Not JSON (plain text response)
              resolve(content);
            }
          } else {
            resolve(response.result);
          }
        }
      } catch (e) {
        reject(e);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      }) + '\n'
    );
  });
}

describe('job artifacts tools', () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  let tmpDir: string;

  before(async () => {
    const mockPort = await findMockServerPort(9200);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    // Add mock handler for artifact tree listing
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/jobs/${TEST_JOB_ID}/artifacts/tree`, (req, res) => {
      res.json([
        {
          name: 'report.xml',
          path: 'report.xml',
          type: 'file',
          size: 1024,
          mode: '100644',
        },
        {
          name: 'logs',
          path: 'logs',
          type: 'directory',
          mode: '040755',
        },
        {
          name: 'output.log',
          path: 'logs/output.log',
          type: 'file',
          size: 512,
          mode: '100644',
        },
      ]);
    });

    // Add mock handler for downloading the full artifact archive
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/jobs/${TEST_JOB_ID}/artifacts`, (req, res) => {
      // Return a minimal zip-like binary content for testing
      const fakeZipContent = Buffer.from('PK\x03\x04fake-zip-content-for-testing');
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename="artifacts_job_${TEST_JOB_ID}.zip"`);
      res.send(fakeZipContent);
    });

    // Add mock handler for getting a single artifact file
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/jobs/${TEST_JOB_ID}/artifacts/report.xml`, (req, res) => {
      res.set('Content-Type', 'application/xml');
      res.send('<testsuites><testsuite name="unit" tests="5" failures="1"></testsuite></testsuites>');
    });

    // Add mock handler for path that requires URL encoding
    mockGitLab.addMockHandler(
      'get',
      `/projects/${TEST_PROJECT_ID}/jobs/${TEST_JOB_ID}/artifacts/reports/report%231.txt`,
      (req, res) => {
        res.set('Content-Type', 'text/plain');
        res.send('encoded artifact content');
      }
    );

    // Add mock handler for 404 on non-existent artifact
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/jobs/999/artifacts/tree`, (req, res) => {
      res.status(404).json({ message: 'Not Found' });
    });

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();

    // Create a temp directory for download tests
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlab-mcp-test-'));
  });

  after(async () => {
    await mockGitLab.stop();
    // Clean up temp directory
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('list_job_artifacts returns artifact entries', async () => {
    const result = await callTool(
      'list_job_artifacts',
      { project_id: TEST_PROJECT_ID, job_id: TEST_JOB_ID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(Array.isArray(result), 'Response should be an array');
    assert.strictEqual(result.length, 3, 'Should return 3 artifact entries');
    assert.strictEqual(result[0].name, 'report.xml');
    assert.strictEqual(result[0].type, 'file');
    assert.strictEqual(result[0].size, 1024);
    assert.strictEqual(result[1].name, 'logs');
    assert.strictEqual(result[1].type, 'directory');
  });

  test('download_job_artifacts saves archive to disk', async () => {
    const result = await callTool(
      'download_job_artifacts',
      { project_id: TEST_PROJECT_ID, job_id: TEST_JOB_ID, local_path: tmpDir },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(result.success, 'Download should succeed');
    assert.ok(result.file_path.endsWith('.zip'), 'File should have .zip extension');
    assert.ok(
      fs.existsSync(result.file_path),
      `File should exist at ${result.file_path}`
    );
    const stats = fs.statSync(result.file_path);
    assert.ok(stats.size > 0, 'Downloaded file should not be empty');
  });

  test('download_job_artifacts creates nested destination directories', async () => {
    const nestedLocalPath = path.join(tmpDir, 'artifacts', 'run-42');
    const result = await callTool(
      'download_job_artifacts',
      { project_id: TEST_PROJECT_ID, job_id: TEST_JOB_ID, local_path: nestedLocalPath },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(result.success, 'Download should succeed');
    assert.ok(fs.existsSync(result.file_path), `File should exist at ${result.file_path}`);
    assert.ok(fs.existsSync(nestedLocalPath), `Directory should be created at ${nestedLocalPath}`);
  });

  test('get_job_artifact_file returns file content', async () => {
    const result = await callTool(
      'get_job_artifact_file',
      {
        project_id: TEST_PROJECT_ID,
        job_id: TEST_JOB_ID,
        artifact_path: 'report.xml',
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(typeof result === 'string', 'Response should be a string');
    assert.ok(result.includes('<testsuites>'), 'Should contain XML content');
    assert.ok(result.includes('failures="1"'), 'Should contain failure data');
  });

  test('get_job_artifact_file handles artifact paths with reserved characters', async () => {
    const result = await callTool(
      'get_job_artifact_file',
      {
        project_id: TEST_PROJECT_ID,
        job_id: TEST_JOB_ID,
        artifact_path: TEST_ENCODED_ARTIFACT_PATH,
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.strictEqual(result, 'encoded artifact content');
  });
});
