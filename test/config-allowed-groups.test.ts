/**
 * Tests for GITLAB_OAUTH_ALLOWED_GROUPS config resolution.
 *
 * Verifies that:
 *   - The new GITLAB_OAUTH_ALLOWED_GROUPS env var is preferred when set.
 *   - The removed GITLAB_ALLOWED_GROUPS makes config loading fail closed.
 *
 * config.ts reads process.env at module load, so each scenario runs in a
 * fresh child process — same pattern as test/stateless/config-ttl.test.ts.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as url from "node:url";
import { describe, test } from "node:test";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, "../config.ts");

interface ConfigSnapshot {
  GITLAB_OAUTH_ALLOWED_GROUPS: string[] | null;
  GITLAB_OAUTH_ALLOWED_GROUPS_RAW: string | null;
}

function loadConfig(env: Record<string, string | undefined>): ConfigSnapshot {
  const script = `
    import(${JSON.stringify(url.pathToFileURL(CONFIG_PATH).href)}).then((m) => {
      const out = {
        GITLAB_OAUTH_ALLOWED_GROUPS: m.GITLAB_OAUTH_ALLOWED_GROUPS ?? null,
        GITLAB_OAUTH_ALLOWED_GROUPS_RAW: m.GITLAB_OAUTH_ALLOWED_GROUPS_RAW ?? null,
      };
      process.stdout.write(JSON.stringify(out));
    }).catch((err) => {
      process.stderr.write(String(err && err.stack || err));
      process.exit(2);
    });
  `;

  const childEnv: Record<string, string> = {
    ...(process.env as Record<string, string>),
  };
  delete childEnv.GITLAB_OAUTH_ALLOWED_GROUPS;
  delete childEnv.GITLAB_ALLOWED_GROUPS;
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) {
      delete childEnv[k];
    } else {
      childEnv[k] = v;
    }
  }

  const stdout = execFileSync(
    process.execPath,
    ["--import", "tsx/esm", "--input-type=module", "--eval", script],
    { env: childEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  return JSON.parse(stdout) as ConfigSnapshot;
}

describe("config.ts — GITLAB_OAUTH_ALLOWED_GROUPS resolution", () => {
  test("neither var set — resolved value and raws are null", () => {
    const cfg = loadConfig({});
    assert.equal(cfg.GITLAB_OAUTH_ALLOWED_GROUPS, null);
    assert.equal(cfg.GITLAB_OAUTH_ALLOWED_GROUPS_RAW, null);
  });

  test("only new var set — resolved correctly, deprecated raw is null", () => {
    const cfg = loadConfig({ GITLAB_OAUTH_ALLOWED_GROUPS: "my-org" });
    assert.deepEqual(cfg.GITLAB_OAUTH_ALLOWED_GROUPS, ["my-org"]);
    assert.equal(cfg.GITLAB_OAUTH_ALLOWED_GROUPS_RAW, "my-org");
  });

  test("removed GITLAB_ALLOWED_GROUPS — config load fails closed", () => {
    assert.throws(() => loadConfig({ GITLAB_ALLOWED_GROUPS: "my-org" }));
  });

  test("comma-separated values are split and trimmed", () => {
    const cfg = loadConfig({
      GITLAB_OAUTH_ALLOWED_GROUPS: "my-org/team-a , my-org/team-b , my-org",
    });
    assert.deepEqual(cfg.GITLAB_OAUTH_ALLOWED_GROUPS, [
      "my-org/team-a",
      "my-org/team-b",
      "my-org",
    ]);
  });

  test("empty string resolves to null", () => {
    const cfg = loadConfig({ GITLAB_OAUTH_ALLOWED_GROUPS: "" });
    assert.equal(cfg.GITLAB_OAUTH_ALLOWED_GROUPS, null);
  });

  test("whitespace-only entries are filtered out", () => {
    const cfg = loadConfig({ GITLAB_OAUTH_ALLOWED_GROUPS: " , , " });
    assert.equal(cfg.GITLAB_OAUTH_ALLOWED_GROUPS, null);
  });
});
