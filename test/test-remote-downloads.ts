/**
 * Remote Mode Download Proxy & Upload Tests
 *
 * Tests the /downloads/:type proxy endpoint and verifies that download/upload
 * tools behave correctly in remote (StreamableHTTP) mode:
 *   - download_job_artifacts returns a download_url
 *   - download_attachment for non-image returns a download_url
 *   - download_attachment for image returns inline base64
 *   - upload_markdown with content+filename works
 *   - upload_markdown with file_path is rejected
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { launchServer, TransportMode, ServerInstance, HOST } from './utils/server-launcher.js';
import { MockGitLabServer, findMockServerPort } from './utils/mock-gitlab-server.js';

const MOCK_TOKEN = 'glpat-mock-token-12345';
const TEST_PROJECT_ID = '123';
const TEST_JOB_ID = '456';
const TEST_SECRET = 'testsecret';
const FORWARDED_BASE_URL = 'https://gitlab.mcp.example.test/gitlab-mcp';
const FORWARDED_HEADERS = {
  'X-Forwarded-Proto': 'https',
  'X-Forwarded-Host': 'gitlab.mcp.example.test',
  'X-Forwarded-Prefix': '/gitlab-mcp',
};
const RFC_FORWARDED_HEADERS = {
  'Forwarded': 'for=192.0.2.43;proto=http;host=attacker.example.test, for="[2001:db8:cafe::17]";proto="https";host="gitlab.mcp.example.test"',
  'X-Forwarded-Prefix': '/gitlab-mcp',
};

// Minimal 1x1 transparent PNG
const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const LARGE_FILE_TOKEN = 'glpat-largefile-test-token';

const FAKE_ZIP = Buffer.from('PK\x03\x04fake-zip-content-for-testing');

const MOCK_UPLOAD_RESPONSE = {
  id: 99,
  alt: 'test-file.txt',
  url: '/uploads/abc123secret/test-file.txt',
  full_path: '/test-group/test-project/uploads/abc123secret/test-file.txt',
  markdown: '[test-file.txt](/uploads/abc123secret/test-file.txt)',
};

// --- SSE response parser ---

interface JsonRpcResult {
  id?: number;
  result?: { content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }> };
  error?: { code: number; message: string };
}

function parseSSE(text: string): JsonRpcResult[] {
  const lines = text.split('\n');
  const dataLines = lines.filter(l => l.startsWith('data: '));
  return dataLines.map(l => JSON.parse(l.slice(6)));
}

// --- Test suites ---

describe('Remote Downloads - Download Proxy Endpoint', { timeout: 30_000 }, () => {
  let mockGitLab: MockGitLabServer;
  let server: ServerInstance;
  let serverPort: number;

  before(async () => {
    const mockPort = await findMockServerPort(9300);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN, LARGE_FILE_TOKEN],
    });

    // Mock artifact download
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/jobs/${TEST_JOB_ID}/artifacts`, (_req, res) => {
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename="artifacts_job_${TEST_JOB_ID}.zip"`);
      res.send(FAKE_ZIP);
    });

    // Mock image attachment
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/uploads/${TEST_SECRET}/image.png`, (_req, res) => {
      res.set('Content-Type', 'image/png');
      res.send(MINIMAL_PNG);
    });

    // Mock text attachment
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/uploads/${TEST_SECRET}/document.txt`, (_req, res) => {
      res.set('Content-Type', 'text/plain');
      res.send('hello document content');
    });

    // Mock large artifact (2MB) to verify streaming works for big files
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/jobs/999/artifacts`, (_req, res) => {
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', 'attachment; filename="large_artifacts.zip"');
      // Send 2MB of data in chunks
      const chunk = Buffer.alloc(64 * 1024, 0x42); // 64KB of 'B'
      res.writeHead(200);
      let sent = 0;
      const total = 2 * 1024 * 1024; // 2MB
      const sendChunk = () => {
        while (sent < total) {
          const size = Math.min(chunk.length, total - sent);
          const ok = res.write(chunk.subarray(0, size));
          sent += size;
          if (!ok) { res.once('drain', sendChunk); return; }
        }
        res.end();
      };
      sendChunk();
    });

    await mockGitLab.start();

    serverPort = 3500;
    server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: serverPort,
      timeout: 10_000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        USE_PIPELINE: 'true',
        MAX_REQUESTS_PER_MINUTE: '2',
      },
    });
  });

  after(async () => {
    if (server) server.kill();
    if (mockGitLab) await mockGitLab.stop();
  });

  test('returns 401 without auth headers', async () => {
    const res = await fetch(
      `http://${HOST}:${serverPort}/downloads/job-artifacts?project_id=${TEST_PROJECT_ID}&job_id=${TEST_JOB_ID}`
    );
    assert.strictEqual(res.status, 401);
    const body = await res.json() as { error: string };
    assert.ok(body.error.toLowerCase().includes('auth'));
  });

  test('returns 400 for missing parameters', async () => {
    const res = await fetch(
      `http://${HOST}:${serverPort}/downloads/job-artifacts?project_id=${TEST_PROJECT_ID}`,
      { headers: { 'Private-Token': MOCK_TOKEN } }
    );
    assert.strictEqual(res.status, 400);
    const body = await res.json() as { error: string };
    assert.ok(body.error.includes('required'));
  });

  test('returns 400 for unknown download types', async () => {
    const res = await fetch(
      `http://${HOST}:${serverPort}/downloads/unknown-type?project_id=${TEST_PROJECT_ID}`,
      { headers: { 'Private-Token': MOCK_TOKEN } }
    );
    assert.strictEqual(res.status, 400);
    const body = await res.json() as { error: string };
    assert.ok(body.error.toLowerCase().includes('unknown'));
  });

  test('streams large file (2MB) without buffering issues', async () => {
    // Use a dedicated token to avoid rate limit interference from other tests
    const largeFileToken = 'glpat-largefile-test-token';
    const res = await fetch(
      `http://${HOST}:${serverPort}/downloads/job-artifacts?project_id=${TEST_PROJECT_ID}&job_id=999`,
      { headers: { 'Private-Token': largeFileToken } }
    );
    assert.strictEqual(res.status, 200, 'Should stream large file successfully');
    const buf = Buffer.from(await res.arrayBuffer());
    const expectedSize = 2 * 1024 * 1024;
    assert.strictEqual(buf.length, expectedSize, `Should receive full 2MB (got ${buf.length} bytes)`);
  });

  test('returns 429 after exceeding rate limit', async () => {
    // Use a different token to get a fresh rate limit counter
    const rateLimitToken = 'glpat-ratelimit-test-token';
    let got429 = false;
    for (let i = 0; i < 10; i++) {
      const res = await fetch(
        `http://${HOST}:${serverPort}/downloads/job-artifacts?project_id=${TEST_PROJECT_ID}&job_id=${TEST_JOB_ID}`,
        { headers: { 'Private-Token': rateLimitToken } }
      );
      if (res.status === 429) {
        got429 = true;
        const body = await res.json() as { error: string };
        assert.ok(body.error.toLowerCase().includes('rate limit'));
        break;
      }
      // consume body (might be 401/403 from GitLab mock, but rate limit still increments)
      await res.arrayBuffer();
    }
    assert.ok(got429, 'Should have received 429 within 10 requests (rate limit is 2/min)');
  });

  test('ignores forwarded headers unless MCP_TRUST_PROXY is enabled', async () => {
    const initRes = await fetch(`http://${HOST}:${serverPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Private-Token': MOCK_TOKEN,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 20,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-remote-downloads-no-trust-proxy', version: '1.0' },
        },
      }),
    });

    assert.strictEqual(initRes.status, 200, 'Initialize should succeed');
    const sessionId = initRes.headers.get('mcp-session-id')!;
    assert.ok(sessionId, 'Should receive a session ID');

    const toolRes = await fetch(`http://${HOST}:${serverPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...FORWARDED_HEADERS,
        'Private-Token': MOCK_TOKEN,
        'mcp-session-id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 21,
        method: 'tools/call',
        params: {
          name: 'download_job_artifacts',
          arguments: {
            project_id: TEST_PROJECT_ID,
            job_id: TEST_JOB_ID,
          },
        },
      }),
    });

    assert.strictEqual(toolRes.status, 200, 'Tool call should return 200');
    const responses = parseSSE(await toolRes.text());
    const result = responses.find(r => r.id === 21);
    assert.ok(result?.result, 'Should have a result');

    const textBlock = result.result!.content!.find(c => c.type === 'text');
    assert.ok(textBlock?.text, 'Should have text content');
    const parsed = JSON.parse(textBlock!.text!);

    assert.ok(parsed.download_url, 'Should contain download_url');
    assert.ok(
      parsed.download_url.startsWith(`http://${HOST}:${serverPort}/downloads/job-artifacts?`),
      `URL should fall back to local server address when MCP_TRUST_PROXY is disabled, got ${parsed.download_url}`
    );
    assert.ok(
      !parsed.download_url.startsWith(`${FORWARDED_BASE_URL}/downloads/job-artifacts?`),
      'URL should not use forwarded public base URL when MCP_TRUST_PROXY is disabled'
    );
  });
});

describe('Remote Downloads - Tool Behavior via MCP Protocol', { timeout: 60_000 }, () => {
  let mockGitLab: MockGitLabServer;
  let server: ServerInstance;
  let serverPort: number;
  let sessionId: string;

  before(async () => {
    const mockPort = await findMockServerPort(9310);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    // Mock artifact download
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/jobs/${TEST_JOB_ID}/artifacts`, (_req, res) => {
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename="artifacts_job_${TEST_JOB_ID}.zip"`);
      res.send(FAKE_ZIP);
    });

    // Mock image attachment
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/uploads/${TEST_SECRET}/image.png`, (_req, res) => {
      res.set('Content-Type', 'image/png');
      res.send(MINIMAL_PNG);
    });

    // Mock text attachment
    mockGitLab.addMockHandler('get', `/projects/${TEST_PROJECT_ID}/uploads/${TEST_SECRET}/document.txt`, (_req, res) => {
      res.set('Content-Type', 'text/plain');
      res.send('hello document content');
    });

    // Mock upload endpoint
    mockGitLab.addMockHandler('post', `/projects/${TEST_PROJECT_ID}/uploads`, (req, res) => {
      res.status(201).json(MOCK_UPLOAD_RESPONSE);
    });

    await mockGitLab.start();

    serverPort = 3510;
    server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: serverPort,
      timeout: 10_000,
      env: {
        STREAMABLE_HTTP: 'true',
        REMOTE_AUTHORIZATION: 'true',
        MCP_TRUST_PROXY: 'true',
        MCP_SERVER_URL: '',
        GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        USE_PIPELINE: 'true',
      },
    });

    // Initialize MCP session
    const initRes = await fetch(`http://${HOST}:${serverPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Private-Token': MOCK_TOKEN,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-remote-downloads', version: '1.0' },
        },
      }),
    });

    assert.strictEqual(initRes.status, 200, 'Initialize should succeed');
    sessionId = initRes.headers.get('mcp-session-id')!;
    assert.ok(sessionId, 'Should receive a session ID');
  });

  after(async () => {
    if (server) server.kill();
    if (mockGitLab) await mockGitLab.stop();
  });

  async function callTool(
    id: number,
    name: string,
    args: Record<string, unknown>,
    extraHeaders: Record<string, string> = {}
  ): Promise<JsonRpcResult> {
    const res = await fetch(`http://${HOST}:${serverPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...extraHeaders,
        'Private-Token': MOCK_TOKEN,
        'mcp-session-id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    });
    assert.strictEqual(res.status, 200, `Tool call ${name} should return 200`);
    const text = await res.text();
    const responses = parseSSE(text);
    const result = responses.find(r => r.id === id);
    assert.ok(result, `Should find response with id=${id} in SSE stream`);
    return result;
  }

  test('download_job_artifacts returns download_url with embedded auth token', async () => {
    const result = await callTool(10, 'download_job_artifacts', {
      project_id: TEST_PROJECT_ID,
      job_id: TEST_JOB_ID,
    });

    assert.ok(result.result, 'Should have a result');
    const content = result.result!.content;
    assert.ok(content && content.length > 0, 'Should have content');

    const textBlock = content!.find(c => c.type === 'text');
    assert.ok(textBlock?.text, 'Should have text content');
    const parsed = JSON.parse(textBlock!.text!);

    assert.ok(parsed.download_url, 'Should contain download_url');
    assert.ok(parsed.download_url.includes('/downloads/job-artifacts'), 'URL should point to proxy endpoint');
    assert.ok(parsed.download_url.includes(`project_id=${TEST_PROJECT_ID}`), 'URL should include project_id');
    assert.ok(parsed.download_url.includes(`job_id=${TEST_JOB_ID}`), 'URL should include job_id');
    assert.ok(parsed.download_url.includes('_token='), 'URL should contain embedded auth token');
    assert.ok(parsed.filename.includes('.zip'), 'Should have zip filename');

    // The URL should work WITHOUT auth headers (token is embedded)
    const downloadRes = await fetch(parsed.download_url);
    assert.strictEqual(downloadRes.status, 200, 'Download URL should work without auth headers');
    const buf = Buffer.from(await downloadRes.arrayBuffer());
    assert.ok(buf.length > 0, 'Downloaded content should not be empty');
    assert.ok(buf.includes(Buffer.from('PK')), 'Should contain zip magic bytes');
  });

  test('download_job_artifacts ignores forwarded hosts containing URL components', async () => {
    const result = await callTool(14, 'download_job_artifacts', {
      project_id: TEST_PROJECT_ID,
      job_id: TEST_JOB_ID,
    }, {
      ...FORWARDED_HEADERS,
      'X-Forwarded-Host': 'gitlab.mcp.example.test@attacker.example.test',
    });

    assert.ok(result.result, 'Should have a result');
    const content = result.result!.content;
    assert.ok(content && content.length > 0, 'Should have content');

    const textBlock = content!.find(c => c.type === 'text');
    assert.ok(textBlock?.text, 'Should have text content');
    const parsed = JSON.parse(textBlock!.text!);

    assert.ok(parsed.download_url, 'Should contain download_url');
    assert.ok(
      parsed.download_url.startsWith(`http://${HOST}:${serverPort}/downloads/job-artifacts?`),
      `URL should fall back to local server address for unsafe forwarded host, got ${parsed.download_url}`
    );
    assert.ok(
      !parsed.download_url.includes('attacker.example.test'),
      `URL should not contain unsafe forwarded host, got ${parsed.download_url}`
    );
    assert.ok(parsed.download_url.includes('_token='), 'URL should contain embedded auth token');
  });

  test('download_job_artifacts ignores authority-style forwarded prefixes', async () => {
    const result = await callTool(15, 'download_job_artifacts', {
      project_id: TEST_PROJECT_ID,
      job_id: TEST_JOB_ID,
    }, {
      ...FORWARDED_HEADERS,
      'X-Forwarded-Prefix': '//attacker.example.test',
    });

    assert.ok(result.result, 'Should have a result');
    const content = result.result!.content;
    assert.ok(content && content.length > 0, 'Should have content');

    const textBlock = content!.find(c => c.type === 'text');
    assert.ok(textBlock?.text, 'Should have text content');
    const parsed = JSON.parse(textBlock!.text!);

    assert.ok(parsed.download_url, 'Should contain download_url');
    assert.ok(
      parsed.download_url.startsWith('https://gitlab.mcp.example.test/downloads/job-artifacts?'),
      `URL should keep forwarded proto/host while ignoring unsafe prefix, got ${parsed.download_url}`
    );
    assert.ok(
      !parsed.download_url.includes('attacker.example.test'),
      `URL should not contain authority-style prefix, got ${parsed.download_url}`
    );
    assert.ok(
      !parsed.download_url.startsWith(`http://${HOST}:${serverPort}`),
      'URL should not fall back to local server address'
    );
    assert.ok(parsed.download_url.includes('_token='), 'URL should contain embedded auth token');
  });

  test('download_job_artifacts uses rightmost forwarded header values', async () => {
    const result = await callTool(16, 'download_job_artifacts', {
      project_id: TEST_PROJECT_ID,
      job_id: TEST_JOB_ID,
    }, {
      'X-Forwarded-Proto': 'http, https',
      'X-Forwarded-Host': 'attacker.example.test, gitlab.mcp.example.test',
      'X-Forwarded-Prefix': '/attacker, /gitlab-mcp',
    });

    assert.ok(result.result, 'Should have a result');
    const content = result.result!.content;
    assert.ok(content && content.length > 0, 'Should have content');

    const textBlock = content!.find(c => c.type === 'text');
    assert.ok(textBlock?.text, 'Should have text content');
    const parsed = JSON.parse(textBlock!.text!);

    assert.ok(parsed.download_url, 'Should contain download_url');
    assert.ok(
      parsed.download_url.startsWith(`${FORWARDED_BASE_URL}/downloads/job-artifacts?`),
      `URL should use the rightmost forwarded header values, got ${parsed.download_url}`
    );
    assert.ok(
      !parsed.download_url.includes('attacker.example.test'),
      `URL should not use the leftmost untrusted forwarded header value, got ${parsed.download_url}`
    );
    assert.ok(parsed.download_url.includes('_token='), 'URL should contain embedded auth token');
  });

  test('download_job_artifacts derives download_url from RFC 7239 Forwarded header', async () => {
    const result = await callTool(18, 'download_job_artifacts', {
      project_id: TEST_PROJECT_ID,
      job_id: TEST_JOB_ID,
    }, RFC_FORWARDED_HEADERS);

    assert.ok(result.result, 'Should have a result');
    const content = result.result!.content;
    assert.ok(content && content.length > 0, 'Should have content');

    const textBlock = content!.find(c => c.type === 'text');
    assert.ok(textBlock?.text, 'Should have text content');
    const parsed = JSON.parse(textBlock!.text!);

    assert.ok(parsed.download_url, 'Should contain download_url');
    assert.ok(
      parsed.download_url.startsWith(`${FORWARDED_BASE_URL}/downloads/job-artifacts?`),
      `URL should use RFC 7239 Forwarded header values, got ${parsed.download_url}`
    );
    assert.ok(
      !parsed.download_url.includes('attacker.example.test'),
      `URL should not use the leftmost untrusted Forwarded value, got ${parsed.download_url}`
    );
    assert.ok(parsed.download_url.includes('_token='), 'URL should contain embedded auth token');
  });

  test('download_job_artifacts derives download_url from forwarded headers when MCP_SERVER_URL is unset', async () => {
    const result = await callTool(17, 'download_job_artifacts', {
      project_id: TEST_PROJECT_ID,
      job_id: TEST_JOB_ID,
    }, FORWARDED_HEADERS);

    assert.ok(result.result, 'Should have a result');
    const content = result.result!.content;
    assert.ok(content && content.length > 0, 'Should have content');

    const textBlock = content!.find(c => c.type === 'text');
    assert.ok(textBlock?.text, 'Should have text content');
    const parsed = JSON.parse(textBlock!.text!);

    assert.ok(parsed.download_url, 'Should contain download_url');
    assert.ok(
      parsed.download_url.startsWith(`${FORWARDED_BASE_URL}/downloads/job-artifacts?`),
      `URL should use forwarded public base URL, got ${parsed.download_url}`
    );
    assert.ok(
      !parsed.download_url.startsWith(`http://${HOST}:${serverPort}`),
      'URL should not fall back to local server address'
    );
    assert.ok(parsed.download_url.includes('_token='), 'URL should contain embedded auth token');
  });

  test('download_attachment for non-image returns download_url', async () => {
    const result = await callTool(11, 'download_attachment', {
      project_id: TEST_PROJECT_ID,
      secret: TEST_SECRET,
      filename: 'document.txt',
    });

    assert.ok(result.result, 'Should have a result');
    const content = result.result!.content;
    assert.ok(content && content.length > 0, 'Should have content');

    const textBlock = content!.find(c => c.type === 'text');
    assert.ok(textBlock?.text, 'Should have text content');
    const parsed = JSON.parse(textBlock!.text!);

    assert.ok(parsed.download_url, 'Should contain download_url');
    assert.ok(parsed.download_url.includes('/downloads/attachment'), 'URL should point to attachment proxy');
    assert.ok(parsed.download_url.includes(`project_id=${TEST_PROJECT_ID}`), 'URL should include project_id');
    assert.ok(parsed.download_url.includes(`secret=${TEST_SECRET}`), 'URL should include secret');
    assert.ok(parsed.download_url.includes('filename=document.txt'), 'URL should include filename');
    assert.strictEqual(parsed.filename, 'document.txt', 'Should echo the filename');
  });

  test('download_attachment for image returns base64 inline', async () => {
    const result = await callTool(12, 'download_attachment', {
      project_id: TEST_PROJECT_ID,
      secret: TEST_SECRET,
      filename: 'image.png',
    });

    assert.ok(result.result, 'Should have a result');
    const content = result.result!.content;
    assert.ok(content && content.length > 0, 'Should have content');

    const imageBlock = content!.find(c => c.type === 'image');
    assert.ok(imageBlock, 'Should contain an image content block');
    assert.strictEqual(imageBlock!.mimeType, 'image/png', 'Should have image/png mime type');
    assert.ok(imageBlock!.data && imageBlock!.data.length > 0, 'Should have non-empty base64 data');
  });

  test('upload_markdown with content+filename works', async () => {
    const fileContent = Buffer.from('hello upload test').toString('base64');
    const result = await callTool(13, 'upload_markdown', {
      project_id: TEST_PROJECT_ID,
      content: fileContent,
      filename: 'test-file.txt',
    });

    assert.ok(result.result, 'Should have a result');
    assert.ok(!result.error, `Should not have error: ${result.error?.message}`);
    const content = result.result!.content;
    assert.ok(content && content.length > 0, 'Should have content');

    const textBlock = content!.find(c => c.type === 'text');
    assert.ok(textBlock?.text, 'Should have text content');
    const parsed = JSON.parse(textBlock!.text!);

    assert.ok(parsed.markdown, 'Should have markdown field');
    assert.ok(parsed.url, 'Should have url field');
  });

  test('upload_markdown with file_path is rejected in remote mode', async () => {
    const result = await callTool(14, 'upload_markdown', {
      project_id: TEST_PROJECT_ID,
      file_path: '/tmp/some-file.txt',
    });

    // In remote mode the server uses MarkdownUploadRemoteSchema which
    // requires content+filename and does not accept file_path. This should
    // result in a validation error.
    const hasError =
      !!result.error ||
      (result.result?.content?.some(c =>
        c.type === 'text' && c.text && (
          c.text.toLowerCase().includes('error') ||
          c.text.toLowerCase().includes('required') ||
          c.text.toLowerCase().includes('invalid')
        )
      ));
    assert.ok(hasError, 'Should reject file_path in remote mode (needs content+filename)');
  });
});
