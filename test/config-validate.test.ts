/**
 * Characterization tests for the startup checks moved out of index.ts into
 * config-validate.ts, and for the call-time env getters in config.ts.
 *
 * The validator reads process.env when it is called, so these run in-process.
 * A fake logger records each call, and exitAfterFlush throws a sentinel instead
 * of exiting. Messages, their order, and the exit code are the pre-move values.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  getGitlabGraphqlUrlOverride,
  getMaxRequestsPerMinute,
  getMaxSessions,
  getOauthRegisterRateLimitPerHour,
} from "../config.js";
import { validateConfiguration } from "../config-validate.js";

// Every env key the validator or the getters read. Each test starts from empty.
const ENV_KEYS = [
  "SESSION_TIMEOUT_SECONDS",
  "MAX_SESSIONS",
  "MAX_REQUESTS_PER_MINUTE",
  "OAUTH_REGISTER_RATE_LIMIT_PER_HOUR",
  "PORT",
  "GITLAB_API_URL",
  "GITLAB_ALLOWED_HOSTS",
  "MCP_ALLOWED_HOSTS",
  "MCP_ALLOWED_ORIGINS",
  "REMOTE_AUTHORIZATION",
  "GITLAB_USE_OAUTH",
  "GITLAB_JOB_TOKEN",
  "GITLAB_AUTH_COOKIE_PATH",
  "GITLAB_MCP_OAUTH",
  "MCP_SERVER_URL",
  "MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL",
  "GITLAB_OAUTH_APP_ID",
  "GITLAB_OAUTH_CALLBACK_PROXY",
  "STREAMABLE_HTTP",
  "STREAMABLE_HTTP_AUTH_TOKEN",
  "SSE",
  "SSE_AUTH_TOKEN",
  "SSE_DANGEROUSLY_ALLOW_UNAUTHENTICATED_REMOTE",
  "ENABLE_DYNAMIC_API_URL",
  "ENABLE_DYNAMIC_PROJECT_SCOPE",
  "GITLAB_GRAPHQL_URL",
];

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  // Satisfies the "some credential is set" check without touching the PAT
  // constant, which config.ts resolves once at load.
  process.env.GITLAB_JOB_TOKEN = "placeholder-job-token";
});

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
});

class ExitSignal extends Error {
  constructor(readonly code: number) {
    super(`exit ${code}`);
  }
}

interface Outcome {
  exitCode: number | undefined;
  info: string[];
  warn: string[];
  error: string[];
}

function runValidation(): Outcome {
  const out: Outcome = { exitCode: undefined, info: [], warn: [], error: [] };
  const logger = {
    info: (...args: unknown[]) => void out.info.push(String(args[0])),
    warn: (...args: unknown[]) => void out.warn.push(String(args[0])),
    error: (...args: unknown[]) => void out.error.push(String(args[0])),
  };
  const exitAfterFlush = (code: number): never => {
    throw new ExitSignal(code);
  };
  try {
    validateConfiguration({
      logger,
      exitAfterFlush,
      configuredGitLabApiUrlErrors: () => [],
    });
  } catch (error) {
    if (!(error instanceof ExitSignal)) throw error;
    out.exitCode = error.code;
  }
  return out;
}

describe("validateConfiguration", () => {
  it("passes a clean configuration and logs only the success line", () => {
    const out = runValidation();
    assert.equal(out.exitCode, undefined);
    assert.deepEqual(out.info, ["Configuration validation passed"]);
    assert.deepEqual(out.warn, []);
    assert.deepEqual(out.error, []);
  });

  it("reports every invalid numeric limit in validator order, then exits 1", () => {
    process.env.SESSION_TIMEOUT_SECONDS = "0";
    process.env.MAX_SESSIONS = "10001";
    process.env.MAX_REQUESTS_PER_MINUTE = "1001";
    process.env.OAUTH_REGISTER_RATE_LIMIT_PER_HOUR = "1.5";
    process.env.PORT = "70000";

    const out = runValidation();
    assert.equal(out.exitCode, 1);
    assert.deepEqual(out.info, []);
    assert.deepEqual(out.warn, [
      "SESSION_TIMEOUT_SECONDS=0 is below recommended minimum of 60 seconds. Only use low values for testing.",
    ]);
    assert.deepEqual(out.error, [
      "Configuration validation failed:",
      "  - SESSION_TIMEOUT_SECONDS must be between 1 and 86400 seconds, got: 0",
      "  - MAX_SESSIONS must be between 1 and 10000, got: 10001",
      "  - MAX_REQUESTS_PER_MINUTE must be between 1 and 1000, got: 1001",
      "  - OAUTH_REGISTER_RATE_LIMIT_PER_HOUR must be an integer between 1 and 1000, got: 1.5",
      "  - PORT must be between 1 and 65535, got: 70000",
    ]);
  });

  it("warns, but does not fail, for a timeout below 60 seconds", () => {
    process.env.SESSION_TIMEOUT_SECONDS = "30";
    const out = runValidation();
    assert.equal(out.exitCode, undefined);
    assert.deepEqual(out.warn, [
      "SESSION_TIMEOUT_SECONDS=30 is below recommended minimum of 60 seconds. Only use low values for testing.",
    ]);
    assert.deepEqual(out.info, ["Configuration validation passed"]);
  });

  it("fails a non-numeric timeout without the low-value warning (NaN < 60 is false)", () => {
    process.env.SESSION_TIMEOUT_SECONDS = "abc";
    const out = runValidation();
    assert.equal(out.exitCode, 1);
    assert.deepEqual(out.warn, []);
    assert.deepEqual(out.error.slice(1), [
      "  - SESSION_TIMEOUT_SECONDS must be between 1 and 86400 seconds, got: abc",
    ]);
  });

  it("keeps Number.parseInt leniency for MAX_SESSIONS (numeric prefix passes)", () => {
    process.env.MAX_SESSIONS = "5abc";
    const out = runValidation();
    assert.equal(out.exitCode, undefined);
    assert.deepEqual(out.info, ["Configuration validation passed"]);
  });

  it("skips empty-string limits, as the falsy check always did", () => {
    process.env.MAX_SESSIONS = "";
    process.env.MAX_REQUESTS_PER_MINUTE = "";
    process.env.OAUTH_REGISTER_RATE_LIMIT_PER_HOUR = "";
    const out = runValidation();
    assert.equal(out.exitCode, undefined);
  });

  it("keeps Number() semantics for OAUTH_REGISTER_RATE_LIMIT_PER_HOUR (hex and exponent forms pass)", () => {
    process.env.OAUTH_REGISTER_RATE_LIMIT_PER_HOUR = "0x10";
    assert.equal(runValidation().exitCode, undefined);
    process.env.OAUTH_REGISTER_RATE_LIMIT_PER_HOUR = "1e2";
    assert.equal(runValidation().exitCode, undefined);
  });

  it("reads MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL at call time for the HTTPS rule", () => {
    process.env.GITLAB_MCP_OAUTH = "true";
    process.env.MCP_SERVER_URL = "http://mcp.example.com";
    process.env.GITLAB_API_URL = "https://gitlab.example.com";
    process.env.GITLAB_OAUTH_APP_ID = "placeholder-app-id";

    const rejected = runValidation();
    assert.equal(rejected.exitCode, 1);
    assert.ok(
      rejected.error.includes(
        "  - MCP_SERVER_URL must use HTTPS in production (set MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=true for local dev)"
      ),
      `expected HTTPS error, got: ${JSON.stringify(rejected.error)}`
    );

    process.env.MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL = "true";
    const allowed = runValidation();
    assert.equal(allowed.exitCode, undefined);
    assert.deepEqual(allowed.info, ["Configuration validation passed"]);
  });
});

describe("call-time env getters in config.ts", () => {
  it("getMaxSessions parses MAX_SESSIONS with a default of 1000, read on each call", () => {
    assert.equal(getMaxSessions(), 1000);
    process.env.MAX_SESSIONS = "250";
    assert.equal(getMaxSessions(), 250);
  });

  it("getMaxRequestsPerMinute parses with a default of 60, and an empty value uses the default", () => {
    assert.equal(getMaxRequestsPerMinute(), 60);
    process.env.MAX_REQUESTS_PER_MINUTE = "";
    assert.equal(getMaxRequestsPerMinute(), 60);
    process.env.MAX_REQUESTS_PER_MINUTE = "5";
    assert.equal(getMaxRequestsPerMinute(), 5);
  });

  it("getOauthRegisterRateLimitPerHour falls back to 20 for unset, zero, fractional, or negative values", () => {
    assert.equal(getOauthRegisterRateLimitPerHour(), 20);
    for (const raw of ["0", "2.5", "-1"]) {
      process.env.OAUTH_REGISTER_RATE_LIMIT_PER_HOUR = raw;
      assert.equal(getOauthRegisterRateLimitPerHour(), 20, `raw=${raw}`);
    }
    process.env.OAUTH_REGISTER_RATE_LIMIT_PER_HOUR = "7";
    assert.equal(getOauthRegisterRateLimitPerHour(), 7);
  });

  it("getGitlabGraphqlUrlOverride returns the raw env value, including empty", () => {
    assert.equal(getGitlabGraphqlUrlOverride(), undefined);
    process.env.GITLAB_GRAPHQL_URL = "https://graphql.example.com/api/graphql";
    assert.equal(getGitlabGraphqlUrlOverride(), "https://graphql.example.com/api/graphql");
    process.env.GITLAB_GRAPHQL_URL = "";
    assert.equal(getGitlabGraphqlUrlOverride(), "");
  });
});
