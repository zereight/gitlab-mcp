/**
 * Shared OAuth callback helper tests.
 *
 * With local OAuth, the first MCP process binds the callback port and serves
 * /callback for the browser plus /auth-request for sibling processes on the
 * same machine. Only loopback Host headers are served, and /auth-request needs
 * the per-process key the helper writes under the user's home directory.
 *
 * The helper runs on a free loopback port with a fake browser opener and a
 * mock /oauth/token endpoint. HOME points at a temp directory.
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as http from "node:http";
import { GitLabOAuth, closeSharedOAuthServersAsync } from "../oauth.js";

const SHORT_TIMEOUT_MS = 1500;
const KEY_HEADER = "x-gitlab-mcp-oauth-key";

let tmpHome = "";
let savedHome: string | undefined;
let savedUserProfile: string | undefined;
let callbackPort = 0;
let tokenServer: http.Server | undefined;
let gitlabUrl = "";
let issuedTokens = 0;
let primaryToken: Promise<string> | undefined;

const openedUrls: string[] = [];
const settledStates = new Set<string>();

interface HelperResponse {
  status: number;
  body: string;
}

function keyPath(): string {
  return path.join(tmpHome, `.gitlab-mcp-oauth-${callbackPort}.key`);
}

function loopbackHost(): string {
  return `127.0.0.1:${callbackPort}`;
}

function stateOf(authUrl: string): string {
  const state = new URL(authUrl).searchParams.get("state");
  assert(state, `authorization URL without state: ${authUrl}`);
  return state;
}

async function freePortAsync(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  assert(addr && typeof addr !== "string");
  await new Promise<void>(resolve => server.close(() => resolve()));
  return addr.port;
}

async function waitForOpenedCountAsync(count: number, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (openedUrls.length < count) {
    if (Date.now() > deadline) {
      throw new Error(`browser opener called ${openedUrls.length} times, expected ${count}`);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

function requestHelper(options: {
  path: string;
  host: string;
  method?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}): { response: Promise<HelperResponse>; abort: () => void } {
  let req: http.ClientRequest | undefined;
  const response = new Promise<HelperResponse>((resolve, reject) => {
    req = http.request(
      {
        hostname: "127.0.0.1",
        port: callbackPort,
        path: options.path,
        method: options.method ?? "GET",
        agent: false,
        headers: { ...options.headers, Host: options.host, Connection: "close" },
      },
      res => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", chunk => {
          body += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );
    const timeoutMs = options.timeoutMs ?? SHORT_TIMEOUT_MS;
    req.setTimeout(timeoutMs, () => {
      req?.destroy();
      reject(new Error(`no response from ${options.path} within ${timeoutMs} ms`));
    });
    req.on("error", reject);
    req.end();
  });
  return { response, abort: () => req?.destroy() };
}

async function callbackAsync(query: string, host = loopbackHost()): Promise<HelperResponse> {
  return requestHelper({ path: `/callback?${query}`, host }).response;
}

async function completeFlowAsync(authUrl: string): Promise<HelperResponse> {
  const state = stateOf(authUrl);
  settledStates.add(state);
  return callbackAsync(`code=test-code&state=${encodeURIComponent(state)}`);
}

// Settle every flow the helper opened so no 5-minute flow timer outlives the suite.
async function denyOpenFlowsAsync(): Promise<void> {
  for (const authUrl of openedUrls) {
    const state = stateOf(authUrl);
    if (settledStates.has(state)) continue;
    settledStates.add(state);
    await callbackAsync(`error=access_denied&state=${encodeURIComponent(state)}`).catch(
      () => undefined
    );
  }
}

function makeClient(name: string): GitLabOAuth {
  return new GitLabOAuth({
    clientId: "test-client",
    redirectUri: `http://127.0.0.1:${callbackPort}/callback`,
    gitlabUrl,
    scopes: ["api"],
    tokenStoragePath: path.join(tmpHome, `${name}-token.json`),
    openBrowser: async url => {
      openedUrls.push(url);
    },
  });
}

describe("shared OAuth callback helper", () => {
  before(async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "oauth-shared-helper-"));
    savedHome = process.env.HOME;
    savedUserProfile = process.env.USERPROFILE;
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    assert.strictEqual(os.homedir(), tmpHome);

    tokenServer = http.createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        issuedTokens += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            access_token: `helper-token-${issuedTokens}`,
            refresh_token: `helper-refresh-${issuedTokens}`,
            expires_in: 7200,
            token_type: "Bearer",
            scope: "api",
          })
        );
      });
    });
    await new Promise<void>(resolve => tokenServer?.listen(0, "127.0.0.1", () => resolve()));
    const addr = tokenServer.address();
    assert(addr && typeof addr !== "string");
    gitlabUrl = `http://127.0.0.1:${addr.port}`;

    callbackPort = await freePortAsync();
    primaryToken = makeClient("primary").getAccessToken();
    primaryToken.catch(() => undefined);
    await waitForOpenedCountAsync(1);
  });

  after(async () => {
    await denyOpenFlowsAsync();
    await closeSharedOAuthServersAsync();
    await new Promise<void>(resolve =>
      tokenServer ? tokenServer.close(() => resolve()) : resolve()
    );
    if (savedHome === undefined) delete process.env.HOME;
    else process.env.HOME = savedHome;
    if (savedUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = savedUserProfile;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  test("answers 403 to /auth-request with a non-loopback Host", async () => {
    for (const method of ["GET", "POST"]) {
      const { response } = requestHelper({
        path: "/auth-request?requestId=from-other-host",
        host: `other-host.example:${callbackPort}`,
        method,
      });
      const res = await response;
      assert.strictEqual(res.status, 403, `${method} status`);
    }
  });

  test("answers 403 to /callback with a non-loopback Host", async () => {
    const res = await callbackAsync(
      "code=x&state=unknown-state",
      `other-host.example:${callbackPort}`
    );
    assert.strictEqual(res.status, 403);
  });

  test("answers 403 to /auth-request without the helper key", async () => {
    const attempts: Array<{ host: string; headers?: Record<string, string> }> = [
      { host: loopbackHost() },
      { host: `localhost:${callbackPort}` },
      { host: loopbackHost(), headers: { [KEY_HEADER]: "0".repeat(64) } },
    ];
    for (const attempt of attempts) {
      const { response } = requestHelper({
        path: "/auth-request?requestId=without-key",
        ...attempt,
      });
      const res = await response;
      assert.strictEqual(res.status, 403, JSON.stringify(attempt));
    }
  });

  test(
    "writes the helper key to an owner-only file",
    { skip: process.platform === "win32" },
    () => {
      const stat = fs.lstatSync(keyPath());
      assert(stat.isFile());
      assert.strictEqual((stat.mode & 0o777).toString(8), "600");
      assert.match(fs.readFileSync(keyPath(), "utf8").trim(), /^[0-9a-f]{64}$/);
    }
  );

  test("starts a flow for /auth-request with the helper key", async () => {
    const key = fs.readFileSync(keyPath(), "utf8").trim();
    const opened = openedUrls.length;
    const { response, abort } = requestHelper({
      path: "/auth-request?requestId=with-key",
      host: loopbackHost(),
      headers: { [KEY_HEADER]: key },
      timeoutMs: 10000,
    });
    response.catch(() => undefined);
    try {
      await waitForOpenedCountAsync(opened + 1, SHORT_TIMEOUT_MS);
    } catch (error) {
      abort();
      throw error;
    }
    const callback = await completeFlowAsync(openedUrls[opened]);
    assert.strictEqual(callback.status, 200);
    const res = await response;
    assert.strictEqual(res.status, 200);
    const tokenData: unknown = JSON.parse(res.body);
    assert(typeof tokenData === "object" && tokenData !== null);
    assert.match(String(Reflect.get(tokenData, "access_token")), /^helper-token-\d+$/);
  });

  test("keeps answering /callback on loopback Hosts", async () => {
    for (const host of [loopbackHost(), `localhost:${callbackPort}`]) {
      const res = await callbackAsync("code=x&state=unknown-state", host);
      assert.strictEqual(res.status, 400, host);
      assert.match(res.body, /Unknown state parameter/);
    }

    const res = await completeFlowAsync(openedUrls[0]);
    assert.strictEqual(res.status, 200);
    assert.match(res.body, /Authentication Successful/);
    assert.match(await (primaryToken as Promise<string>), /^helper-token-\d+$/);
  });

  test("hands a token to a sibling instance on the same port", async () => {
    const opened = openedUrls.length;
    const sibling = makeClient("sibling").getAccessToken();
    sibling.catch(() => undefined);
    await waitForOpenedCountAsync(opened + 1);
    const callback = await completeFlowAsync(openedUrls[opened]);
    assert.strictEqual(callback.status, 200);
    assert.match(await sibling, /^helper-token-\d+$/);
  });

  test("reports a clear error when the helper key file is missing", async () => {
    const movedKey = `${keyPath()}.moved`;
    fs.renameSync(keyPath(), movedKey);
    try {
      const sibling = makeClient("sibling-without-key").getAccessToken();
      sibling.catch(() => undefined);
      const outcome = await Promise.race([
        sibling.then(
          () => new Error("sibling unexpectedly received a token"),
          (error: unknown) => error
        ),
        new Promise(resolve =>
          setTimeout(() => resolve(new Error("sibling did not fail promptly")), SHORT_TIMEOUT_MS)
        ),
      ]);
      assert(outcome instanceof Error);
      assert.match(outcome.message, /cannot connect to existing OAuth server/);
      assert.match(outcome.message, /same OS user/);
    } finally {
      fs.renameSync(movedKey, keyPath());
    }
  });

  test("removes the helper key file when the helper stops", async () => {
    await denyOpenFlowsAsync();
    await closeSharedOAuthServersAsync();
    assert.strictEqual(fs.existsSync(keyPath()), false);
  });

  test(
    "replaces a key file left by an earlier run",
    { skip: process.platform === "win32" },
    async () => {
      callbackPort = await freePortAsync();
      fs.writeFileSync(keyPath(), "f".repeat(64), { mode: 0o644 });
      makeClient("stale")
        .getAccessToken()
        .catch(() => undefined);
      await waitForOpenedCountAsync(openedUrls.length + 1);
      try {
        const stat = fs.lstatSync(keyPath());
        assert(stat.isFile());
        assert.strictEqual((stat.mode & 0o777).toString(8), "600");
        assert.notStrictEqual(fs.readFileSync(keyPath(), "utf8").trim(), "f".repeat(64));
      } finally {
        await denyOpenFlowsAsync();
        await closeSharedOAuthServersAsync();
      }
    }
  );

  test(
    "does not write through a symlink at the key path",
    { skip: process.platform === "win32" },
    async () => {
      callbackPort = await freePortAsync();
      const target = path.join(tmpHome, "symlink-target");
      fs.writeFileSync(target, "unchanged");
      fs.symlinkSync(target, keyPath());
      makeClient("symlink")
        .getAccessToken()
        .catch(() => undefined);
      await waitForOpenedCountAsync(openedUrls.length + 1);
      try {
        assert(fs.lstatSync(keyPath()).isSymbolicLink());
        assert.strictEqual(fs.readFileSync(target, "utf8"), "unchanged");
        const { response } = requestHelper({
          path: "/auth-request?requestId=through-symlink",
          host: loopbackHost(),
          headers: { [KEY_HEADER]: "unchanged" },
        });
        assert.strictEqual((await response).status, 403);
      } finally {
        await denyOpenFlowsAsync();
        await closeSharedOAuthServersAsync();
      }
    }
  );
});
