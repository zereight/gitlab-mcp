/**
 * Live E2E for the GITLAB_API_URL comma rule (#876). A comma that may be inside a
 * username or password stops startup, and the error does not print the value. The
 * same password written with %2C is accepted: the server starts and get_project
 * returns the test project from the live instance.
 *
 * Both cases put fake userinfo in front of the live host, so the real token is the
 * only credential the server uses. The refusal case checks stdout and stderr for the
 * fake user, the fake password, and the live host name. The acceptance case checks
 * stderr for the fake user and the %2C password.
 *
 * test/startup-url-redaction.test.ts covers the refusal without a token on every PR
 * (`npm run test:mock`). This file adds the acceptance half against a real instance.
 *
 * Skips without a token or a project ID, like the other live files. The project comes
 * from TEST_PROJECT_ID, or from GITLAB_PROJECT_ID. The server is spawned with a minimal
 * environment, not StdioTestClient: that client copies the whole process environment,
 * so a developer's GITLAB_* settings could change the outcome, and it does not expose
 * stderr.
 */

import { describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { normalizeGitLabApiUrl } from "../../utils/url.js";

dotenv.config();

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SERVER_ENTRY = path.join(REPO_ROOT, "build/index.js");

const GITLAB_TOKEN =
  process.env.GITLAB_TOKEN_TEST ||
  process.env.GITLAB_TOKEN ||
  process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID || process.env.GITLAB_PROJECT_ID;
const LIVE_API_URL = normalizeGitLabApiUrl(process.env.GITLAB_API_URL || "https://gitlab.com");
const LIVE_HOST = new URL(LIVE_API_URL).host;

const SKIP_REASON = !GITLAB_TOKEN
  ? "no GitLab token; set GITLAB_TOKEN_TEST, GITLAB_TOKEN, or GITLAB_PERSONAL_ACCESS_TOKEN"
  : !TEST_PROJECT_ID
    ? "no test project; set TEST_PROJECT_ID (or GITLAB_PROJECT_ID)"
    : false;

// Fake credentials. The server must not print them, and must not send them to GitLab.
const FAKE_USER = "e2e-comma-user";
const FAKE_PASSWORD = "e2e,comma-pw-5a1c";
const ENCODED_PASSWORD = "e2e%2Ccomma-pw-5a1c";
const AMBIGUOUS_COMMA_ERROR = /GITLAB_API_URL comma 1 of 1 may be inside a username or password/;

// The live API URL with fake userinfo in front of its host. The path is the one
// GITLAB_API_URL normalizes to (it always ends in /api/v4).
function withUserinfo(password: string): string {
  const url = new URL(LIVE_API_URL);
  return `${url.protocol}//${FAKE_USER}:${password}@${url.host}${url.pathname}`;
}

// Only PATH and HOME come from the parent; the server reads the rest from here.
// Assertion messages below never include stdout or stderr: a regression would print
// the value there, and a failure message would copy it into the CI log.
function serverEnv(apiUrl: string, extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {
    GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
    GITLAB_API_URL: apiUrl,
    GITLAB_DISABLE_VERSION_CHECK: "true",
    LOG_LEVEL: "info",
    ...extra,
  };
  if (process.env.PATH !== undefined) {
    env.PATH = process.env.PATH;
  }
  if (process.env.HOME !== undefined) {
    env.HOME = process.env.HOME;
  }
  return env;
}

interface StartupExit {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

async function runUntilExitAsync(apiUrl: string): Promise<StartupExit> {
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: REPO_ROOT,
    env: serverEnv(apiUrl),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout?.on("data", chunk => stdoutChunks.push(Buffer.from(chunk)));
  child.stderr?.on("data", chunk => stderrChunks.push(Buffer.from(chunk)));
  // A server that starts instead of refusing keeps running; the timer ends it.
  const timer = setTimeout(() => child.kill("SIGKILL"), 20_000);
  try {
    const [code] = await once(child, "close");
    return {
      code: code as number | null,
      stdout: Buffer.concat(stdoutChunks).toString("utf8"),
      stderr: Buffer.concat(stderrChunks).toString("utf8"),
    };
  } finally {
    clearTimeout(timer);
  }
}

interface ProjectOverStdio {
  readonly payload: Record<string, unknown>;
  readonly stderr: string;
}

async function getProjectOverStdioAsync(apiUrl: string): Promise<ProjectOverStdio> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    cwd: REPO_ROOT,
    env: serverEnv(apiUrl, { GITLAB_TOOLSETS: "core", GITLAB_PERMISSION_MODE: "readonly" }),
    stderr: "pipe",
  });
  let stderr = "";
  const stderrStream = transport.stderr;
  stderrStream?.on("data", chunk => {
    stderr += String(chunk);
  });
  const stderrEnded = stderrStream ? once(stderrStream, "end") : Promise.resolve();
  const client = new Client({ name: "api-url-comma-live", version: "1.0.0" });
  let payload: Record<string, unknown> = {};
  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: "get_project",
      arguments: { project_id: String(TEST_PROJECT_ID) },
    });
    assert.notStrictEqual(result.isError, true, "get_project should succeed");
    const text = (result.content as Array<{ text?: string }>).map(part => part.text ?? "").join("");
    payload = JSON.parse(text) as Record<string, unknown>;
  } finally {
    await client.close();
  }
  // Let stderr reach its end after the child exits, so the leak check sees all of it.
  await Promise.race([stderrEnded, new Promise(resolve => setTimeout(resolve, 5_000))]);
  return { payload, stderr };
}

describe("live: GITLAB_API_URL comma rule (#876)", { skip: SKIP_REASON }, () => {
  test("a literal comma in the password stops startup without printing the value", async () => {
    const outcome = await runUntilExitAsync(withUserinfo(FAKE_PASSWORD));

    assert.equal(outcome.code, 1, "startup should be refused with exit code 1");
    assert.equal(outcome.stdout, "", "the refusal should not write to stdout");
    assert.ok(
      AMBIGUOUS_COMMA_ERROR.test(outcome.stderr),
      "the refusal should name the ambiguous comma"
    );
    for (const secret of [FAKE_USER, FAKE_PASSWORD, LIVE_HOST]) {
      const printed = outcome.stdout.includes(secret) || outcome.stderr.includes(secret);
      assert.equal(printed, false, "the refusal printed part of GITLAB_API_URL");
    }
  });

  test("the same password written as %2C is accepted and get_project reaches the instance", async () => {
    const { payload, stderr } = await getProjectOverStdioAsync(withUserinfo(ENCODED_PASSWORD));

    assert.equal(
      String(payload.id),
      String(TEST_PROJECT_ID),
      "get_project should return the test project"
    );
    assert.equal(stderr.includes(ENCODED_PASSWORD), false, "stderr should not print the password");
    assert.equal(stderr.includes(FAKE_USER), false, "stderr should not print the user name");
  });
});
