/**
 * Cookie jar lifecycle and OAuth token refresh in auth/session-store.ts, driven through
 * the injected logger and a local HTTP stub standing in for GitLab's /user endpoint.
 *
 * config.ts reads the environment when it is first imported, so GITLAB_AUTH_COOKIE_PATH
 * is set before the dynamic imports below.
 */
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm, unlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Logger } from "pino";
import { getGlobalDispatcher } from "undici";
import type { GitLabOAuth } from "../../oauth.js";

type SessionStore = typeof import("../../auth/session-store.js");
type RequestContext = typeof import("../../server/gitlab-request-context.js");

const logs: { level: string; msg: string }[] = [];
const recordTo =
  (level: string) =>
  (...args: unknown[]) => {
    logs.push({ level, msg: String(args.find(arg => typeof arg === "string")) });
  };
const logger = {
  info: recordTo("info"),
  warn: recordTo("warn"),
  error: recordTo("error"),
  debug: recordTo("debug"),
} as unknown as Logger;
const messages = () => logs.map(entry => entry.msg);

let server: http.Server;
let dir: string;
let cookiePath: string;
let userHits = 0;
let store: SessionStore;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url?.endsWith("/user")) userHits++;
    res.writeHead(401).end();
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const apiUrl = `http://127.0.0.1:${port}/api/v4`;

  dir = await mkdtemp(path.join(tmpdir(), "session-store-"));
  cookiePath = path.join(dir, "cookies.txt");
  process.env.GITLAB_AUTH_COOKIE_PATH = cookiePath;
  for (const key of [
    "GITLAB_USE_OAUTH",
    "GITLAB_PERSONAL_ACCESS_TOKEN",
    "GITLAB_JOB_TOKEN",
    "REMOTE_AUTHORIZATION",
    "GITLAB_MCP_OAUTH",
    "ENABLE_DYNAMIC_API_URL",
  ]) {
    delete process.env[key];
  }

  store = await import("../../auth/session-store.js");
  const requestContext: RequestContext = await import("../../server/gitlab-request-context.js");
  requestContext.configureGitLabRequestContext({
    logger,
    getDefaultApiUrl: () => apiUrl,
    getDefaultAllowedProjectIds: () => [],
    getDispatcherForUrl: () => getGlobalDispatcher(),
    getOAuthAccessToken: () => null,
  });
  store.configureSessionStore({ logger });
});

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(dir, { recursive: true, force: true });
});

test("cookie file loads on the first request and reloads when it changes or disappears", async () => {
  // A name domain, not 127.0.0.1: tough-cookie rejects an IP address as a cookie domain, and the
  // reload swallows that error, so the jar would stay empty and no warmup would run.
  await writeFile(cookiePath, "localhost\tFALSE\t/\tFALSE\t0\tsession\tabc123\n");
  const initialFetch = store.fetch;
  logs.length = 0;

  await store.ensureSessionForRequest();
  assert.deepEqual(messages(), ["Loading cookie file"]);
  assert.equal(userHits, 1, "first load runs one warmup request");
  assert.notEqual(store.fetch, initialFetch, "fetch is swapped for the cookie-aware one");

  await store.ensureSessionForRequest();
  assert.deepEqual(messages(), ["Loading cookie file"], "unchanged mtime does not reload");
  assert.equal(userHits, 1);

  const later = new Date(Date.now() + 10_000);
  await utimes(cookiePath, later, later);
  await store.ensureSessionForRequest();
  assert.equal(messages().at(-1), "Cookie file changed, reloading");
  assert.equal(userHits, 2, "a reload runs the warmup again");

  await unlink(cookiePath);
  await store.ensureSessionForRequest();
  assert.equal(messages().at(-1), "Cookie file removed, clearing cached cookies");
  assert.equal(userHits, 2, "no jar, no warmup");
});

test("ensureValidOAuthToken stores the refreshed token, and logs and rethrows a refresh failure", async () => {
  logs.length = 0;
  store.setOAuthClient({
    hasValidToken: () => false,
    getAccessToken: async () => "token-1",
  } as unknown as GitLabOAuth);
  await store.ensureValidOAuthToken();
  assert.equal(store.getOAuthAccessToken(), "token-1");

  store.setOAuthClient({
    hasValidToken: () => false,
    getAccessToken: async () => {
      throw new Error("refresh denied");
    },
  } as unknown as GitLabOAuth);
  await assert.rejects(store.ensureValidOAuthToken(), /refresh denied/);
  assert.ok(messages().includes("Failed to refresh OAuth token"));
  assert.equal(store.getOAuthAccessToken(), "token-1", "a failed refresh keeps the old token");
});
