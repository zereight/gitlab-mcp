/**
 * Regression tests for OAUTH_STATELESS_SESSION_TTL_SECONDS parsing.
 *
 * Maintainer feedback (zereight, PR #442):
 *   "This can still disable stateless session expiry when
 *   OAUTH_STATELESS_SESSION_TTL_SECONDS is unset and SESSION_TIMEOUT_SECONDS
 *   is invalid. In that state, this fallback becomes NaN; _intEnv() returns
 *   the fallback directly when the stateless-specific value is missing, so
 *   OAUTH_STATELESS_SESSION_TTL_SECONDS becomes NaN instead of falling back
 *   to a safe positive default."
 *
 * The fix validates both the direct env/CLI value and the fallback inside
 * _intEnv, and also sanitizes SESSION_TIMEOUT_SECONDS itself through the
 * same helper so its downstream consumers always see a finite positive
 * integer.
 *
 * config.ts reads process.env / process.argv at module load, so these
 * tests use a child process per scenario to control the environment.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as url from "node:url";
import { describe, test } from "node:test";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, "../../config.ts");

interface ConfigSnapshot {
  SESSION_TIMEOUT_SECONDS: number;
  OAUTH_STATELESS_SESSION_TTL_SECONDS: number;
  OAUTH_STATELESS_CLIENT_TTL_SECONDS: number;
  PORT: number;
}

/**
 * Spawn a child Node process that imports config.ts with the given env
 * overrides, and returns a structured snapshot of the parsed numeric
 * config values. We pipe a tiny evaluator script through stdin (`--eval`
 * with tsx via `--import`) to keep the test hermetic.
 */
function loadConfig(env: Record<string, string | undefined>): ConfigSnapshot {
  const script = `
    import(${JSON.stringify(url.pathToFileURL(CONFIG_PATH).href)}).then((m) => {
      const out = {
        SESSION_TIMEOUT_SECONDS: m.SESSION_TIMEOUT_SECONDS,
        OAUTH_STATELESS_SESSION_TTL_SECONDS: m.OAUTH_STATELESS_SESSION_TTL_SECONDS,
        OAUTH_STATELESS_CLIENT_TTL_SECONDS: m.OAUTH_STATELESS_CLIENT_TTL_SECONDS,
        PORT: m.PORT,
      };
      process.stdout.write(JSON.stringify(out));
    }).catch((err) => {
      process.stderr.write(String(err && err.stack || err));
      process.exit(2);
    });
  `;

  // Strip undefined entries so they truly aren't set in the child's env.
  const childEnv: Record<string, string> = {
    // Keep PATH / basic vars so tsx can spawn.
    ...(process.env as Record<string, string>),
  };
  // Reset anything that could interfere with the test even if our caller
  // didn't set it — make every variable start clean.
  delete childEnv.SESSION_TIMEOUT_SECONDS;
  delete childEnv.OAUTH_STATELESS_SESSION_TTL_SECONDS;
  delete childEnv.OAUTH_STATELESS_CLIENT_TTL_SECONDS;
  delete childEnv.PORT;
  // Apply the per-test overrides last.
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
    {
      env: childEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  return JSON.parse(stdout) as ConfigSnapshot;
}

describe("config.ts TTL parsing — finite-positive guards", () => {
  test("happy path: both TTLs default to 3600 when unset", () => {
    const cfg = loadConfig({});
    assert.equal(cfg.SESSION_TIMEOUT_SECONDS, 3600);
    assert.equal(cfg.OAUTH_STATELESS_SESSION_TTL_SECONDS, 3600);
  });

  test("OAUTH_STATELESS_SESSION_TTL_SECONDS honors its own env value", () => {
    const cfg = loadConfig({
      OAUTH_STATELESS_SESSION_TTL_SECONDS: "7200",
    });
    assert.equal(cfg.OAUTH_STATELESS_SESSION_TTL_SECONDS, 7200);
  });

  test("OAUTH_STATELESS_SESSION_TTL_SECONDS inherits valid SESSION_TIMEOUT_SECONDS", () => {
    const cfg = loadConfig({
      SESSION_TIMEOUT_SECONDS: "1800",
    });
    assert.equal(cfg.SESSION_TIMEOUT_SECONDS, 1800);
    assert.equal(cfg.OAUTH_STATELESS_SESSION_TTL_SECONDS, 1800);
  });

  test("invalid SESSION_TIMEOUT_SECONDS must not poison OAUTH_STATELESS_SESSION_TTL_SECONDS (NaN regression)", () => {
    // Regression for zereight's P-level PR review feedback. Before the
    // fix, _intEnv returned NaN verbatim from the fallback when the
    // stateless-specific var was unset, which silently disabled TTL
    // checks in checkIat (`ttlSec > 0` is false for NaN).
    const cfg = loadConfig({
      SESSION_TIMEOUT_SECONDS: "not-a-number",
    });
    assert.equal(
      cfg.OAUTH_STATELESS_SESSION_TTL_SECONDS,
      3600,
      "OAUTH_STATELESS_SESSION_TTL_SECONDS must fall back to the hardcoded 3600 default when SESSION_TIMEOUT_SECONDS is invalid"
    );
    assert.equal(
      cfg.SESSION_TIMEOUT_SECONDS,
      3600,
      "SESSION_TIMEOUT_SECONDS must sanitize its own input too"
    );
    assert.ok(
      Number.isFinite(cfg.OAUTH_STATELESS_SESSION_TTL_SECONDS),
      "OAUTH_STATELESS_SESSION_TTL_SECONDS must be a finite number"
    );
    assert.ok(
      cfg.OAUTH_STATELESS_SESSION_TTL_SECONDS > 0,
      "OAUTH_STATELESS_SESSION_TTL_SECONDS must be strictly positive"
    );
  });

  test("zero and negative SESSION_TIMEOUT_SECONDS fall back to the safe default", () => {
    for (const badValue of ["0", "-1", "-3600"]) {
      const cfg = loadConfig({ SESSION_TIMEOUT_SECONDS: badValue });
      assert.equal(
        cfg.SESSION_TIMEOUT_SECONDS,
        3600,
        `SESSION_TIMEOUT_SECONDS=${badValue} should sanitize to default`
      );
      assert.equal(
        cfg.OAUTH_STATELESS_SESSION_TTL_SECONDS,
        3600,
        `OAUTH_STATELESS_SESSION_TTL_SECONDS should inherit the sanitized default from SESSION_TIMEOUT_SECONDS=${badValue}`
      );
    }
  });

  test("garbage OAUTH_STATELESS_SESSION_TTL_SECONDS falls back to SESSION_TIMEOUT_SECONDS (when valid) or safe default", () => {
    const cfg = loadConfig({
      OAUTH_STATELESS_SESSION_TTL_SECONDS: "garbage",
      SESSION_TIMEOUT_SECONDS: "1800",
    });
    assert.equal(
      cfg.OAUTH_STATELESS_SESSION_TTL_SECONDS,
      1800,
      "invalid direct value should defer to the valid fallback"
    );

    const cfg2 = loadConfig({
      OAUTH_STATELESS_SESSION_TTL_SECONDS: "garbage",
      SESSION_TIMEOUT_SECONDS: "also-garbage",
    });
    assert.equal(
      cfg2.OAUTH_STATELESS_SESSION_TTL_SECONDS,
      3600,
      "both invalid should hit the hardcoded safe default"
    );
  });

  test("other _intEnv consumers remain unaffected (client TTL default)", () => {
    // Guards against an accidental over-broad change to _intEnv.
    const cfg = loadConfig({});
    assert.equal(cfg.OAUTH_STATELESS_CLIENT_TTL_SECONDS, 86_400);
  });

  test("PORT uses the hardened _intEnv and rejects invalid values", () => {
    const cfg = loadConfig({ PORT: "not-a-port" });
    assert.equal(
      cfg.PORT,
      3002,
      "invalid PORT should fall back to the default rather than NaN"
    );
  });
});
