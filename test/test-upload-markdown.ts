import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';

const MOCK_TOKEN = 'glpat-mock-token-12345';
const TEST_PROJECT_ID = '123';

interface ContentBlock {
  type: string;
  text?: string;
}

interface JsonRpcResponse {
  result?: { content?: ContentBlock[] };
  error?: { message: string; code?: number };
}

function callUploadMarkdown(
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv,
  timeoutMs = 15_000,
): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
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
      const lines = stdout.split('\n').filter(l => l.trim().startsWith('{'));
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === 1) { resolve(parsed); return; }
        } catch { /* try next line */ }
      }
      reject(new Error(`No matching JSON-RPC response found.\nstdout: ${stdout}\nstderr: ${stderr}`));
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'upload_markdown', arguments: args },
      }) + '\n'
    );
  });
}

const MOCK_UPLOAD_RESPONSE = {
  id: 42,
  alt: 'test-file.txt',
  url: '/uploads/abc123secret/test-file.txt',
  full_path: '/test-group/test-project/uploads/abc123secret/test-file.txt',
  markdown: '[test-file.txt](/uploads/abc123secret/test-file.txt)',
};

describe('upload_markdown', () => {
  let mockGitLab: MockGitLabServer;
  let env: NodeJS.ProcessEnv;

  // Captured per-request state, reset before each invocation via the handler
  let lastContentType: string | undefined;
  let lastRawBody: string | undefined;

  before(async () => {
    const port = await findMockServerPort(9200);
    mockGitLab = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
    await mockGitLab.start();

    env = {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    };

    mockGitLab.addMockHandler(
      'post',
      `/projects/${TEST_PROJECT_ID}/uploads`,
      (req, res) => {
        lastContentType = req.headers['content-type'];
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          lastRawBody = Buffer.concat(chunks).toString('binary');
          res.status(201).json(MOCK_UPLOAD_RESPONSE);
        });
      }
    );
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test('Content-Type is multipart/form-data with a boundary', async () => {
    const tmpFile = path.join(os.tmpdir(), 'mcp-upload-ct-test.txt');
    fs.writeFileSync(tmpFile, 'content-type test');
    try {
      await callUploadMarkdown({ project_id: TEST_PROJECT_ID, file_path: tmpFile }, env);

      assert.ok(lastContentType, 'Content-Type header must be present');
      assert.ok(
        lastContentType!.startsWith('multipart/form-data'),
        `Expected multipart/form-data, got: ${lastContentType}`
      );
      assert.ok(
        lastContentType!.includes('boundary='),
        `Content-Type must include boundary, got: ${lastContentType}`
      );
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('multipart body contains a "file" field with the file content', async () => {
    const tmpFile = path.join(os.tmpdir(), 'mcp-upload-body-test.txt');
    const fileContent = 'hello from multipart upload test';
    fs.writeFileSync(tmpFile, fileContent);
    try {
      await callUploadMarkdown({ project_id: TEST_PROJECT_ID, file_path: tmpFile }, env);

      assert.ok(lastRawBody, 'Request body must be captured');
      assert.ok(
        lastRawBody!.includes('name="file"'),
        'Multipart body should include a field named "file"'
      );
      assert.ok(
        lastRawBody!.includes(fileContent),
        'Multipart body should contain the uploaded file content'
      );
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('multipart body includes the original filename', async () => {
    const tmpFile = path.join(os.tmpdir(), 'mcp-upload-filename-check.txt');
    fs.writeFileSync(tmpFile, 'filename check');
    try {
      await callUploadMarkdown({ project_id: TEST_PROJECT_ID, file_path: tmpFile }, env);

      assert.ok(lastRawBody, 'Request body must be captured');
      assert.ok(
        lastRawBody!.includes('mcp-upload-filename-check.txt'),
        'Multipart body should include the original filename'
      );
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('returns markdown, url, alt, and full_path from upload response', async () => {
    const tmpFile = path.join(os.tmpdir(), 'mcp-upload-response-test.txt');
    fs.writeFileSync(tmpFile, 'response field test');
    try {
      const raw = await callUploadMarkdown({ project_id: TEST_PROJECT_ID, file_path: tmpFile }, env);

      assert.ok(!raw.error, `Unexpected RPC error: ${raw.error?.message}`);
      const text = raw.result?.content?.[0]?.text;
      assert.ok(text, 'Result should contain a text content block');

      const parsed = JSON.parse(text);
      assert.strictEqual(parsed.markdown, MOCK_UPLOAD_RESPONSE.markdown);
      assert.strictEqual(parsed.url, MOCK_UPLOAD_RESPONSE.url);
      assert.strictEqual(parsed.alt, MOCK_UPLOAD_RESPONSE.alt);
      assert.strictEqual(parsed.full_path, MOCK_UPLOAD_RESPONSE.full_path);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('returns an error when the file does not exist', async () => {
    const raw = await callUploadMarkdown(
      { project_id: TEST_PROJECT_ID, file_path: '/nonexistent/no-such-file.txt' },
      env
    );

    const hasError =
      typeof raw.error?.message === 'string' ||
      raw.result?.content?.some(
        c => c.text && (c.text.toLowerCase().includes('not found') || c.text.toLowerCase().includes('error'))
      );
    assert.ok(hasError, 'Should return an error for a nonexistent file path');
  });
});
