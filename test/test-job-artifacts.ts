import { describe, test, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MOCK_TOKEN = 'glpat-mock-token-12345';
const TEST_PROJECT_ID = '123';
const TEST_JOB_ID = '456';
const NULL_MODE_JOB_ID = '457';
const PARTIAL_JOB_ID = '458';
const REDIRECT_JOB_ID = '789';
const REDIRECT_TARGET = 'http://169.254.169.254/latest/meta-data/';
const TEST_ENCODED_ARTIFACT_PATH = 'reports/report#1.txt';
const SERVER_ENTRY = path.resolve('build/index.js');
const DOWNLOAD_ROOT = '.gitlab-mcp-downloads';

// Helper to run an MCP tool via the built server
async function callTool(
  toolName: string,
  args: Record<string, any>,
  env: NodeJS.ProcessEnv,
  cwd?: string
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const proc = spawn('node', [SERVER_ENTRY], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Saving archives is refused in readonly mode, so tests opt into it explicitly.
        GITLAB_READ_ONLY_MODE: 'false',
        GITLAB_PERMISSION_MODE: 'full',
        ...env,
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

function findFiles(dir: string, name: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter(entry => path.basename(entry) === name)
    .map(entry => path.join(dir, entry));
}

describe('job artifacts tools', () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  const scratchDirs: string[] = [];

  // Each download test runs the server in a fresh, empty working directory.
  function freshWorkspace(): { workspace: string; downloadRoot: string } {
    const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gl-artifacts-ws-')));
    scratchDirs.push(workspace);
    return { workspace, downloadRoot: path.join(workspace, DOWNLOAD_ROOT) };
  }

  function downloadArtifacts(
    jobId: string,
    workspace: string,
    localPath?: string,
    env: NodeJS.ProcessEnv = {}
  ): Promise<any> {
    return callTool(
      'download_job_artifacts',
      { project_id: TEST_PROJECT_ID, job_id: jobId, ...(localPath ? { local_path: localPath } : {}) },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_DOWNLOAD_DIR: '',
        ...env,
      },
      workspace
    );
  }

  before(async () => {
    const mockPort = await findMockServerPort();
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

    // GitLab.com can return mode/size as null on artifacts/tree entries (#661)
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/jobs/${NULL_MODE_JOB_ID}/artifacts/tree`, (req, res) => {
      res.json([
        {
          name: 'report.xml',
          path: 'report.xml',
          type: 'file',
          size: 1024,
          mode: null,
        },
        {
          name: 'logs',
          path: 'logs',
          type: 'directory',
          size: null,
          mode: '040755',
        },
      ]);
    });

    // Add mock handler for 404 on non-existent artifact
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/jobs/999/artifacts/tree`, (req, res) => {
      res.status(404).json({ message: 'Not Found' });
    });

    // Sends the start of the archive, then drops the connection
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/jobs/${PARTIAL_JOB_ID}/artifacts`, (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': '4096' });
      res.write('PK\x03\x04partial-archive');
      setTimeout(() => res.destroy(), 50);
    });

    // GitLab redirects artifact downloads to its object storage, so the hop after this
    // response leaves the origin. The destination is a non-public address here.
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/jobs/${REDIRECT_JOB_ID}/artifacts`, (req, res) => {
      res.redirect(REDIRECT_TARGET);
    });
    mockGitLab.addMockHandler(
      'get',
      `/projects/${TEST_PROJECT_ID}/jobs/${REDIRECT_JOB_ID}/artifacts/report.xml`,
      (req, res) => {
        res.redirect(REDIRECT_TARGET);
      }
    );

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
    for (const dir of scratchDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
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

  describe('When listing job artifacts', () => {
    describe('with a null mode entry', () => {
      it('should return the entries instead of failing', async () => {
        const result = await callTool(
          'list_job_artifacts',
          { project_id: TEST_PROJECT_ID, job_id: NULL_MODE_JOB_ID },
          {
            GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
            GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
          }
        );

        assert.ok(Array.isArray(result), 'Response should be an array');
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].mode, null);
        assert.strictEqual(result[1].size, null);
      });
    });
  });

  describe('When download_job_artifacts saves an archive', () => {
    describe('with a nested local_path', () => {
      it('should create it under the download directory', async () => {
        // Given
        const { workspace, downloadRoot } = freshWorkspace();

        // When
        const result = await downloadArtifacts(TEST_JOB_ID, workspace, 'artifacts/run-42');

        // Then
        const expected = path.join(downloadRoot, 'artifacts', 'run-42', `artifacts_job_${TEST_JOB_ID}.zip`);
        assert.strictEqual(result.file_path, expected);
        assert.ok(fs.readFileSync(expected).subarray(0, 2).equals(Buffer.from('PK')));
      });
    });

    describe('without local_path', () => {
      it('should save it in the download directory itself', async () => {
        // Given
        const { workspace, downloadRoot } = freshWorkspace();

        // When
        const result = await downloadArtifacts(TEST_JOB_ID, workspace);

        // Then
        assert.strictEqual(result.file_path, path.join(downloadRoot, `artifacts_job_${TEST_JOB_ID}.zip`));
      });
    });

    describe('with GITLAB_DOWNLOAD_DIR set', () => {
      it('should save it under that directory', async () => {
        // Given
        const { workspace } = freshWorkspace();
        const configured = path.join(workspace, 'configured', 'downloads');

        // When
        const result = await downloadArtifacts(TEST_JOB_ID, workspace, 'sub', {
          GITLAB_DOWNLOAD_DIR: configured,
        });

        // Then
        assert.strictEqual(result.file_path, path.join(configured, 'sub', `artifacts_job_${TEST_JOB_ID}.zip`));
      });
    });

    describe('with an archive of the same job already on disk', () => {
      it('should refuse to replace it', async () => {
        // Given
        const { workspace, downloadRoot } = freshWorkspace();
        const archive = `artifacts_job_${TEST_JOB_ID}.zip`;
        fs.mkdirSync(downloadRoot);
        fs.writeFileSync(path.join(downloadRoot, archive), 'original');
        fs.writeFileSync(path.join(workspace, archive), 'original');

        // When
        const download = downloadArtifacts(TEST_JOB_ID, workspace);

        // Then
        await assert.rejects(download, (err: Error) => /already exists/i.test(String(err.message || err)));
        assert.deepStrictEqual(
          [path.join(downloadRoot, archive), path.join(workspace, archive)].map(file => fs.readFileSync(file, 'utf8')),
          ['original', 'original']
        );
      });
    });

    describe('with a download that breaks off midway', () => {
      it('should not leave a partial archive behind', async () => {
        // Given
        const { workspace } = freshWorkspace();

        // When
        const download = downloadArtifacts(PARTIAL_JOB_ID, workspace, 'partial');

        // Then
        await assert.rejects(download);
        assert.deepStrictEqual(findFiles(workspace, `artifacts_job_${PARTIAL_JOB_ID}.zip`), []);
      });
    });
  });

  test('download_job_artifacts rejects local_path with directory traversal', async () => {
    const { workspace } = freshWorkspace();
    await assert.rejects(
      () => downloadArtifacts(TEST_JOB_ID, workspace, '../../../tmp'),
      (err: Error) => {
        const msg = String(err.message || err).toLowerCase();
        return msg.includes('traversal') || msg.includes('invalid');
      }
    );
  });

  test('download_job_artifacts rejects symlink local_path escape', async () => {
    const { workspace, downloadRoot } = freshWorkspace();
    fs.mkdirSync(downloadRoot);
    fs.symlinkSync(os.tmpdir(), path.join(downloadRoot, 'symlink-escape'));
    await assert.rejects(
      () => downloadArtifacts(TEST_JOB_ID, workspace, 'symlink-escape'),
      (err: Error) => {
        const msg = String(err.message || err).toLowerCase();
        return (
          msg.includes('symbolic') ||
          msg.includes('symlink') ||
          msg.includes('escapes') ||
          msg.includes('traversal') ||
          msg.includes('invalid')
        );
      }
    );
  });

  test('download_job_artifacts rejects a local_path segment that starts with a dot', async () => {
    const { workspace, downloadRoot } = freshWorkspace();
    await assert.rejects(
      () => downloadArtifacts(TEST_JOB_ID, workspace, path.join('.git', 'hooks')),
      (err: Error) => /dot/i.test(String(err.message || err))
    );
    assert.ok(!fs.existsSync(path.join(downloadRoot, '.git')), 'no dot directory should be created');
  });

  test('download_job_artifacts does not write in readonly mode', async () => {
    const { workspace } = freshWorkspace();
    await assert.rejects(
      () => downloadArtifacts(TEST_JOB_ID, workspace, 'readonly', { GITLAB_READ_ONLY_MODE: 'true' }),
      (err: Error) => /readonly/i.test(String(err.message || err))
    );
    assert.deepStrictEqual(fs.readdirSync(workspace), [], 'readonly mode must not touch the disk');
  });

  test('get_job_artifact_file still works in readonly mode', async () => {
    const result = await callTool(
      'get_job_artifact_file',
      { project_id: TEST_PROJECT_ID, job_id: TEST_JOB_ID, artifact_path: 'report.xml' },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_PERMISSION_MODE: 'readonly',
      }
    );
    assert.ok(String(result).includes('<testsuites>'), `unexpected result: ${JSON.stringify(result)}`);
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

  test('download_job_artifacts refuses a redirect to a non-public address', async () => {
    const { workspace } = freshWorkspace();
    await assert.rejects(
      () => downloadArtifacts(REDIRECT_JOB_ID, workspace),
      (err: Error) => String(err.message || err).toLowerCase().includes('non-public address')
    );
  });

  test('get_job_artifact_file refuses a redirect to a non-public address', async () => {
    await assert.rejects(
      () =>
        callTool(
          'get_job_artifact_file',
          { project_id: TEST_PROJECT_ID, job_id: REDIRECT_JOB_ID, artifact_path: 'report.xml' },
          {
            GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
            GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
          }
        ),
      (err: Error) => String(err.message || err).toLowerCase().includes('non-public address')
    );
  });
});
