/**
 * Startup-level regression test for removed settings.
 *
 * Spawns the built server (build/index.js) exactly as an MCP client would and
 * asserts that an active removed setting stops startup with a migration error
 * that names the replacement and links the migration guide and tracking issue.
 * Run `npm run build` first (test:mock does this in CI).
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SERVER_ENTRY = fileURLToPath(new URL("../build/index.js", import.meta.url));
const MIGRATION_GUIDE =
  "https://github.com/zereight/gitlab-mcp/blob/main/docs/migration/v2-to-v3.md";
const TRACKING_ISSUE = "https://github.com/zereight/gitlab-mcp/issues/815";
// A correct refusal exits during module load, long before this. A server that
// starts instead keeps running, so the timeout is what makes the test fail.
const EXIT_TIMEOUT_MS = 15_000;

interface StartResult {
  code: number | null;
  timedOut: boolean;
  stderr: string;
}

// Drop inherited GITLAB_, USE_, and transport settings so the developer's shell cannot leak in.
function hermeticEnv(extra: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (/^(GITLAB_|USE_|STREAMABLE|SSE|REMOTE_|OAUTH_)/.test(key)) continue;
    env[key] = value;
  }
  return {
    ...env,
    GITLAB_API_URL: "https://gitlab.example.test/api/v4",
    GITLAB_PERSONAL_ACCESS_TOKEN: "startup-test-token",
    GITLAB_DISABLE_VERSION_CHECK: "true",
    ...extra,
  };
}

function startServer(extraEnv: Record<string, string>, args: string[] = []): Promise<StartResult> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [SERVER_ENTRY, ...args], {
      env: hermeticEnv(extraEnv),
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    let timedOut = false;
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, EXIT_TIMEOUT_MS);
    child.on("close", code => {
      clearTimeout(timer);
      resolve({ code, timedOut, stderr });
    });
  });
}

function assertRefused(result: StartResult, replacement: string): void {
  assert.equal(result.timedOut, false, "server kept running instead of refusing to start");
  assert.equal(result.code, 1, `expected exit code 1, got ${result.code}\n${result.stderr}`);
  assert.match(result.stderr, /Removed configuration detected/);
  assert.ok(result.stderr.includes(replacement), `missing replacement "${replacement}"`);
  // Exact line match, not substring: the links must be the whole URL, not a prefix of a longer one.
  const lines = result.stderr.split("\n").map(line => line.trim());
  assert.ok(lines.includes(`Migration guide: ${MIGRATION_GUIDE}`), "missing migration guide link");
  assert.ok(lines.includes(`Tracking issue: ${TRACKING_ISSUE}`), "missing tracking issue link");
}

describe("Removed settings stop server startup", () => {
  it("refuses GITLAB_READ_ONLY_MODE=true and names GITLAB_PERMISSION_MODE=readonly", async () => {
    const result = await startServer({ GITLAB_READ_ONLY_MODE: "true" });
    assertRefused(result, "GITLAB_PERMISSION_MODE=readonly");
  });

  it("refuses the --read-only CLI flag and names GITLAB_PERMISSION_MODE=readonly", async () => {
    const result = await startServer({}, ["--read-only"]);
    assertRefused(result, "GITLAB_PERMISSION_MODE=readonly");
  });

  it("refuses GITLAB_ALLOWED_GROUPS and names GITLAB_OAUTH_ALLOWED_GROUPS", async () => {
    const result = await startServer({ GITLAB_ALLOWED_GROUPS: "my-group" });
    assertRefused(result, "GITLAB_OAUTH_ALLOWED_GROUPS");
  });

  it("refuses the --allowed-groups CLI flag and names GITLAB_OAUTH_ALLOWED_GROUPS", async () => {
    const result = await startServer({}, ["--allowed-groups", "my-group"]);
    assertRefused(result, "GITLAB_OAUTH_ALLOWED_GROUPS");
  });
  it("refuses USE_GITLAB_WIKI=true and names GITLAB_TOOLSETS=core,wiki", async () => {
    const result = await startServer({ USE_GITLAB_WIKI: "true" }, []);
    assertRefused(result, "GITLAB_TOOLSETS=core,wiki");
  });

  it("refuses the --use-wiki CLI flag and names GITLAB_TOOLSETS=core,wiki", async () => {
    const result = await startServer({}, ["--use-wiki"]);
    assertRefused(result, "GITLAB_TOOLSETS=core,wiki");
  });

  it("refuses USE_MILESTONE=true and names GITLAB_TOOLSETS=core,milestones", async () => {
    const result = await startServer({ USE_MILESTONE: "true" }, []);
    assertRefused(result, "GITLAB_TOOLSETS=core,milestones");
  });

  it("refuses the --use-milestone CLI flag and names GITLAB_TOOLSETS=core,milestones", async () => {
    const result = await startServer({}, ["--use-milestone"]);
    assertRefused(result, "GITLAB_TOOLSETS=core,milestones");
  });

  it("refuses USE_PIPELINE=true and names GITLAB_TOOLSETS=core,pipelines", async () => {
    const result = await startServer({ USE_PIPELINE: "true" }, []);
    assertRefused(result, "GITLAB_TOOLSETS=core,pipelines");
  });

  it("refuses the --use-pipeline CLI flag and names GITLAB_TOOLSETS=core,pipelines", async () => {
    const result = await startServer({}, ["--use-pipeline"]);
    assertRefused(result, "GITLAB_TOOLSETS=core,pipelines");
  });
});
