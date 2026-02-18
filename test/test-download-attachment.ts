import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';

const MOCK_TOKEN = 'glpat-mock-token-12345';
const TEST_PROJECT_ID = '123';
const TEST_SECRET = 'testsecret123';

// Minimum valid 1x1 transparent PNG
const MINIMAL_PNG_BUF = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Unique suffix per test run to avoid conflicts on concurrent executions
const RUN_ID = Math.random().toString(36).slice(2, 8);

interface ContentBlock {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  isError?: boolean;
}

interface JsonRpcResponse {
  result?: { content?: ContentBlock[] };
  error?: { message: string; code?: number };
}

/**
 * Spawn build/index.js, send a single download_attachment JSON-RPC call, and
 * return the raw parsed JSON-RPC response (either {result:...} or {error:...}).
 */
function callDownloadAttachment(
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv,
  timeoutMs = 15_000,
): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env, GITLAB_READ_ONLY_MODE: 'true' },
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

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'download_attachment', arguments: args },
      }) + '\n'
    );
  });
}

describe('download_attachment', () => {
  let mockGitLab: MockGitLabServer;
  let env: NodeJS.ProcessEnv;

  before(async () => {
    const port = await findMockServerPort(9100);
    mockGitLab = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
    await mockGitLab.start();

    env = {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
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
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test('image file without local_path returns base64 image content block', async () => {
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'image.png' },
      env
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
  });

  test('non-image file is saved to disk and returns file_path', async () => {
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'document.txt' },
      env
    );

    const text = raw.result?.content?.[0]?.text;
    assert.ok(text, 'Should have text content');
    const parsed = JSON.parse(text);

    try {
      assert.strictEqual(parsed.success, true, 'success should be true');
      assert.ok(typeof parsed.file_path === 'string', 'file_path should be a string');
      assert.ok(parsed.file_path.endsWith('document.txt'), 'file_path should end with document.txt');
    } finally {
      if (parsed.file_path && fs.existsSync(parsed.file_path)) {
        fs.unlinkSync(parsed.file_path);
      }
    }
  });

  test('image file with local_path is saved to disk and returns file_path', async () => {
    // Must be a relative path – the implementation rejects absolute paths as traversal
    const localPath = `omc-test-save-${RUN_ID}`;
    try {
      const raw = await callDownloadAttachment(
        { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'image.png', local_path: localPath },
        env
      );

      const text = raw.result?.content?.[0]?.text;
      assert.ok(text, 'Should have text content');
      const parsed = JSON.parse(text);
      assert.strictEqual(parsed.success, true, 'success should be true');
      assert.ok(typeof parsed.file_path === 'string', 'file_path should be a string');
      assert.ok(parsed.file_path.includes('image.png'), 'file_path should include image.png');
    } finally {
      fs.rmSync(localPath, { recursive: true, force: true });
    }
  });

  test('local_path with ".." returns path traversal error', async () => {
    const raw = await callDownloadAttachment(
      { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'image.png', local_path: '../../../tmp' },
      env
    );

    // MCP SDK may return a JSON-RPC error or an isError content block; both must mention "traversal"
    const isRpcError =
      typeof raw.error?.message === 'string' &&
      raw.error.message.toLowerCase().includes('traversal');
    const isContentError =
      Array.isArray(raw.result?.content) &&
      raw.result.content.some(
        c => typeof c.text === 'string' && c.text.toLowerCase().includes('traversal')
      );

    assert.ok(isRpcError || isContentError, 'Should return an error mentioning directory traversal');
  });

  test('non-existent local_path directory is auto-created before saving', async () => {
    const baseDir = `omc-test-newdir-${RUN_ID}`;
    const localPath = `${baseDir}/subdir`;
    fs.rmSync(baseDir, { recursive: true, force: true });

    try {
      const raw = await callDownloadAttachment(
        { project_id: TEST_PROJECT_ID, secret: TEST_SECRET, filename: 'document.txt', local_path: localPath },
        env
      );

      const text = raw.result?.content?.[0]?.text;
      assert.ok(text, 'Should have text content');
      const parsed = JSON.parse(text);
      assert.strictEqual(parsed.success, true, 'success should be true');
      assert.ok(fs.existsSync(parsed.file_path), 'Saved file should exist on disk');
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });
});
