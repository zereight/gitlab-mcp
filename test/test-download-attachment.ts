import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';

const MOCK_TOKEN = 'glpat-mock-token-12345';
const TEST_PROJECT_ID = '123';
const TEST_SECRET = 'testsecret123';
const SERVER_ENTRY = path.resolve('build/index.js');
const DOWNLOAD_ROOT = '.gitlab-mcp-downloads';

// Minimum valid 1x1 transparent PNG
const MINIMAL_PNG_BUF = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

interface ContentBlock {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  isError?: boolean;
}

interface ListedTool {
  name: string;
  annotations?: { readOnlyHint?: boolean };
}

interface JsonRpcResponse {
  result?: { content?: ContentBlock[]; tools?: ListedTool[] };
  error?: { message: string; code?: number };
}

/**
 * Spawn build/index.js in `cwd`, send a single JSON-RPC request, and return the
 * raw parsed JSON-RPC response (either {result:...} or {error:...}).
 */
function callServer(
  method: string,
  params: Record<string, unknown>,
  env: NodeJS.ProcessEnv,
  cwd: string,
  timeoutMs = 15_000,
): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [SERVER_ENTRY], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      // Saving files is refused in readonly mode, so tests opt into it explicitly.
      env: { ...process.env, GITLAB_READ_ONLY_MODE: 'false', GITLAB_PERMISSION_MODE: 'full', ...env },
    });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
    proc.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn process: ${err.message}`));
    });

    proc.on('close', () => {
      clearTimeout(timer);
      // Find the JSON-RPC response line matching our request id
      const lines = stdout.split('\n').filter(l => l.trim().startsWith('{'));
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === 1) { resolve(parsed); return; }
        } catch { /* try next line */ }
      }
      reject(new Error(`No matching JSON-RPC response found.\nstderr: ${stderr}`));
    });

    proc.stdin?.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) + '\n');
  });
}

function callDownloadAttachment(
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv,
  cwd: string,
): Promise<JsonRpcResponse> {
  return callServer('tools/call', { name: 'download_attachment', arguments: args }, env, cwd);
}

function responseText(raw: JsonRpcResponse): string {
  return (
    (typeof raw.error?.message === 'string' ? raw.error.message : '') +
    (Array.isArray(raw.result?.content)
      ? raw.result.content.map(c => c.text || '').join(' ')
      : '')
  );
}

function savedFilePath(raw: JsonRpcResponse): string {
  const text = raw.result?.content?.[0]?.text;
  assert.ok(text, `Should have text content, got ${JSON.stringify(raw)}`);
  const parsed = JSON.parse(text);
  assert.strictEqual(parsed.success, true, `success should be true, got ${text}`);
  assert.ok(typeof parsed.file_path === 'string', 'file_path should be a string');
  return parsed.file_path;
}

describe('download_attachment', () => {
  let mockGitLab: MockGitLabServer;
  let env: NodeJS.ProcessEnv;
  let workspace: string;
  let downloadRoot: string;
  const scratchDirs: string[] = [];

  before(async () => {
    const port = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
    await mockGitLab.start();

    env = {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_TOOLSETS: "users",
      GITLAB_DOWNLOAD_DIR: '',
    };

    // PNG upload endpoint
    mockGitLab.addMockHandler(
      'get',
      `/projects/${TEST_PROJECT_ID}/uploads/${TEST_SECRET}/image.png`,
      (_req, res) => { res.set('Content-Type', 'image/png').send(MINIMAL_PNG_BUF); }
    );

    // Plain-text upload endpoint
    mockGitLab.addMockHandler(
      'get',
      `/projects/${TEST_PROJECT_ID}/uploads/${TEST_SECRET}/document.txt`,
      (_req, res) => { res.set('Content-Type', 'text/plain').send('hello world'); }
    );

    // Upload whose name starts with a dot
    mockGitLab.addMockHandler(
      'get',
      `/projects/${TEST_PROJECT_ID}/uploads/${TEST_SECRET}/.envrc`,
      (_req, res) => { res.set('Content-Type', 'text/plain').send('echo from upload'); }
    );

    // GitLab redirects uploads to its object storage, so the hop after this response
    // leaves the origin. The destination is a non-public address here.
    mockGitLab.addMockHandler(
      'get',
      `/projects/${TEST_PROJECT_ID}/uploads/${TEST_SECRET}/redirected.txt`,
      (_req, res) => { res.redirect('http://169.254.169.254/latest/meta-data/'); }
    );
  });

  after(async () => {
    await mockGitLab.stop();
    for (const dir of scratchDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // Each test runs the server in a fresh, empty working directory.
  function freshWorkspace(): void {
    workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gl-download-ws-')));
    scratchDirs.push(workspace);
    downloadRoot = path.join(workspace, DOWNLOAD_ROOT);
  }

  test('image file without local_path returns base64 image content block', async () => {
    freshWorkspace();
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'image.png' },
      env,
      workspace
    );

    const content = raw.result?.content;
    assert.ok(Array.isArray(content), 'result.content should be an array');

    const imageBlock = content.find(c => c.type === 'image');
    assert.ok(imageBlock, 'Should contain an image content block');
    assert.strictEqual(imageBlock.mimeType, 'image/png', 'mimeType should be image/png');
    assert.ok(
      typeof imageBlock.data === 'string' && imageBlock.data.length > 0,
      'Image block should have non-empty base64 data'
    );
    assert.deepStrictEqual(fs.readdirSync(workspace), [], 'inline images must not touch the disk');
  });

  test('non-image file without local_path is saved under the download directory', async () => {
    freshWorkspace();
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'document.txt' },
      env,
      workspace
    );

    const filePath = savedFilePath(raw);
    assert.strictEqual(filePath, path.join(downloadRoot, 'document.txt'));
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'hello world');
    assert.deepStrictEqual(fs.readdirSync(workspace), [DOWNLOAD_ROOT]);
    assert.strictEqual(
      fs.readFileSync(path.join(downloadRoot, '.gitignore'), 'utf8').trim(),
      '*',
      'a created download directory should ignore its own contents'
    );
  });

  test('image file with local_path is saved to disk under the download directory', async () => {
    freshWorkspace();
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'image.png', local_path: 'images' },
      env,
      workspace
    );

    assert.strictEqual(savedFilePath(raw), path.join(downloadRoot, 'images', 'image.png'));
  });

  test('local_path with ".." returns path traversal error', async () => {
    freshWorkspace();
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'image.png', local_path: '../../../tmp' },
      env,
      workspace
    );

    assert.ok(
      responseText(raw).toLowerCase().includes('traversal'),
      'Should return an error mentioning directory traversal'
    );
  });

  for (const localPath of ['.git', '.vscode', 'docs/.github/workflows', '.']) {
    const rejected = localPath !== '.';
    test(`local_path "${localPath}" ${rejected ? 'is rejected' : 'means the download directory itself'}`, async () => {
      freshWorkspace();
      fs.mkdirSync(path.join(workspace, '.git'));
      const raw = await callDownloadAttachment(
        { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'document.txt', local_path: localPath },
        env,
        workspace
      );

      if (!rejected) {
        assert.strictEqual(savedFilePath(raw), path.join(downloadRoot, 'document.txt'));
        return;
      }
      assert.match(responseText(raw), /dot/i, `expected a dot-segment rejection, got ${JSON.stringify(raw)}`);
      assert.deepStrictEqual(fs.readdirSync(path.join(workspace, '.git')), []);
      if (localPath !== '.git') {
        assert.ok(!fs.existsSync(path.join(workspace, localPath)), 'nothing created in the workspace');
      }
      assert.ok(!fs.existsSync(path.join(downloadRoot, localPath)), 'nothing created in the download directory');
    });
  }

  test('an upload whose name starts with a dot is not written', async () => {
    freshWorkspace();
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: '.envrc' },
      env,
      workspace
    );

    assert.match(responseText(raw), /dot/i, `expected a dot-filename rejection, got ${JSON.stringify(raw)}`);
    assert.ok(!fs.existsSync(path.join(workspace, '.envrc')));
    assert.ok(!fs.existsSync(path.join(downloadRoot, '.envrc')));
  });

  test('an existing file is not overwritten', async () => {
    freshWorkspace();
    fs.mkdirSync(downloadRoot);
    fs.writeFileSync(path.join(downloadRoot, 'document.txt'), 'original');
    fs.writeFileSync(path.join(workspace, 'document.txt'), 'original');

    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'document.txt' },
      env,
      workspace
    );

    assert.match(responseText(raw), /already exists/i, `expected a refusal, got ${JSON.stringify(raw)}`);
    assert.strictEqual(fs.readFileSync(path.join(downloadRoot, 'document.txt'), 'utf8'), 'original');
    assert.strictEqual(fs.readFileSync(path.join(workspace, 'document.txt'), 'utf8'), 'original');
  });

  test('a download directory that is a symbolic link is rejected', async () => {
    freshWorkspace();
    const elsewhere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gl-download-target-')));
    scratchDirs.push(elsewhere);
    fs.symlinkSync(elsewhere, downloadRoot);

    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'document.txt' },
      env,
      workspace
    );

    assert.match(responseText(raw), /symbolic link/i, `expected a symlink rejection, got ${JSON.stringify(raw)}`);
    assert.deepStrictEqual(fs.readdirSync(elsewhere), []);
  });

  test('GITLAB_DOWNLOAD_DIR selects the download directory', async () => {
    freshWorkspace();
    const configured = path.join(workspace, 'configured', 'downloads');
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'document.txt', local_path: 'sub' },
      { ...env, GITLAB_DOWNLOAD_DIR: configured },
      workspace
    );

    assert.strictEqual(savedFilePath(raw), path.join(configured, 'sub', 'document.txt'));
    assert.ok(!fs.existsSync(downloadRoot));
  });

  test('a redirect to a non-public address is refused', async () => {
    freshWorkspace();
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'redirected.txt' },
      env,
      workspace
    );

    assert.ok(
      responseText(raw).toLowerCase().includes('non-public address'),
      `Should refuse the redirect instead of following it, got ${JSON.stringify(raw)}`
    );
  });

  test('local_path through a symlink directory is rejected', async () => {
    freshWorkspace();
    fs.mkdirSync(downloadRoot);
    fs.symlinkSync(os.tmpdir(), path.join(downloadRoot, 'linked'));
    const raw = await callDownloadAttachment(
      {
        project_id: TEST_PROJECT_ID,
        secret: TEST_SECRET,
        filename: 'image.png',
        local_path: 'linked',
      },
      env,
      workspace
    );

    const lower = responseText(raw).toLowerCase();
    assert.ok(
      lower.includes('symbolic') ||
        lower.includes('symlink') ||
        lower.includes('escapes') ||
        lower.includes('traversal') ||
        lower.includes('invalid'),
      `Expected symlink rejection, got: ${lower}`
    );
  });

  test('filename with directory traversal is rejected before writing to disk', async () => {
    freshWorkspace();
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'image.png#../../owned.txt' },
      env,
      workspace
    );

    assert.ok(
      responseText(raw).toLowerCase().includes('filename'),
      'Should return an error mentioning filename validation'
    );
  });

  test('non-existent local_path directory is auto-created before saving', async () => {
    freshWorkspace();
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'document.txt', local_path: 'newdir/subdir' },
      env,
      workspace
    );

    const filePath = savedFilePath(raw);
    assert.strictEqual(filePath, path.join(downloadRoot, 'newdir', 'subdir', 'document.txt'));
    assert.ok(fs.existsSync(filePath), 'Saved file should exist on disk');
  });

  test('readonly mode still returns images inline', async () => {
    freshWorkspace();
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'image.png' },
      { ...env, GITLAB_PERMISSION_MODE: 'readonly' },
      workspace
    );

    const imageBlock = raw.result?.content?.find(c => c.type === 'image');
    assert.ok(imageBlock, `expected an inline image, got ${JSON.stringify(raw)}`);
    assert.deepStrictEqual(fs.readdirSync(workspace), []);
  });

  for (const [label, args] of [
    ['a non-image file', { filename: 'document.txt' }],
    ['an image with local_path', { filename: 'image.png', local_path: 'images' }],
  ] as const) {
    test(`readonly mode does not save ${label}`, async () => {
      freshWorkspace();
      const raw = await callDownloadAttachment(
        { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, ...args },
        { ...env, GITLAB_READ_ONLY_MODE: 'true' },
        workspace
      );

      assert.match(responseText(raw), /readonly/i, `expected a readonly refusal, got ${JSON.stringify(raw)}`);
      assert.deepStrictEqual(fs.readdirSync(workspace), [], 'readonly mode must not touch the disk');
    });
  }

  test('tools that save local files are not advertised as read-only', async () => {
    freshWorkspace();
    const raw = await callServer(
      'tools/list',
      {},
      { ...env, GITLAB_TOOLSETS: 'users,pipelines', GITLAB_PERMISSION_MODE: 'readonly' },
      workspace
    );
    const tools = raw.result?.tools ?? [];
    for (const name of ['download_attachment', 'download_job_artifacts']) {
      const tool = tools.find(t => t.name === name);
      assert.ok(tool, `${name} should be listed in readonly mode`);
      assert.notStrictEqual(tool.annotations?.readOnlyHint, true, `${name} must not carry readOnlyHint`);
    }
    const plainRead = tools.find(t => t.name === 'list_pipelines');
    assert.strictEqual(plainRead?.annotations?.readOnlyHint, true);
  });
});
